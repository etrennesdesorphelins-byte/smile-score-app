const VIDEO_MIME_CANDIDATES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

export function canRecordCanvas(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    "captureStream" in HTMLCanvasElement.prototype
  );
}

export function pickSupportedVideoMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return (
    VIDEO_MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ??
    ""
  );
}

export type CanvasRecording = {
  drawFrame: () => void;
  stop: () => Promise<Blob>;
};

export function startCompositeCanvasRecording(
  video: HTMLVideoElement,
  landmarkCanvas: HTMLCanvasElement,
  fps = 30
): CanvasRecording {
  if (!canRecordCanvas()) {
    throw new Error("このブラウザはCanvas録画に対応していません");
  }

  const width = video.videoWidth || landmarkCanvas.width;
  const height = video.videoHeight || landmarkCanvas.height;
  if (width <= 0 || height <= 0) {
    throw new Error("録画する映像サイズを取得できませんでした");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) {
    throw new Error("録画用Canvasを初期化できませんでした");
  }
  const ctx: CanvasRenderingContext2D = maybeCtx;

  const stream = canvas.captureStream(fps);
  const mimeType = pickSupportedVideoMimeType();
  let recorder: MediaRecorder;
  try {
    recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
  } catch (err) {
    stream.getTracks().forEach((track) => track.stop());
    throw err;
  }
  const chunks: Blob[] = [];
  let stopped = false;
  let stopPromise: Promise<Blob> | null = null;

  function stopTracks() {
    stream.getTracks().forEach((track) => track.stop());
  }

  function drawFrame() {
    if (stopped) return;

    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, width, height);
    ctx.drawImage(landmarkCanvas, 0, 0, width, height);
    ctx.restore();
  }

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  drawFrame();
  recorder.start();

  const stop = () => {
    if (stopPromise) return stopPromise;

    stopPromise = new Promise<Blob>((resolve, reject) => {
      if (stopped) {
        resolve(new Blob(chunks, { type: mimeType || "video/webm" }));
        return;
      }

      recorder.onerror = (event) => {
        stopped = true;
        stopTracks();
        reject(event);
      };
      recorder.onstop = () => {
        stopped = true;
        stopTracks();
        resolve(new Blob(chunks, { type: mimeType || "video/webm" }));
      };

      if (recorder.state === "inactive") {
        stopped = true;
        stopTracks();
        resolve(new Blob(chunks, { type: mimeType || "video/webm" }));
        return;
      }

      try {
        recorder.requestData();
        recorder.stop();
      } catch (err) {
        stopped = true;
        stopTracks();
        reject(err);
      }
    });
    return stopPromise;
  };

  return { drawFrame, stop };
}

export function formatTimestampForFilename(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  const y = date.getFullYear();
  const mo = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}${mo}${d}_${h}${mi}${s}`;
}
