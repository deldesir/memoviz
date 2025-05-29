import { writable, get, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { showNotification } from '$lib/stores/notificationStore.js';
import {
    USER_DATASET_ID,
    saveUserDataset,
    loadUserDataset,
    deleteUserDataset
} from '$lib/utils/indexedDB.js';

// --- JSDoc Type Definitions ---

/** @typedef {Object.<string, string>} Languages */
/**
 * @typedef {Object} CategoryDetails
 * @property {string} color - 6-digit hex color string (e.g., "#ffcc80")
 * @property {Languages} names - Language codes mapped to translated category names
 */
/** @typedef {Object.<string, CategoryDetails>} Categories */
/**
 * Defines the structure of the 'meta' object in the data file.
 * @typedef {Object} GridMetaData
 * @property {string} datasetId - Unique machine-readable ID for the dataset
 * @property {Languages} datasetName - REQUIRED: Name of the dataset in multiple languages
 * @property {Languages} [datasetDescription] - OPTIONAL: Description in multiple languages
 * @property {string} [version] - OPTIONAL: Dataset version string
 * @property {string} [attribution] - OPTIONAL: Data source or author information
 * @property {string} [license] - OPTIONAL: License information
 * @property {string} [licenseUrl] - OPTIONAL: URL to the license
 * @property {number} rows - Grid rows (1-10)
 * @property {number} cols - Grid columns (1-10)
 * @property {Languages} languages - Supported languages for the dataset
 * @property {string} defaultLanguage - Default language code (must be a key in languages)
 * @property {string[]} forms - Array of display form names (e.g., ["Full Name", "Abbr."])
 * @property {Categories} categories - Category definitions for the dataset
 */
/** @typedef {(string | null)[]} ItemFormData - Array of text forms for one language */
/** @typedef {{ category: string } & Record<string, ItemFormData | undefined>} GridItemData - Data for a single grid item */
/** @typedef {Object.<string, GridItemData | null>} GridItems - Map of "CR" coords to item data or null */
/**
 * @typedef {Object} RawGridData - The complete structure of a loaded dataset file.
 * @property {GridMetaData} meta
 * @property {GridItems} items
 */
/**
 * @typedef {Object} GamePrompt - Data for the current game prompt item.
 * @property {string} coord
 * @property {GridItemData} itemData
 */
/**
 * @typedef {Object} GameState - Overall game state.
 * @property {'explore' | 'guess-cell' | 'timed-recall'} mode - Current application mode
 * @property {boolean} isActive - Whether a game is currently running
 * @property {GamePrompt | null} currentPrompt - Data for the current item in a game
 * @property {number} score - Current score (primarily for Guess the Cell)
 * @property {number | null} timerId - setTimeout ID (number in browser, null otherwise) for Timed Recall
 * @property {number} recallDuration - Delay in seconds for Timed Recall reveal
 * @property {boolean} isItemRevealed - Tracks visibility state in Timed Recall
 */
/**
 * Represents an entry in the catalog.json file.
 * @typedef {Object} CatalogEntry
 * @property {string} id - Unique dataset ID (matches datasetId in meta)
 * @property {Languages} name - REQUIRED: Multi-language name for display
 * @property {Languages} [description] - OPTIONAL: Multi-language description
 * @property {string} filePath - Path to the dataset JSON file (relative to /static)
 * @property {string} [defaultLanguage] - Optional suggested starting language for dataset content
 * @property {string} [thumbnail] - Optional path to thumbnail image
 */

// --- Configuration & Constants ---
const DEFAULT_FORM_INDEX = 0;
const INITIAL_CELL_FORM_INDEX = 1;
const FALLBACK_CELL_FORM_INDEX = 1;
const STORAGE_KEY_DATA = 'gridData_v2';
const STORAGE_KEY_SETTINGS = 'gridSettings_v1';
const FEEDBACK_DURATION = 550; // ms
const AUTO_CLEAR_DELAY = 1500; // ms

// --- Helper: Load settings from localStorage ---
/** @returns {Partial<GameState & {currentLang: string, currentForm: number, showDefaultFormAboveGrid: boolean, useCategoryColors: boolean, showDebugOptions: boolean, itemsVisible: boolean, showAppInfoSection: boolean, selectedCategoryIds?: string[], selectedDatasetId?: string | null}>} */
function loadSettingsFromStorage() {
    if (!browser) return {};
    const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
    try { return saved ? JSON.parse(saved) : {}; }
        catch (e) { console.error("Error parsing saved settings", e); return {}; }
}
// const initialSettings = loadSettingsFromStorage(); // Original line
let initialSettings = {}; // Default to empty object
try {
    initialSettings = loadSettingsFromStorage();
    // console.log("appStore: Initial settings loaded:", initialSettings);
} catch (e) {
    console.error("appStore: Error in loadSettingsFromStorage():", e);
    // initialSettings remains {}
}

// --- Catalog Ready Promise ---
let resolveCatalogReady;
export const catalogReady = new Promise(resolve => {
    resolveCatalogReady = resolve;
});

// --- Reactive Stores ---
/** @type {import('svelte/store').Writable<RawGridData | null | undefined>} */
export const rawData = writable(undefined);
/** @type {import('svelte/store').Writable<{rows: number, cols: number}>} */
export const gridDimensions = writable({ rows: 0, cols: 0 });
/** @type {import('svelte/store').Writable<Categories>} */
export const categories = writable({});
/** @type {import('svelte/store').Writable<string | null>} */
export const highlightedCoord = writable(null);
/** @type {import('svelte/store').Writable<{coord: string | null, type: 'correct' | 'wrong' | null}>} */
export const feedback = writable({ coord: null, type: null });
/** @type {import('svelte/store').Writable<GameState>} */
export const gameState = writable({
    mode: 'explore', isActive: false, currentPrompt: null, score: 0, timerId: null,
    recallDuration: parseInt(String(initialSettings.recallDuration || '3'), 10),
    isItemRevealed: true
});

// UI Settings / Preferences
/** @type {import('svelte/store').Writable<string>} */
export const currentLang = writable(initialSettings.currentLang || 'en');
/** @type {import('svelte/store').Writable<number>} */
export const currentForm = writable(initialSettings.currentForm ?? INITIAL_CELL_FORM_INDEX);
/** @type {import('svelte/store').Writable<boolean>} */
export const showDefaultFormAboveGrid = writable(initialSettings.showDefaultFormAboveGrid === true);
/** @type {import('svelte/store').Writable<boolean>} */
export const useCategoryColors = writable(initialSettings.useCategoryColors === true);
/** @type {import('svelte/store').Writable<boolean>} */
export const showAppInfoSection = writable(initialSettings.showAppInfoSection === true);
/** @type {import('svelte/store').Writable<boolean>} */
export const itemsVisible = writable(initialSettings.itemsVisible === true);
/** @type {import('svelte/store').Writable<string>} */
export const exploreInputCoords = writable('');
/** @type {import('svelte/store').Writable<string[]>} */
export const selectedCategoryIds = writable(initialSettings.selectedCategoryIds || []);
// --- NEW CATALOG STORES ---
/** @type {import('svelte/store').Writable<CatalogEntry[]>} */
export const catalogList = writable([]);
/** @type {import('svelte/store').Writable<string | null>} */ // Holds ID of selected dataset from catalog
export const selectedDatasetId = writable(initialSettings.selectedDatasetId || null);

// Online/Offline Status Store
export const isOnline = writable(true); // Default to true, will be updated by browser events


// --- Derived Stores ---
/** Creates derived store of available categories {id, name} in current language */
export const availableCategories = derived(
    [categories, currentLang],
    ([$categories, $currentLang]) => {
        if (!$categories) return [];
        return Object.entries($categories)
            .map(([id, details]) => ({
                id: id,
                name: details.names?.[$currentLang] || details.names?.['en'] || id
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    },
    [] // Initial value
);

// --- Settings Persistence ---
function persistSettings() {
    if (!browser) return;
    const settings = {
        recallDuration: get(gameState).recallDuration,
        currentLang: get(currentLang),
        currentForm: get(currentForm),
        showDefaultFormAboveGrid: get(showDefaultFormAboveGrid),
        useCategoryColors: get(useCategoryColors),
        showAppInfoSection: get(showAppInfoSection),
        itemsVisible: get(itemsVisible),
        selectedCategoryIds: get(selectedCategoryIds),
        selectedDatasetId: get(selectedDatasetId) // ADDED: Persist last selected dataset
    };
    try { localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings)); }
    catch (e) { console.error("Error persisting settings", e); }
}
if (browser) {
    let previousGameState = get(gameState);
    currentLang.subscribe(persistSettings);
    currentForm.subscribe(persistSettings);
    showDefaultFormAboveGrid.subscribe(persistSettings);
    useCategoryColors.subscribe(persistSettings);
    showAppInfoSection.subscribe(persistSettings);
    itemsVisible.subscribe(persistSettings);
    selectedCategoryIds.subscribe(persistSettings); // Persist category filter
    selectedDatasetId.subscribe(persistSettings); // Persist last selected dataset
    gameState.subscribe(
        /** @param {GameState} value @param {GameState | undefined} oldValue */
        (value, oldValue = previousGameState) => {
        if (value.recallDuration !== oldValue?.recallDuration) { persistSettings(); }
        previousGameState = value;
    });

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data && event.data.type === 'SW_UPDATED') {
                console.log('appStore: Received SW_UPDATED message from service worker.');
                showNotification(
                    'App has been updated. Refresh for the latest version.', 
                    'info', // type
                    0,      // duration 0 for persistent
                    [       // actions array
                        {
                            label: 'Refresh',
                            action: () => {
                                console.log('appStore: User clicked refresh on SW_UPDATED notification.');
                                window.location.reload();
                            }
                        }
                    ]
                );
            }
        });
    }

    // Online/Offline Status Store Initialization
    if ('onLine' in navigator) { // Check if navigator.onLine is supported
        isOnline.set(navigator.onLine); // Set initial status

        window.addEventListener('online', () => {
            // console.log('appStore: Browser reported online.');
            isOnline.set(true);
            showNotification("You are back online.", "success", 3000);
        });

        window.addEventListener('offline', () => {
            // console.log('appStore: Browser reported offline.');
            isOnline.set(false);
            showNotification("You are now offline. Some features may be limited.", "warning", 5000);
        });
    } else {
        // Fallback for browsers that don't support navigator.onLine (rare)
        // Assume online, or could try a fetch test, but for simplicity, assume online.
        console.warn('appStore: navigator.onLine not supported, assuming online.');
        isOnline.set(true);
    }
}

// --- Data & UI Helper Functions ---

/**
 * Retrieves the display string for a given cell and form index.
 * @param {string | number} r_str - Row index
 * @param {string | number} c_str - Column index
 * @param {number} formIndex - The desired form index
 * @returns {string} The display text or empty string
 */
export function getItemDisplay(r_str, c_str, formIndex) {
    const r = parseInt(String(r_str), 10); const c = parseInt(String(c_str), 10);
    const data = get(rawData); const lang = get(currentLang);
    if (isNaN(r) || isNaN(c) || !data?.items || !data?.meta?.forms) { return ''; }
    const coordKey = `${c}${r}`;
    /** @type {GridItemData | null} */
    const itemEntry = data.items[coordKey];
    if (!itemEntry) { return ''; }
    const defaultLangCode = data.meta.defaultLanguage || 'en';
    // Safely access language data using bracket notation
    const currentLangData = itemEntry[lang];
    const defaultLangData = itemEntry[defaultLangCode];
    let text = null;
    text = currentLangData?.[formIndex] ?? text; if (text !== null) return String(text);
    text = defaultLangData?.[formIndex] ?? text; if (text !== null) return String(text);
    const fallbackIndex = FALLBACK_CELL_FORM_INDEX;
    if (formIndex !== fallbackIndex && fallbackIndex < data.meta.forms.length) {
         text = currentLangData?.[fallbackIndex] ?? text; if (text !== null) return String(text);
         text = defaultLangData?.[fallbackIndex] ?? text; if (text !== null) return String(text);
    }
    const defFormIdx = DEFAULT_FORM_INDEX;
    if (formIndex !== defFormIdx && defFormIdx < data.meta.forms.length) {
         text = currentLangData?.[defFormIdx] ?? text; if (text !== null) return String(text);
         text = defaultLangData?.[defFormIdx] ?? text; if (text !== null) return String(text);
     }
    return '';
}

/** @type {number | null | ReturnType<typeof setTimeout>} */
let feedbackTimer = null;
/** Apply feedback animation state temporarily
 * @param {string | null} coord
 * @param {'correct' | 'wrong' | null} type
 */
export function applyFeedback(coord, type) {
    if (!browser) return;
    // Log added previously to debug missing feedback
    // console.log(`Applying feedback: ${type} for ${coord}`);
    if (feedbackTimer !== null) clearTimeout(feedbackTimer);
    feedback.set({ coord, type });
    feedbackTimer = window.setTimeout(() => {
        // console.log(`Clearing feedback for ${coord}`); // Log added previously
        feedback.set({ coord: null, type: null });
        feedbackTimer = null;
    }, FEEDBACK_DURATION);
}

/** Clear highlight state */
export function clearHighlightState() { highlightedCoord.set(null); }

/** Set highlight state
 * @param {string | null} coord
 */
export function setHighlightState(coord) { highlightedCoord.set(coord); }


// --- Explore Input Actions ---
/** @type {number | null | ReturnType<typeof setTimeout>} */
let exploreInputClearTimer = null;

/** Clears the auto-clear timer for explore input */
function clearExploreInputTimer() {
    if (exploreInputClearTimer !== null && browser) { clearTimeout(exploreInputClearTimer); exploreInputClearTimer = null; }
}
/** Schedules the explore input store to be cleared after a delay */
function scheduleExploreInputClear() {
    clearExploreInputTimer();
    if (browser) { exploreInputClearTimer = window.setTimeout(() => { exploreInputCoords.set(''); exploreInputClearTimer = null; }, AUTO_CLEAR_DELAY); }
}
/** Add a digit (key) to the explore input coordinate string
 * @param {string} key
*/
export function updateExploreInput(key) {
    if (!browser || get(gameState).mode !== 'explore' || get(gameState).isActive) return;
    clearExploreInputTimer();
    exploreInputCoords.update(current => {
        const newValue = (current + key).slice(-2);
        if (newValue.length === 2) { scheduleExploreInputClear(); }
        return newValue;
    });
}
/** Handle backspace for explore input */
export function backspaceExploreInput() {
    if (!browser || get(gameState).mode !== 'explore' || get(gameState).isActive) return;
    clearExploreInputTimer();
    exploreInputCoords.update(current => current.slice(0, -1));
}
/** Clear explore input, associated timer, and current highlight */
export function clearExploreInput() {
    // Allow clearing even if game active? No, let's restrict.
    if (!browser || get(gameState).mode !== 'explore') return;
    // Check if game is active - maybe allow clearing input but not highlight if active? No, keep simple.
    if (get(gameState).isActive) return;

    // console.log("Action: clearExploreInput");
    clearExploreInputTimer();
    exploreInputCoords.set('');
    clearHighlightState();
}


// --- Game Logic Actions ---

/** Internal helper to get random item, respecting category filters
 * @returns {GamePrompt | null}
*/
function _getRandomItem() {
    const data = get(rawData);
    const selectedCats = get(selectedCategoryIds); // Read selected categories
    if (!data?.items) { console.warn("_getRandomItem: No data available."); return null; }

    let validCoords = Object.keys(data.items).filter(coord => data.items[coord] !== null);
    if (validCoords.length === 0) { console.warn("_getRandomItem: No non-null items found."); return null; }

    // --- FILTERING LOGIC ---
    let filteredCoords = validCoords;
    if (selectedCats && selectedCats.length > 0) {
        console.log("Filtering by categories:", selectedCats);
        filteredCoords = validCoords.filter(coord => {
            // itemData here is guaranteed non-null by the first filter
            /** @type {GridItemData | null} */
            const itemData = data.items[coord];
            if (!itemData) return false;
            return itemData.category && selectedCats.includes(itemData.category);
        });
        console.log(`Found ${filteredCoords.length} items matching filter.`);
    }

    if (filteredCoords.length === 0) {
        // No items match the current filter
        console.warn("_getRandomItem: No items match the selected category filter.");
        // Optional: Notify user that filter resulted in no items?
        showNotification("No items match the current category filter.", "warning", 3000);
        return null; // Signal no item could be selected
    }

    // --- Pick from filtered list ---
    let randomCoord; let maxTries = 5;
    const lastPrompt = get(gameState).currentPrompt;
    const lastCoord = lastPrompt?.coord;
    do {
        randomCoord = filteredCoords[Math.floor(Math.random() * filteredCoords.length)];
        maxTries--;
    } while (filteredCoords.length > 1 && lastCoord === randomCoord && maxTries > 0);

    /** @type {GridItemData | null} */
    const itemData = data.items[randomCoord];
    return itemData ? { coord: randomCoord, itemData } : null;
}

/** Stop any active game and reset related state */
export function stopCurrentGameAction() {
    // console.log("Action: stopCurrentGameAction");
    const gs = get(gameState); if (!gs.isActive) return;
    if (gs.timerId !== null && browser) { clearTimeout(gs.timerId); }
    // Ensure state reset matches GameState type
    gameState.update(s => ({ ...s, isActive: false, currentPrompt: null, timerId: null, isItemRevealed: true }));
    clearHighlightState(); feedback.set({ coord: null, type: null });
    // console.log("Game stopped.");
}

/** Set the application mode
 * @param {'explore' | 'guess-cell' | 'timed-recall'} newMode
 */
export function setModeAction(newMode) {
    // console.log(`Action: setModeAction to ${newMode}`);
    const currentGs = get(gameState);
    if (currentGs.mode !== newMode || currentGs.isActive) {
        stopCurrentGameAction();
        if (currentGs.mode !== newMode) {
            // Ensure state update matches GameState type
            gameState.update(gs => ({ ...gs, mode: newMode, currentPrompt: null, timerId: null }));
        }
    }
}

/** Action to set up the next prompt for Guess the Cell */
export function nextGuessCellPromptAction() {
    const gs = get(gameState); if (!gs.isActive || gs.mode !== 'guess-cell') return;
    const promptItem = _getRandomItem();
    if (!promptItem) {
        console.error("NGCPA: No item available to prompt.");
        showNotification("No valid items found for game.", 'error', 3000);
        stopCurrentGameAction(); return;
    }
    // Ensure promptItem matches GamePrompt type
    gameState.update(s => ({ ...s, currentPrompt: promptItem }));
    clearHighlightState();
    // console.log("Store updated with new prompt:", promptItem.coord);
}

/** Action called by timer to reveal item in Timed Recall */
function revealCurrentItemAction() {
    const gs = get(gameState);
    // Safety check: ensure game is still active and in correct mode
    if (!gs.isActive || gs.mode !== 'timed-recall') {
         console.log("revealCurrentItemAction aborted: game not active or mode changed.");
         if (gs.timerId !== null && browser) clearTimeout(gs.timerId); // Clear potentially orphaned timer
         gameState.update(s => ({ ...s, timerId: null })); // Ensure timer ID is nullified
         return;
    }
    // console.log("Action: revealCurrentItemAction for", gs.currentPrompt?.coord);
    gameState.update(s => ({ ...s, isItemRevealed: true })); // Reveal item

    // Set timer for the *next* loop iteration (pause after reveal)
    const pauseDuration = gs.recallDuration * 1000;
    /** @type {number | null} */
    let nextTimerId = null;
    if (browser) {
        // Assign setTimeout result only in browser
        nextTimerId = window.setTimeout(startTimedRecallLoopAction, pauseDuration);
    }
    // Update store with new timer ID
    gameState.update(s => ({ ...s, timerId: nextTimerId }));
}

/** Action to start/continue the Timed Recall loop */
export function startTimedRecallLoopAction() {
    const gs = get(gameState); if (!gs.isActive || gs.mode !== 'timed-recall') return;
    // Clear previous timer safely
    if (gs.timerId !== null && browser) { clearTimeout(gs.timerId); }
    clearHighlightState();

    const promptItem = _getRandomItem();
     if (!promptItem) {
         console.error("STRLA: No item available to prompt.");
         showNotification("No valid items found for game.", 'error', 3000);
         stopCurrentGameAction(); return;
     }

    setHighlightState(promptItem.coord); // Highlight cell

    /** @type {number | null} */
    let revealTimerId = null; // Ensure type matches GameState.timerId
    if (browser) {
        const delayMilliseconds = gs.recallDuration * 1000;
        // console.log(`Timed Recall: Hiding ${promptItem.coord}, starting ${delayMilliseconds}ms timer.`);
        revealTimerId = window.setTimeout(revealCurrentItemAction, delayMilliseconds);
    }
    // Update state: set prompt, mark hidden, store timer ID
    gameState.update(s => ({ ...s, currentPrompt: promptItem, isItemRevealed: false, timerId: revealTimerId }));
}

/** Start the game for the current mode */
export function startGameAction() {
    const currentMode = get(gameState).mode; const dataLoaded = !!get(rawData);
    if (!dataLoaded || currentMode === 'explore' || get(gameState).isActive) { console.warn("Start game ignored."); return; }
    // console.log(`Action: startGameAction for mode ${currentMode}`);
    // Reset state, ensuring type compatibility
    gameState.update(gs => ({ ...s, isActive: true, score: 0, currentPrompt: null, timerId: null, isItemRevealed: true }));
    clearHighlightState(); feedback.set({ coord: null, type: null });
    // Trigger the first step of the game loop/prompt
    if (currentMode === 'guess-cell') { nextGuessCellPromptAction(); }
    else if (currentMode === 'timed-recall') { startTimedRecallLoopAction(); }
}

/** Toggle game state (Start/Stop) based on current state */
export function toggleGameStateAction() { if (get(gameState).isActive) { stopCurrentGameAction(); } else { startGameAction(); } }

/** Action to select all available category IDs */
export function selectAllCategories() {
    const allCategoryIds = Object.keys(get(categories) || {});
    if (allCategoryIds.length > 0) {
        selectedCategoryIds.set(allCategoryIds);
        // console.log("Selected all categories for filtering.");
    }
}

/** Action to deselect all category IDs */
export function deselectAllCategories() {
    selectedCategoryIds.set([]);
    // console.log("Deselected all categories for filtering.");
}

/** Resets UI settings stores to their application defaults */
export function resetSettingsAction() {
    // console.log("Action: resetSettingsAction");
    // Determine defaults (could also read from initial default dataset meta if needed)
    const defaultLang = get(rawData)?.meta?.defaultLanguage || 'en';
    const defaultForm = INITIAL_CELL_FORM_INDEX; // Use constant

    currentLang.set(defaultLang);
    currentForm.set(defaultForm);
    showDefaultFormAboveGrid.set(false);
    useCategoryColors.set(false);
    itemsVisible.set(true); // Default to showing names? Or false? Let's use true.
    selectedCategoryIds.set([]); // Clear category filters
    gameState.update(gs => ({ ...gs, recallDuration: 3 })); // Reset slider
    // showAppInfoSection remains unchanged by this action

    showNotification("UI settings reset to defaults.", "info", 2500);
    // Note: persistSettings() will be called automatically by store subscriptions
}

/** Clears saved user dataset from IndexedDB and potentially unloads it */
export async function clearSavedDataAction() {
    // This function is now focused on deleting the user's custom dataset from IndexedDB.
    // The STORAGE_KEY_DATA in localStorage for dataset *content* is deprecated.
    // User-uploaded files go to IndexedDB. Catalog files are handled by Service Worker cache.
    // console.log("Action: clearSavedDataAction - User custom dataset");
    if (!browser) return;

    stopCurrentGameAction();

    try {
        await deleteUserDataset(); // Deletes from IndexedDB
        showNotification("Cleared your custom uploaded dataset from browser storage.", "info", 3000);

        // If the currently active dataset was the one stored in IndexedDB, unload it from UI.
        if (get(selectedDatasetId) === USER_DATASET_ID) {
            console.log("Unloading currently active custom dataset.");
            unloadDatasetAction(); // This also calls persistSettings after clearing selectedDatasetId
        } else {
            // If another dataset (e.g., from catalog) was active, no need to unload UI,
            // but ensure settings are persisted if they were somehow changed.
            persistSettings();
        }
        
        // For thoroughness, explicitly remove the old localStorage key if it exists.
        // This helps clean up for users who might have old data.
        if (browser) {
            localStorage.removeItem(STORAGE_KEY_DATA);
            console.log("Old localStorage key 'gridData_v2' (if existed) has been removed for cleanup.");
        }

    } catch (err) {
        console.error("Error clearing user dataset from IndexedDB or old localStorage:", err);
        const message = (err instanceof Error) ? err.message : "Unknown error.";
        showNotification(`Failed to clear custom dataset: ${message}`, 'error', 4000);
    }
}

/** Unloads current dataset and resets related state to show catalog selector */
export function unloadDatasetAction() {
    // console.log("Action: unloadDatasetAction");
    stopCurrentGameAction(); // Stop any active game
    rawData.set(null); // Clear main data
    gridDimensions.set({ rows: 0, cols: 0 }); // Reset dimensions
    categories.set({}); // Clear categories
    clearHighlightState(); // Clear any highlight
    feedback.set({ coord: null, type: null }); // Clear feedback
    selectedDatasetId.set(null); // Clear selected dataset ID
    // Optionally reset language/form/filters, or keep user preferences? Let's keep them for now.
    // currentLang.set('en');
    // currentForm.set(INITIAL_CELL_FORM_INDEX);
    // selectedCategoryIds.set([]);
    persistSettings(); // Save the cleared selectedDatasetId
    showNotification("Dataset unloaded. Select a new one.", "info", 2000);
}

// --- Data Loading / Validation / Persistence ---

/** Validate data structure */
function validateData(/** @type {any} */ d) {
    // console.log("Validating data structure...");
    try {
        if (typeof d !== 'object' || d === null) throw new Error('Data must be an object.');
        if (!d.meta || typeof d.meta !== 'object') throw new Error("Missing or invalid 'meta' object.");
        if (!d.items || typeof d.items !== 'object') throw new Error("Missing or invalid 'items' object.");

        const { meta } = d;

        // --- NEW: Validate Dataset Identification Metadata ---
        if (typeof meta.datasetId !== 'string' || !meta.datasetId.trim()) {
            throw new Error("Missing or invalid 'meta.datasetId' (must be non-empty string).");
        }
        if (typeof meta.datasetName !== 'object' || meta.datasetName === null) {
            throw new Error("Missing or invalid 'meta.datasetName' (must be object).");
        }
        // Check datasetName against defined languages below...
        // Optional fields validation (example for description)
        if (meta.datasetDescription !== undefined && (typeof meta.datasetDescription !== 'object' || meta.datasetDescription === null)) {
             throw new Error("Invalid 'meta.datasetDescription' (must be object if present).");
        }
        // --- END NEW ---

        // Validate Grid/Language/Form Metadata (as before)
        if (typeof meta.rows !== 'number' || !Number.isInteger(meta.rows) || meta.rows <= 0 || meta.rows > 10) throw new Error('meta.rows invalid.');
        if (typeof meta.cols !== 'number' || !Number.isInteger(meta.cols) || meta.cols <= 0 || meta.cols > 10) throw new Error('meta.cols invalid.');
        if (!meta.languages || typeof meta.languages !== 'object' || Object.keys(meta.languages).length === 0) throw new Error("meta.languages invalid/empty.");
        if (!meta.defaultLanguage || !meta.languages[meta.defaultLanguage]) throw new Error("meta.defaultLanguage invalid.");
        if (!meta.forms || !Array.isArray(meta.forms) || meta.forms.length === 0) throw new Error("meta.forms invalid/empty.");

         // --- Validate Multi-Language fields against defined languages ---
         const definedLanguages = Object.keys(meta.languages);
         // Check datasetName languages
         for (const langCode of definedLanguages) {
             if (typeof meta.datasetName[langCode] !== 'string' || !meta.datasetName[langCode].trim()) {
                throw new Error(`Missing or empty name for language '${langCode}' in 'meta.datasetName'.`);
             }
             // Check optional datasetDescription languages
             if (meta.datasetDescription && (typeof meta.datasetDescription[langCode] !== 'string')) { // Allow empty description
                 throw new Error(`Invalid description for language '${langCode}' in 'meta.datasetDescription' (must be string).`);
             }
         }
         // --- END Multi-language check ---

        // Validate Categories structure (Checks nested names against definedLanguages)
        if (typeof meta.categories !== 'object' || meta.categories === null) throw new Error("meta.categories invalid.");
        for (const catId in meta.categories) {
            const category = meta.categories[catId];
            if (typeof category !== 'object' || category === null) throw new Error(`Invalid category structure for '${catId}'.`);
            if (typeof category.color !== 'string' || !category.color.match(/^#[0-9a-fA-F]{6}$/)) { throw new Error(`Invalid 'color' for category '${catId}'.`); }
            if (typeof category.names !== 'object' || category.names === null) { throw new Error(`Missing 'names' object for category '${catId}'.`); }
            for (const langCode of definedLanguages) { // Check names against languages in *this* file
                if (typeof category.names[langCode] !== 'string' || !category.names[langCode].trim()) { throw new Error(`Missing name for lang '<span class="math-inline">\{langCode\}' in category '</span>{catId}'.`); }
            }
        }
        if (!meta.categories.unknown) { console.warn("Validation: 'unknown' category not defined in meta.categories."); }

        // Validate Items structure (as before)
        const numForms = meta.forms.length;
        for (const coord in d.items) {
            if (!coord.match(/^[0-9]{2}$/)) throw new Error(`Invalid item coordinate format: '${coord}'.`);
            const c = parseInt(coord[0], 10); const r = parseInt(coord[1], 10);
            if (c >= meta.cols || r >= meta.rows) throw new Error(`Item coordinate '${coord}' outside grid dimensions (${meta.cols}x${meta.rows}).`);
            const item = d.items[coord]; if (item === null) continue;
            if (typeof item !== 'object') throw new Error(`Item data for '${coord}' must be an object or null.`);
            if (typeof item.category !== 'string' || !item.category.trim()) { throw new Error(`Item '${coord}' has missing or empty 'category' field.`); }
            if (!meta.categories[item.category] && item.category !== 'unknown') { console.warn(`Item '${coord}' category '${item.category}' not found. Treating as 'unknown'.`); }
            let hasLanguageData = false;
            for (const langCode in item) { if (langCode === 'category') continue; hasLanguageData = true; if (!meta.languages[langCode]) throw new Error(`Item '${coord}' uses unknown language '${langCode}'.`); if (!Array.isArray(item[langCode]) || item[langCode].length !== numForms) { throw new Error(`Item '${coord}' lang '${langCode}' data array length mismatch (expected ${numForms}, got ${item[langCode]?.length}).`); } }
            if (!hasLanguageData && item !== null) { throw new Error(`Item '${coord}' has no language data.`); }
        }
        // console.log("Data validation passed for dataset: ${meta.datasetId}.");
        return true;
    } catch (error) {
        console.error("Data validation error:", error);
        if (error instanceof Error) throw error;
        else throw new Error("Unknown validation error.");
    }
}

/** Persist data to localStorage
 * @param {RawGridData | null} dataToSave
 */
function persistData(dataToSave) {
    if (!browser || !dataToSave) { return; }
    try { localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(dataToSave)); /* console.log("Data persisted."); */ }
    catch (err) {
        console.error("Error persisting data:", err);
        let message = 'Could not save data to local storage.';
        if (err instanceof Error && err.name === 'QuotaExceededError') { message = 'Storage limit exceeded.'; }
        showNotification(message, 'error', 5000);
    }
}

// --- NEW/MODIFIED Data Loading Actions ---

/** Fetch and load the catalog file */
export async function loadCatalog() {
    // console.log("appStore: loadCatalog() called");
    if (!browser) {
        if (resolveCatalogReady) resolveCatalogReady(); // Resolve immediately if not in browser
        return;
    }
    // console.log("Fetching catalog.json...");
    try {
        const response = await fetch('/catalog.json'); // Assumes catalog is in /static/catalog.json
        if (!response.ok) { throw new Error(`HTTP error! ${response.status}`); }
        /** @type {CatalogEntry[]} */
        const catalogData = await response.json();

        // --- Basic validation for catalog structure ---
        if (!Array.isArray(catalogData)) { throw new Error("Catalog data is not an array."); }
        catalogData.forEach((item, index) => {
             if (!item || typeof item !== 'object') throw new Error(`Catalog entry ${index} is not an object.`);
             if (typeof item.id !== 'string' || !item.id) throw new Error(`Catalog entry ${index} missing required 'id'.`);
             if (typeof item.filePath !== 'string' || !item.filePath) throw new Error(`Catalog entry ${index} ('${item.id}') missing required 'filePath'.`);
             // Check multi-language name
             if (typeof item.name !== 'object' || item.name === null) throw new Error(`Catalog entry '${item.id}' missing required 'name' object.`);
             if (Object.keys(item.name).length === 0) throw new Error(`Catalog entry '${item.id}' 'name' object is empty.`);
             for(const lang in item.name) {
                 if(typeof item.name[lang] !== 'string') throw new Error(`Catalog entry '${item.id}' has invalid name for lang '${lang}'.`);
             }
             // Optionally check description structure if present
             if (item.description && typeof item.description !== 'object') {
                 console.warn(`Catalog entry '${item.id}' has non-object 'description'. Ignoring.`);
             } else if (item.description) {
                 for(const lang in item.description) {
                      if(typeof item.description[lang] !== 'string') throw new Error(`Catalog entry '${item.id}' has invalid description for lang '${lang}'.`);
        }
             }
        });

        catalogList.set(catalogData);
        console.log("Catalog loaded successfully:", catalogData);
    } catch(err) {
        console.error("Error loading catalog.json:", err);
        catalogList.set([]); // Set empty on error
        const message = (err instanceof Error) ? err.message : "Unknown error";
        showNotification(`Failed to load dataset catalog: ${message}`, 'error', 0); // Persistent
    } finally {
        if (resolveCatalogReady) resolveCatalogReady(); // Resolve regardless of success or failure
    }
}

/** Loads a specific dataset based on its ID from the catalog. */
export async function loadSpecificDataset(/** @type {string | null} */ datasetId) {
    // Do not wait for catalog if datasetId is null or not in browser context
    if (!browser) return false; 
    if (!datasetId) { 
        rawData.set(null); 
        gridDimensions.set({rows:0, cols:0}); 
        categories.set({}); 
        return false; 
    }

    await catalogReady; // Wait for catalog to be processed before trying to access it

    // console.log(`appStore: loadSpecificDataset() called for datasetId: ${datasetId}`);
    // console.log(`Attempting to load dataset ID: ${datasetId}`); // Original log, now more specific
     stopCurrentGameAction();
     rawData.set(undefined); gridDimensions.set({ rows: 0, cols: 0 }); categories.set({});

    const catalog = get(catalogList);
    /** @type {CatalogEntry | undefined} */
    const datasetInfo = catalog.find(item => item.id === datasetId);

    if (!datasetInfo || !datasetInfo.filePath) {
        console.error(`Dataset with ID '${datasetId}' not found in catalog or missing filePath.`);
        showNotification(`Dataset '${datasetId}' not found in catalog.`, 'error', 5000);
        rawData.set(null); // Failed state
        return false;
    }

    // console.log(`Workspaceing dataset from: ${datasetInfo.filePath}`);
    try {
        const response = await fetch(datasetInfo.filePath);
        if (!response.ok) { throw new Error(`HTTP error! ${response.status} fetching ${datasetInfo.filePath}`); }
        const jsonData = await response.json();
         validateData(jsonData); // Use existing validation which includes datasetId check

         // --- Verify loaded datasetId matches requested Id ---
         if (jsonData?.meta?.datasetId !== datasetId) {
             throw new Error(`Loaded dataset's ID ('${jsonData?.meta?.datasetId}') does not match requested ID ('${datasetId}'). Check catalog.json.`);
         }

        // --- Success Path ---
        rawData.set(jsonData);
        gridDimensions.set({ rows: jsonData.meta.rows, cols: jsonData.meta.cols });
        categories.set(jsonData.meta.categories || {});
         // Set lang based on dataset suggestion FIRST, then current setting, then fallback
         currentLang.set(datasetInfo.defaultLanguage || get(currentLang) || jsonData.meta.defaultLanguage || 'en');
         currentForm.set(get(currentForm) ?? Math.min(INITIAL_CELL_FORM_INDEX, jsonData.meta.forms.length - 1)); // Keep existing form if possible
         selectedDatasetId.set(datasetId);
        console.log(`Dataset ${datasetId} loaded successfully.`);
         // persistData(jsonData); // Removed: Service worker handles caching of cataloged datasets
         persistSettings(); // Save selected ID and potentially updated lang/form
         // Use correct language for notification
         const lang = get(currentLang);
         const datasetDisplayName = jsonData.meta.datasetName[lang] || jsonData.meta.datasetName['en'] || datasetId;
         showNotification(`Loaded dataset: ${datasetDisplayName}`, 'success', 3000);
         return true;

    } catch (err) {
        console.error(`Error loading/validating dataset ${datasetId}:`, err);
        rawData.set(null); gridDimensions.set({ rows: 0, cols: 0 }); categories.set({});
        const message = (err instanceof Error) ? err.message : "Unknown load error.";
        showNotification(`Failed to load dataset ${datasetId}: ${message}`, 'error'); // Use default duration (persistent for errors)
        selectedDatasetId.set(null); // Clear selection on error
        persistSettings();
        return false; // Failure
    }
}


/** Initial data loading action (only loads last selected dataset) */
export async function loadGridData() {
    // console.log("appStore: loadGridData() called");
    if (!browser) return;
    // console.log("Initial load check: Attempting to load last selected dataset..."); // Original log
    const lastSelectedId = initialSettings.selectedDatasetId || null;

    if (lastSelectedId === USER_DATASET_ID) {
        console.log("Attempting to load user custom dataset from IndexedDB...");
        try {
            const userDbData = await loadUserDataset();
            if (userDbData) {
                console.log("User custom dataset loaded from IndexedDB.");
                rawData.set(userDbData);
                gridDimensions.set({ rows: userDbData.meta.rows, cols: userDbData.meta.cols });
                categories.set(userDbData.meta.categories || {});
                currentLang.set(get(currentLang) || userDbData.meta.defaultLanguage || 'en');
                currentForm.set(get(currentForm) ?? Math.min(INITIAL_CELL_FORM_INDEX, userDbData.meta.forms.length - 1));
                // selectedDatasetId is already USER_DATASET_ID from initialSettings
                showNotification("Loaded custom dataset from your browser storage.", "success", 3000);
                return; // Exit early as we've loaded the custom dataset
            } else {
                console.warn("User custom dataset ID was set, but no data found in IndexedDB. Clearing selection.");
                selectedDatasetId.set(null); 
                persistSettings(); // Save the cleared selection
            }
        } catch (err) {
            console.error("Error loading user dataset from IndexedDB:", err);
            showNotification("Could not load your custom dataset. Please try uploading again.", "error", 4000);
            selectedDatasetId.set(null); // Clear selection on error
            persistSettings();
        }
    }

    // If not user custom dataset, or if it failed to load, try catalog datasets
    // This part will execute if lastSelectedId was not USER_DATASET_ID, or if USER_DATASET_ID failed to load and was reset to null.
    const currentEffectiveSelectedId = get(selectedDatasetId); // Re-check in case it was nulled above

    if (currentEffectiveSelectedId && currentEffectiveSelectedId !== USER_DATASET_ID) {
        console.log(`Found last selected catalog dataset ID: ${currentEffectiveSelectedId}. Loading...`);
        await loadSpecificDataset(currentEffectiveSelectedId);
    } else if (!currentEffectiveSelectedId) { 
        console.log("No dataset selected previously, or custom/catalog dataset failed to load. Waiting for user selection or showing catalog.");
        rawData.set(null); gridDimensions.set({ rows: 0, cols: 0 }); categories.set({});
    }
}

/** Action to load data from user file. */
export async function loadFileDataAction(/** @type {File} */ file) {
    // console.log(`appStore: loadFileDataAction() called for file: ${file ? file.name : 'no file'}`);
    if (!browser) return false;
    if (!file) { showNotification('No file provided.', 'error'); return false; }
    stopCurrentGameAction();
    rawData.set(undefined); gridDimensions.set({ rows: 0, cols: 0 }); categories.set({});
    showNotification(`Loading file: ${file.name}...`, 'info', 2000);
    return new Promise(async (resolve) => { // Added async here
        const reader = new FileReader();
        reader.onload = async () => { // Added async here
            try {
                const fileContent = reader.result;
                if (typeof fileContent !== 'string') { throw new Error("Could not read file as text."); }
                const parsed = JSON.parse(fileContent);
                validateData(parsed);

                await saveUserDataset(parsed); // Store in IndexedDB
                console.log("User dataset saved to IndexedDB.");

                rawData.set(parsed);
                gridDimensions.set({ rows: parsed.meta.rows, cols: parsed.meta.cols });
                categories.set(parsed.meta.categories || {});
                currentLang.set(parsed.meta.defaultLanguage || 'en');
                currentForm.set(Math.min(INITIAL_CELL_FORM_INDEX, parsed.meta.forms.length - 1));
                
                selectedDatasetId.set(USER_DATASET_ID); // Set ID for user's custom data
                persistSettings(); // Save selection of USER_DATASET_ID

                itemsVisible.set(false); // Hide names automatically
                useCategoryColors.set(true); // Show category colors automatically
                setModeAction('explore'); // Switch back to explore mode
                clearHighlightState(); // Clear any previous highlight

                showNotification(`Successfully loaded and saved: ${file.name}`, 'success', 3000);
                resolve(true); // Indicate success

            } catch (err) {
                console.error(`Error processing file ${file.name}:`, err);
                rawData.set(null); // Ensure data is null on error
                gridDimensions.set({ rows: 0, cols: 0 }); categories.set({});
                selectedDatasetId.set(null); // Clear selection on error
                persistSettings();
                const message = (err instanceof Error) ? err.message : "Unknown error during processing.";
                showNotification(`Error loading ${file.name}: ${message}`, 'error');
                resolve(false); // Indicate failure
            }
        };
        reader.onerror = () => {
            console.error("FileReader error:", reader.error);
            rawData.set(null); gridDimensions.set({ rows: 0, cols: 0 }); categories.set({});
            selectedDatasetId.set(null); // Clear selection on error
            persistSettings();
            showNotification(`Error reading file: ${reader.error?.message || 'Unknown read error'}`, 'error');
            resolve(false); // Indicate failure
        };
        reader.readAsText(file); // Start reading
    });
}

// --- Initial Load Trigger ---
// Call loadCatalog() and loadGridData() from +page.svelte's onMount hook.
