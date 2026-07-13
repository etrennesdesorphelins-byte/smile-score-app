import {
  DrawingUtils,
  FaceLandmarker,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  detectFace,
  disposeFaceLandmarker,
  initializeFaceLandmarker,
} from "../lib/mediapipe";

export type LandmarkDetectionStatus = "loading" | "ready" | "error";

type LandmarkCanvasProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  onFrame?: (result: FaceLandmarkerResult) => void;
  onStatusChange?: (status: LandmarkDetectionStatus) => void;
};

const LandmarkCanvas = forwardRef<HTMLCanvasElement, LandmarkCanvasProps>(
  function LandmarkCanvas({ videoRef, onFrame, onStatusChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [status, setStatus] = useState<LandmarkDetectionStatus>("loading");
    const [faceDetected, setFaceDetected] = useState(false);

    useImperativeHandle(ref, () => canvasRef.current as HTMLCanvasElement);

    const onFrameRef = useRef(onFrame);
    onFrameRef.current = onFrame;
    const onStatusChangeRef = useRef(onStatusChange);
    onStatusChangeRef.current = onStatusChange;

    useEffect(() => {
      let rafId = 0;
      let cancelled = false;
      let lastTimestampMs = -1;

      function setDetectionStatus(next: LandmarkDetectionStatus) {
        setStatus(next);
        onStatusChangeRef.current?.(next);
      }

      function loop(landmarker: FaceLandmarker) {
        if (cancelled) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video && canvas && video.readyState >= 2) {
          if (
            canvas.width !== video.videoWidth ||
            canvas.height !== video.videoHeight
          ) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }

          const timestampMs = Math.max(
            performance.now(),
            lastTimestampMs + 1
          );
          lastTimestampMs = timestampMs;

          const result = detectFace(landmarker, video, timestampMs);
          drawResult(canvas, result);
          setFaceDetected((result.faceLandmarks?.length ?? 0) > 0);
          onFrameRef.current?.(result);
        }

        rafId = requestAnimationFrame(() => loop(landmarker));
      }

      initializeFaceLandmarker()
        .then((landmarker) => {
          if (cancelled) return;
          setDetectionStatus("ready");
          rafId = requestAnimationFrame(() => loop(landmarker));
        })
        .catch(() => {
          if (!cancelled) setDetectionStatus("error");
        });

      return () => {
        cancelled = true;
        cancelAnimationFrame(rafId);
        void disposeFaceLandmarker().catch(console.error);
      };
    }, [videoRef]);

    return (
      <>
        <canvas ref={canvasRef} className="landmark-canvas" />
        {status === "error" && (
          <p className="landmark-status landmark-status-error">
            顔ランドマークモデルの読み込みに失敗しました。ネットワーク接続を確認してください。
          </p>
        )}
        {status === "ready" && (
          <p className="landmark-status">
            {faceDetected ? "顔を検出しています" : "顔が検出されていません"}
          </p>
        )}
      </>
    );
  }
);

export default LandmarkCanvas;

function drawResult(canvas: HTMLCanvasElement, result: FaceLandmarkerResult) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const drawingUtils = new DrawingUtils(ctx);
  for (const landmarks of result.faceLandmarks) {
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

  ctx.restore();
}
