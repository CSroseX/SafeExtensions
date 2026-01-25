import { renderPrivacyScore } from './privacy-score.js';
import { renderActionButtons } from './action-buttons.js';

export function getExtensionCard(ext) {
  const card = document.createElement('div');
  card.className = 'extension-card';

  // Determine grade and color
  const grade = getGrade(ext.score);
  const riskLevel = getRiskLevel(ext.score);

  card.innerHTML = `
    <div class="flex items-start justify-between mb-3">
      <div class="flex items-start gap-2 flex-1 mr-3 min-w-0">
        <img id="icon-${ext.extensionId}" class="ext-icon" src="" alt="" style="width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0; background: #f1f5f9;" />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1 mb-1">
            <h3 class="font-semibold text-slate-800 text-sm truncate">${ext.name}</h3>
            ${hasBroadHostAccess(ext) ? '<span class="pill pill-warning" title="Has access to all sites via host permissions like <all_urls>">Broad access</span>' : ''}
          </div>
          <p class="text-xs text-slate-500">Version ${ext.version}</p>
        </div>
      </div>
      ${renderPrivacyScore(ext.score, grade, riskLevel)}
    </div>

    ${ext.risks && ext.risks.length > 0 ? `
      <div class="mb-3 space-y-1.5">
        ${ext.risks.slice(0, 2).map(risk => `
          <div class="flex items-start gap-2 text-xs">
            <span class="mt-0.5">${getRiskIcon(risk.severity)}</span>
            <span class="text-slate-600 flex-1">${risk.title}</span>
          </div>
        `).join('')}
        ${ext.risks.length > 2 ? `
          <p class="text-xs text-slate-400 pl-5">+${ext.risks.length - 2} more risks</p>
        ` : ''}
      </div>
    ` : ''}

    <div class="flex items-center justify-between pt-3 border-t border-slate-100 gap-2">
      <button
        class="btn-view view-details-btn"
        data-extension-id="${ext.extensionId}">
        View Details →
      </button>
      ${renderActionButtons(ext.extensionId, ext.enabled)}
    </div>
  `;

  // Load extension icon asynchronously
  setTimeout(() => {
    const iconImg = card.querySelector(`#icon-${ext.extensionId}`);
    if (iconImg && ext.extensionId) {
      loadExtensionIcon(ext.extensionId, iconImg);
    }
  }, 0);

  return card;
}

function getGrade(score) {
  if (score >= 9) return 'A+';
  if (score >= 7) return 'A';
  if (score >= 5) return 'B';
  if (score >= 3) return 'C';
  return 'F';
}

function getRiskLevel(score) {
  if (score >= 7) return 'safe';
  if (score >= 5) return 'medium';
  if (score >= 3) return 'high';
  return 'critical';
}

function getRiskIcon(severity) {
  const icons = {
    critical: '🚨',
    high: '⚠️',
    medium: '⚡',
    low: 'ℹ️'
  };
  return icons[severity] || 'ℹ️';
}

export function loadExtensionIcon(extensionId, imgElement) {
  // Try to get icon from chrome.management API
  if (chrome && chrome.management) {
    chrome.management.get(extensionId, (ext) => {
      if (ext && ext.icons && ext.icons.length > 0) {
        // Get the largest icon available
        const icon = ext.icons[ext.icons.length - 1];
        imgElement.src = icon.url;
        imgElement.style.background = 'transparent';
      } else {
        // Fallback: gradient background
        imgElement.style.background = 'linear-gradient(135deg, #3b82f6 0%, #4f46e5 100%)';
      }
    });
  }
}

function hasBroadHostAccess(ext) {
  const hosts = ext.hostPermissions || [];
  return hosts.some(p => p === '<all_urls>' || p === '*://*/*' || p === 'http://*/*' || p === 'https://*/*');
}