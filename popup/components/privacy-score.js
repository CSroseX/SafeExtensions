export function renderPrivacyScore(score) {
  let colorClass = 'risk-medium';

  if (score <= 3) colorClass = 'risk-critical';
  else if (score <= 5) colorClass = 'risk-high';

  return `
    <div class="text-right">
      <div class="text-xs text-gray-500">Score</div>
      <div class="font-bold ${colorClass}">
        ${score}/10
      </div>
    </div>
  `;
}
