<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  export let isOpen = false;

  function requestClose() {
    isOpen = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      requestClose();
    }
    if (event.key === 'Tab') {
      // TODO: Implement focus trapping if desired for better a11y
    }
  }

  function handleBackdropClick(event: MouseEvent & { currentTarget: HTMLDivElement }) {
    if (event.target === event.currentTarget) {
      requestClose();
    }
  }

  function handleBackdropKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      requestClose();
    }
  }
</script>

{#if isOpen}
  <div
    class="modal-backdrop"
    role="button"
    tabindex="0"
    aria-label="Close modal"
    transition:fade={{ duration: 150 }}
    on:click={handleBackdropClick}
    on:keydown={handleBackdropKeydown}
  >
    <div
      class="modal-content"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      tabindex="-1"
      transition:fly={{ duration: 300, y: -50, easing: quintOut }}
      on:keydown={handleKeydown}
    >
      <button
        type="button"
        class="close-button"
        aria-label="Close modal"
        on:click={requestClose}
      >&times;</button>
      <slot name="header"></slot>
      <slot></slot>
      <slot name="footer"></slot>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 50;
    cursor: default;
  }

  .modal-content {
    background-color: var(--panel-bg, #fff);
    padding: 25px 30px;
    border-radius: 8px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
    position: relative;
    width: 90%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-content:focus {
    outline: none;
  }

  .modal-content:focus-visible {
    outline: 2px solid var(--highlight-outline);
    outline-offset: 2px;
  }

  .close-button {
    position: absolute;
    top: 10px;
    right: 15px;
    background: none;
    border: none;
    font-size: 1.8em;
    line-height: 1;
    cursor: pointer;
    color: #aaa;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-button:hover {
    color: #333;
  }
</style>
