import { getAllScans } from '../libs/storage.js';
import '../libs/chrome-api.js';

import { getExtensionCard } from './components/extension-card.js';

const TOUR_COMPLETED_KEY = 'tourCompleted';
const TOUR_STEPS = [
  { selector: '#scan-now', text: 'Click Scan to analyze your installed extensions for privacy risks.' },
  { selector: '#stats-bar', text: 'The dashboard summarizes total, safe, and risky extensions at a glance.' },
  { selector: '.filter-bar', text: 'Use filters and sorting to focus on active, disabled, or high-access extensions.' },
  { selector: null, text: 'Please note: we do not encourage deleting extensions. Our goal is to make you aware of permissions. For more info, please use the About link.' }
];

let tourState = { active: false, index: 0 };
let tourHighlightEl = null;
let tourHighlightPrev = null;
let tourHighlightContainer = null;
let tourHighlightContainerPrev = null;
let tourCutout = null;

const MIN_LOADING_MS = 1000;
let loadingStart = 0;
let loadingHideTimeout;
let toastTimeout;
let currentFilter = 'active'; // 'all' | 'active' | 'disabled' | 'broad' | 'access'
let currentSort = 'risky'; // 'risky' | 'medium' | 'safe'
let allExtensions = [];
let isRendering = false;
let scrollInitialized = false;
let scrollTicking = false;

document.addEventListener('DOMContentLoaded', async () => {
  // CRITICAL: Force a fresh scan from the background to sync with Chrome's latest extension state
  console.log('📂 Popup opened - requesting fresh scan from background...');
  chrome.runtime.sendMessage({ action: 'rescan' }, async (response) => {
    console.log('✅ Background scan complete:', response);
    await loadAndDisplay();
    attachListeners();
    attachDelegatedActions();
    attachScrollBehavior();
    initializeOnboardingTour();
  });
});

// Refresh when background reports extension state changes
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.action === 'extension-state-changed') {
    loadAndDisplay({ skipLoading: true });
  }
});

async function loadAndDisplay(options = {}) {
  const { showCompleteToast = false, skipLoading = false } = options;

  if (!skipLoading) {
    showLoading(true);
  }

  allExtensions = await getAllScans();

  // Safety: Ensure all records have enabled field (in case of DB records from before the update)
  console.log(`📋 Loaded ${allExtensions.length} scans from DB`);
  console.log(`🔍 Scan enabled states before safety check:`, allExtensions.map(e => ({ name: e.name, enabled: e.enabled })));

  // Log any records missing enabled field
  const missingEnabled = allExtensions.filter(e => e.enabled === undefined);
  if (missingEnabled.length > 0) {
    console.warn(`⚠️ ${missingEnabled.length} records missing 'enabled' field:`, missingEnabled.map(e => e.name));
  }

  updateTabCounts(allExtensions);

  applyFilterAndSort();

  if (showCompleteToast) {
    showToast('Completed scan');
  }

  if (!skipLoading) {
    showLoading(false);
  }
}

function updateStats(results) {
  const total = results.length;
  const safe = results.filter(r => r.score >= 7).length;
  const risky = results.filter(r => r.score < 5).length;

  document.getElementById('total-extensions').textContent = total;
  document.getElementById('safe-count').textContent = safe;
  document.getElementById('risky-count').textContent = risky;
}

function hasBroadHostAccess(ext) {
  const hosts = ext.hostPermissions || [];
  return hosts.some(p => p === '<all_urls>' || p === '*://*/*' || p === 'http://*/*' || p === 'https://*/*');
}

function hasAnyAccess(ext) {
  const hosts = ext.hostPermissions || [];
  return hosts.length > 0;
}

function updateTabCounts(results) {
  const allCount = results.length || 0;
  const activeCount = results.filter(r => r.enabled === true).length || 0;
  const disabledCount = results.filter(r => r.enabled !== true).length || 0; // Catch both false and undefined
  const broadCount = results.filter(hasBroadHostAccess).length || 0;
  const accessCount = results.filter(hasAnyAccess).length || 0;

  const counts = {
    all: allCount,
    active: activeCount,
    disabled: disabledCount,
    broad: broadCount,
    access: accessCount
  };

  console.log(`📊 Counts`, counts);

  Object.entries(counts).forEach(([key, value]) => {
    const el = document.getElementById(`filter-count-${key}`);
    if (el) el.textContent = value;
  });
}

function filterExtensions(extensions, filter) {
  let filtered;
  switch (filter) {
    case 'active':
      filtered = extensions.filter(ext => ext.enabled === true);
      console.log(`🔍 Active filter: ${filtered.length} of ${extensions.length} match (enabled === true)`);
      console.log(`   Filtered:`, filtered.map(e => ({ name: e.name, enabled: e.enabled })));
      return filtered;
    case 'disabled':
      // Catch both explicitly false and undefined/missing (backward compat with old DB records)
      filtered = extensions.filter(ext => ext.enabled !== true);
      console.log(`🔍 Disabled filter: ${filtered.length} of ${extensions.length} match (enabled !== true)`);
      console.log(`   Filtered:`, filtered.map(e => ({ name: e.name, enabled: e.enabled })));
      return filtered;
    case 'broad':
      filtered = extensions.filter(hasBroadHostAccess);
      console.log(`🔍 Broad access filter: ${filtered.length} of ${extensions.length} match (<all_urls> or *://*/*)`);
      console.log(`   Filtered:`, filtered.map(e => ({ name: e.name, hostPermissions: e.hostPermissions })));
      return filtered;
    case 'access':
      filtered = extensions.filter(hasAnyAccess);
      console.log(`🔍 Access filter: ${filtered.length} of ${extensions.length} match (has any host permissions)`);
      console.log(`   Filtered:`, filtered.map(e => ({ name: e.name, hostPermissions: e.hostPermissions })));
      return filtered;
    case 'all':
    default:
      console.log(`🔍 All filter: ${extensions.length} extensions`);
      return extensions;
  }
}

function buildStoreUrl(name, id) {
  if (!id) return null;
  const slug = (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  // Fallback to id-only path if name missing
  const base = 'https://chrome.google.com/webstore/detail';
  return slug ? `${base}/${slug}/${id}` : `${base}/${id}`;
}

function sortExtensions(extensions, sortBy) {
  const bucket = (score) => {
    if (score >= 7) return 'safe';
    if (score >= 5) return 'medium';
    return 'risky';
  };

  const orderMaps = {
    risky: ['risky', 'medium', 'safe'],
    medium: ['medium', 'risky', 'safe'],
    safe: ['safe', 'medium', 'risky']
  };

  const order = orderMaps[sortBy] || orderMaps.risky;

  return [...extensions].sort((a, b) => {
    const bucketA = bucket(a.score || 0);
    const bucketB = bucket(b.score || 0);
    if (bucketA !== bucketB) {
      return order.indexOf(bucketA) - order.indexOf(bucketB);
    }
    // Within same bucket, sort by score ascending for riskier first
    return (a.score || 0) - (b.score || 0);
  });
}

function applyFilterAndSort() {
  const filteredResults = filterExtensions(allExtensions, currentFilter);
  const sortedResults = sortExtensions(filteredResults, currentSort);
  updateStats(sortedResults);
  renderExtensions(sortedResults);
  const helper = document.getElementById('filter-helper');
  if (helper) {
    const label = currentFilter.charAt(0).toUpperCase() + currentFilter.slice(1);
    helper.textContent = `Showing ${label} extensions`;
  }
}

function attachListeners() {
  document.getElementById('scan-now').addEventListener('click', async () => {
    showLoading(true);

    chrome.runtime.sendMessage({ action: 'rescan' }, async () => {
      try {
        await loadAndDisplay({ showCompleteToast: true, skipLoading: true });
      } finally {
        showLoading(false);
      }
    });
  });

  document
    .getElementById('export-report')
    .addEventListener('click', exportReport);

  // Risky stat card click handler
  document.getElementById('risky-stat-card').addEventListener('click', scrollToFirstRisky);

  // Filter & sort controls
  attachFilterControls();

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

function attachScrollBehavior() {
  if (scrollInitialized) return;
  const list = document.getElementById('extensions-list');
  const header = document.getElementById('header-bar');
  const stats = document.getElementById('stats-bar');
  const filterBar = document.querySelector('.filter-bar');
  if (!list || !header || !stats || !filterBar) return;

  scrollInitialized = true;
  let collapsed = false;
  const HIDE_THRESHOLD = 100; // Much higher to avoid premature hiding on initial scroll
  const SHOW_THRESHOLD = 30; // Larger gap creates hysteresis, prevents jitter
  let lastStateChange = 0;
  const STATE_COOLDOWN_MS = 150; // Prevents rapid toggling

  list.addEventListener('scroll', () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      const y = list.scrollTop;
      const now = Date.now();
      const canToggle = (now - lastStateChange) > STATE_COOLDOWN_MS;

      if (!collapsed && y > HIDE_THRESHOLD && canToggle) {
        header.classList.add('collapsed');
        stats.classList.add('collapsed');
        filterBar.classList.add('stuck');
        collapsed = true;
        lastStateChange = now;
      } else if (collapsed && y < SHOW_THRESHOLD && canToggle) {
        header.classList.remove('collapsed');
        stats.classList.remove('collapsed');
        filterBar.classList.remove('stuck');
        collapsed = false;
        lastStateChange = now;
      }
      scrollTicking = false;
    });
  });
}

function showLoading(show) {
  const loading = document.getElementById('loading');
  const list = document.getElementById('extensions-list');
  const empty = document.getElementById('empty-state');
  
  if (show) {
    if (loadingHideTimeout) {
      clearTimeout(loadingHideTimeout);
    }

    loadingStart = Date.now();
    loading.style.display = 'flex';
    list.style.display = 'none';
    empty.style.display = 'none';
    return;
  } else {
    const elapsed = loadingStart ? Date.now() - loadingStart : MIN_LOADING_MS;
    const waitTime = Math.max(MIN_LOADING_MS - elapsed, 0);

    if (loadingHideTimeout) {
      clearTimeout(loadingHideTimeout);
    }

    loadingHideTimeout = setTimeout(() => {
      loading.style.display = 'none';
    }, waitTime);
  }
}

function renderExtensions(results) {
  const container = document.getElementById('extensions-list');
  const emptyState = document.getElementById('empty-state');
  
  container.innerHTML = '';

  if (results.length === 0) {
    container.style.display = 'none';
    emptyState.style.display = 'flex';

    const emptyMessage = emptyState.querySelector('p.text-sm');
    if (emptyMessage) {
      if (currentFilter === 'active') {
        emptyMessage.textContent = 'No active extensions';
      } else if (currentFilter === 'disabled') {
        emptyMessage.textContent = 'No disabled extensions';
      } else {
        emptyMessage.textContent = 'No extensions installed';
      }
    }
    return;
  }

  container.style.display = 'flex';
  emptyState.style.display = 'none';

  results.sort((a, b) => a.score - b.score);

  // Create document fragment for batch rendering (prevents multiple reflows)
  const fragment = document.createDocumentFragment();
  
  results.forEach(ext => {
    const card = getExtensionCard(ext);
    fragment.appendChild(card);
  });
  
  // Single DOM append - prevents incremental scrollbar resizing
  container.appendChild(fragment);
  
  // Force synchronous layout calculation to stabilize scrollbar
  container.offsetHeight;
}

function attachFilterControls() {
  const filterSelect = document.getElementById('filter-select');
  const sortSelect = document.getElementById('sort-select');

  if (filterSelect) {
    filterSelect.value = currentFilter;
    filterSelect.addEventListener('change', (e) => {
      currentFilter = e.target.value;
      if (isRendering) return;
      isRendering = true;
      applyFilterAndSort();
      setTimeout(() => { isRendering = false; }, 150);
    });
  }

  if (sortSelect) {
    sortSelect.value = currentSort;
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      if (isRendering) return;
      isRendering = true;
      applyFilterAndSort();
      setTimeout(() => { isRendering = false; }, 150);
    });
  }
}

async function exportReport() {
  const results = await getAllScans();
  if (!results || results.length === 0) {
    showToast('No extensions to export', 'info');
    return;
  }

  const csv = generateCSV(results);

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `safeextensions-report-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('✅ Report exported', 'success');
}

function generateCSV(results) {
  const headers = ['Extension Name', 'Version', 'Privacy Score', 'Grade', 'Risk Count', 'Top Risks'];
  const rows = results.map((ext) => {
    const topRisks = ext.risks?.slice(0, 3).map(r => r.title).join('; ') || 'None';
    const grade = ext.grade || '';
    return [
      `"${ext.name}"`,
      ext.version,
      ext.score,
      grade,
      ext.risks?.length || 0,
      `"${topRisks}"`
    ];
  });

  return [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
}

function showToast(message, variant = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  // Reset variant classes
  toast.classList.remove('success', 'error', 'info');
  // Apply variant class
  if (variant === 'success') {
    toast.classList.add('success');
  } else if (variant === 'error') {
    toast.classList.add('error');
  } else {
    toast.classList.add('info');
  }

  toast.classList.add('show');

  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2400);
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

      <!-- Chrome Web Store Link -->
      ${buildStoreUrl(ext.name, ext.extensionId) ? `
        <div class="modal-section">
          <div class="modal-section-title">Store Page</div>
          <a class="text-sm text-blue-600 hover:text-blue-700" href="${buildStoreUrl(ext.name, ext.extensionId)}" target="_blank" rel="noopener noreferrer">Open on Chrome Web Store →</a>
          <p class="text-xs text-slate-500 mt-1">Store data is informational only.</p>
        </div>
      ` : ''}

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

      <!-- Host Permissions -->
      ${ext.hostPermissions && ext.hostPermissions.length > 0 ? `
        <div class="modal-section">
          <div class="modal-section-title flex items-center gap-2">
            <span>Host Permissions (${ext.hostPermissions.length})</span>
            ${hasBroadHostAccess(ext) ? '<span class="pill pill-warning" title="Has access to all sites via host permissions like <all_urls>">Broad access</span>' : ''}
          </div>
          <div class="space-y-1 max-h-32 overflow-y-auto">
            ${ext.hostPermissions.map(p => `
              <div class="flex items-center gap-2 text-sm text-slate-600">
                <span class="text-amber-500">•</span>
                <span title="${p === '<all_urls>' ? 'Has access to all websites' : ''}">${p}</span>
              </div>
            `).join('')}
            ${hasBroadHostAccess(ext) ? `
              <p class="text-xs text-amber-600 mt-2" style="line-height:1.4;">
                This extension can access every site you visit (<all_urls>). It may read or modify content on any page, including banking or email.
              </p>
            ` : ''}
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
                  ${r.type === 'reputation' ? `<span class="text-xs text-slate-400" title="Low rating < 3.0 or few reviews < 10 may indicate poor quality or newness.">ⓘ</span>` : ''}
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

// Disable an extension (requires management permission)
window.disableExtension = async (extensionId) => {
  if (!confirm('Disable this extension? You can re-enable it later.')) return;

  showLoading(true);

  try {
    console.log('🔄 Disabling extension:', extensionId);

    // Step 1: Disable the extension
    await new Promise((resolve, reject) => {
      chrome.management.setEnabled(extensionId, false, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });

    console.log('✅ Extension disabled, triggering rescan...');

    // Step 2: Wait for rescan to complete (with timeout)
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Rescan timeout'));
      }, 5000); // 5 second timeout

      chrome.runtime.sendMessage({ action: 'rescan' }, (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          console.log('✅ Rescan complete:', response);
          resolve();
        }
      });
    });

    // Step 3: Small delay to ensure IndexedDB writes are flushed
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('🔄 Refreshing UI...');

    // Step 4: Reload UI with fresh data
    await loadAndDisplay({ skipLoading: true });
    
    showToast('✅ Extension disabled successfully', 'success');
  } catch (error) {
    const msg = error && error.message ? error.message : String(error);
    console.error('❌ Disable failed:', error);
    showToast('❌ Failed to disable: ' + msg, 'error');
  } finally {
    showLoading(false);
  }
};

// Uninstall an extension (Chrome shows confirmation dialog)
window.uninstallExtension = async (extensionId) => {
  showLoading(true);

  try {
    console.log('🗑️ Uninstalling extension:', extensionId);

    // Step 1: Uninstall the extension (Chrome shows confirmation)
    await new Promise((resolve, reject) => {
      chrome.management.uninstall(
        extensionId,
        { showConfirmDialog: true },
        () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        }
      );
    });

    console.log('✅ Extension uninstalled, triggering rescan...');

    // Step 2: Wait for rescan to complete (with timeout)
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Rescan timeout'));
      }, 5000);

      chrome.runtime.sendMessage({ action: 'rescan' }, (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          console.log('✅ Rescan complete:', response);
          resolve();
        }
      });
    });

    // Step 3: Small delay to ensure IndexedDB writes are flushed
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('🔄 Refreshing UI...');

    // Step 4: Reload UI with fresh data
    await loadAndDisplay({ skipLoading: true });
    
    showToast('✅ Extension uninstalled', 'success');
  } catch (error) {
    console.log('❌ Uninstall cancelled or failed:', error);
    // Don't show error toast (user may have cancelled)
  } finally {
    showLoading(false);
  }
};

function scrollToFirstRisky() {
  // Find first extension with score < 7 (risky)
  const riskyExt = allExtensions.find(ext => ext.score < 7);
  
  if (!riskyExt) {
    showToast('ℹ️ No risky extensions found', 'info');
    return;
  }

  // Find the extension card in the DOM
  const extensionsList = document.getElementById('extensions-list');
  const cards = extensionsList.querySelectorAll('.extension-card');
  
  let targetCard = null;
  cards.forEach(card => {
    const title = card.querySelector('h3')?.textContent;
    if (title === riskyExt.name) {
      targetCard = card;
    }
  });

  if (!targetCard) {
    showToast('❌ Risky extension not found', 'error');
    return;
  }

  // Remove any previous glow effect
  cards.forEach(card => card.classList.remove('glow-highlight'));

  // Add glow effect to the card
  targetCard.classList.add('glow-highlight');

  // Scroll into view with smooth behavior
  targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Remove glow effect after animation completes (3 cycles of 2s = 6s)
  setTimeout(() => {
    targetCard.classList.remove('glow-highlight');
  }, 6000);
}

/* ---------- Onboarding Tour ---------- */

async function initializeOnboardingTour() {
  const overlay = document.getElementById('tour-overlay');
  const popover = document.getElementById('tour-popover');
  tourCutout = document.getElementById('tour-cutout');
  if (!overlay || !popover) {
    console.warn('Tour UI missing; skipping onboarding tour');
    return;
  }

  bindTourControls();
  setupDevReset();

  try {
    const stored = await chrome.storage.local.get({ [TOUR_COMPLETED_KEY]: false });
    const done = stored?.[TOUR_COMPLETED_KEY] === true;
    if (done) return;
    startTour();
  } catch (err) {
    console.error('Tour init failed', err);
  }
}

function bindTourControls() {
  const nextBtn = document.getElementById('tour-next');
  const prevBtn = document.getElementById('tour-prev');
  const skipBtn = document.getElementById('tour-skip');

  if (nextBtn) nextBtn.addEventListener('click', () => advanceTour(1));
  if (prevBtn) prevBtn.addEventListener('click', () => advanceTour(-1));
  if (skipBtn) skipBtn.addEventListener('click', () => endTour({ markComplete: true }));
}

function startTour() {
  const overlay = document.getElementById('tour-overlay');
  const popover = document.getElementById('tour-popover');
  if (!overlay || !popover) return;

  tourState = { active: true, index: 0 };
  overlay.classList.remove('hidden');
  renderTourStep();
}

function endTour({ markComplete } = { markComplete: true }) {
  const overlay = document.getElementById('tour-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }

  tourState.active = false;

  clearTourHighlight();

  if (markComplete) {
    chrome.storage.local
      .set({ [TOUR_COMPLETED_KEY]: true })
      .catch((err) => console.error('Tour completion save failed', err));
  }
}

function advanceTour(delta) {
  if (!tourState.active) return;

  const nextIndex = tourState.index + delta;

  if (nextIndex < 0) return;
  if (nextIndex >= TOUR_STEPS.length) {
    endTour({ markComplete: true });
    return;
  }

  tourState.index = nextIndex;
  renderTourStep();
}

function renderTourStep() {
  const popover = document.getElementById('tour-popover');
  const overlay = document.getElementById('tour-overlay');
  const textEl = document.getElementById('tour-step-text');

  if (!popover || !overlay || !textEl) return;

  const step = TOUR_STEPS[tourState.index];
  textEl.textContent = step?.text || '';

  const target = step?.selector ? document.querySelector(step.selector) : null;
  applyTourHighlight(target);
  updateCutout(target);
  positionTourPopover(target, popover, overlay);
  updateTourButtons();
}

function positionTourPopover(target, popover, overlay) {
  const padding = 12;
  popover.style.transform = '';

  if (target) {
    const rect = target.getBoundingClientRect();
    const overlayWidth = overlay.clientWidth || window.innerWidth;
    const left = Math.max(padding, Math.min(rect.left, overlayWidth - popover.offsetWidth - padding));
    const top = Math.max(padding, rect.bottom + 8);

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
    return;
  }

  popover.style.left = '50%';
  popover.style.top = '50%';
  popover.style.transform = 'translate(-50%, -50%)';
}

function applyTourHighlight(target) {
  clearTourHighlight();

  if (!target) return;

  tourHighlightEl = target;
  tourHighlightPrev = {
    zIndex: target.style.zIndex,
    position: target.style.position,
    filter: target.style.filter
  };

  if (!target.style.position || target.style.position === 'static') {
    target.style.position = 'relative';
  }
  target.style.zIndex = '13000';
  target.style.filter = 'none';

  const container = findStackingContext(target.parentElement);
  if (container) {
    tourHighlightContainer = container;
    tourHighlightContainerPrev = {
      zIndex: container.style.zIndex,
      position: container.style.position
    };

    if (!container.style.position || container.style.position === 'static') {
      container.style.position = 'relative';
    }
    container.style.zIndex = '12500';
  }

  tourHighlightEl.classList.add('tour-highlight');
}

function clearTourHighlight() {
  if (!tourHighlightEl) return;

  tourHighlightEl.classList.remove('tour-highlight');

  if (tourHighlightPrev) {
    tourHighlightEl.style.zIndex = tourHighlightPrev.zIndex || '';
    tourHighlightEl.style.position = tourHighlightPrev.position || '';
    tourHighlightEl.style.filter = tourHighlightPrev.filter || '';
  }

  if (tourHighlightContainer) {
    if (tourHighlightContainerPrev) {
      tourHighlightContainer.style.zIndex = tourHighlightContainerPrev.zIndex || '';
      tourHighlightContainer.style.position = tourHighlightContainerPrev.position || '';
    }
    tourHighlightContainer = null;
    tourHighlightContainerPrev = null;
  }

  tourHighlightEl = null;
  tourHighlightPrev = null;

  updateCutout(null);
}

function findStackingContext(el) {
  let node = el;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    const positionCreates = ['relative', 'absolute', 'fixed', 'sticky'].includes(style.position);
    const zSet = style.zIndex !== 'auto';
    const transformSet = style.transform !== 'none' || style.filter !== 'none' || style.perspective !== 'none';
    if (positionCreates && zSet) return node;
    if (transformSet) return node;
    node = node.parentElement;
  }
  return null;
}

function updateCutout(target) {
  if (!tourCutout) return;
  const backdrop = document.getElementById('tour-backdrop');

  if (!target) {
    tourCutout.classList.add('hidden');
    tourCutout.style.width = '';
    tourCutout.style.height = '';
    tourCutout.style.left = '';
    tourCutout.style.top = '';
    if (backdrop) backdrop.classList.remove('no-blur');
    return;
  }

  const rect = target.getBoundingClientRect();
  const pad = 6;

  tourCutout.classList.remove('hidden');
  tourCutout.style.width = `${Math.max(0, rect.width + pad * 2)}px`;
  tourCutout.style.height = `${Math.max(0, rect.height + pad * 2)}px`;
  tourCutout.style.left = `${rect.left - pad}px`;
  tourCutout.style.top = `${rect.top - pad}px`;

  if (backdrop) {
    if (target.id === 'scan-now') {
      backdrop.classList.add('no-blur');
    } else {
      backdrop.classList.remove('no-blur');
    }
  }
}

function updateTourButtons() {
  const prevBtn = document.getElementById('tour-prev');
  const nextBtn = document.getElementById('tour-next');

  if (!prevBtn || !nextBtn) return;

  prevBtn.disabled = tourState.index === 0;
  const isLast = tourState.index === TOUR_STEPS.length - 1;
  nextBtn.textContent = isLast ? 'Done' : 'Next';
}

function setupDevReset() {
  const resetBtn = document.getElementById('tour-reset');
  if (!resetBtn) return;

  const isDev = new URLSearchParams(location.search).get('dev') === '1';
  if (!isDev) return;

  resetBtn.classList.remove('hidden');
  resetBtn.addEventListener('click', async () => {
    try {
      await chrome.storage.local.remove(TOUR_COMPLETED_KEY);
      tourState = { active: false, index: 0 };
      startTour();
    } catch (err) {
      console.error('Tour reset failed', err);
    }
  });
}

