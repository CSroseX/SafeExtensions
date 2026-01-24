import { getAllScans } from '../libs/storage.js';
import '../libs/chrome-api.js';

import { getExtensionCard } from './components/extension-card.js';

document.addEventListener('DOMContentLoaded', async () => {
  await loadAndDisplay();
  attachListeners();
  attachDelegatedActions();
});

async function loadAndDisplay() {
  showLoading(true);

  const results = await getAllScans();

  updateStats(results);
  renderExtensions(results);

  showLoading(false);
}

function updateStats(results) {
  const total = results.length;
  const safe = results.filter(r => r.score >= 7).length;
  const risky = results.filter(r => r.score < 5).length;

  document.getElementById('total-extensions').textContent = total;
  document.getElementById('safe-count').textContent = safe;
  document.getElementById('risky-count').textContent = risky;
}

function attachListeners() {
  document.getElementById('scan-now').addEventListener('click', async () => {
    showLoading(true);

    chrome.runtime.sendMessage({ action: 'rescan' }, async () => {
      await loadAndDisplay();
    });
  });

  document
    .getElementById('export-report')
    .addEventListener('click', exportReport);

  // Close modal buttons
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', closeDetailsModal);
  });

  // Click outside modal content closes modal
  const modalOverlay = document.getElementById('details-modal');
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeDetailsModal();
    }
  });
}

function attachDelegatedActions() {
  document.addEventListener('click', async (event) => {
    const target = event.target.closest('button');
    if (!target) return;

    const extensionId = target.dataset.extensionId;
    if (!extensionId) return;

    if (target.classList.contains('disable-btn')) {
      await window.disableExtension(extensionId);
      return;
    }

    if (target.classList.contains('uninstall-btn')) {
      await window.uninstallExtension(extensionId);
      return;
    }

    if (target.classList.contains('view-details-btn')) {
      await window.viewDetails(extensionId);
    }
  });
}

function showLoading(show) {
  const loading = document.getElementById('loading');
  const list = document.getElementById('extensions-list');
  const empty = document.getElementById('empty-state');
  
  if (show) {
    loading.style.display = 'flex';
    list.style.display = 'none';
    empty.style.display = 'none';
  } else {
    loading.style.display = 'none';
  }
}

function renderExtensions(results) {
  const container = document.getElementById('extensions-list');
  const emptyState = document.getElementById('empty-state');
  
  container.innerHTML = '';

  if (results.length === 0) {
    container.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  container.style.display = 'flex';
  emptyState.style.display = 'none';

  results.sort((a, b) => a.score - b.score);

  results.forEach(ext => {
    const card = getExtensionCard(ext);
    container.appendChild(card);
  });
}

function exportReport() {
  alert('Export feature coming soon!');
}

// Update modal display


/* ---------- Global Actions ---------- */

window.viewDetails = async (extensionId) => {
  const scans = await getAllScans();
  const ext = scans.find(s => s.extensionId === extensionId);
  if (!ext) return;

  const riskLevel = ext.score >= 7 ? 'safe' : ext.score >= 5 ? 'medium' : ext.score >= 3 ? 'high' : 'critical';

  document.getElementById('modal-title').textContent = ext.name;
  document.getElementById('modal-content').innerHTML = `
    <div class="space-y-4">
      <!-- Score Section -->
      <div class="modal-section">
        <div class="modal-section-title">Privacy Score</div>
        <div class="flex items-center justify-between">
          <span class="text-2xl font-bold ${riskLevel === 'critical' ? 'text-red-600' : riskLevel === 'high' ? 'text-orange-600' : riskLevel === 'medium' ? 'text-blue-600' : 'text-emerald-600'}">${ext.score}/10</span>
          <span class="score-badge ${riskLevel}">${ext.score >= 7 ? 'Safe' : ext.score >= 5 ? 'Caution' : 'Risky'}</span>
        </div>
      </div>

      <!-- Version -->
      <div class="modal-section">
        <div class="modal-section-title">Version</div>
        <p class="text-sm text-slate-700">${ext.version}</p>
      </div>

      <!-- Permissions -->
      ${ext.permissions && ext.permissions.length > 0 ? `
        <div class="modal-section">
          <div class="modal-section-title">Permissions (${ext.permissions.length})</div>
          <div class="space-y-1 max-h-32 overflow-y-auto">
            ${ext.permissions.map(p => `
              <div class="flex items-center gap-2 text-sm text-slate-600">
                <span class="text-blue-500">•</span>
                <span>${p}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Risks -->
      ${ext.risks && ext.risks.length > 0 ? `
        <div class="modal-section">
          <div class="modal-section-title">Detected Risks (${ext.risks.length})</div>
          <div class="space-y-2">
            ${ext.risks.map(r => `
              <div class="risk-indicator ${r.severity}">
                <span>${r.severity === 'critical' ? '🚨' : r.severity === 'high' ? '⚠️' : '⚡'}</span>
                <div class="flex-1">
                  <p class="text-sm font-medium text-slate-800">${r.title}</p>
                  ${r.description ? `<p class="text-xs text-slate-600 mt-0.5">${r.description}</p>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : `
        <div class="modal-section">
          <p class="text-sm text-slate-600">✅ No major risks detected</p>
        </div>
      `}
    </div>
  `;

  document.getElementById('details-modal').classList.add('show');
  document.getElementById('details-modal').style.display = 'flex';
};

window.closeDetailsModal = () => {
  const modal = document.getElementById('details-modal');
  modal.classList.remove('show');
  modal.style.display = 'none';
};

/* ---------- Global Actions ---------- */
