<script setup lang="ts">
import ConsolePanel from "../components/ui/ConsolePanel.vue";
</script>

<template>
  <div class="page-intro">
    <div>
      <h1>Not found</h1>
      <p>The requested route is not defined.</p>
    </div>
  </div>
  <ConsolePanel title="Missing page">
    <p class="hint-text">Return to Sessions from the sidebar.</p>
  </ConsolePanel>
</template>
