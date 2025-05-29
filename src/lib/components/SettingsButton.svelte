<script lang="ts"> // Added lang="ts" based on user's Modal code
  /** @type {boolean} */
  export let ariaExpanded = false;
  /** @type {HTMLButtonElement | null} - Exported reference TO the button element for parent */
  export let buttonElement = null; // Parent binds to this via bind:buttonElement
  /** @type {() => void} - Callback function to call when button is clicked */
  export let onToggle = () => { console.warn("SettingsButton: onToggle prop not provided"); };

</script>

<button
  type="button"
  class="gear-btn"
  aria-label={ariaExpanded ? "Close settings" : "Open settings"}
  aria-controls="settingsPanel" aria-expanded={ariaExpanded}
  on:click={onToggle} title={ariaExpanded ? "Close settings" : "Open settings"}
  bind:this={buttonElement} >
  ⚙️
</button>

<style>
  /* Styles specific to the settings button */
  .gear-btn {
    background: rgba(255, 255, 255, 0.9);
    border: none;
    cursor: pointer;
    padding: 8px;
    border-radius: 50%;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); /* Subtle shadow */
    transition: all var(--transition-speed, 0.3s);
    color: #333;
    z-index: 5; /* Keep z-index relative to header content if needed */
    font-size: 1.2em;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .gear-btn:hover {
    background: rgba(255, 255, 255, 1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transform: scale(1.1);
  }
  /* Uses global :focus-visible from app.css */
</style>
