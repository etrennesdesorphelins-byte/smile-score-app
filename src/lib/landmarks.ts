import { FaceLandmarker } from "@mediapipe/tasks-vision";

export type Point3D = {
  x: number;
  y: number;
  z: number;
};

export type FaceBoxMetrics = {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type EyeMetrics = {
  leftCenter: Point3D;
  rightCenter: Point3D;
};

type IndexConnection = { start: number; end: number };

function indicesFromConnectors(connectors: readonly IndexConnection[]): number[] {
  const indices = new Set<number>();
  for (const connection of connectors) {
    indices.add(connection.start);
    indices.add(connection.end);
  }
  return Array.from(indices);
}

// Collect the landmark indices from the SDK connector definitions so drawing
// and metric code use the same facial regions.
const FACE_OVAL_INDICES = indicesFromConnectors(
  FaceLandmarker.FACE_LANDMARKS_FACE_OVAL
);
const LEFT_EYE_INDICES = indicesFromConnectors(
  FaceLandmarker.FACE_LANDMARKS_LEFT_EYE
);
const RIGHT_EYE_INDICES = indicesFromConnectors(
  FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE
);
const MOUTH_INDICES = indicesFromConnectors(FaceLandmarker.FACE_LANDMARKS_LIPS);

export function calculateDistance(a: Point3D, b: Point3D): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function averagePoint(
  landmarks: readonly Point3D[],
  indices: readonly number[]
): Point3D {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const index of indices) {
    const point = landmarks[index];
    x += point.x;
    y += point.y;
    z += point.z;
  }
  const count = indices.length;
  return { x: x / count, y: y / count, z: z / count };
}

function boundingBox(
  landmarks: readonly Point3D[],
  indices: readonly number[]
): FaceBoxMetrics {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const index of indices) {
    const point = landmarks[index];
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function getFaceBoxMetrics(
  landmarks: readonly Point3D[]
): FaceBoxMetrics {
  return boundingBox(landmarks, FACE_OVAL_INDICES);
}

export function getEyeMetrics(
  landmarks: readonly Point3D[]
): EyeMetrics {
  return {
    leftCenter: averagePoint(landmarks, LEFT_EYE_INDICES),
    rightCenter: averagePoint(landmarks, RIGHT_EYE_INDICES),
  };
}

// Bounding box of each eye's landmark set. `.height` is the vertical eye
// opening (eyelid narrowing when smiling); `.maxY` is the lower-eyelid
// position, used as a cheek-lift proxy since MediaPipe has no dedicated
// "cheek" connector set to derive indices from.
export function getEyeBoxMetrics(
  landmarks: readonly Point3D[]
): { left: FaceBoxMetrics; right: FaceBoxMetrics } {
  return {
    left: boundingBox(landmarks, LEFT_EYE_INDICES),
    right: boundingBox(landmarks, RIGHT_EYE_INDICES),
  };
}

export function getMouthBoxMetrics(landmarks: readonly Point3D[]): FaceBoxMetrics {
  return boundingBox(landmarks, MOUTH_INDICES);
}

// MediaPipe's "left"/"right" naming is subject-relative (the subject's own
// left/right), which in an unmirrored camera image corresponds to the
// larger/smaller x coordinate respectively — consistent with LEFT_EYE /
// RIGHT_EYE sitting on the larger-x / smaller-x side of a frontal face.
export function getMouthCornerPoints(
  landmarks: readonly Point3D[]
): { left: Point3D; right: Point3D } {
  let left = landmarks[MOUTH_INDICES[0]];
  let right = landmarks[MOUTH_INDICES[0]];
  for (const index of MOUTH_INDICES) {
    const point = landmarks[index];
    if (point.x > left.x) left = point;
    if (point.x < right.x) right = point;
  }
  return { left, right };
}

export function getHeadRollDegrees(eyeMetrics: EyeMetrics): number {
  const dx = eyeMetrics.leftCenter.x - eyeMetrics.rightCenter.x;
  const dy = eyeMetrics.leftCenter.y - eyeMetrics.rightCenter.y;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

// Proxy for head yaw (facing away from the camera) that avoids relying on a
// single nose-tip landmark index: when the face turns, the eye-line midpoint
// shifts away from the horizontal center of the visible face oval.
export function getHeadYawIndex(
  faceBox: FaceBoxMetrics,
  eyeMetrics: EyeMetrics
): number {
  const eyeMidX = (eyeMetrics.leftCenter.x + eyeMetrics.rightCenter.x) / 2;
  if (faceBox.width === 0) return 0;
  return (eyeMidX - faceBox.centerX) / faceBox.width;
}
