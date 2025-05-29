export const DB_NAME = 'MemoVizUserDB';
export const DB_VERSION = 1;
export const USER_DATASET_STORE_NAME = 'userDatasets';
export const USER_DATASET_ID = 'user-custom-dataset'; // Key for the single user-uploaded dataset

/**
 * Opens a connection to the IndexedDB.
 * @returns {Promise<IDBDatabase>} A promise that resolves with the database instance.
 */
export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(USER_DATASET_STORE_NAME)) {
        db.createObjectStore(USER_DATASET_STORE_NAME); // Not using autoIncrement, key is USER_DATASET_ID
        console.log(`IndexedDB: Object store ${USER_DATASET_STORE_NAME} created.`);
      }
    };

    request.onsuccess = (event) => {
      console.log('IndexedDB: Database opened successfully.');
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error('IndexedDB: Error opening database:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Saves the user-uploaded dataset object to IndexedDB.
 * @param {object} datasetObject - The dataset object to save.
 * @returns {Promise<void>} A promise that resolves on success or rejects on error.
 */
export async function saveUserDataset(datasetObject) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([USER_DATASET_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(USER_DATASET_STORE_NAME);
    const request = store.put(datasetObject, USER_DATASET_ID);

    request.onsuccess = () => {
      console.log('IndexedDB: User dataset saved successfully with key:', USER_DATASET_ID);
      resolve();
    };

    request.onerror = (event) => {
      console.error('IndexedDB: Error saving user dataset:', event.target.error);
      reject(event.target.error);
    };

    transaction.oncomplete = () => {
      db.close();
    };
    transaction.onerror = (event) => {
        console.error('IndexedDB: Transaction error saving user dataset:', event.target.error);
        reject(event.target.error);
    };
  });
}

/**
 * Loads the user-uploaded dataset object from IndexedDB.
 * @returns {Promise<object|null>} A promise that resolves with the dataset object if found, or null if not.
 */
export async function loadUserDataset() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([USER_DATASET_STORE_NAME], 'readonly');
    const store = transaction.objectStore(USER_DATASET_STORE_NAME);
    const request = store.get(USER_DATASET_ID);

    request.onsuccess = (event) => {
      if (event.target.result) {
        console.log('IndexedDB: User dataset loaded successfully.');
        resolve(event.target.result);
      } else {
        console.log('IndexedDB: No user dataset found with key:', USER_DATASET_ID);
        resolve(null);
      }
    };

    request.onerror = (event) => {
      console.error('IndexedDB: Error loading user dataset:', event.target.error);
      reject(event.target.error);
    };
    
    transaction.oncomplete = () => {
      db.close();
    };
    transaction.onerror = (event) => {
        console.error('IndexedDB: Transaction error loading user dataset:', event.target.error);
        reject(event.target.error);
    };
  });
}

/**
 * Deletes the user-uploaded dataset object from IndexedDB.
 * @returns {Promise<void>} A promise that resolves on success or rejects on error.
 */
export async function deleteUserDataset() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([USER_DATASET_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(USER_DATASET_STORE_NAME);
    const request = store.delete(USER_DATASET_ID);

    request.onsuccess = () => {
      console.log('IndexedDB: User dataset deleted successfully.');
      resolve();
    };

    request.onerror = (event) => {
      console.error('IndexedDB: Error deleting user dataset:', event.target.error);
      reject(event.target.error);
    };

    transaction.oncomplete = () => {
      db.close();
    };
    transaction.onerror = (event) => {
        console.error('IndexedDB: Transaction error deleting user dataset:', event.target.error);
        reject(event.target.error);
    };
  });
}
