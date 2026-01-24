import { analyzeRisk } from './risk-analyzer.js';
import { saveScan } from '../libs/storage.js';

export async function scanExtensions() {
  chrome.management.getAll(async (extensions) => {
    for (const ext of extensions) {
      if (!ext.enabled) continue;

      const analysis = analyzeRisk(ext);

      await saveScan({
        extensionId: ext.id,
        name: ext.name,
        version: ext.version,
        permissions: ext.permissions || [],
        score: analysis.score,
        risks: analysis.risks,
        scannedAt: Date.now()
      });
    }
  });
}
