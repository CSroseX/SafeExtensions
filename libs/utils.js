export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function gradeFromScore(score) {
  if (score >= 9) return 'A+';
  if (score >= 7) return 'A';
  if (score >= 5) return 'B';
  if (score >= 3) return 'C';
  return 'F';
}
