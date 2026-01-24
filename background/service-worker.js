import { scanExtensions } from './scanner.js';

chrome.runtime.onInstalled.addListener(() => {
  scanExtensions();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'rescan') {
    scanExtensions().then(() => sendResponse(true));
    return true;
  }
});
