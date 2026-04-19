<script setup lang="ts">
interface SegmentedOption {
  label: string;
  value: string;
}

defineProps<{
  options: SegmentedOption[];
  selectedValue: string;
}>();

const emit = defineEmits<{
  select: [value: string];
}>();
</script>

<template>
  <div
    class="segmented-control"
    role="group"
  >
    <button
      v-for="option in options"
      :key="option.value"
      :aria-pressed="selectedValue === option.value ? 'true' : 'false'"
      :class="['segmented-option', { selected: selectedValue === option.value }]"
      type="button"
      @click="emit('select', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
