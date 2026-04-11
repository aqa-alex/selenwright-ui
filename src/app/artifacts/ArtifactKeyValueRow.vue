<script setup lang="ts">
defineProps<{
  label: string;
  value: string;
}>();
</script>

<template>
  <div class="copyable-row">
    <span>{{ label }}</span>
    <strong class="mono">{{ value }}</strong>
  </div>
</template>
