import { drawFaceMesh } from "./mediapipe";
import type { Point3D } from "./landmarks";

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

export function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    img.src = dataUrl;
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

// Draws the face mesh onto a copy of the captured photo, for the "landmark
// overlay" view on the result screen. The stored photo is mirrored (see
// captureMirroredFrame above) but landmarks are in raw camera coordinates,
// so they must be mirrored too before drawing or they land on the wrong
// side of the image.
export async function renderLandmarkOverlayImage(
  imageDataUrl: string,
  landmarks: Point3D[]
): Promise<string> {
  const img = await loadImageElement(imageDataUrl);

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("画像を生成できませんでした");
  }

  ctx.drawImage(img, 0, 0);
  const mirrored = landmarks.map((point) => ({
    x: 1 - point.x,
    y: point.y,
    z: point.z,
    visibility: 1,
  }));
  drawFaceMesh(ctx, mirrored);

  return canvas.toDataURL("image/png");
}
