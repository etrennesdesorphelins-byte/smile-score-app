import type { FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import CameraView from "../components/CameraView";
import CountdownOverlay from "../components/CountdownOverlay";
import FaceGuideOverlay, {
  type FaceGuideHandle,
  type FaceGuideStatus,
} from "../components/FaceGuideOverlay";
import LandmarkCanvas, {
  type LandmarkDetectionStatus,
} from "../components/LandmarkCanvas";
import { generateAdvice } from "../lib/advice";
import { captureMirroredFrame } from "../lib/imageUtils";
import type { Point3D } from "../lib/landmarks";
import {
  computeBaselineFeatures,
  computeFrameSmileMetrics,
  computeSmileScore,
  type BaselineFeatures,
} from "../lib/scoring";
import type {
  CaptureFrame,
  CaptureSession,
  ResultLocationState,
} from "../types/app";

type CaptureStage =
  | "guide"
  | "baseline-countdown"
  | "baseline-capturing"
  | "baseline-done"
  | "smile-countdown"
  | "smile-capturing"
  | "smile-review"
  | "scoring";

const COUNTDOWN_SECONDS = 3;
const CAPTURE_DURATION_MS = 2000;

export default function SmileCapturePage() {
  const navigate = useNavigate();
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
  // During smile capture only: the baseline features (computed once, right
  // before the countdown finishes) and the best provisional score seen so
  // far, so the kept image is the highest-scoring frame rather than simply
  // the last valid one.
  const baselineFeaturesRef = useRef<BaselineFeatures | null>(null);
  const bestProvisionalScoreRef = useRef(-Infinity);

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

  function captureImageSafely(video: HTMLVideoElement): string | null {
    try {
      return captureMirroredFrame(video);
    } catch {
      return null;
    }
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
    const currentGuideStatus = faceGuideRef.current?.updateFrame(result) ?? null;
    if (currentGuideStatus) {
      faceGuideStatusRef.current = currentGuideStatus;
    }

    const target = captureTargetRef.current;
    if (target === null) return;

    const video = videoRef.current;
    if (!video) return;

    const elapsedMs = performance.now() - captureStartRef.current;
    const rawLandmarks = result.faceLandmarks[0];
    const landmarks: Point3D[] = rawLandmarks
      ? rawLandmarks.map(({ x, y, z }) => ({ x, y, z }))
      : [];
    const guideStatus = currentGuideStatus ?? faceGuideStatusRef.current;
    const guideOk = guideStatus?.ok === true;

    if (guideOk && landmarks.length > 0) {
      const capturedImage = captureImageSafely(video);

      if (target === "baseline") {
        if (capturedImage) {
          lastValidImageRef.current = capturedImage;
        }
      } else if (baselineFeaturesRef.current && capturedImage) {
        const metrics = computeFrameSmileMetrics(
          landmarks,
          baselineFeaturesRef.current
        );
        const provisional =
          metrics.mouthCornerScore +
          metrics.mouthWidthScore +
          metrics.cheekEyeScore +
          metrics.symmetryScore;
        if (provisional > bestProvisionalScoreRef.current) {
          bestProvisionalScoreRef.current = provisional;
          lastValidImageRef.current = capturedImage;
        }
      }
    }

    captureBufferRef.current.push({
      timestampMs: elapsedMs,
      landmarks,
      faceDetected: guideStatus?.faceDetected ?? false,
      landmarksOk: guideStatus?.landmarksOk ?? false,
      guideOk,
    });

    if (elapsedMs >= CAPTURE_DURATION_MS) {
      finalizeCapture();
    }
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
    if (!faceGuideStatusRef.current?.ok || !baselineCapture) return;
    try {
      baselineFeaturesRef.current = computeBaselineFeatures(baselineCapture);
    } catch (err) {
      setCaptureError(
        err instanceof Error ? err.message : "基準顔の特徴量を計算できませんでした"
      );
      return;
    }
    setCaptureError(null);
    setSmileAttempt((n) => n + 1);
    setStage("smile-countdown");
  }

  function beginSmileCapturing() {
    if (!faceGuideStatusRef.current?.ok || !baselineFeaturesRef.current) {
      cancelCapture("顔を枠の中に入れてから撮影してください", "baseline-done");
      return;
    }
    captureBufferRef.current = [];
    lastValidImageRef.current = null;
    bestProvisionalScoreRef.current = -Infinity;
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

  async function confirmSmile() {
    if (!baselineFeaturesRef.current || !smileCapture) return;
    setCaptureError(null);
    setStage("scoring");
    try {
      const result = await computeSmileScore(
        baselineFeaturesRef.current,
        smileCapture
      );
      const state: ResultLocationState = {
        scoreResult: result,
        adviceMessages: generateAdvice(result),
        imageDataUrl: smileCapture.representativeImageDataUrl,
      };
      navigate("/result", { state });
    } catch (err) {
      setCaptureError(
        err instanceof Error ? err.message : "採点に失敗しました"
      );
      setStage("smile-review");
    }
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

      {stage === "baseline-done" && baselineCapture && (
        <div className="capture-review">
          <p className="capture-success">基準顔の撮影に成功しました</p>
          <img
            src={baselineCapture.representativeImageDataUrl}
            alt="撮影した基準顔"
            className="capture-review-image"
          />
          <div className="capture-controls">
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

      {stage === "scoring" && (
        <p className="capture-indicator">● 採点しています...</p>
      )}

      <p className="back-link">
        <Link to="/">ホームへ戻る</Link>
      </p>
    </div>
  );
}
