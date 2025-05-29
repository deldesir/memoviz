<script lang="ts">
  // Import global styles for the entire application
  import "../app.css";
  // Import the component responsible for showing toast notifications
  import NotificationDisplay from "$lib/components/NotificationDisplay.svelte";

  // This layout applies to all pages within your application.
</script>

<NotificationDisplay />

<slot />
