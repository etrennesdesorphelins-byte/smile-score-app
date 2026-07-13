import type { Point3D } from "../lib/landmarks";

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
