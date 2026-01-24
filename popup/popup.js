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

function renderExtensions(results) {
  const container = document.getElementById('extensions-list');
  container.innerHTML = '';

  results.sort((a, b) => a.score - b.score);

  results.forEach(ext => {
    const card = getExtensionCard(ext);
    container.appendChild(card);
  });
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
  document.getElementById('loading').classList.toggle('hidden', !show);
  document
    .getElementById('extensions-list')
    .classList.toggle('hidden', show);
}

function exportReport() {
  alert('Export feature coming soon!');
}

/* ---------- Global Actions ---------- */

window.disableExtension = async (extensionId) => {
  if (!confirm('Disable this extension?')) return;

  try {
    await new Promise((resolve, reject) => {
      chrome.management.setEnabled(extensionId, false, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });

    await loadAndDisplay();
  } catch (err) {
    alert('Failed to disable extension');
  }
};

window.uninstallExtension = async (extensionId) => {
  try {
    await new Promise((resolve, reject) => {
      chrome.management.uninstall(
        extensionId,
        { showConfirmDialog: true },
        () => {
          if (chrome.runtime.lastError) reject();
          else resolve();
        }
      );
    });

    await loadAndDisplay();
  } catch {
    console.log('Uninstall cancelled');
  }
};

window.viewDetails = async (extensionId) => {
  const scans = await getAllScans();
  const ext = scans.find(s => s.extensionId === extensionId);
  if (!ext) return;

  document.getElementById('modal-title').textContent = ext.name;
  document.getElementById('modal-content').innerHTML = `
    <div class="space-y-2 text-sm">
      <div><strong>Version:</strong> ${ext.version}</div>
      <div><strong>Score:</strong> ${ext.score}/10</div>
      <div>
        <strong>Permissions:</strong>
        <ul class="list-disc pl-5">
          ${ext.permissions.map(p => `<li>${p}</li>`).join('')}
        </ul>
      </div>
      <div>
        <strong>Risks:</strong>
        <ul class="list-disc pl-5">
          ${ext.risks.map(r => `<li>${r.title}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;

  document.getElementById('details-modal').classList.remove('hidden');
};

window.closeDetailsModal = () => {
  document.getElementById('details-modal').classList.add('hidden');
};
