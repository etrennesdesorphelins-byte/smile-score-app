import type { FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import CameraView from "../components/CameraView";
import FaceGuideOverlay, {
  type FaceGuideHandle,
  type FaceGuideStatus,
} from "../components/FaceGuideOverlay";
import LandmarkCanvas, {
  type LandmarkDetectionStatus,
} from "../components/LandmarkCanvas";
import { buildLandmarkCsv, type LandmarkFrameRecord } from "../lib/csv";
import {
  canRecordCanvas,
  formatTimestampForFilename,
  startCompositeCanvasRecording,
  type CanvasRecording,
} from "../lib/recording";

type DownloadLinks = {
  videoUrl: string;
  videoName: string;
  csvUrl: string;
  csvName: string;
};

export default function LandmarkPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceGuideRef = useRef<FaceGuideHandle>(null);
  const framesRef = useRef<LandmarkFrameRecord[]>([]);
  const frameCounterRef = useRef(0);
  const recordingStartRef = useRef(0);
  const recordingRef = useRef<CanvasRecording | null>(null);

  const [detectionStatus, setDetectionStatus] =
    useState<LandmarkDetectionStatus>("loading");
  const [faceGuideStatus, setFaceGuideStatus] = useState<FaceGuideStatus | null>(
    null
  );
  const [isRecording, setIsRecording] = useState(false);
  const [hasCapturedFrame, setHasCapturedFrame] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [downloadLinks, setDownloadLinks] = useState<DownloadLinks | null>(
    null
  );

  useEffect(() => {
    return () => {
      void recordingRef.current?.stop().catch(console.error);
      recordingRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (downloadLinks) {
        URL.revokeObjectURL(downloadLinks.videoUrl);
        URL.revokeObjectURL(downloadLinks.csvUrl);
      }
    };
  }, [downloadLinks]);

  function handleFrame(result: FaceLandmarkerResult) {
    if (!hasCapturedFrame) setHasCapturedFrame(true);
    faceGuideRef.current?.updateFrame(result);

    if (!isRecording) return;
    const video = videoRef.current;
    if (!video) return;

    recordingRef.current?.drawFrame();

    const landmarks = result.faceLandmarks[0] ?? null;
    framesRef.current.push({
      frame: frameCounterRef.current++,
      timestampMs: performance.now() - recordingStartRef.current,
      faceDetected: landmarks !== null,
      imageWidth: video.videoWidth,
      imageHeight: video.videoHeight,
      landmarks,
    });
  }

  function handleStartRecording() {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    if (!canRecordCanvas()) {
      setRecordingError("このブラウザは録画に対応していません");
      return;
    }

    framesRef.current = [];
    frameCounterRef.current = 0;
    recordingStartRef.current = performance.now();
    setRecordingError(null);

    try {
      recordingRef.current = startCompositeCanvasRecording(video, canvas);
      setDownloadLinks(null);
      setIsRecording(true);
    } catch (err) {
      recordingRef.current = null;
      setRecordingError(
        err instanceof Error ? err.message : "録画を開始できませんでした"
      );
    }
  }

  async function handleStopRecording() {
    const recording = recordingRef.current;
    if (!recording) return;

    recordingRef.current = null;
    setIsRecording(false);
    setRecordingError(null);

    try {
      const videoBlob = await recording.stop();
      const csvText = buildLandmarkCsv(framesRef.current);
      const csvBlob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
      const timestamp = formatTimestampForFilename(new Date());

      setDownloadLinks({
        videoUrl: URL.createObjectURL(videoBlob),
        videoName: `face_landmark_${timestamp}.webm`,
        csvUrl: URL.createObjectURL(csvBlob),
        csvName: `face_landmark_${timestamp}.csv`,
      });
    } catch (err) {
      setRecordingError(
        err instanceof Error ? err.message : "録画の停止に失敗しました"
      );
    } finally {
      recordingRef.current = null;
    }
  }

  const canRecord =
    detectionStatus === "ready" &&
    hasCapturedFrame &&
    faceGuideStatus?.ok === true &&
    canRecordCanvas();

  return (
    <div className="app-shell">
      <h1>Smile Score Demo</h1>
      <p>顔ランドマーク表示・録画</p>
      <div className="camera-stage">
        <div className="camera-frame">
          <CameraView ref={videoRef} />
          <LandmarkCanvas
            ref={canvasRef}
            videoRef={videoRef}
            onFrame={handleFrame}
            onStatusChange={setDetectionStatus}
          />
          <FaceGuideOverlay
            ref={faceGuideRef}
            onStatusChange={setFaceGuideStatus}
          />
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

      {isRecording && <p className="recording-indicator">● 録画中</p>}
      {!canRecordCanvas() && (
        <p className="recording-error">このブラウザは録画に対応していません。</p>
      )}
      {recordingError && <p className="recording-error">{recordingError}</p>}

      <div className="recording-controls">
        {!isRecording ? (
          <button
            type="button"
            onClick={handleStartRecording}
            disabled={!canRecord}
          >
            録画開始
          </button>
        ) : (
          <button type="button" onClick={handleStopRecording}>
            録画停止
          </button>
        )}
      </div>

      {!isRecording && downloadLinks && (
        <div className="download-links">
          <a href={downloadLinks.videoUrl} download={downloadLinks.videoName}>
            動画をダウンロード（.webm）
          </a>
          <a href={downloadLinks.csvUrl} download={downloadLinks.csvName}>
            ランドマークCSVをダウンロード
          </a>
        </div>
      )}

      <p className="back-link">
        <Link to="/">ホームへ戻る</Link>
      </p>
    </div>
  );
}
