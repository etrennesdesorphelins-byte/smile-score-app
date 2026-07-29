import { getScoreColor } from "../lib/scoreColor";
import type { SmileScoreResult } from "../lib/scoring";

type ScoreBreakdownProps = {
  scores: SmileScoreResult;
};

type ScoreItemKey = Exclude<
  keyof SmileScoreResult,
  "total" | "representativeLandmarks"
>;

const ITEMS: { key: ScoreItemKey; label: string; max: number }[] = [
  { key: "mouthCorner", label: "口角挙上", max: 25 },
  { key: "mouthWidth", label: "口幅拡大", max: 20 },
  { key: "cheekEye", label: "頬・目周囲", max: 25 },
  { key: "symmetry", label: "左右対称性", max: 15 },
  { key: "stability", label: "安定性", max: 10 },
  { key: "teeth", label: "上歯露出", max: 5 },
];

const TOTAL_MAX = ITEMS.reduce((sum, item) => sum + item.max, 0);

export default function ScoreBreakdown({ scores }: ScoreBreakdownProps) {
  const totalColor = getScoreColor(scores.total, TOTAL_MAX);
  const totalPercent = Math.min(100, Math.max(0, (scores.total / TOTAL_MAX) * 100));

  return (
    <div className="score-breakdown">
      <div
        className="score-ring"
        style={{
          backgroundImage: `conic-gradient(${totalColor} ${totalPercent}%, #e5e5e5 ${totalPercent}% 100%)`,
        }}
      >
        <div className="score-ring-inner">
          <span className="score-ring-value">{scores.total}</span>
          <span className="score-ring-max">/ {TOTAL_MAX}</span>
        </div>
      </div>
      <p className="score-caption">
        今回のカメラ条件で検出された笑顔特徴のスコアです
      </p>
      <ul className="score-list">
        {ITEMS.map((item) => {
          const value = scores[item.key];
          const color = getScoreColor(value, item.max);
          const percent = Math.min(100, Math.max(0, (value / item.max) * 100));
          return (
            <li key={item.key}>
              <div className="score-item-header">
                <span className="score-item-label">{item.label}</span>
                <span className="score-item-value">
                  {value} / {item.max}
                </span>
              </div>
              <div className="score-bar-track">
                <div
                  className="score-bar-fill"
                  style={{ width: `${percent}%`, background: color }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
