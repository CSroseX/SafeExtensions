import { analyzeRisk } from './risk-analyzer.js';
import { saveScan, getAllScans, deleteScan } from '../libs/storage.js';

export async function scanExtensions() {
  return new Promise((resolve, reject) => {
    chrome.management.getAll(async (extensions) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Failed to get extensions:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
        return;
      }

      try {
        console.log('🔍 Starting extension scan...');

        const allExtensions = extensions.filter(e => e.type === 'extension');
        const enabledCount = allExtensions.filter(e => e.enabled).length;
        const disabledCount = allExtensions.length - enabledCount;

        console.log(`📊 Found ${allExtensions.length} total extensions`);
        console.log(`  ✅ Active: ${enabledCount}`);
        console.log(`  ⏸️  Disabled: ${disabledCount}`);
        console.log(`🔍 Raw extension data:`, allExtensions.map(e => ({ id: e.id, name: e.name, enabled: e.enabled })));

        // Get stored scans and track IDs for cleanup
        const storedScans = await getAllScans();
        const currentExtIds = new Set(allExtensions.map(e => e.id));

        console.log(`📦 Stored scans: ${storedScans.length}`);
        console.log(`🔍 Stored scan enabled states:`, storedScans.map(s => ({ id: s.extensionId, name: s.name, enabled: s.enabled })));

        // Delete scans for uninstalled extensions
        const deletePromises = [];
        for (const scan of storedScans) {
          if (!currentExtIds.has(scan.extensionId)) {
            console.log(`🗑️ Removing uninstalled: ${scan.name}`);
            deletePromises.push(deleteScan(scan.extensionId));
          }
        }
        await Promise.all(deletePromises);
        console.log(`✅ Cleaned up ${deletePromises.length} uninstalled extension(s)`);

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

          const analysis = await analyzeRisk({ ...ext, ...metadata });

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

          console.log(`💾 Saving ${ext.name}: enabled=${ext.enabled} (type: ${typeof ext.enabled})`);
          savePromises.push(saveScan(scanData));
        }

        await Promise.all(savePromises);
        console.log(`✅ Saved ${savePromises.length} extension scan(s)`);

        // Verify what was saved
        const verifySaved = await getAllScans();
        console.log(`🔍 Verification - Scans after save:`, verifySaved.map(s => ({ name: s.name, enabled: s.enabled })));

        console.log('✅ Scan complete!');

        resolve({ total: allExtensions.length, active: enabledCount, disabled: disabledCount, deleted: deletePromises.length });
      } catch (error) {
        console.error('❌ Scan error:', error);
        reject(error);
      }
    });
  });
}
