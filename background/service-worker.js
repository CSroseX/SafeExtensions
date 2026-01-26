import { scanExtensions } from './scanner.js';
import { saveScan, getAllScans } from '../libs/storage.js';

// Initial scan on install
chrome.runtime.onInstalled.addListener(async () => {
  try {
    await scanExtensions();
  } catch (error) {
    console.error('Initial scan failed:', error);
  }
});

// Handle rescan requests from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'rescan') {
    scanExtensions()
      .then((result) => {
        sendResponse({ success: true, ...result });
      })
      .catch((error) => {
        console.error('Rescan failed:', error);
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
    try {
      await scanExtensions();
      chrome.runtime.sendMessage({ action: 'extension-state-changed' });
    } catch (error) {
      console.error('Debounced rescan failed:', error);
    }
  }, 500);
};

chrome.management.onEnabled.addListener(async (info) => {
  await updateExtensionState(info.id, true);
  debounceScanAndNotify('onEnabled');
});

chrome.management.onDisabled.addListener(async (info) => {
  await updateExtensionState(info.id, false);
  debounceScanAndNotify('onDisabled');
});

chrome.management.onInstalled.addListener(async (info) => {
  debounceScanAndNotify('onInstalled');
});

chrome.management.onUninstalled.addListener(async (id) => {
  debounceScanAndNotify('onUninstalled');
});

async function updateExtensionState(extensionId, enabled) {
  try {
    const scans = await getAllScans();
    const scan = scans.find(s => s.extensionId === extensionId);
    if (scan) {
      scan.enabled = enabled;
      await saveScan(scan);
    }
  } catch (error) {
    console.error('Failed to update extension state in DB:', error);
  }
}