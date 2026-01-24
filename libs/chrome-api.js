export function getInstalledExtensions() {
  return new Promise(resolve => {
    chrome.management.getAll(exts => {
      resolve(exts || []);
    });
  });
}
