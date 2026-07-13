import {
  DrawingUtils,
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

// Built with import.meta.env.BASE_URL (Vite's configured `base`) rather than
// hardcoded root-relative paths, so these resolve correctly both locally and
// when deployed under a GitHub Pages project subpath.
const WASM_BASE_URL = `${import.meta.env.BASE_URL}mediapipe/wasm`;
const MODEL_ASSET_PATH = `${import.meta.env.BASE_URL}mediapipe/face_landmarker.task`;

let faceLandmarkerPromise: Promise<FaceLandmarker> | null = null;

async function createFaceLandmarker(
  delegate: "GPU" | "CPU"
): Promise<FaceLandmarker> {
  const filesetResolver = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
  return FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: MODEL_ASSET_PATH,
      delegate,
    },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });
}

async function createFaceLandmarkerWithFallback(): Promise<FaceLandmarker> {
  try {
    return await createFaceLandmarker("GPU");
  } catch (err) {
    console.warn("GPU delegate initialization failed. Retrying with CPU.", err);
    return createFaceLandmarker("CPU");
  }
}

export function initializeFaceLandmarker(): Promise<FaceLandmarker> {
  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise = createFaceLandmarkerWithFallback();
  }
  return faceLandmarkerPromise;
}

export function detectFace(
  faceLandmarker: FaceLandmarker,
  video: HTMLVideoElement,
  timestampMs: number
): FaceLandmarkerResult {
  return faceLandmarker.detectForVideo(video, timestampMs);
}

export async function disposeFaceLandmarker(): Promise<void> {
  if (!faceLandmarkerPromise) return;
  const pending = faceLandmarkerPromise;
  faceLandmarkerPromise = null;
  const landmarker = await pending;
  landmarker.close();
}

// Shared face mesh drawing style, used both for the live overlay
// (LandmarkCanvas) and for annotating a still photo (ResultPage).
export function drawFaceMesh(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[]
): void {
  const drawingUtils = new DrawingUtils(ctx);
  drawingUtils.drawConnectors(
    landmarks,
    FaceLandmarker.FACE_LANDMARKS_TESSELATION,
    { color: "#C0C0C070", lineWidth: 1 }
  );
  drawingUtils.drawConnectors(
    landmarks,
    FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
    { color: "#30FF30", lineWidth: 2 }
  );
  drawingUtils.drawConnectors(
    landmarks,
    FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
    { color: "#30FF30", lineWidth: 1.5 }
  );
  drawingUtils.drawConnectors(
    landmarks,
    FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
    { color: "#30FF30", lineWidth: 1.5 }
  );
  drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, {
    color: "#E0E000",
    lineWidth: 1.5,
  });
}
