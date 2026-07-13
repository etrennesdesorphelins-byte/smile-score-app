export type LandmarkPoint = {
  x: number;
  y: number;
  z: number;
};

export type LandmarkFrameRecord = {
  frame: number;
  timestampMs: number;
  faceDetected: boolean;
  imageWidth: number;
  imageHeight: number;
  landmarks: LandmarkPoint[] | null;
};

export function buildLandmarkCsv(records: LandmarkFrameRecord[]): string {
  const maxLandmarks = records.reduce(
    (max, record) => Math.max(max, record.landmarks?.length ?? 0),
    0
  );

  const header = [
    "frame",
    "timestamp_ms",
    "face_detected",
    "image_width",
    "image_height",
    ...Array.from({ length: maxLandmarks }, (_, i) => [
      `x_${i}`,
      `y_${i}`,
      `z_${i}`,
    ]).flat(),
  ];

  const rows = records.map((record) => {
    const cells: (string | number)[] = [
      record.frame,
      record.timestampMs.toFixed(1),
      record.faceDetected ? 1 : 0,
      record.imageWidth,
      record.imageHeight,
    ];
    for (let i = 0; i < maxLandmarks; i++) {
      const point = record.landmarks?.[i];
      cells.push(
        point ? point.x.toFixed(6) : "",
        point ? point.y.toFixed(6) : "",
        point ? point.z.toFixed(6) : ""
      );
    }
    return cells.join(",");
  });

  return [header.join(","), ...rows].join("\r\n");
}
