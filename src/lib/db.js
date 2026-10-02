import { openDB } from 'idb';

export const dbPromise = openDB('mcat-app', 1, {
  upgrade(db) {
    db.createObjectStore('notes', { keyPath: 'id' });
    db.createObjectStore('cards', { keyPath: 'id' });
    // append-only event log — never overwritten, only added to
    const log = db.createObjectStore('reviewEvents', { keyPath: 'id', autoIncrement: true });
    log.createIndex('byCard', 'cardId');
  },
});