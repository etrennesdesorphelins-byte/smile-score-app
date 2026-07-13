import type { SmileScoreResult } from "./scoring";

type ScoreItemKey = Exclude<
  keyof SmileScoreResult,
  "total" | "representativeLandmarks"
>;

const MAX_SCORES: Record<ScoreItemKey, number> = {
  mouthCorner: 25,
  mouthWidth: 20,
  cheekEye: 25,
  symmetry: 15,
  stability: 10,
  teeth: 5,
};

const GOOD_TEXT: Record<ScoreItemKey, string> = {
  mouthCorner: "口角の上がり方がよく検出されました。",
  mouthWidth: "口の横方向の広がりがよく検出されました。",
  cheekEye: "頬・目元の変化がよく検出されました。",
  symmetry: "左右バランスの良い笑顔が検出されました。",
  stability: "安定した笑顔が検出されました。",
  teeth: "自然な歯の見え方が検出されました。",
};

const IMPROVEMENT_TEXT: Record<ScoreItemKey, string> = {
  mouthCorner:
    "口元の表情は検出されています。さらに口角を少し外上方へ引き上げるように笑うと、笑顔の特徴がよりはっきり検出されやすくなります。",
  mouthWidth:
    "口角の動きはとらえられています。さらに口を横に少し広げるように笑うと、笑顔の特徴がより検出されやすくなります。",
  cheekEye:
    "口角はよく動いています。さらに頬を軽く持ち上げるように笑うと、目元にも笑顔の特徴が出やすくなります。",
  symmetry:
    "笑顔の動きはしっかり出ています。カメラに対して正面を向き、左右の口角を同じくらい上げる意識をすると、より安定して検出されやすくなります。",
  stability:
    "表情の変化はしっかり出ています。カメラに顔を向けたまま少し長めに笑顔を保つと、より安定して検出されやすくなります。",
  teeth:
    "口角はよく上がっています。さらに明るい印象を出したい場合は、上の前歯が少し見える程度に笑うと、口元の表情が伝わりやすくなります。",
};

// Praises the highest-scoring item first, then suggests improvements for the
// one or two lowest-scoring items (skipping the praised item if it also
// happens to be among them, e.g. when all scores are nearly uniform).
export function generateAdvice(scores: SmileScoreResult): string[] {
  const keys = Object.keys(MAX_SCORES) as ScoreItemKey[];
  const ranked = keys
    .map((key) => ({ key, ratio: scores[key] / MAX_SCORES[key] }))
    .sort((a, b) => {
      if (a.ratio !== b.ratio) return a.ratio - b.ratio;
      // Tie-break by the item's own point weight, so "prefer the
      // higher-weighted item" holds regardless of declaration order.
      return MAX_SCORES[a.key] - MAX_SCORES[b.key];
    });

  const bestItem = ranked[ranked.length - 1];
  const lowItems = ranked.slice(0, 2).filter((item) => item.key !== bestItem.key);

  return [GOOD_TEXT[bestItem.key], ...lowItems.map((item) => IMPROVEMENT_TEXT[item.key])];
}
