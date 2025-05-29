<script lang="ts">
  // Added lang="ts" for consistency
  import {
      gridDimensions,
      rawData,
      categories,
      currentForm,
      highlightedCoord,
      feedback,
      gameState,
      getItemDisplay
  } from '$lib/stores/appStore.js';
  import type { GameState, Categories, RawGridData } from '$lib/stores/appStore.js'; // Import types if needed

  /**
   * Callback function passed from parent to handle cell activation.
   * @param {{coord: string, col: number, row: number}} detail - Data about the activated cell
   */
  export let onCellClick = (detail: { coord: string, col: number, row: number }) => {
      console.warn("Grid component: onCellClick prop was called but not provided by parent.", detail);
  };

  /** Internal handler, calls the prop */
  function handleCellActivation(c: number, r: number) {
      onCellClick({ coord: `${c}${r}`, col: c, row: r });
  }

  /** Handles keydown events on cells */
  function handleKeyDown(event: KeyboardEvent, c: number, r: number) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCellActivation(c, r);
    }
  }

  // --- Reactive Calculations ---
  // Use $ prefix for reactive access to stores
  $: rowIndices = Array.from({ length: $gridDimensions.rows }, (_, i) => i);
  $: colIndices = Array.from({ length: $gridDimensions.cols }, (_, i) => i);

  /** Get category color */
  function getCategoryColor(c: number, r: number): string {
    const data = $rawData; // Access store value reactively
    if (!data?.items) return 'transparent';
    const coord = `${c}${r}`;
    const item = data.items[coord];
    const categoryId = item?.category || 'unknown';
    const cats = $categories; // Access store value reactively
    return cats[categoryId]?.color || cats['unknown']?.color || 'transparent';
  }

</script>

<div class="grid-container">
  {#if $gridDimensions.rows > 0 && $gridDimensions.cols > 0}
    <table id="interactiveTable" role="grid" aria-label="Interactive grid">
      <caption class="visually-hidden">Interactive grid table.</caption>
      <thead>
        <tr>
          <th scope="col" class="corner-cell"></th>
          {#each colIndices as c (c)} <th scope="col" class="col-header">{c}</th> {/each}
        </tr>
      </thead>
      <tbody id="gridBody">
        {#each rowIndices as r (r)}
          <tr>
            <th scope="row" class="row-header">{r}</th>
            {#each colIndices as c (c)}
              {@const coord = `${c}${r}`}
              {@const itemText = getItemDisplay(r, c, $currentForm)}
              {@const isHighlighted = $highlightedCoord === coord}
              {@const feedbackType = $feedback.coord === coord ? $feedback.type : null}
              {@const categoryBgColor = getCategoryColor(c,r)}
              {@const isTimedRecallHidden = $gameState.mode === 'timed-recall' && $gameState.isActive && isHighlighted && !$gameState.isItemRevealed}

              <td
                data-row={r} data-col={c} role="gridcell" tabindex="-1"
                aria-label={`Cell ${c},${r}${isTimedRecallHidden ? ' (content hidden)' : ''}`}
                class:highlight={isHighlighted}
                class:feedback-correct={feedbackType === 'correct'}
                class:feedback-wrong={feedbackType === 'wrong'}
                style:--cell-category-bg={categoryBgColor} on:click={() => handleCellActivation(c, r)}
                on:keydown={(event) => handleKeyDown(event, c, r)}
              >
                <span
                  class="item-name"
                  style:visibility={isTimedRecallHidden ? 'hidden' : 'visible'} >
                  {itemText}
                </span>
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <p>Grid dimensions not loaded or invalid.</p>
  {/if}
</div>

<style>
  /* Styles specific to the grid component and its children */
  .grid-container {
    background: #fff; padding: 15px; border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow-x: auto;
    margin-top: 10px;
    width: max-content; /* Fit container to table size */
    max-width: 95%; /* Prevent excessive width */
  }

  table {
    border-collapse: collapse;
    table-layout: fixed;
    margin: 0 auto;
  }

  th {
    padding: 4px; background: none; color: #222; font-weight: 600;
    vertical-align: middle; user-select: none;
  }
  .col-header {
    border-bottom: 2px solid var(--axis-border); border-right: 1px solid #ccc;
    text-align: center; height: 25px; width: var(--cell-size);
  }
  .col-header:last-child { border-right: none; }
  .row-header {
    border-right: 2px solid var(--axis-border); border-bottom: 1px solid #ccc;
    text-align: right; padding-right: 8px; width: 30px; height: var(--cell-height);
  }
  .corner-cell { background: transparent; border: none; }

  td {
    border: 1px solid #ccc; width: var(--cell-size); height: var(--cell-height);
    text-align: center; vertical-align: middle; padding: 2px; box-sizing: border-box;
    transition: background-color var(--transition-speed, 0.3s), color var(--transition-speed, 0.3s), box-shadow var(--transition-speed, 0.3s);
    cursor: pointer; position: relative;
    /* --- MODIFIED: Default background transparent --- */
    background-color: transparent;
    /* --cell-category-bg variable set via inline style */
    --cell-category-bg: transparent; /* Define default */
  }
  /* --- NEW: Apply category background ONLY when body class is present --- */
  :global(body.category-colors-visible) td {
      background-color: var(--cell-category-bg);
  }

  td:hover {
    transform: scale(1.03);
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    /* filter: brightness(95%); /* Optionally keep or remove brightness filter */
    /* Ensure z-index is high enough to see the shadow over adjacent cells if they don't also transform */
    position: relative; /* Needed for z-index to apply if not already set */
    z-index: 10;
  }
  td:focus-visible { outline: 2px solid var(--highlight-outline); outline-offset: -2px; z-index: 5; }

  .item-name {
    display: none; /* Hide by default */
    font-size: 0.9em; color: #444; user-select: none; word-break: break-word;
    line-height: 1.2; padding: 0 2px; visibility: visible; opacity: 1;
    transition: opacity 0.2s, visibility 0.2s;
  }
  /* Show names ONLY when body class is present */
  :global(body.items-visible) .item-name {
    display: block;
  }

  /* Highlighted cell style */
  td.highlight {
    background-color: var(--highlight-cell-bg, var(--highlight-color)); /* Uses variable set on TD */
    outline: 2px solid var(--highlight-outline); outline-offset: -2px;
    font-weight: bold; color: black; z-index: 1;
  }
  /* Name style when highlighted */
  td.highlight .item-name {
    display: block !important; /* Ensure layout space */
    /* REMOVED visibility: visible !important; - Let inline style control for Timed Recall */
    color: black; font-weight: bold;
  }

  /* Feedback animation classes */
  td.feedback-correct,
  td.feedback-wrong {
    animation: feedback-flash var(--feedback-anim-duration) ease-out;
    z-index: 2;
  }
  td.feedback-correct { --feedback-color: rgba(40, 167, 69, 0.7); }
  td.feedback-wrong { --feedback-color: rgba(220, 53, 69, 0.7); }

  /* Ensure text is visible during feedback, even if game active */
  td.feedback-correct .item-name,
  td.feedback-wrong .item-name {
      display: block !important;
      visibility: visible !important; /* Important needed to override game-active hiding */
      font-weight: bold;
      color: black;
  }

  /* --- REMOVED --- rules that incorrectly hid text/set color transparent */
  /* :global(body.category-colors-visible:not(.items-visible)) td { ... } */
  /* :global(body.category-colors-visible:not(.items-visible)) td .item-name { ... } */

  /* Keep hover adjustment for category colors */
  :global(body.category-colors-visible) td:hover {
      filter: brightness(90%);
      box-shadow: none;
  }

  /* --- MODIFIED: Force hide names when game is active, NO !important --- */
  :global(body.game-active) .item-name {
      display: none;   /* Hide by default during game */
      visibility: hidden; /* Hide by default during game */
  }
  /* Allow highlight (display:block) and feedback (!important) and */
  /* timed recall inline style (visibility) to override the above rule */
  /* No specific override needed here for highlight if !important removed above */

</style>
