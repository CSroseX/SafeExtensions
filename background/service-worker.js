import { scanExtensions } from './scanner.js';
import { saveScan, getAllScans } from '../libs/storage.js';

// Initial scan on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('🚀 SafeExtensions installed, running initial scan...');
  try {
    await scanExtensions();
    console.log('✅ Initial scan complete');
  } catch (error) {
    console.error('❌ Initial scan failed:', error);
  }
});

// Handle rescan requests from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'rescan') {
    console.log('🔄 Rescan requested from popup');
    
    scanExtensions()
      .then((result) => {
        console.log('✅ Rescan complete:', result);
        sendResponse({ success: true, ...result });
      })
      .catch((error) => {
        console.error('❌ Rescan failed:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep message channel open for async response
  }
});

// Debounced state change handler to avoid rapid double rescans
let stateChangeTimeout;
const debounceScanAndNotify = (label) => {
  clearTimeout(stateChangeTimeout);
  stateChangeTimeout = setTimeout(async () => {
    console.log(label, '→ triggering debounced rescan');
    try {
      await scanExtensions();
      chrome.runtime.sendMessage({ action: 'extension-state-changed' });
    } catch (error) {
      console.error('❌ Debounced rescan failed:', error);
    }
  }, 500);
};

chrome.management.onEnabled.addListener(async (info) => {
  console.log('📦 Extension enabled:', info.name);
  await updateExtensionState(info.id, true);
  debounceScanAndNotify('onEnabled');
});

chrome.management.onDisabled.addListener(async (info) => {
  console.log('📦 Extension disabled:', info.name);
  await updateExtensionState(info.id, false);
  debounceScanAndNotify('onDisabled');
});

chrome.management.onInstalled.addListener(async (info) => {
  console.log('📦 New extension installed:', info.name);
  debounceScanAndNotify('onInstalled');
});

chrome.management.onUninstalled.addListener(async (id) => {
  console.log('📦 Extension uninstalled:', id);
  debounceScanAndNotify('onUninstalled');
});

async function updateExtensionState(extensionId, enabled) {
  try {
    const scans = await getAllScans();
    const scan = scans.find(s => s.extensionId === extensionId);
    if (scan) {
      scan.enabled = enabled;
      await saveScan(scan);
      console.log(`✅ Updated ${scan.name} state: enabled=${enabled}`);
    }
  } catch (error) {
    console.error('❌ Failed to update extension state in DB:', error);
  }
}