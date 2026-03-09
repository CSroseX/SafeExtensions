const DB_NAME = 'privacy_guardian_db';
const STORE_NAME = 'scans';
const DB_VERSION = 1;

function isQuotaError(error) {
  const name = error?.name || '';
  const message = String(error?.message || '').toLowerCase();
  return name === 'QuotaExceededError' || message.includes('quota');
}

function putScan(db, scan) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(scan);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('IndexedDB write aborted'));
  });
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'extensionId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveScan(scan) {
  const db = await openDB();

  try {
    await putScan(db, scan);
    return;
  } catch (error) {
    if (!isQuotaError(error)) throw error;
  }

  await clearScans();
  await putScan(db, scan);
}

export async function getAllScans() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function clearScans() {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteScan(extensionId) {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(extensionId);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    
    // Wait for transaction to complete
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}