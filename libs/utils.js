export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function gradeFromScore(score) {
  if (score >= 8) return 'Safe';
  if (score >= 5) return 'Medium';
  return 'High Risk';
}
