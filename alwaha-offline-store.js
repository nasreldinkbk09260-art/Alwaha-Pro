(() => {
  'use strict';

  const DB_NAME = 'alwaha-private-offline-v1';
  const DB_VERSION = 1;
  const MAX_RECORD_BYTES = 4 * 1024 * 1024;
  const ALLOWED_KINDS = new Set([
    'profile',
    'direct-conversations',
    'direct-messages',
    'market-conversations',
    'market-messages',
    'notifications',
    'friends'
  ]);
  let dbPromise = null;
  const keyLocks = new Map();

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window) || !window.crypto?.subtle) {
        reject(new Error('encrypted_offline_storage_unavailable'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys', { keyPath: 'userId' });
        if (!db.objectStoreNames.contains('records')) {
          const records = db.createObjectStore('records', { keyPath: 'id' });
          records.createIndex('userId', 'userId', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('offline_db_open_failed'));
      request.onblocked = () => reject(new Error('offline_db_upgrade_blocked'));
    }).catch(error => {
      dbPromise = null;
      throw error;
    });
    return dbPromise;
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('offline_db_request_failed'));
    });
  }

  async function transaction(storeName, mode, action) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let value;
      try { value = action(store); }
      catch (error) { reject(error); return; }
      tx.oncomplete = () => resolve(value?.result);
      tx.onerror = () => reject(tx.error || new Error('offline_db_transaction_failed'));
      tx.onabort = () => reject(tx.error || new Error('offline_db_transaction_aborted'));
    });
  }

  async function getKey(userId) {
    const existing = await transaction('keys', 'readonly', store => store.get(userId));
    if (existing?.key) return existing.key;
    if (keyLocks.has(userId)) return keyLocks.get(userId);
    const promise = (async () => {
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      await transaction('keys', 'readwrite', store => store.put({ userId, key, createdAt: Date.now() }));
      const saved = await transaction('keys', 'readonly', store => store.get(userId));
      if (!saved?.key) throw new Error('offline_crypto_key_not_persisted');
      return saved.key;
    })().finally(() => keyLocks.delete(userId));
    keyLocks.set(userId, promise);
    return promise;
  }

  function makeId(userId, kind, scope) {
    return userId + '|' + kind + '|' + scope;
  }

  async function save(userId, kind, scope, value) {
    userId = String(userId || '');
    kind = String(kind || '');
    scope = String(scope || 'default');
    if (!userId || !ALLOWED_KINDS.has(kind)) return false;
    const plain = JSON.stringify(value);
    const bytes = new TextEncoder().encode(plain);
    if (bytes.byteLength > MAX_RECORD_BYTES) return false;
    const key = await getKey(userId);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aad = new TextEncoder().encode(makeId(userId, kind, scope));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, bytes);
    await transaction('records', 'readwrite', store => store.put({
      id: makeId(userId, kind, scope),
      userId, kind, scope,
      iv: Array.from(iv),
      cipher,
      updatedAt: Date.now(),
      byteLength: bytes.byteLength
    }));
    return true;
  }

  async function load(userId, kind, scope = 'default') {
    userId = String(userId || '');
    kind = String(kind || '');
    scope = String(scope || 'default');
    if (!userId || !ALLOWED_KINDS.has(kind)) return null;
    const row = await transaction('records', 'readonly', store => store.get(makeId(userId, kind, scope)));
    if (!row?.cipher || !Array.isArray(row.iv)) return null;
    const key = await getKey(userId);
    const aad = new TextEncoder().encode(makeId(userId, kind, scope));
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(row.iv), additionalData: aad },
      key,
      row.cipher
    );
    return JSON.parse(new TextDecoder().decode(plain));
  }

  async function clearUser(userId) {
    userId = String(userId || '');
    if (!userId) return false;
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['keys', 'records'], 'readwrite');
      tx.objectStore('keys').delete(userId);
      const index = tx.objectStore('records').index('userId');
      const cursor = index.openCursor(IDBKeyRange.only(userId));
      cursor.onsuccess = () => {
        const item = cursor.result;
        if (item) { item.delete(); item.continue(); }
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('offline_user_clear_failed'));
      tx.onabort = () => reject(tx.error || new Error('offline_user_clear_aborted'));
    });
    return true;
  }

  window.AlwahaOfflineStore = Object.freeze({
    ready: () => openDb().then(() => true).catch(() => false),
    save,
    load,
    clearUser
  });
})();
