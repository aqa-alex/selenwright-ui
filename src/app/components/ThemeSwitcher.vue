<script setup lang="ts">
import SegmentedControl from "./ui/SegmentedControl.vue";

defineProps<{
  themeMode: string;
}>();

const options = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];
</script>

<template>
  <div class="theme-switcher" aria-label="Theme mode">
    <SegmentedControl action="set-theme" :options="options" :selected-value="themeMode" />
  </div>
</template>
