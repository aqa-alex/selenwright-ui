<script setup lang="ts">
import { storeToRefs } from "pinia";
import SegmentedControl from "./ui/SegmentedControl.vue";
import { type ThemeMode, usePreferencesStore } from "../stores/preferences";

const preferencesStore = usePreferencesStore();
const { themeMode } = storeToRefs(preferencesStore);

const options: Array<{ value: ThemeMode; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function handleSelect(value: string) {
  preferencesStore.setThemeMode(value as ThemeMode);
}
</script>

<template>
  <div
    class="theme-switcher"
    aria-label="Theme mode"
  >
    <SegmentedControl
      :options="options"
      :selected-value="themeMode"
      @select="handleSelect"
    />
  </div>
</template>
