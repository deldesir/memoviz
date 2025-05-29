<script lang="ts">
    import { notification, hideNotification } from '$lib/stores/notificationStore.js';
    import { fade } from 'svelte/transition';

    // Reactive variables make template cleaner
    $: message = $notification.message;
    $: type = $notification.type;
    $: visible = $notification.visible;
    $: isPersistent = $notification.duration === 0;

</script>

{#if visible}
    <div
        class="notification toast toast-{type}"
        role={type === 'error' || type === 'warning' ? 'alert' : 'status'}
        aria-live={type === 'error' || type === 'warning' ? 'assertive' : 'polite'}
        transition:fade={{ duration: 250 }}
    >
        <span>{message}</span>
        {#if isPersistent}
            <button
                type="button"
                class="close-toast-btn"
                aria-label="Dismiss notification"
                on:click={hideNotification}>
                &times;
            </button>
        {/if}
    </div>
{/if}

<style>
    .notification {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 20px;
        border-radius: 6px;
        color: white;
        z-index: 1000; /* Above everything */
        box-shadow: 0 3px 10px rgba(0,0,0,0.2);
        font-size: 0.95em;
        max-width: 90%;
        width: max-content; /* Adjust width to content */
        min-width: 200px; /* Ensure reasonable min width */
        text-align: center;
        display: flex; /* For close button alignment */
        justify-content: space-between;
        align-items: center;
        gap: 15px;
    }
    /* Color schemes */
    .toast-info { background-color: #0d6efd; } /* Blue */
    .toast-success { background-color: #198754; } /* Green */
    .toast-error { background-color: #dc3545; } /* Red */
    .toast-warning { background-color: #ffc107; color: #000; } /* Yellow (dark text) */

    .close-toast-btn {
        background: none;
        border: none;
        color: inherit; /* Inherit color from parent */
        opacity: 0.8;
        cursor: pointer;
        font-size: 1.4em;
        line-height: 1;
        padding: 0 0 0 10px; /* Space before button */
        margin-left: auto; /* Push to right */
    }
    .close-toast-btn:hover {
        opacity: 1;
    }
</style>
