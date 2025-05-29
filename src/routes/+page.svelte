<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { browser } from '$app/environment';

  // Import stores and actions
  import {
      // Data / State Stores
      rawData,
      gameState,
      gridDimensions,
      itemsVisible,
      useCategoryColors,
      highlightedCoord,
      exploreInputCoords,
      catalogList,         // Store for available datasets
      selectedDatasetId,   // Store for the chosen dataset ID
      currentLang,         // NEEDED to display correct catalog name/desc ***
      // Loading Actions
      loadCatalog,         // NEW: Action to load catalog.json
      loadGridData,        // MODIFIED: Now tries to load last selected dataset
      loadSpecificDataset, // NEW: Action to load dataset by ID
      // Highlight/Feedback Actions
      setHighlightState,
      clearHighlightState,
      applyFeedback,
      // Game Actions
      stopCurrentGameAction,
      nextGuessCellPromptAction,
      // Explore Input Actions
      updateExploreInput,
      backspaceExploreInput,
      clearExploreInput
   } from '$lib/stores/appStore.js';
   import type { CatalogEntry } from '$lib/stores/appStore.js'; // Import type

  // Local constants
  const FEEDBACK_DURATION = 550; // Matches store value

  // Import UI components
  import Header from '$lib/components/Header.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import SettingsModalContent from '$lib/components/SettingsModalContent.svelte';
  import Grid from '$lib/components/Grid.svelte';

  // --- Component State (Standard Svelte reactivity) ---
  let isSettingsModalOpen = false; // Controls modal visibility
  let settingsButtonEl: HTMLButtonElement | null = null; // Reference to button element
  let previousInputCoords = ''; // Tracker for explore input changes
  let isLoadingDataset = false; // Local state to track loading *after* selection

  // --- Lifecycle ---
  onMount(async () => {
    // Load catalog AND attempt to load last used grid data concurrently
    await Promise.all([
        loadCatalog(), // Fetches /catalog.json -> populates $catalogList
        loadGridData() // Checks localStorage for selectedDatasetId -> loads if found
    ]);

    if (browser) {
        window.addEventListener('keydown', handleKeyDown);
        // Initialize body classes - handled by reactive statements below
    }
  });

  onDestroy(() => {
    if (browser) { window.removeEventListener('keydown', handleKeyDown); }
    // Use get() for non-reactive access in onDestroy
    if (get(gameState).isActive) { stopCurrentGameAction(); }
  });

  // --- Reactive Statements ---

  // React to explore input changes -> trigger highlight/clear
  $: {
    const currentInput = $exploreInputCoords;
    if (currentInput !== previousInputCoords) {
      console.log("Reactive: Input coords changed to:", currentInput);
      previousInputCoords = currentInput;
      if ($gameState.mode === 'explore' && !$gameState.isActive) {
          if (currentInput.length === 2) {
              const c = parseInt(currentInput[0], 10);
              const r = parseInt(currentInput[1], 10);
              const dims = $gridDimensions;
              if (dims.cols > 0 && dims.rows > 0 && c >= 0 && c < dims.cols && r >= 0 && r < dims.rows) {
                  console.log("Reactive: Highlighting", currentInput);
                  setHighlightState(currentInput);
              } else {
                  console.log(`Reactive: Invalid coords entered: ${currentInput}`);
                  clearExploreInput();
              }
          } else if (currentInput.length < 2 && $highlightedCoord !== null) {
               console.log("Reactive: Clearing highlight due to input length < 2");
               clearHighlightState();
          }
      }
    }
  }

  // Reactive Effects for Body Classes
  $: if (browser && $itemsVisible !== undefined) {
      document.body.classList.toggle('items-visible', $itemsVisible);
      console.log("Reactive: Body class 'items-visible' set to:", $itemsVisible);
  }
  $: if (browser && $useCategoryColors !== undefined) {
      document.body.classList.toggle('category-colors-visible', $useCategoryColors);
       console.log("Reactive: Body class 'category-colors-visible' set to:", $useCategoryColors);
  }
   $: if (browser && $gameState.isActive !== undefined) {
       document.body.classList.toggle('game-active', $gameState.isActive);
       console.log("Reactive: Body class 'game-active' set to:", $gameState.isActive);
   }

  // --- Event Handlers ---
  function toggleSettingsModal() { isSettingsModalOpen = !isSettingsModalOpen; }

  /** Function to close the modal, passed down */
  function closeModal() {
      isSettingsModalOpen = false;
      // Optionally refocus button? Maybe not needed if user action implies moving focus elsewhere (like grid)
      // settingsButtonEl?.focus();
  }

  /** @param {KeyboardEvent} event */
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
       if ($gameState.isActive) { stopCurrentGameAction(); event.preventDefault(); return; }
       if (isSettingsModalOpen) {
           event.preventDefault();
           closeModal(); // Use the close function
           settingsButtonEl?.focus(); // Still refocus button on ESC
           return;
        }
       if ($gameState.mode === 'explore') { clearExploreInput(); event.preventDefault(); return; }
    }
    if ($gameState.isActive || event.ctrlKey || event.altKey || event.metaKey ||
        (browser && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? '')) ||
        isSettingsModalOpen
    ) { return; }
    if ($gameState.mode === 'explore') {
        if (event.key >= '0' && event.key <= '9') { event.preventDefault(); updateExploreInput(event.key); }
        else if (event.key === 'Backspace') { event.preventDefault(); backspaceExploreInput(); }
    }
  }

  // Define type for the detail object
  interface CellClickDetail { coord: string; col: number; row: number; }

  /** Handles cell activation from Grid component */
  function handleCellClick(/** @type {CellClickDetail} */ detail: CellClickDetail) {
      const { coord } = detail;
      const currentMode = $gameState.mode;
      console.log(`Cell activated: ${coord}, Mode: ${currentMode}`);

      if (currentMode === 'explore') {
          setHighlightState(coord);
          exploreInputCoords.set(coord);
      }
      else if (currentMode === 'guess-cell') {
          if (!$gameState.isActive || !$gameState.currentPrompt) return;
          const correctCoord = $gameState.currentPrompt.coord;
          const isCorrect = (coord === correctCoord);
          applyFeedback(coord, isCorrect ? 'correct' : 'wrong');
          if (isCorrect) {
              console.log("Correct Guess!");
              gameState.update(gs => ({ ...gs, score: gs.score + 1 }));
              setTimeout(() => {
                  if ($gameState.isActive && $gameState.mode === 'guess-cell') {
                     nextGuessCellPromptAction();
                  }
              }, FEEDBACK_DURATION + 150);
          } else {
              console.log("Incorrect Guess.");
          }
      }
      else if (currentMode === 'timed-recall') {
           if (!$gameState.isActive) return;
           console.log("Activation ignored during Timed Recall game.");
      }
  }

  /** Handles clicking on a dataset in the selection UI */
  async function selectDataset(/** @type {string | null} */ datasetId: string | null) {
      if (!datasetId || isLoadingDataset) return;
      console.log(`UI: Requesting load for dataset ID: ${datasetId}`);
      isLoadingDataset = true;
      await loadSpecificDataset(datasetId);
      isLoadingDataset = false;
  }

</script>

<Header
    onSettingsToggle={toggleSettingsModal}
    settingsOpen={isSettingsModalOpen}
    bind:buttonElement={settingsButtonEl}
/>

<main>
  {#if $catalogList.length === 0 && $rawData === undefined}
     <div class="grid-placeholder">Loading Catalog...</div>
  {:else if $catalogList.length === 0 && $rawData === null}
     <div class="grid-placeholder">Error loading dataset catalog. Cannot proceed.</div>
  {:else if (!$rawData || $rawData === undefined) && $catalogList.length > 0}
     <div class="dataset-selector">
        <h2>Select a Dataset</h2>
        {#if isLoadingDataset}
            <p>Loading selected dataset...</p>
        {/if}
        <div class="dataset-list">
            {#each $catalogList as dataset (dataset.id)}
                {@const ds = dataset as CatalogEntry}
                {@const displayName = ds.name?.[$currentLang] || ds.name?.['en'] || ds.id}
                {@const displayDesc = ds.description?.[$currentLang] || ds.description?.['en'] || ''}
                <button
                    class="dataset-item"
                    on:click={() => selectDataset(ds.id)}
                    title={displayDesc || displayName} disabled={isLoadingDataset}
                >
                    {#if ds.thumbnail}
                        <img src={ds.thumbnail} alt="" class="dataset-thumb" loading="lazy" />
                    {/if}
                    <div class="dataset-info">
                        <h3>{displayName}</h3> {#if displayDesc}<p>{displayDesc}</p>{/if} </div>
                </button>
            {:else}
                <p>No datasets found in catalog.json.</p>
            {/each}
        </div>
         <p class="info-text">You can also load a custom local file via the Settings (⚙️) menu.</p>
     </div>
  {:else if $rawData}
     <Grid onCellClick={handleCellClick} />
  {:else}
     <div class="grid-placeholder">Initializing...</div>
  {/if}
</main>

<Modal bind:isOpen={isSettingsModalOpen} on:close={() => isSettingsModalOpen = false}>
  <SettingsModalContent />
</Modal>


<style>
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    padding: 20px 10px;
    box-sizing: border-box;
  }
  .grid-placeholder {
    margin-top: 20px; padding: 20px; background-color: #eee;
    border-radius: 8px; color: #555; text-align: center;
    max-width: 600px; width: 80%;
  }
  .dataset-selector {
    margin-top: 20px; padding: 20px; background-color: #f9f9f9;
    border: 1px solid #ddd; border-radius: 8px; width: 90%;
    max-width: 800px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  }
  .dataset-selector h2 { margin-top: 0; margin-bottom: 20px; text-align: center; color: #333; font-size: 1.4em; }
  .dataset-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 15px; }
  .dataset-item {
    display: flex; flex-direction: column; align-items: center;
    padding: 15px; border: 1px solid #ccc; border-radius: 6px;
    background-color: #fff; cursor: pointer;
    transition: box-shadow 0.2s ease-in-out, transform 0.2s ease-in-out;
    text-align: center; min-height: 160px; justify-content: space-between;
    color: inherit; font-family: inherit; font-size: 1em;
  }
  .dataset-item:hover:not(:disabled) { box-shadow: 0 4px 12px rgba(0,0,0,0.15); transform: translateY(-3px); }
  .dataset-item:focus-visible { outline: 2px solid var(--highlight-outline); outline-offset: 3px; }
  .dataset-item:disabled { cursor: not-allowed; opacity: 0.6; }
  .dataset-thumb { max-width: 70px; max-height: 70px; margin-bottom: 10px; border-radius: 4px; object-fit: cover; }
  .dataset-info { width: 100%; }
  .dataset-info h3 { margin: 0 0 5px 0; font-size: 1.1em; color: #222; }
  .dataset-info p { margin: 0; font-size: 0.9em; color: #555; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-clamp: 2; }
  .dataset-selector > .info-text { text-align: center; font-size: 0.9em; color: #777; margin-top: 10px; }
</style>
