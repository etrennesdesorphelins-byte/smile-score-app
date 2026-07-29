const COLOR_GOOD = "#2f7d3c";
const COLOR_MEDIUM = "#d9a441";
const COLOR_LOW = "#d9534f";

// Thresholds are ratios of score/max, shared by the total-score ring and the
// per-item bars so the whole result screen uses one consistent color language.
export function getScoreColor(value: number, max: number): string {
  const ratio = max > 0 ? value / max : 0;
  if (ratio >= 0.8) return COLOR_GOOD;
  if (ratio >= 0.5) return COLOR_MEDIUM;
  return COLOR_LOW;
}
