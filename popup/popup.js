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
  chrome.runtime.sendMessage({ action: 'rescan' }, async (_response) => {
    if (chrome.runtime.lastError) {
      await loadAndDisplay();
      attachListeners();
      attachDelegatedActions();
      attachScrollBehavior();
      initializeOnboardingTour();
      showToast('Unable to sync with background scan. Showing last saved results.', 'error');
      return;
    }

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

  // Log any records missing enabled field
  const missingEnabled = allExtensions.filter(e => e.enabled === undefined);
  if (missingEnabled.length > 0) {
    console.warn(`${missingEnabled.length} records missing 'enabled' field:`, missingEnabled.map(e => e.name));
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

// Removed unused function - kept for potential future use
// function hasAnyAccess(ext) {
//   const hosts = ext.hostPermissions || [];
//   return hosts.length > 0;
// }

function updateTabCounts(results) {
  const allCount = results.length || 0;
  const activeCount = results.filter(r => r.enabled === true).length || 0;
  const disabledCount = results.filter(r => r.enabled !== true).length || 0; // Catch both false and undefined

  const counts = {
    all: allCount,
    active: activeCount,
    disabled: disabledCount
  };

  Object.entries(counts).forEach(([key, value]) => {
    const el = document.getElementById(`filter-count-${key}`);
    if (el) el.textContent = value;
  });
}

function filterExtensions(extensions, filter) {
  switch (filter) {
    case 'active':
      return extensions.filter(ext => ext.enabled === true);
    case 'disabled':
      return extensions.filter(ext => ext.enabled !== true);
    case 'all':
    default:
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
    
    // Primary sort: by bucket order
    if (bucketA !== bucketB) {
      return order.indexOf(bucketA) - order.indexOf(bucketB);
    }
    
    // Secondary sort: within same bucket
    // For risky first (ascending): show lowest scores first (riskiest first)
    if (sortBy === 'risky') {
      return (a.score || 0) - (b.score || 0);
    }
    // For safe first or medium first (descending): show highest scores first
    else {
      return (b.score || 0) - (a.score || 0);
    }
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

// Modal control functions (declared early for event listeners)
window.closeDetailsModal = () => {
  const modal = document.getElementById('details-modal');
  modal.classList.remove('show');
  modal.style.display = 'none';
};

function openDisclaimerModal() {
  const modal = document.getElementById('disclaimer-modal');
  if (modal) {
    modal.classList.add('show');
    modal.style.display = 'flex';
  }
}

function closeDisclaimerModal() {
  const modal = document.getElementById('disclaimer-modal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

function attachListeners() {
  document.getElementById('scan-now').addEventListener('click', async () => {
    showLoading(true);

    chrome.runtime.sendMessage({ action: 'rescan' }, async (response) => {
      try {
        if (chrome.runtime.lastError || response?.success === false) {
          const message = response?.error || chrome.runtime.lastError?.message || 'Scan failed';
          showToast(`Scan failed: ${message}`, 'error');
          return;
        }
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
    btn.addEventListener('click', window.closeDetailsModal);
  });

  // Click outside modal content closes modal
  const modalOverlay = document.getElementById('details-modal');
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      window.closeDetailsModal();
    }
  });

  // Disclaimer modal handlers
  const disclaimerBtn = document.getElementById('disclaimer-btn');
  if (disclaimerBtn) {
    disclaimerBtn.addEventListener('click', openDisclaimerModal);
  }

  document.querySelectorAll('[data-close-disclaimer]').forEach((btn) => {
    btn.addEventListener('click', closeDisclaimerModal);
  });

  const disclaimerModalOverlay = document.getElementById('disclaimer-modal');
  if (disclaimerModalOverlay) {
    disclaimerModalOverlay.addEventListener('click', (e) => {
      if (e.target === disclaimerModalOverlay) {
        closeDisclaimerModal();
      }
    });
  }
}

function attachDelegatedActions() {
  // Handle button clicks (uninstall, view details)
  document.addEventListener('click', async (event) => {
    const target = event.target.closest('button');
    if (!target) return;

    const extensionId = target.dataset.extensionId;
    if (!extensionId) return;

    if (target.classList.contains('uninstall-btn')) {
      await window.uninstallExtension(extensionId);
      return;
    }

    if (target.classList.contains('view-details-btn')) {
      await window.viewDetails(extensionId);
    }
  });

  // Handle toggle switch changes
  document.addEventListener('change', async (event) => {
    const target = event.target;
    if (!target.classList.contains('toggle-disable-btn')) return;

    const extensionId = target.dataset.extensionId;
    if (!extensionId) return;

    // If toggling ON (checked), enable the extension
    if (target.checked) {
      await window.enableExtension(extensionId);
    } else {
      // If toggling OFF (unchecked), disable the extension
      await window.disableExtension(extensionId);
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
  const COLLAPSE_START = 40;  // Start fading out
  const COLLAPSE_END = 80;    // Fully collapsed
  const EXPAND_THRESHOLD = 30; // Start expanding back
  
  list.addEventListener('scroll', () => {
    if (scrollTicking) return;
    
    scrollTicking = true;
    
    requestAnimationFrame(() => {
      const scrollTop = list.scrollTop;
      
      // Gradual fade on scroll down
      if (scrollTop >= COLLAPSE_START && !collapsed) {
        const progress = Math.min((scrollTop - COLLAPSE_START) / (COLLAPSE_END - COLLAPSE_START), 1);
        
        // Fade out gradually
        header.style.opacity = 1 - progress;
        stats.style.opacity = 1 - progress;
        header.style.transform = `translateY(${-progress * 20}px)`;
        stats.style.transform = `translateY(${-progress * 20}px)`;
        
        // Fully collapse at end of range
        if (scrollTop >= COLLAPSE_END) {
          header.classList.add('collapsed');
          stats.classList.add('collapsed');
          filterBar.classList.add('stuck');
          collapsed = true;
        }
      }
      
      // Expand on scroll up
      else if (scrollTop < EXPAND_THRESHOLD && collapsed) {
        header.classList.remove('collapsed');
        stats.classList.remove('collapsed');
        filterBar.classList.remove('stuck');
        collapsed = false;
        
        // Reset inline styles
        header.style.opacity = '';
        stats.style.opacity = '';
        header.style.transform = '';
        stats.style.transform = '';
      }
      
      // In-between zone (expanding back up)
      else if (scrollTop < COLLAPSE_START && scrollTop > 0 && !collapsed) {
        const progress = scrollTop / COLLAPSE_START;
        header.style.opacity = 1 - (progress * 0.2); // Subtle fade hint
        stats.style.opacity = 1 - (progress * 0.2);
      }
      
      scrollTicking = false;
    });
  }, { passive: true });
}

function showLoading(show) {
  const loading = document.getElementById('loading');
  const list = document.getElementById('extensions-list');
  const empty = document.getElementById('empty-state');
  
  // Guard against missing elements
  if (!loading || !list || !empty) {
    console.warn('Loading elements not found:', { loading, list, empty });
    return;
  }
  
  if (show) {
    if (loadingHideTimeout) {
      clearTimeout(loadingHideTimeout);
    }

    loadingStart = Date.now();
    loading.style.display = 'flex';
    list.style.display = 'flex';
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
  
  // Guard against missing elements
  if (!container || !emptyState) {
    console.warn('Container elements not found');
    return;
  }
  
  // Remove only extension cards, preserve loading element
  const cards = container.querySelectorAll('.extension-card');
  cards.forEach(card => card.remove());

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

  // Create document fragment for batch rendering (prevents multiple reflows)
  const fragment = document.createDocumentFragment();
  
  results.forEach(ext => {
    const card = getExtensionCard(ext);
    fragment.appendChild(card);
  });
  
  // Append cards to container (preserving loading element)
  const loadingEl = container.querySelector('#loading');
  if (loadingEl && loadingEl.nextSibling) {
    // Insert after loading element
    container.insertBefore(fragment, loadingEl.nextSibling);
  } else {
    // No loading element or it's the last child, just append
    container.appendChild(fragment);
  }
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

function safeSeverityClass(severity) {
  const allowed = new Set(['critical', 'high', 'medium', 'low']);
  return allowed.has(severity) ? severity : 'low';
}

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function createModalSection(titleText) {
  const section = createElement('div', 'modal-section');
  section.appendChild(createElement('div', 'modal-section-title', titleText));
  return section;
}


/* ---------- Global Actions ---------- */

window.viewDetails = async (extensionId) => {
  const scans = await getAllScans();
  const ext = scans.find(s => s.extensionId === extensionId);
  if (!ext) return;

  const riskLevel = ext.score >= 7 ? 'safe' : ext.score >= 5 ? 'medium' : ext.score >= 3 ? 'high' : 'critical';
  const safeStoreUrl = buildStoreUrl(ext.name, ext.extensionId);

  const modalTitle = document.getElementById('modal-title');
  const modalContent = document.getElementById('modal-content');
  modalTitle.textContent = ext.name || '';
  modalContent.replaceChildren();

  const root = createElement('div', 'space-y-4');

  const scoreSection = createModalSection('Privacy Score');
  const scoreRow = createElement('div', 'flex items-center justify-between');
  const scoreValueClass = riskLevel === 'critical'
    ? 'text-red-600'
    : riskLevel === 'high'
      ? 'text-orange-600'
      : riskLevel === 'medium'
        ? 'text-blue-600'
        : 'text-emerald-600';
  const scoreValue = createElement('span', `text-2xl font-bold ${scoreValueClass}`, `${ext.score}/10`);
  const scoreBadge = createElement('span', `score-badge ${riskLevel}`, ext.score >= 7 ? 'Safe' : ext.score >= 5 ? 'Caution' : 'Risky');
  scoreRow.appendChild(scoreValue);
  scoreRow.appendChild(scoreBadge);
  scoreSection.appendChild(scoreRow);
  root.appendChild(scoreSection);

  const versionSection = createModalSection('Version');
  versionSection.appendChild(createElement('p', 'text-sm text-slate-700', ext.version || ''));
  root.appendChild(versionSection);

  if (safeStoreUrl) {
    const storeSection = createModalSection('Store Page');
    const link = createElement('a', 'text-sm text-blue-600 hover:text-blue-700', 'Open on Chrome Web Store →');
    link.href = safeStoreUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    storeSection.appendChild(link);
    storeSection.appendChild(createElement('p', 'text-xs text-slate-500 mt-1', 'Store data is informational only.'));
    root.appendChild(storeSection);
  }

  if (ext.permissions && ext.permissions.length > 0) {
    const permSection = createModalSection(`Permissions (${ext.permissions.length})`);
    const list = createElement('div', 'space-y-1 max-h-32 overflow-y-auto');
    ext.permissions.forEach((permission) => {
      const row = createElement('div', 'flex items-center gap-2 text-sm text-slate-600');
      row.appendChild(createElement('span', 'text-blue-500', '•'));
      row.appendChild(createElement('span', '', permission));
      list.appendChild(row);
    });
    permSection.appendChild(list);
    root.appendChild(permSection);
  }

  if (ext.hostPermissions && ext.hostPermissions.length > 0) {
    const hostSection = createElement('div', 'modal-section');
    const hostTitle = createElement('div', 'modal-section-title flex items-center gap-2');
    hostTitle.appendChild(createElement('span', '', `Host Permissions (${ext.hostPermissions.length})`));
    if (hasBroadHostAccess(ext)) {
      const broad = createElement('span', 'pill pill-warning', 'Broad access');
      broad.title = 'Has access to all sites via host permissions like <all_urls>';
      hostTitle.appendChild(broad);
    }
    hostSection.appendChild(hostTitle);

    const hostList = createElement('div', 'space-y-1 max-h-32 overflow-y-auto');
    ext.hostPermissions.forEach((hostPermission) => {
      const row = createElement('div', 'flex items-center gap-2 text-sm text-slate-600');
      row.appendChild(createElement('span', 'text-amber-500', '•'));
      const text = createElement('span', '', hostPermission);
      if (hostPermission === '<all_urls>') {
        text.title = 'Has access to all websites';
      }
      row.appendChild(text);
      hostList.appendChild(row);
    });

    if (hasBroadHostAccess(ext)) {
      const note = createElement(
        'p',
        'text-xs text-amber-600 mt-2',
        'This extension can access every site you visit (<all_urls>). It may read or modify content on any page, including banking or email.'
      );
      note.style.lineHeight = '1.4';
      hostList.appendChild(note);
    }

    hostSection.appendChild(hostList);
    root.appendChild(hostSection);
  }

  if (ext.risks && ext.risks.length > 0) {
    const riskSection = createModalSection(`Detected Risks (${ext.risks.length})`);
    const riskList = createElement('div', 'space-y-2');

    ext.risks.forEach((risk) => {
      const riskRow = createElement('div', `risk-indicator ${safeSeverityClass(risk.severity)}`);
      const riskIcon = createElement('span', '', risk.severity === 'critical' ? '🚨' : risk.severity === 'high' ? '⚠️' : '⚡');
      const body = createElement('div', 'flex-1');
      body.appendChild(createElement('p', 'text-sm font-medium text-slate-800', risk.title || ''));

      if (risk.description) {
        body.appendChild(createElement('p', 'text-xs text-slate-600 mt-0.5', risk.description));
      }

      if (risk.type === 'reputation') {
        const info = createElement('span', 'text-xs text-slate-400', 'ⓘ');
        info.title = 'Low rating < 3.0 or few reviews < 10 may indicate poor quality or newness.';
        body.appendChild(info);
      }

      riskRow.appendChild(riskIcon);
      riskRow.appendChild(body);
      riskList.appendChild(riskRow);
    });

    riskSection.appendChild(riskList);
    root.appendChild(riskSection);
  } else {
    const noRiskSection = createElement('div', 'modal-section');
    noRiskSection.appendChild(createElement('p', 'text-sm text-slate-600', '✅ No major risks detected'));
    root.appendChild(noRiskSection);
  }

  modalContent.appendChild(root);

  document.getElementById('details-modal').classList.add('show');
  document.getElementById('details-modal').style.display = 'flex';
};

/* ---------- Global Actions ---------- */

// Enable a disabled extension
window.enableExtension = async (extensionId) => {
  showLoading(true);

  try {
    // Step 1: Enable the extension
    await new Promise((resolve, reject) => {
      chrome.management.setEnabled(extensionId, true, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });

    // Step 2: Wait for rescan to complete (with timeout)
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Rescan timeout'));
      }, 5000); // 5 second timeout

      chrome.runtime.sendMessage({ action: 'rescan' }, (_response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });

    // Step 3: Small delay to ensure IndexedDB writes are flushed
    await new Promise(resolve => setTimeout(resolve, 100));

    // Step 4: Reload UI with fresh data (extension will move to Active filter)
    await loadAndDisplay({ skipLoading: true });
    
    showToast('✅ Extension enabled successfully', 'success');
  } catch (error) {
    const msg = error && error.message ? error.message : String(error);
    console.error('❌ Enable failed:', error);
    showToast('❌ Failed to enable: ' + msg, 'error');
  } finally {
    showLoading(false);
  }
};

// Disable an extension (requires management permission)
window.disableExtension = async (extensionId) => {
  if (!confirm('Disable this extension? You can re-enable it later.')) return;

  showLoading(true);

  try {
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

    // Step 2: Wait for rescan to complete (with timeout)
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Rescan timeout'));
      }, 5000); // 5 second timeout

      chrome.runtime.sendMessage({ action: 'rescan' }, (_response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });

    // Step 3: Small delay to ensure IndexedDB writes are flushed
    await new Promise(resolve => setTimeout(resolve, 100));

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

    // Step 2: Wait for rescan to complete (with timeout)
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Rescan timeout'));
      }, 5000);

      chrome.runtime.sendMessage({ action: 'rescan' }, (_response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });

    // Step 3: Small delay to ensure IndexedDB writes are flushed
    await new Promise(resolve => setTimeout(resolve, 100));

    // Step 4: Reload UI with fresh data
    await loadAndDisplay({ skipLoading: true });
    
    showToast('✅ Extension uninstalled', 'success');
  } catch (_error) {
    return;
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

  // SMOOTH SCROLL: Use manual scrolling instead of scrollIntoView
  const list = document.getElementById('extensions-list');
  const targetPosition = targetCard.offsetTop - 100; // 100px offset from top

  // Smooth scroll with easing
  list.scrollTo({
    top: targetPosition,
    behavior: 'smooth'
  });

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

