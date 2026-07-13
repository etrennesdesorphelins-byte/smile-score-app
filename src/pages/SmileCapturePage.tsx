import type { FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import CameraView from "../components/CameraView";
import CountdownOverlay from "../components/CountdownOverlay";
import FaceGuideOverlay, {
  type FaceGuideHandle,
  type FaceGuideStatus,
} from "../components/FaceGuideOverlay";
import LandmarkCanvas, {
  type LandmarkDetectionStatus,
} from "../components/LandmarkCanvas";
import { captureMirroredFrame } from "../lib/imageUtils";
import type { CaptureFrame, CaptureSession } from "../types/app";

type CaptureStage =
  | "guide"
  | "baseline-countdown"
  | "baseline-capturing"
  | "baseline-done"
  | "smile-countdown"
  | "smile-capturing"
  | "smile-review"
  | "done";

const COUNTDOWN_SECONDS = 3;
const CAPTURE_DURATION_MS = 2000;

export default function SmileCapturePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const faceGuideRef = useRef<FaceGuideHandle>(null);
  const faceGuideStatusRef = useRef<FaceGuideStatus | null>(null);

  const captureBufferRef = useRef<CaptureFrame[]>([]);
  const captureStartRef = useRef(0);
  const captureTargetRef = useRef<"baseline" | "smile" | null>(null);
  const captureTimeoutRef = useRef<number | null>(null);
  // Overwritten on each frame that satisfies the guide conditions, so the
  // representative image reflects a well-positioned moment without keeping
  // every frame's image (each capture is an expensive, sizeable data URL).
  const lastValidImageRef = useRef<string | null>(null);

  const [detectionStatus, setDetectionStatus] =
    useState<LandmarkDetectionStatus>("loading");
  const [faceGuideStatus, setFaceGuideStatus] =
    useState<FaceGuideStatus | null>(null);
  const [stage, setStage] = useState<CaptureStage>("guide");
  const [baselineCapture, setBaselineCapture] =
    useState<CaptureSession | null>(null);
  const [smileCapture, setSmileCapture] = useState<CaptureSession | null>(
    null
  );
  const [baselineAttempt, setBaselineAttempt] = useState(0);
  const [smileAttempt, setSmileAttempt] = useState(0);
  const [captureError, setCaptureError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      clearCaptureTimeout();
      captureTargetRef.current = null;
    };
  }, []);

  function clearCaptureTimeout() {
    if (captureTimeoutRef.current !== null) {
      window.clearTimeout(captureTimeoutRef.current);
      captureTimeoutRef.current = null;
    }
  }

  function cancelCapture(message: string, nextStage: CaptureStage) {
    clearCaptureTimeout();
    captureTargetRef.current = null;
    captureBufferRef.current = [];
    setCaptureError(message);
    setStage(nextStage);
  }

  function handleFaceGuideStatusChange(status: FaceGuideStatus) {
    faceGuideStatusRef.current = status;
    setFaceGuideStatus(status);
  }

  function finalizeCapture() {
    const target = captureTargetRef.current;
    captureTargetRef.current = null;
    clearCaptureTimeout();

    if (!target) return;

    try {
      const representativeImageDataUrl = lastValidImageRef.current;
      if (!representativeImageDataUrl) {
        throw new Error("撮影中に顔の位置条件を満たしたフレームがありませんでした");
      }

      const session: CaptureSession = {
        frames: [...captureBufferRef.current],
        representativeImageDataUrl,
      };
      if (target === "baseline") {
        setBaselineCapture(session);
        setStage("baseline-done");
      } else {
        setSmileCapture(session);
        setStage("smile-review");
      }
    } catch (err) {
      setCaptureError(
        err instanceof Error ? err.message : "撮影に失敗しました"
      );
      setStage(target === "baseline" ? "guide" : "baseline-done");
    }
  }

  function handleFrame(result: FaceLandmarkerResult) {
    faceGuideRef.current?.updateFrame(result);

    if (captureTargetRef.current === null) return;

    const video = videoRef.current;
    if (!video) return;

    const elapsedMs = performance.now() - captureStartRef.current;
    const landmarks = result.faceLandmarks[0];
    const guideStatus = faceGuideStatusRef.current;
    const guideOk = guideStatus?.ok === true;

    if (guideOk) {
      try {
        lastValidImageRef.current = captureMirroredFrame(video);
      } catch {
        // Skip this frame's snapshot; the capture can still finish using an
        // image from an earlier or later valid frame. A thrown error here
        // must never escape into LandmarkCanvas's animation-frame loop, or
        // detection stops silently for the rest of the page's lifetime.
      }
    }

    captureBufferRef.current.push({
      timestampMs: elapsedMs,
      landmarks: landmarks ? landmarks.map(({ x, y, z }) => ({ x, y, z })) : [],
      faceDetected: guideStatus?.faceDetected ?? false,
      landmarksOk: guideStatus?.landmarksOk ?? false,
      guideOk,
    });
  }

  function requestBaselineCapture() {
    if (!faceGuideStatusRef.current?.ok) return;
    setCaptureError(null);
    setBaselineAttempt((n) => n + 1);
    setStage("baseline-countdown");
  }

  function beginBaselineCapturing() {
    if (!faceGuideStatusRef.current?.ok) {
      cancelCapture("顔を枠の中に入れてから撮影してください", "guide");
      return;
    }
    captureBufferRef.current = [];
    lastValidImageRef.current = null;
    captureStartRef.current = performance.now();
    captureTargetRef.current = "baseline";
    captureTimeoutRef.current = window.setTimeout(
      finalizeCapture,
      CAPTURE_DURATION_MS
    );
    setStage("baseline-capturing");
  }

  function retakeBaseline() {
    clearCaptureTimeout();
    captureTargetRef.current = null;
    setBaselineCapture(null);
    setCaptureError(null);
    setBaselineAttempt((n) => n + 1);
    setStage("baseline-countdown");
  }

  function requestSmileCapture() {
    if (!faceGuideStatusRef.current?.ok) return;
    setCaptureError(null);
    setSmileAttempt((n) => n + 1);
    setStage("smile-countdown");
  }

  function beginSmileCapturing() {
    if (!faceGuideStatusRef.current?.ok) {
      cancelCapture("顔を枠の中に入れてから撮影してください", "baseline-done");
      return;
    }
    captureBufferRef.current = [];
    lastValidImageRef.current = null;
    captureStartRef.current = performance.now();
    captureTargetRef.current = "smile";
    captureTimeoutRef.current = window.setTimeout(
      finalizeCapture,
      CAPTURE_DURATION_MS
    );
    setStage("smile-capturing");
  }

  function retakeSmile() {
    clearCaptureTimeout();
    captureTargetRef.current = null;
    setSmileCapture(null);
    setCaptureError(null);
    setSmileAttempt((n) => n + 1);
    setStage("smile-countdown");
  }

  function confirmSmile() {
    setStage("done");
  }

  return (
    <div className="app-shell">
      <h1>Smile Score Demo</h1>
      <p>笑顔採点</p>

      <div className="camera-stage">
        <div className="camera-frame">
          <CameraView ref={videoRef} />
          <LandmarkCanvas
            videoRef={videoRef}
            onFrame={handleFrame}
            onStatusChange={setDetectionStatus}
          />
          <FaceGuideOverlay
            ref={faceGuideRef}
            onStatusChange={handleFaceGuideStatusChange}
          />
          {stage === "baseline-countdown" && (
            <CountdownOverlay
              key={`baseline-${baselineAttempt}`}
              seconds={COUNTDOWN_SECONDS}
              onComplete={beginBaselineCapturing}
            />
          )}
          {stage === "smile-countdown" && (
            <CountdownOverlay
              key={`smile-${smileAttempt}`}
              seconds={COUNTDOWN_SECONDS}
              onComplete={beginSmileCapturing}
            />
          )}
        </div>

        {detectionStatus === "loading" && (
          <p className="landmark-status">
            顔ランドマークモデルを読み込んでいます...
          </p>
        )}
        {detectionStatus === "error" && (
          <p className="landmark-status landmark-status-error">
            顔ランドマークモデルの読み込みに失敗しました。ネットワーク接続を確認してください。
          </p>
        )}
        {faceGuideStatus && (
          <p className="face-guide-message">{faceGuideStatus.messages[0]}</p>
        )}
      </div>

      {captureError && <p className="recording-error">{captureError}</p>}

      {stage === "guide" && (
        <div className="capture-controls">
          <button
            type="button"
            onClick={requestBaselineCapture}
            disabled={!faceGuideStatus?.ok}
          >
            基準顔を撮影
          </button>
        </div>
      )}

      {stage === "baseline-capturing" && (
        <p className="capture-indicator">● 基準顔を撮影中</p>
      )}

      {stage === "baseline-done" && (
        <div className="capture-controls">
          <p className="capture-success">基準顔の撮影に成功しました</p>
          <button type="button" onClick={retakeBaseline}>
            基準顔を撮り直す
          </button>
          <button
            type="button"
            onClick={requestSmileCapture}
            disabled={!faceGuideStatus?.ok}
          >
            笑顔を採点
          </button>
        </div>
      )}

      {stage === "smile-capturing" && (
        <p className="capture-indicator">● 笑顔を撮影中</p>
      )}

      {stage === "smile-review" && smileCapture && (
        <div className="capture-review">
          <img
            src={smileCapture.representativeImageDataUrl}
            alt="笑顔の代表フレーム"
            className="capture-review-image"
          />
          <div className="capture-controls">
            <button type="button" onClick={retakeSmile}>
              撮り直す
            </button>
            <button type="button" onClick={confirmSmile}>
              この画像で採点する
            </button>
          </div>
        </div>
      )}

      {stage === "done" && baselineCapture && smileCapture && (
        <div className="capture-review">
          <p className="capture-success">
            撮影が完了しました。Smile Scoreの算出は今後のフェーズで実装予定です。
          </p>
          <div className="capture-done-images">
            <div>
              <p>基準顔</p>
              <img
                src={baselineCapture.representativeImageDataUrl}
                alt="基準顔"
                className="capture-review-image"
              />
            </div>
            <div>
              <p>笑顔</p>
              <img
                src={smileCapture.representativeImageDataUrl}
                alt="笑顔"
                className="capture-review-image"
              />
            </div>
          </div>
          <div className="capture-controls">
            <button type="button" onClick={retakeSmile}>
              笑顔を撮り直す
            </button>
          </div>
        </div>
      )}

      <p className="back-link">
        <Link to="/">ホームへ戻る</Link>
      </p>
    </div>
  );
}
