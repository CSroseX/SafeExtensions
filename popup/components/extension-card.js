import { renderPrivacyScore } from './privacy-score.js';
import { renderActionButtons } from './action-buttons.js';

function safeSeverityClass(severity) {
  const allowed = new Set(['critical', 'high', 'medium', 'low']);
  return allowed.has(severity) ? severity : 'low';
}

export function getExtensionCard(ext) {
  const card = document.createElement('div');
  card.className = 'extension-card';

  const grade = getGrade(ext.score);
  const riskLevel = getRiskLevel(ext.score);
  const header = document.createElement('div');
  header.className = 'flex items-start justify-between mb-3';

  const headerLeft = document.createElement('div');
  headerLeft.className = 'flex items-start gap-3 flex-1 mr-3 min-w-0';

  const icon = document.createElement('img');
  icon.id = `icon-${ext.extensionId}`;
  icon.className = 'ext-icon';
  icon.src = '';
  icon.alt = '';
  icon.style.width = '48px';
  icon.style.height = '48px';
  icon.style.borderRadius = '8px';
  icon.style.flexShrink = '0';
  icon.style.background = '#f1f5f9';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'flex-1 min-w-0';

  const titleRow = document.createElement('div');
  titleRow.className = 'flex items-center gap-1 mb-1';

  const title = document.createElement('h3');
  title.className = 'font-semibold text-slate-800 text-sm truncate';
  title.textContent = ext.name || '';
  titleRow.appendChild(title);

  if (hasBroadHostAccess(ext)) {
    const broad = document.createElement('span');
    broad.className = 'pill pill-warning';
    broad.title = 'Has access to all sites via host permissions like <all_urls>';
    broad.textContent = 'Broad access';
    titleRow.appendChild(broad);
  }

  const version = document.createElement('p');
  version.className = 'text-xs text-slate-500';
  version.textContent = `Version ${ext.version || ''}`;

  titleWrap.appendChild(titleRow);
  titleWrap.appendChild(version);

  headerLeft.appendChild(icon);
  headerLeft.appendChild(titleWrap);
  header.appendChild(headerLeft);
  header.appendChild(renderPrivacyScore(ext.score, grade, riskLevel));

  card.appendChild(header);

  if (ext.risks && ext.risks.length > 0) {
    const risksWrap = document.createElement('div');
    risksWrap.className = 'mb-3 space-y-1.5';

    ext.risks.slice(0, 2).forEach((risk) => {
      const row = document.createElement('div');
      row.className = 'flex items-start gap-2 text-xs';

      const iconNode = document.createElement('span');
      iconNode.className = 'mt-0.5';
      iconNode.textContent = getRiskIcon(risk.severity);

      const text = document.createElement('span');
      text.className = 'text-slate-600 flex-1';
      text.textContent = risk.title || '';

      row.appendChild(iconNode);
      row.appendChild(text);
      risksWrap.appendChild(row);
    });

    if (ext.risks.length > 2) {
      const more = document.createElement('p');
      more.className = 'text-xs text-slate-400 pl-5';
      more.textContent = `+${ext.risks.length - 2} more risks`;
      risksWrap.appendChild(more);
    }

    card.appendChild(risksWrap);
  }

  const footer = document.createElement('div');
  footer.className = 'flex items-center justify-between pt-3 border-t border-slate-100 gap-2 flex-wrap';

  const viewDetails = document.createElement('button');
  viewDetails.className = 'btn-view view-details-btn';
  viewDetails.dataset.extensionId = ext.extensionId;
  viewDetails.type = 'button';
  viewDetails.style.flex = '1 1 auto';
  viewDetails.style.minWidth = 'fit-content';
  viewDetails.style.whiteSpace = 'nowrap';
  viewDetails.textContent = 'View Details →';

  const actionsWrap = document.createElement('div');
  actionsWrap.style.flex = '0 0 auto';
  actionsWrap.style.display = 'flex';
  actionsWrap.style.gap = '8px';
  actionsWrap.appendChild(renderActionButtons(ext.extensionId, ext.enabled));

  footer.appendChild(viewDetails);
  footer.appendChild(actionsWrap);
  card.appendChild(footer);

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
  const normalized = safeSeverityClass(severity);
  const icons = {
    critical: '🚨',
    high: '⚠️',
    medium: '⚡',
    low: 'ℹ️'
  };
  return icons[normalized] || 'ℹ️';
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