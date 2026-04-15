<script setup lang="ts">
import type { ConfigurationItem } from "../api";

defineProps<{
  compact?: boolean;
  emptyLabel?: string;
  items: ConfigurationItem[];
}>();
</script>

<template>
  <div v-if="!items.length" class="note-block configuration-panel-empty">
    {{ emptyLabel || "No data" }}
  </div>
  <div v-else :class="['key-value-list', { compact }]">
    <div v-for="item in items" :key="item.key" class="copyable-row">
      <span>{{ item.label }}</span>
      <strong>{{ item.value }}</strong>
    </div>
  </div>
</template>
