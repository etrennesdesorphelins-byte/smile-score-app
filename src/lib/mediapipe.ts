import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";

const WASM_BASE_URL = "/mediapipe/wasm";
const MODEL_ASSET_PATH = "/mediapipe/face_landmarker.task";

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
