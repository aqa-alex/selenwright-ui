<script setup lang="ts">
interface SegmentedOption {
  label: string;
  value: string;
}

defineProps<{
  action: string;
  options: SegmentedOption[];
  selectedValue: string;
}>();
</script>

<template>
  <div class="segmented-control" role="group">
    <button
      v-for="option in options"
      :key="option.value"
      :aria-pressed="selectedValue === option.value ? 'true' : 'false'"
      :class="['segmented-option', { selected: selectedValue === option.value }]"
      :data-action="action"
      :data-value="option.value"
      type="button"
    >
      {{ option.label }}
    </button>
  </div>
</template>
