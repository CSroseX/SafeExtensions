export function renderPrivacyScore(score, grade, riskLevel) {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col items-end gap-1';

  const badge = document.createElement('div');
  badge.className = `score-badge ${riskLevel}`;
  badge.textContent = `${score}/10`;

  const gradeText = document.createElement('span');
  gradeText.className = 'text-xs font-medium text-slate-500';
  gradeText.textContent = grade;

  wrapper.appendChild(badge);
  wrapper.appendChild(gradeText);

  return wrapper;
}
