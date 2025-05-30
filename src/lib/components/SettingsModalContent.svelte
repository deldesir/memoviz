<script lang="ts">
  import { browser } from '$app/environment';
  import { slide } from 'svelte/transition';
  // Import stores and actions needed for the controls
  import {
    rawData,
    gameState, currentLang, currentForm,
    showDefaultFormAboveGrid, useCategoryColors, itemsVisible, showAppInfoSection,
    setModeAction, toggleGameStateAction,
    loadFileDataAction,
    // --- Category Filtering Imports ---
    availableCategories,    // Derived store for UI [{id, name}]
    selectedCategoryIds,    // Writable store for selected IDs []
    selectAllCategories,    // Action
    deselectAllCategories,   // Action
    resetSettingsAction,
    clearSavedDataAction
  } from '$lib/stores/appStore.js';
  import type { GameState, Categories, RawGridData } from '$lib/stores/appStore.js';

  /** @type {() => void} - Function passed from parent to close the modal */
  export let doClose = () => { console.warn("SettingsModalContent: doClose prop not provided"); };

  /** @type {HTMLInputElement | null} */
  let fileInputElement: HTMLInputElement | null = null;

  // --- Reactive Derived State (for cleaner templates) ---
  $: meta = $rawData?.meta;
  $: availableForms = meta?.forms
      ? meta.forms.map((label, index) => ({ label, index })).filter(f => f.index !== 0)
      : [];
  $: availableLanguages = meta?.languages
      ? Object.entries(meta.languages)
      : [];
  $: dataLoaded = !!$rawData;

  // --- Display values for App Info section ---
  $: currentDatasetName = $rawData?.meta?.datasetName?.[$currentLang]
                        || $rawData?.meta?.datasetName?.['en'] // Fallback to English name
                        || $rawData?.meta?.datasetId // Fallback to ID
                        || 'N/A';
  $: currentDatasetVersion = $rawData?.meta?.version || 'N/A';
  $: currentDatasetAttribution = $rawData?.meta?.attribution || '';

  function handleImportClick() { if (!browser) return; fileInputElement?.click(); }
  /** @param {Event & { currentTarget: EventTarget & HTMLInputElement }} event */
   async function handleFileSelected(event: Event & { currentTarget: EventTarget & HTMLInputElement }) {
       if (!browser) return;
       const file = event.currentTarget.files?.[0];
       const inputElement = event.currentTarget;
       if (file) {
           const success = await loadFileDataAction(file);
        if (success) {
            console.log("File load action successful.");
            doClose(); // Close modal after file load
        } else {
            console.error("File load action failed.");
            // Keep modal open on failure for user to see error/try again
        }
        if (inputElement) inputElement.value = ''; // Clear file input
   }
}

  function toggleItemsVisible() { itemsVisible.update(visible => !visible); }

  // --- Handlers for actions that should close modal ---
  function handleToggleGame() {
      toggleGameStateAction(); // Call store action
      // Close modal immediately when starting/stopping game
      // Don't wait for action to finish, provide instant UI feedback
      if (!$gameState.isActive) { // Only close if *starting* a game or stopping? Let's close always for now.
           doClose();
      }
      // If stopping, state change might happen slightly after closing, which is ok.
  }

  function handleResetSettings() {
      resetSettingsAction();
      doClose(); // Close modal after reset
  }

  function handleClearData() {
      // Consider adding a confirmation dialog here!
      if (browser && window.confirm("Are you sure you want to clear the currently saved dataset and reload the default? This cannot be undone.")) {
            clearSavedDataAction(); // Call action
            doClose(); // Close modal after confirmation
        }
}
    

</script>

<h2 id="modal-title">Settings</h2>

<div class="settings-section file-controls">
    <h4>File Management</h4>
    <div class="import-controls">
      <button type="button" class="import-button" title="Load JSON data" on:click={handleImportClick}>Load New Dataset</button>
      <input type="file" id="importFile" accept=".json" on:change={handleFileSelected} bind:this={fileInputElement} hidden/>
    </div>
</div>

<div class="mode-selector settings-section">
    <h4>Mode:</h4>
    <div class="radio-group">
        <label>
            <input type="radio" name="gameMode" value="explore" bind:group={$gameState.mode} on:change={() => setModeAction('explore')}>
            <span>Explore</span>
        </label>
        <label>
            <input type="radio" name="gameMode" value="guess-cell" bind:group={$gameState.mode} on:change={() => setModeAction('guess-cell')} disabled={!dataLoaded}>
            <span>Game: Guess Cell</span>
        </label>
        <label>
            <input type="radio" name="gameMode" value="timed-recall" bind:group={$gameState.mode} on:change={() => setModeAction('timed-recall')} disabled={!dataLoaded}>
            <span>Game: Timed Recall</span>
        </label>
    </div>
</div>

{#if $gameState.mode === 'guess-cell' || $gameState.mode === 'timed-recall'}
<div class="settings-section category-filter" transition:slide={{duration: 200}}>
    <h4>Filter Categories (for Games)</h4>
    {#if $availableCategories.length > 0}
        <div class="filter-buttons">
             <button type="button" on:click={selectAllCategories} disabled={!dataLoaded}>Select All</button>
             <button type="button" on:click={deselectAllCategories} disabled={!dataLoaded || $selectedCategoryIds.length === 0}>Deselect All</button>
        </div>
        <div class="checkbox-group" role="group" aria-labelledby="category-filter-heading">
            <span id="category-filter-heading" class="visually-hidden">Select categories to include in games</span>
            {#each $availableCategories as category (category.id)}
                <label title={category.name}>
                    <input type="checkbox" bind:group={$selectedCategoryIds} value={category.id} disabled={!dataLoaded}>
                    <span>{category.name}</span>
                </label>
            {/each}
        </div>
         <p class="info-text">Select categories to include. If none selected, all are used.</p>
    {:else if dataLoaded}
         <p class="info-text">(No categories defined in current dataset)</p>
    {:else}
         <p class="info-text">(Load data to see categories)</p>
    {/if}
</div>
{/if}

{#if $gameState.mode === 'explore'}
    <div id="explore-controls" class="settings-section" transition:slide={{duration: 200}}>
        <h4>Explore Options:</h4>
        <div class="language-selector">
            <label for="languageSelect">Language:</label>
            <select id="languageSelect" bind:value={$currentLang} disabled={!dataLoaded || $gameState.isActive}>
                {#if availableLanguages.length === 0} <option value="">-- No Data --</option>
                {:else} {#each availableLanguages as [code, name] (code)} <option value={code}>{name || code}</option> {/each} {/if}
            </select>
        </div>
        <div class="form-selector">
            <span>Display Form (in grid):</span>
            {#if availableForms.length > 0}
                <div class="radio-group">
                    {#each availableForms as form (form.index)}
                        <label>
                            <input type="radio" name="displayForm" bind:group={$currentForm} value={form.index} disabled={!dataLoaded || $gameState.isActive}>
                            <span>{form.label || `Form ${form.index + 1}`}</span>
                        </label>
                    {/each}
                </div>
            {:else} <p class="info-text">(Only one display form defined in data)</p> {/if}
        </div>
        <div class="view-options">
           <label><input type="checkbox" bind:checked={$showDefaultFormAboveGrid} disabled={!dataLoaded || $gameState.isActive}> Show Full Name Above Grid</label>
           <label><input type="checkbox" bind:checked={$useCategoryColors} disabled={!dataLoaded || $gameState.isActive}> Color Cells by Category</label>
           <button type="button" id="toggleItemsBtn" on:click={toggleItemsVisible} disabled={!dataLoaded || $gameState.isActive}>
               {$itemsVisible ? 'Hide Names' : 'Show Names'}
           </button>
        </div>
        </div>
{/if}

{#if $gameState.mode === 'guess-cell'}
   <div id="guess-cell-controls" class="settings-section game-controls" transition:slide={{duration: 200}}>
      <h4>Game: Guess Cell</h4>
      <button type="button" id="guessGameBtn" class="start-stop-btn" class:active={$gameState.isActive} on:click={handleToggleGame} disabled={!dataLoaded}>
         {$gameState.isActive ? 'Stop Game' : 'Start Game'}
      </button>
      <div id="scoreDisplay">Score: {$gameState.score}</div>
      </div>
{/if}

{#if $gameState.mode === 'timed-recall'}
  <div id="timed-recall-controls" class="settings-section game-controls" transition:slide={{duration: 200}}>
      <h4>Game: Timed Recall</h4>
      <label for="recallSlider">Reveal Delay: <span id="sliderValueDisplay">{$gameState.recallDuration}</span>s</label>
      <input type="range" id="recallSlider" min="1" max="10" step="1" bind:value={$gameState.recallDuration} disabled={!dataLoaded || $gameState.isActive}>
       <button type="button" id="recallGameBtn" class="start-stop-btn" class:active={$gameState.isActive} on:click={handleToggleGame} disabled={!dataLoaded}>
         {$gameState.isActive ? 'Stop Game' : 'Start Game'}
       </button>
       </div>
{/if}

<div class="settings-section">
     <label><input type="checkbox" bind:checked={$showAppInfoSection}> Show App Info & Reset</label>
     {#if $showAppInfoSection}
         <div id="app-info-options" class="app-info-options" transition:slide={{duration: 200}}>
            <h4>App Information & Actions</h4>
            {#if $rawData?.meta}
                <div class="info-block">
                    <strong>Dataset:</strong> {$rawData.meta.datasetName[$currentLang] || $rawData.meta.datasetId}<br>
                    {#if $rawData.meta.version}
                        <strong>Version:</strong> {$rawData.meta.version}<br>
                    {/if}
                     {#if $rawData.meta.attribution}
                        <small><em>Source: {$rawData.meta.attribution}</em></small>
                    {/if}
                </div>
            {:else}
                 <p class="info-text">No dataset loaded.</p>
            {/if}
            <div class="action-buttons">
                <button type="button" class="action-btn reset-settings" on:click={resetSettingsAction} title="Reset language, form, toggles, filters to defaults">
                    Reset UI Settings
                </button>
                <button type="button" class="action-btn clear-data" on:click={clearSavedDataAction} title="Remove saved dataset from browser storage and load default">
                    Clear Saved Data & Reload Default
                </button>
            </div>
         </div>
     {/if}
 </div>

<style>
    /* Scoped styles */
    h2 { margin: 0 0 20px 0; font-size: 1.3em; color: #222; border-bottom: 2px solid #eee; padding-bottom: 12px; }
    .settings-section { border-top: 1px solid #eee; padding-top: 15px; margin-top: 15px; }
    .settings-section:first-of-type { border-top: none; padding-top: 0; margin-top: 0; }
    h4 { margin-top: 0; margin-bottom: 12px; font-size: 1.1em; color: #333; }

    button, select, .import-button { display: block; width: 100%; padding: 10px 12px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 1em; background-color: #fdfdfd; color: #333; cursor: pointer; transition: background-color 0.2s, border-color 0.2s; text-align: center; box-sizing: border-box; min-height: 38px; }
    button:last-child, select:last-child, .import-controls:last-child .import-button { margin-bottom: 0; }
    button:not(:disabled):hover, .import-button:hover, select:not(:disabled):hover { background-color: #f0f0f0; border-color: #ccc; }
    select:disabled, button:disabled { cursor: not-allowed; background-color: #e9e9e9; color: #999; opacity: 0.7; }

    .radio-group, .view-options { display: flex; flex-direction: column; gap: 5px; }
    .radio-group label, .view-options label { display: flex; align-items: center; gap: 8px; padding: 5px 2px; cursor: pointer; border-radius: 4px; font-size: 0.95em; color: #444; }
    .radio-group label:hover, .view-options label:hover { background-color: #f0f0f0; }
    .radio-group input, .view-options input { margin: 0; width: 16px; height: 16px; flex-shrink: 0; cursor: pointer;}
    input[type="radio"]:disabled, input[type="checkbox"]:disabled { cursor: not-allowed; }
    label > span { flex-grow: 1; pointer-events: none; }

    .language-selector, .form-selector { margin-bottom: 15px; }
    .language-selector label[for="languageSelect"], .form-selector span { font-weight: 600; font-size: 1.0em; margin-bottom: 5px; display: block;}
    #explore-controls .view-options button#toggleItemsBtn { margin-top: 5px; }
    .info-text { font-size: 0.85em; color: #666; margin-top: 8px; }
    .game-controls { display: flex; flex-direction: column; gap: 12px; }
    .game-controls button { font-weight: bold; }
    .start-stop-btn { border: none; color: white; }
    .start-stop-btn:not(.active) { background-color: var(--feedback-correct-color); }
    .start-stop-btn.active { background-color: var(--feedback-wrong-color); }
    #scoreDisplay { font-weight: bold; text-align: center; margin-top: 5px; font-size: 1.1em; }
    #timed-recall-controls label[for="recallSlider"] { display: block; margin-bottom: 5px; font-size: 0.95em; }
    #sliderValueDisplay { font-weight: bold; }
    #recallSlider { width: 100%; margin-bottom: 10px; cursor: pointer; }
    #recallSlider:disabled { cursor: not-allowed; }


    input[type="file"][hidden] { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border-width: 0; }
    .visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }


    /* --- Styles for category filter --- */
    .category-filter .filter-buttons { display: flex; gap: 10px; margin-bottom: 10px; }
    .category-filter .filter-buttons button { flex: 1; padding: 5px 8px; font-size: 0.9em; min-height: 30px; margin-bottom: 0; }
    .checkbox-group { border: 1px solid #eee; padding: 10px; border-radius: 4px; display: flex; flex-wrap: wrap; gap: 6px 10px; } /* flex-wrap here */
    .checkbox-group label { padding: 4px 8px; border-radius: 12px; border: 1px solid #ddd; background-color: #f8f8f8; font-size: 0.9em; white-space: nowrap; transition: background-color 0.2s, border-color 0.2s; }
    .checkbox-group label:hover { background-color: #f0f0f0; border-color: #ccc; }
    .checkbox-group input[type="checkbox"] { margin-top: 1px; width: 14px; height: 14px; flex-shrink: 0; }
    .checkbox-group label > span { pointer-events: none; }
    .category-filter > .info-text { margin-top: 12px; }

    /* --- ADD Styles for New App Info Section --- */
    .app-info-options {
        background-color: #f0f0f0; /* Slightly different background */
        border: 1px solid #e0e0e0;
        padding: 15px;
        margin-top: 10px;
        border-radius: 4px;
        display: flex;
        flex-direction: column;
        gap: 15px; /* Space between info and buttons */
    }
     .app-info-options h4 {
         margin-bottom: 8px;
         font-size: 1.0em;
         color: #444;
     }
     .info-block {
         font-size: 0.9em;
         line-height: 1.4;
         color: #333;
     }
      .info-block strong {
          color: #111;
      }
      .info-block small {
          color: #555;
          display: block;
          margin-top: 3px;
      }
      .action-buttons {
          display: flex;
          flex-direction: column; /* Stack buttons vertically */
          gap: 10px;
      }
      .action-btn {
          width: 100%;
          padding: 8px 10px;
          font-size: 0.9em;
          min-height: 32px;
          margin-bottom: 0; /* Remove default bottom margin */
          background-color: #e7e7e7;
          border-color: #ccc;
      }
       .action-btn:not(:disabled):hover {
          background-color: #dcdcdc;
          border-color: #bbb;
       }
       /* Optional: Specific button colors */
       .action-btn.reset-settings { background-color: #d1ecf1; border-color: #bee5eb; color: #0c5460; }
       .action-btn.clear-data { background-color: #f8d7da; border-color: #f5c6cb; color: #721c24; }
       .action-btn.clear-data:hover { background-color: #f5c6cb; border-color: #f1b0b7; }

</style>
