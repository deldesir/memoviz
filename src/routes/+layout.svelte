<script lang="ts">
  // Import global styles for the entire application
  import "../app.css";
  // Import the component responsible for showing toast notifications
  import NotificationDisplay from "$lib/components/NotificationDisplay.svelte";

  // This layout applies to all pages within your application.
</script>

<NotificationDisplay />

<slot />

<script>
    import { onMount } from 'svelte';

    onMount(async () => {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/service-worker.js');
                console.log('Service Worker registered with scope:', registration.scope);
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    });
</script>
