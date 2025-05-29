// src/lib/stores/notificationStore.js
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * @typedef {'info' | 'success' | 'error' | 'warning'} NotificationType
 */

/**
 * @typedef {Object} NotificationState
 * @property {string} message
 * @property {NotificationType} type
 * @property {boolean} visible
 * @property {number} duration - Duration in ms (0 for persistent)
 */

/** @type {import('svelte/store').Writable<NotificationState>} */
export const notification = writable({ message: '', type: 'info', visible: false, duration: 0 });

/** @type {number | null | ReturnType<typeof setTimeout>} */
let timeoutId = null;

/**
 * Shows a notification message.
 * @param {string} message - The message to display.
 * @param {NotificationType} [type='info'] - The type of notification.
 * @param {number} [duration] - How long to show in ms. Defaults to 4000ms for non-errors, 0 (persistent) for errors.
 */
export function showNotification(message, type = 'info', duration) {
    if (!browser) return; // Don't show notifications during SSR

    // Default duration logic
    if (duration === undefined) {
        duration = (type === 'error') ? 0 : 4000; // Errors are persistent by default
    }

    if (timeoutId !== null) {
        clearTimeout(timeoutId); // Clear previous timer
        timeoutId = null;
    }

    notification.set({ message, type, visible: true, duration });

    if (duration > 0) {
        timeoutId = setTimeout(() => {
            notification.update(n => ({ ...n, visible: false })); // Hide after duration
            timeoutId = null;
        }, duration);
    }
}

/** Hides the current notification */
export function hideNotification() {
     if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
    }
    notification.update(n => ({ ...n, visible: false }));
}
