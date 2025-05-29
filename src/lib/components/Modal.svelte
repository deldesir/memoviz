<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { onMount, onDestroy, tick } from 'svelte';

  export let isOpen = false;

  let previouslyFocusedElement: HTMLElement | null = null;
  let modalContentElement: HTMLDivElement | null = null; // Bind to modal-content div
  let closeButtonElement: HTMLButtonElement | null = null; // Bind to close button

  async function openModal() {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      previouslyFocusedElement = document.activeElement;
    }
    // Wait for modal to be rendered and transitions to start
    await tick();
    if (modalContentElement) {
        // Focus the modal container first, then decide on internal element
        modalContentElement.focus(); 
        // Attempt to focus the close button by default, or the first focusable item.
        if (closeButtonElement) {
            closeButtonElement.focus();
        } else {
            // Fallback: focus first focusable element in modal content
            const firstFocusable = modalContentElement.querySelector(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            ) as HTMLElement | null;
            firstFocusable?.focus();
        }
    }
  }

  function requestClose() {
    isOpen = false;
    if (previouslyFocusedElement) {
      previouslyFocusedElement.focus();
      previouslyFocusedElement = null;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      requestClose();
      return;
    }
    if (event.key === 'Tab' && modalContentElement) {
      const focusableElements = Array.from(
        modalContentElement.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => el instanceof HTMLElement && el.offsetParent !== null) as HTMLElement[]; // Check visibility

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const currentElement = document.activeElement;

      if (event.shiftKey) { // Shift + Tab
        if (currentElement === firstElement || currentElement === modalContentElement /* allow tabbing from container itself */) {
          lastElement.focus();
          event.preventDefault();
        }
      } else { // Tab
        if (currentElement === lastElement) {
          firstElement.focus();
          event.preventDefault();
        }
      }
      // If currentElement is not within focusableElements (e.g. modalContentElement itself),
      // and we're tabbing forward, focus the first element.
      if (!focusableElements.includes(currentElement as HTMLElement) && !event.shiftKey) {
        firstElement.focus();
        event.preventDefault();
      }
    }
  }

  // Reactive statement to handle modal opening
  $: if (isOpen) {
    openModal();
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
      tabindex="-1"  {# Make the modal content div programmatically focusable #}
      bind:this={modalContentElement}
      transition:fly={{ duration: 300, y: -50, easing: quintOut }}
      on:keydown={handleKeydown}
    >
      <button
        type="button"
        class="close-button"
        aria-label="Close modal"
        bind:this={closeButtonElement}
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
