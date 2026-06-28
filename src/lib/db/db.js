
/**
 * @typedef {import('../../lib/models/timeEntry.js').TimeEntry} TimeEntry
 */

const DB_NAME = 'ClockInClockOutDB';
const DB_VERSION = 2;
const STORE_NAME = 'timeEntries';

let db;

/**
 * Initializes the IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
export function initializeDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            /** @type {IDBDatabase} */
            const db = event.target.result;
            /** @type {IDBTransaction} */
            const transaction = event.target.transaction;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                objectStore.createIndex('type', 'type', { unique: false });
            } else if (event.oldVersion < 2 && transaction) {
                const objectStore = transaction.objectStore(STORE_NAME);
                if (objectStore.indexNames.contains('createdAt')) {
                    objectStore.deleteIndex('createdAt');
                }
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * Gets an object store for transactions.
 * @param {IDBDatabase} db
 * @param {IDBTransactionMode} mode
 * @returns {IDBObjectStore}
 */
function getObjectStore(db, mode) {
    const transaction = db.transaction([STORE_NAME], mode);
    return transaction.objectStore(STORE_NAME);
}

/**
 * Saves a new time entry to IndexedDB.
 * @param {TimeEntry} entry
 * @returns {Promise<TimeEntry>}
 */
export function saveEntry(entry) {
    return new Promise(async (resolve, reject) => {
        const database = await initializeDB();
        const objectStore = getObjectStore(database, 'readwrite');
        const request = objectStore.add(entry);

        request.onsuccess = () => resolve(entry);
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Updates an existing time entry in IndexedDB.
 * @param {TimeEntry} entry
 * @returns {Promise<TimeEntry>}
 */
export function updateEntry(entry) {
    return new Promise(async (resolve, reject) => {
        const database = await initializeDB();
        const objectStore = getObjectStore(database, 'readwrite');
        const request = objectStore.put(entry);

        request.onsuccess = () => resolve(entry);
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Deletes a time entry from IndexedDB.
 * @param {string} id
 * @returns {Promise<void>}
 */
export function deleteEntry(id) {
    return new Promise(async (resolve, reject) => {
        const database = await initializeDB();
        const objectStore = getObjectStore(database, 'readwrite');
        const request = objectStore.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Retrieves a time entry by its ID.
 * @param {string} id
 * @returns {Promise<TimeEntry | undefined>}
 */
export function getEntry(id) {
    return new Promise(async (resolve, reject) => {
        const database = await initializeDB();
        const objectStore = getObjectStore(database, 'readonly');
        const request = objectStore.get(id);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Retrieves all time entries from IndexedDB.
 * @returns {Promise<TimeEntry[]>}
 */
export function getAllEntries() {
    return new Promise(async (resolve, reject) => {
        const database = await initializeDB();
        const objectStore = getObjectStore(database, 'readonly');
        const request = objectStore.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Retrieves time entries between two timestamps.
 * @param {number} start - Start timestamp (inclusive).
 * @param {number} end - End timestamp (inclusive).
 * @returns {Promise<TimeEntry[]>}
 */
export function getEntriesBetween(start, end) {
    return new Promise(async (resolve, reject) => {
        const database = await initializeDB();
        const objectStore = getObjectStore(database, 'readonly');
        const timestampIndex = objectStore.index('timestamp');
        const range = IDBKeyRange.bound(start, end);
        const request = timestampIndex.getAll(range);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Clears all data from the time entries object store.
 * @returns {Promise<void>}
 */
export function clearDatabase() {
    return new Promise(async (resolve, reject) => {
        const database = await initializeDB();
        const objectStore = getObjectStore(database, 'readwrite');
        const request = objectStore.clear();

        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}
