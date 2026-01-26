import { analyzeRisk } from './risk-analyzer.js';
import { saveScan, getAllScans, deleteScan } from '../libs/storage.js';

export async function scanExtensions() {
  return new Promise((resolve, reject) => {
    chrome.management.getAll(async (extensions) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to get extensions:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
        return;
      }

      try {
        const allExtensions = extensions.filter(e => e.type === 'extension');
        const enabledCount = allExtensions.filter(e => e.enabled).length;
        const disabledCount = allExtensions.length - enabledCount;

        // Get stored scans and track IDs for cleanup
        const storedScans = await getAllScans();
        const currentExtIds = new Set(allExtensions.map(e => e.id));

        // Delete scans for uninstalled extensions
        const deletePromises = [];
        for (const scan of storedScans) {
          if (!currentExtIds.has(scan.extensionId)) {
            deletePromises.push(deleteScan(scan.extensionId));
          }
        }
        await Promise.all(deletePromises);

        // Scan and save ALL extensions (active + disabled)
        // CRITICAL: Always set enabled flag explicitly to ensure it's in the database
        const savePromises = [];
        for (const ext of allExtensions) {
          // Temporal metadata (age)
          let installTimeMs = null;
          if (typeof ext.installTime === 'number') {
            installTimeMs = ext.installTime;
          } else if (ext.installTime instanceof Date) {
            installTimeMs = ext.installTime.getTime();
          }

          const daysSinceInstall = installTimeMs
            ? Math.floor((Date.now() - installTimeMs) / (1000 * 60 * 60 * 24))
            : null;

          const metadata = {
            installDate: installTimeMs ? new Date(installTimeMs).toISOString() : null,
            daysSinceInstall
          };

          // Pass full extension object including manifest to analyzer
          const analysis = await analyzeRisk({ 
            ...ext, 
            ...metadata,
            manifest: ext // The ext object contains manifest data from chrome.management API
          });

          const scanData = {
            extensionId: ext.id,
            name: ext.name,
            version: ext.version,
            enabled: ext.enabled, // ← CRITICAL: Must be explicitly set (boolean)
            permissions: ext.permissions || [],
            hostPermissions: ext.hostPermissions || [],
            installType: ext.installType,
            installDate: metadata.installDate,
            daysSinceInstall: metadata.daysSinceInstall,
            score: analysis.score,
            grade: analysis.grade,
            risks: analysis.risks,
            scannedAt: Date.now()
          };

          savePromises.push(saveScan(scanData));
        }

        await Promise.all(savePromises);

        resolve({ total: allExtensions.length, active: enabledCount, disabled: disabledCount, deleted: deletePromises.length });
      } catch (error) {
        console.error('Scan error:', error);
        reject(error);
      }
    });
  });
}
