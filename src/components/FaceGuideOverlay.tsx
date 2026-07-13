import type { FaceLandmarkerResult, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import {
  getEyeMetrics,
  getFaceBoxMetrics,
  getHeadRollDegrees,
  getHeadYawIndex,
} from "../lib/landmarks";

export type FaceGuideStatus = {
  ok: boolean;
  messages: string[];
  faceDetected: boolean;
  faceCentered: boolean;
  faceSizeOk: boolean;
  headPoseOk: boolean;
  landmarksOk: boolean;
};

export type FaceGuideHandle = {
  updateFrame: (result: FaceLandmarkerResult) => FaceGuideStatus;
};

type FaceGuideOverlayProps = {
  onStatusChange?: (status: FaceGuideStatus) => void;
};

const THRESHOLDS = {
  centerTolerance: 0.15,
  minFaceWidthRatio: 0.28,
  maxFaceWidthRatio: 0.65,
  maxRollDegrees: 18,
  maxYawIndex: 0.18,
  requiredConsecutiveDetectFrames: 5,
};

const MIN_EXPECTED_LANDMARKS = 468;

const IDLE_STATUS: FaceGuideStatus = {
  ok: false,
  messages: ["顔を枠の中に入れてください"],
  faceDetected: false,
  faceCentered: false,
  faceSizeOk: false,
  headPoseOk: false,
  landmarksOk: false,
};

function evaluateFrame(
  result: FaceLandmarkerResult,
  detectionStreakRef: { current: number }
): FaceGuideStatus {
  const landmarks: NormalizedLandmark[] | undefined = result.faceLandmarks[0];
  const landmarksOk = (landmarks?.length ?? 0) >= MIN_EXPECTED_LANDMARKS;
  const detectedThisFrame = landmarksOk;

  detectionStreakRef.current = detectedThisFrame
    ? detectionStreakRef.current + 1
    : 0;
  const faceDetected =
    detectionStreakRef.current >= THRESHOLDS.requiredConsecutiveDetectFrames;

  if (!landmarksOk || !landmarks) {
    return { ...IDLE_STATUS, faceDetected };
  }

  const faceBox = getFaceBoxMetrics(landmarks);
  const eyeMetrics = getEyeMetrics(landmarks);
  const roll = getHeadRollDegrees(eyeMetrics);
  const yaw = getHeadYawIndex(faceBox, eyeMetrics);

  const faceCentered =
    Math.abs(faceBox.centerX - 0.5) <= THRESHOLDS.centerTolerance &&
    Math.abs(faceBox.centerY - 0.5) <= THRESHOLDS.centerTolerance;
  const faceSizeOk =
    faceBox.width >= THRESHOLDS.minFaceWidthRatio &&
    faceBox.width <= THRESHOLDS.maxFaceWidthRatio;
  const headPoseOk =
    Math.abs(roll) <= THRESHOLDS.maxRollDegrees &&
    Math.abs(yaw) <= THRESHOLDS.maxYawIndex;

  const ok =
    faceDetected && faceCentered && faceSizeOk && headPoseOk && landmarksOk;

  const messages: string[] = [];
  if (!faceDetected || !landmarksOk) {
    messages.push("顔を枠の中に入れてください");
  } else if (faceBox.width < THRESHOLDS.minFaceWidthRatio) {
    messages.push("もう少しカメラに近づいてください");
  } else if (faceBox.width > THRESHOLDS.maxFaceWidthRatio) {
    messages.push("もう少しカメラから離れてください");
  } else if (!faceCentered) {
    messages.push("顔を枠の中に入れてください");
  } else if (!headPoseOk) {
    messages.push("正面を向いてください");
  } else {
    messages.push("その位置でOKです");
  }

  return {
    ok,
    messages,
    faceDetected,
    faceCentered,
    faceSizeOk,
    headPoseOk,
    landmarksOk,
  };
}

const FaceGuideOverlay = forwardRef<FaceGuideHandle, FaceGuideOverlayProps>(
  function FaceGuideOverlay({ onStatusChange }, ref) {
    const [status, setStatus] = useState<FaceGuideStatus>(IDLE_STATUS);
    const detectionStreakRef = useRef(0);

    useImperativeHandle(ref, () => ({
      updateFrame(result) {
        const next = evaluateFrame(result, detectionStreakRef);
        setStatus(next);
        onStatusChange?.(next);
        return next;
      },
    }));

    const colorClass = status.ok
      ? "face-guide-ok"
      : status.faceDetected
        ? "face-guide-warn"
        : "face-guide-ng";

    return <div className={`face-guide-frame ${colorClass}`} />;
  }
);

export default FaceGuideOverlay;
