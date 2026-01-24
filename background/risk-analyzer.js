import { BASE_SCORE, DANGEROUS_PERMISSIONS } from './constants.js';

export function analyzeRisk(extension) {
  let score = BASE_SCORE;
  const risks = [];

  (extension.permissions || []).forEach(p => {
    if (DANGEROUS_PERMISSIONS.includes(p)) {
      score -= 2;
      risks.push({
        title: `Sensitive permission: ${p}`,
        severity: 'high'
      });
    }
  });

  score = Math.max(0, score);

  return { score, risks };
}
