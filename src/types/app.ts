import type { Point3D } from "../lib/landmarks";
import type { SmileScoreResult } from "../lib/scoring";

export type ResultLocationState = {
  scoreResult: SmileScoreResult;
  adviceMessages: string[];
  imageDataUrl: string;
};

export type CaptureFrame = {
  timestampMs: number;
  landmarks: Point3D[];
  faceDetected: boolean;
  landmarksOk: boolean;
  guideOk: boolean;
};

export type CaptureSession = {
  frames: CaptureFrame[];
  representativeImageDataUrl: string;
};
