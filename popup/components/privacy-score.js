export function renderPrivacyScore(score, grade, riskLevel) {
  return `
    <div class="flex flex-col items-end gap-1">
      <div class="score-badge ${riskLevel}">
        ${score}/10
      </div>
      <span class="text-xs font-medium text-slate-500">${grade}</span>
    </div>
  `;
}
