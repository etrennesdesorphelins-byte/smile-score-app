import type { SmileScoreResult } from "../lib/scoring";

type ScoreBreakdownProps = {
  scores: SmileScoreResult;
};

const ITEMS: { key: Exclude<keyof SmileScoreResult, "total">; label: string; max: number }[] = [
  { key: "mouthCorner", label: "口角挙上", max: 25 },
  { key: "mouthWidth", label: "口幅拡大", max: 20 },
  { key: "cheekEye", label: "頬・目周囲", max: 25 },
  { key: "symmetry", label: "左右対称性", max: 15 },
  { key: "stability", label: "安定性", max: 10 },
  { key: "teeth", label: "上歯露出", max: 5 },
];

export default function ScoreBreakdown({ scores }: ScoreBreakdownProps) {
  return (
    <div className="score-breakdown">
      <p className="score-total">Smile Score：{scores.total}点</p>
      <p className="score-caption">
        今回のカメラ条件で検出された笑顔特徴のスコアです
      </p>
      <ul className="score-list">
        {ITEMS.map((item) => (
          <li key={item.key}>
            <span className="score-item-label">{item.label}</span>
            <span className="score-item-value">
              {scores[item.key]} / {item.max}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
