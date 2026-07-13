import {
  calculateDistance,
  getEyeBoxMetrics,
  getFaceBoxMetrics,
  getMouthBoxMetrics,
  getMouthCornerPoints,
  type Point3D,
} from "./landmarks";
import type { CaptureFrame, CaptureSession } from "../types/app";

export type SmileScoreResult = {
  total: number;
  mouthCorner: number;
  mouthWidth: number;
  cheekEye: number;
  symmetry: number;
  stability: number;
  teeth: number;
};

export type BaselineFeatures = {
  faceHeight: number;
  mouthWidth: number;
  mouthCornerLeftY: number;
  mouthCornerRightY: number;
  eyeHeightLeft: number;
  eyeHeightRight: number;
  lowerEyelidYLeft: number;
  lowerEyelidYRight: number;
};

type FrameSmileMetrics = {
  mouthCornerScore: number;
  mouthWidthScore: number;
  cheekEyeScore: number;
  symmetryScore: number;
};

// These targets are initial estimates (matching the ranges suggested in the
// technical proposal) and are expected to need calibration against real
// smiles during pre-event testing.
const TARGET_MOUTH_LIFT = 0.08;
const TARGET_MOUTH_EXPANSION = 0.2;
const TARGET_CHEEK_LIFT = 0.03;
const TARGET_EYE_NARROWING = 0.15;
const MAX_ALLOWED_ASYMMETRY = 0.05;
const MAX_ALLOWED_SCORE_STD_DEV = 12;
const MIN_EXPECTED_LANDMARKS = 468;

const MAX_SCORES = {
  mouthCorner: 25,
  mouthWidth: 20,
  cheekEye: 25,
  symmetry: 15,
  stability: 10,
  teeth: 5,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function computeBaselineFeatures(
  session: CaptureSession
): BaselineFeatures {
  const validFrames = session.frames.filter(
    (frame) => frame.guideOk && frame.landmarks.length >= MIN_EXPECTED_LANDMARKS
  );
  if (validFrames.length === 0) {
    throw new Error("基準顔から有効なフレームを取得できませんでした");
  }

  const faceHeights: number[] = [];
  const mouthWidths: number[] = [];
  const mouthCornerLeftYs: number[] = [];
  const mouthCornerRightYs: number[] = [];
  const eyeHeightLefts: number[] = [];
  const eyeHeightRights: number[] = [];
  const lowerEyelidYLefts: number[] = [];
  const lowerEyelidYRights: number[] = [];

  for (const frame of validFrames) {
    const landmarks = frame.landmarks;
    const faceBox = getFaceBoxMetrics(landmarks);
    const eyeBox = getEyeBoxMetrics(landmarks);
    const mouth = getMouthCornerPoints(landmarks);

    faceHeights.push(faceBox.height);
    mouthWidths.push(calculateDistance(mouth.left, mouth.right));
    mouthCornerLeftYs.push(mouth.left.y);
    mouthCornerRightYs.push(mouth.right.y);
    eyeHeightLefts.push(eyeBox.left.height);
    eyeHeightRights.push(eyeBox.right.height);
    lowerEyelidYLefts.push(eyeBox.left.maxY);
    lowerEyelidYRights.push(eyeBox.right.maxY);
  }

  return {
    faceHeight: median(faceHeights),
    mouthWidth: median(mouthWidths),
    mouthCornerLeftY: median(mouthCornerLeftYs),
    mouthCornerRightY: median(mouthCornerRightYs),
    eyeHeightLeft: median(eyeHeightLefts),
    eyeHeightRight: median(eyeHeightRights),
    lowerEyelidYLeft: median(lowerEyelidYLefts),
    lowerEyelidYRight: median(lowerEyelidYRights),
  };
}

// Computes the four landmark-only sub-scores for a single frame against the
// baseline. Cheap and synchronous, so it can run live during capture (to
// pick the best-scoring representative frame) as well as at final scoring.
export function computeFrameSmileMetrics(
  landmarks: Point3D[],
  baseline: BaselineFeatures
): FrameSmileMetrics {
  const faceHeight = baseline.faceHeight || 1;
  const eyeBox = getEyeBoxMetrics(landmarks);
  const mouth = getMouthCornerPoints(landmarks);

  // 口角挙上：25点（画像座標はyが小さいほど上方向）
  const liftLeft = (baseline.mouthCornerLeftY - mouth.left.y) / faceHeight;
  const liftRight = (baseline.mouthCornerRightY - mouth.right.y) / faceHeight;
  const avgLift = (liftLeft + liftRight) / 2;
  const mouthCornerScore =
    clamp(avgLift / TARGET_MOUTH_LIFT, 0, 1) * MAX_SCORES.mouthCorner;

  // 口幅拡大：20点
  const mouthWidth = calculateDistance(mouth.left, mouth.right);
  const widthRatio =
    baseline.mouthWidth > 0 ? mouthWidth / baseline.mouthWidth : 1;
  const mouthWidthScore =
    clamp((widthRatio - 1) / TARGET_MOUTH_EXPANSION, 0, 1) *
    MAX_SCORES.mouthWidth;

  // 頬・目周囲：25点
  const cheekLiftLeft =
    (baseline.lowerEyelidYLeft - eyeBox.left.maxY) / faceHeight;
  const cheekLiftRight =
    (baseline.lowerEyelidYRight - eyeBox.right.maxY) / faceHeight;
  const cheekLiftIndex = clamp(
    (cheekLiftLeft + cheekLiftRight) / 2 / TARGET_CHEEK_LIFT,
    0,
    1
  );

  const eyeNarrowLeft =
    baseline.eyeHeightLeft > 0
      ? 1 - eyeBox.left.height / baseline.eyeHeightLeft
      : 0;
  const eyeNarrowRight =
    baseline.eyeHeightRight > 0
      ? 1 - eyeBox.right.height / baseline.eyeHeightRight
      : 0;
  const eyeNarrowIndex = clamp(
    (eyeNarrowLeft + eyeNarrowRight) / 2 / TARGET_EYE_NARROWING,
    0,
    1
  );

  const cheekEyeIndex = cheekLiftIndex * 0.6 + eyeNarrowIndex * 0.4;
  const cheekEyeScore = clamp(cheekEyeIndex, 0, 1) * MAX_SCORES.cheekEye;

  // 左右対称性：15点（基準顔との差分の左右差を用いる）
  const liftAsymmetry = Math.abs(liftLeft - liftRight);
  const cheekAsymmetry = Math.abs(cheekLiftLeft - cheekLiftRight);
  const eyeAsymmetry = Math.abs(eyeNarrowLeft - eyeNarrowRight);
  const asymmetryIndex = (liftAsymmetry + cheekAsymmetry + eyeAsymmetry) / 3;
  const symmetryScore =
    (1 - clamp(asymmetryIndex / MAX_ALLOWED_ASYMMETRY, 0, 1)) *
    MAX_SCORES.symmetry;

  return { mouthCornerScore, mouthWidthScore, cheekEyeScore, symmetryScore };
}

function computeStabilityScore(
  allFrames: CaptureFrame[],
  provisionalScores: number[]
): number {
  if (allFrames.length === 0) return 0;

  const detectionRate =
    allFrames.filter((f) => f.faceDetected).length / allFrames.length;
  const detectionComponent = clamp(detectionRate, 0, 1) * 3;

  const guideOkRate =
    allFrames.filter((f) => f.guideOk).length / allFrames.length;
  const guideComponent = clamp(guideOkRate, 0, 1) * 3;

  const variationComponent =
    provisionalScores.length >= 2
      ? (1 - clamp(stdDev(provisionalScores) / MAX_ALLOWED_SCORE_STD_DEV, 0, 1)) * 4
      : 0;

  return detectionComponent + guideComponent + variationComponent;
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    img.src = dataUrl;
  });
}

// Approximates the "upper interior mouth" region as the top half of the
// lips' landmark bounding box, rather than clipping a precise polygon. Given
// this score is explicitly a low-weight, best-effort supplementary signal
// (see requirements 5.5.6), the extra complexity of exact polygon masking
// isn't warranted.
const BRIGHTNESS_THRESHOLD = 170;
const TEETH_RATIO_NONE = 0.02;
const TEETH_RATIO_SLIGHT = 0.06;
const TEETH_RATIO_IDEAL_MAX = 0.22;
const TEETH_RATIO_EXCESS = 0.4;

function scoreFromTeethRatio(ratio: number): number {
  if (ratio <= 0) return 0;
  if (ratio < TEETH_RATIO_NONE) {
    return clamp(ratio / TEETH_RATIO_NONE, 0, 1);
  }
  if (ratio < TEETH_RATIO_SLIGHT) {
    return 3;
  }
  if (ratio <= TEETH_RATIO_IDEAL_MAX) {
    return MAX_SCORES.teeth;
  }
  const excess = clamp(
    (ratio - TEETH_RATIO_IDEAL_MAX) / (TEETH_RATIO_EXCESS - TEETH_RATIO_IDEAL_MAX),
    0,
    1
  );
  return 3 - excess;
}

export async function computeTeethScore(
  imageDataUrl: string,
  landmarks: Point3D[]
): Promise<number> {
  const mouthBox = getMouthBoxMetrics(landmarks);
  const img = await loadImage(imageDataUrl);

  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const mirroredMinX = 1 - mouthBox.maxX;
  const x = Math.round(mirroredMinX * width);
  const yTop = Math.round(mouthBox.minY * height);
  const regionWidth = Math.max(1, Math.round(mouthBox.width * width));
  const regionHeight = Math.max(1, Math.round((mouthBox.height / 2) * height));

  if (regionWidth <= 0 || regionHeight <= 0) return 0;

  const canvas = document.createElement("canvas");
  canvas.width = regionWidth;
  canvas.height = regionHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;

  ctx.drawImage(
    img,
    x,
    yTop,
    regionWidth,
    regionHeight,
    0,
    0,
    regionWidth,
    regionHeight
  );
  const imageData = ctx.getImageData(0, 0, regionWidth, regionHeight);

  let brightCount = 0;
  const totalPixels = regionWidth * regionHeight;
  for (let i = 0; i < imageData.data.length; i += 4) {
    const brightness =
      (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
    if (brightness >= BRIGHTNESS_THRESHOLD) brightCount++;
  }

  const teethRatio = totalPixels > 0 ? brightCount / totalPixels : 0;
  return scoreFromTeethRatio(teethRatio);
}

function clampRound(value: number, max: number): number {
  return Math.round(clamp(value, 0, max));
}

export async function computeSmileScore(
  baseline: BaselineFeatures,
  smileSession: CaptureSession
): Promise<SmileScoreResult> {
  const guideOkFrames = smileSession.frames.filter(
    (frame) => frame.guideOk && frame.landmarks.length >= MIN_EXPECTED_LANDMARKS
  );
  if (guideOkFrames.length === 0) {
    throw new Error("笑顔の撮影から有効なフレームを取得できませんでした");
  }

  const evaluated = guideOkFrames.map((frame) => {
    const metrics = computeFrameSmileMetrics(frame.landmarks, baseline);
    const provisional =
      metrics.mouthCornerScore +
      metrics.mouthWidthScore +
      metrics.cheekEyeScore +
      metrics.symmetryScore;
    return { frame, metrics, provisional };
  });

  const best = evaluated.reduce((a, b) => (b.provisional > a.provisional ? b : a));

  const stability = computeStabilityScore(
    smileSession.frames,
    evaluated.map((e) => e.provisional)
  );
  const teeth = await computeTeethScore(
    smileSession.representativeImageDataUrl,
    best.frame.landmarks
  );

  const mouthCorner = clampRound(best.metrics.mouthCornerScore, MAX_SCORES.mouthCorner);
  const mouthWidth = clampRound(best.metrics.mouthWidthScore, MAX_SCORES.mouthWidth);
  const cheekEye = clampRound(best.metrics.cheekEyeScore, MAX_SCORES.cheekEye);
  const symmetry = clampRound(best.metrics.symmetryScore, MAX_SCORES.symmetry);
  const stabilityScore = clampRound(stability, MAX_SCORES.stability);
  const teethScore = clampRound(teeth, MAX_SCORES.teeth);

  return {
    total:
      mouthCorner + mouthWidth + cheekEye + symmetry + stabilityScore + teethScore,
    mouthCorner,
    mouthWidth,
    cheekEye,
    symmetry,
    stability: stabilityScore,
    teeth: teethScore,
  };
}
