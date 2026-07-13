// Mirrors the same orientation the live preview uses (see recording.ts's
// compositing), so a captured still matches what the user actually saw.
export function captureMirroredFrame(video: HTMLVideoElement): string {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (width <= 0 || height <= 0) {
    throw new Error("撮影する映像サイズを取得できませんでした");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("画像を生成できませんでした");
  }

  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, width, height);

  return canvas.toDataURL("image/png");
}
