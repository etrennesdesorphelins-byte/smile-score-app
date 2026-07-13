import {
  FaceLandmarker,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type RefObject,
} from "react";
import {
  detectFace,
  disposeFaceLandmarker,
  drawFaceMesh,
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

    useImperativeHandle(ref, () => canvasRef.current as HTMLCanvasElement);

    const onFrameRef = useRef(onFrame);
    onFrameRef.current = onFrame;
    const onStatusChangeRef = useRef(onStatusChange);
    onStatusChangeRef.current = onStatusChange;

    useEffect(() => {
      let rafId = 0;
      let cancelled = false;
      let lastTimestampMs = -1;

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
          // A consumer's onFrame callback must never be able to kill this
          // loop: an uncaught exception here would skip the
          // requestAnimationFrame call below and stop detection silently.
          try {
            onFrameRef.current?.(result);
          } catch (err) {
            console.error(err);
          }
        }

        rafId = requestAnimationFrame(() => loop(landmarker));
      }

      initializeFaceLandmarker()
        .then((landmarker) => {
          if (cancelled) return;
          onStatusChangeRef.current?.("ready");
          rafId = requestAnimationFrame(() => loop(landmarker));
        })
        .catch(() => {
          if (!cancelled) onStatusChangeRef.current?.("error");
        });

      return () => {
        cancelled = true;
        cancelAnimationFrame(rafId);
        void disposeFaceLandmarker().catch(console.error);
      };
    }, [videoRef]);

    return <canvas ref={canvasRef} className="landmark-canvas" />;
  }
);

export default LandmarkCanvas;

function drawResult(canvas: HTMLCanvasElement, result: FaceLandmarkerResult) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const landmarks of result.faceLandmarks) {
    drawFaceMesh(ctx, landmarks);
  }

  ctx.restore();
}
