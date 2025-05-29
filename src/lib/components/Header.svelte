<script lang="ts">
  // Standard component imports (no runes needed here)
  import SettingsButton from '$lib/components/SettingsButton.svelte';
  import {
      gameState,
      highlightedCoord,
      showDefaultFormAboveGrid,
      getItemDisplay,
      rawData, // Needed to conditionally make title clickable
      unloadDatasetAction // Action to call when title clicked
  } from '$lib/stores/appStore.js';
  import type { GameState } from '$lib/stores/appStore.js';

  // --- Props (using standard export let) ---
  /** @type {() => void} - Callback function passed from parent (+page) */
  export let onSettingsToggle: () => void = () => { console.warn("Header: onSettingsToggle prop not provided"); };
  /** @type {boolean} - Passed from parent, reflects if the settings modal is open */
  export let settingsOpen: boolean = false;
   /** @type {HTMLButtonElement | null} - Used with bind:buttonElement on child to pass ref up */
   export let buttonElement: HTMLButtonElement | null = null;


  const DEFAULT_FORM_INDEX = 0;

  // --- Reactive Derived Values (using standard $:) ---
  // We directly use store values ($storeName) in calculations where possible
  let displayLabel: string;
  let displayText: string;
  let showText: boolean;
  let isDatasetLoaded: boolean; // To control title clickability

  $: { // Reactive block for calculations
      const gs = $gameState; // Use $ prefix inside reactive block
      const data = $rawData;
      const hlCoord = $highlightedCoord;
      const showExploreInfo = $showDefaultFormAboveGrid;

      isDatasetLoaded = !!data; // Is data currently loaded?

      // Calculate Label
      if (gs.isActive) {
          if (gs.mode === 'guess-cell') { displayLabel = 'Guess:'; }
          else if (gs.mode === 'timed-recall' && gs.currentPrompt) { displayLabel = `Locate: ${gs.currentPrompt.coord[0]},${gs.currentPrompt.coord[1]}`; }
          else { displayLabel = '--'; }
          } else {
          if (gs.mode === 'explore') { displayLabel = (hlCoord && showExploreInfo) ? `${hlCoord[0]},${hlCoord[1]}:` : "Mode: Explore"; }
          else { displayLabel = `Mode: ${gs.mode.charAt(0).toUpperCase() + gs.mode.slice(1)}`; }
      }

      // Calculate Text
      if (gs.isActive && gs.currentPrompt) {
            const r = gs.currentPrompt.coord[1]; const c = gs.currentPrompt.coord[0];
            displayText = (gs.mode === 'timed-recall' && !gs.isItemRevealed) ? "..." : (getItemDisplay(r, c, DEFAULT_FORM_INDEX) || '???');
                } else {
          if (gs.mode === 'explore') { displayText = (hlCoord && showExploreInfo) ? (getItemDisplay(hlCoord[1], hlCoord[0], DEFAULT_FORM_INDEX) || '---') : ""; }
          else { displayText = gs.score > 0 ? `Last Score: ${gs.score}` : ""; }
      }
      showText = displayText !== "";
  }

  // --- Event Handlers ---
  function handleTitleClick() {
      // Only unload if a dataset is currently loaded
      if (isDatasetLoaded) {
          console.log("Title clicked, unloading dataset...");
          unloadDatasetAction();
      }
  }

</script>

<header class="app-header">
  <div class="title-area">
    <button
        type="button"
        class="title-button"
        on:click={handleTitleClick}
        disabled={!isDatasetLoaded}
        title={isDatasetLoaded ? "Go back to dataset selection" : "MemoViz"}
        aria-label={isDatasetLoaded ? "MemoViz - Change Dataset" : "MemoViz"}
    >
    <h1>MemoViz</h1>
    </button>
  </div>

  <div class="info-prompt-area" aria-live="assertive">
    {#if displayLabel}
      <span class="info-label">{displayLabel}</span>
    {/if}
    {#if showText}
      <span class="info-text">{displayText}</span>
    {/if}
  </div>

  <div class="controls-area">
    <SettingsButton
        onToggle={onSettingsToggle}
        ariaExpanded={settingsOpen}
        bind:buttonElement
    />
</div>
</header>

<style>
  .app-header {
    background-color: var(--panel-bg, #fff);
    color: var(--default-display-text, #333);
    padding: 10px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    width: 100%;
    box-sizing: border-box;
    position: sticky; /* Make header sticky */
    top: 0;
    z-index: 5; /* Below settings button/modal overlay */
  }

  .title-area {
    flex-shrink: 0;
  }

  /* NEW: Style for the button wrapping H1 */
  .title-button {
      background: none;
      border: none;
      padding: 0;
      margin: 0;
      font: inherit; /* Inherit font from parent */
      color: inherit; /* Inherit color */
      cursor: pointer;
      text-align: left;
      border-radius: 4px; /* Add radius for focus state */
      transition: background-color 0.2s;
  }
  .title-button:hover:not(:disabled) {
      background-color: rgba(0,0,0,0.05); /* Subtle hover */
  }
  .title-button:focus-visible {
       outline: 2px solid var(--highlight-outline); /* Use global focus */
       outline-offset: 2px;
  }
   /* Make non-clickable when disabled */
  .title-button:disabled {
      cursor: default;
      pointer-events: none; /* Prevent hover effects too */
      background: none; /* No hover background */
  }

  .title-area h1 {
    margin: 0;
    font-size: 1.4em; /* Adjust as needed */
    font-weight: 600;
    display: block; /* Ensure h1 itself doesn't interfere with button click area */
    padding: 2px 4px; /* Add slight padding inside button */
  }

  .info-prompt-area {
    flex-grow: 1; /* Take up available space */
    text-align: center;
    font-size: 1.0em; /* Adjust size */
    padding: 0 15px; /* Space around prompt */
    min-height: 1.5em; /* Prevent layout shifts */
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .info-label {
    font-weight: 600;
    margin-right: 5px;
  }

  .info-text {
    color: #111; /* Slightly darker */
  }

  /* Inside Header.svelte <style> */
  .controls-area {
    flex-shrink: 0;
    display: flex; /* Use flex to align buttons */
    align-items: center;
    /* No gap needed if only one button */
  }

  /* REMOVED .change-dataset-btn styles */

  /* Responsive adjustments */
  @media (max-width: 600px) {
    .app-header {
        padding: 8px 10px;
    }
    .title-area h1 {
        font-size: 1.2em;
    }
    .info-prompt-area {
        font-size: 0.9em;
        padding: 0 8px;
    }
  }
</style>
