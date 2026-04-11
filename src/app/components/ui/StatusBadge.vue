<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  label: string;
  status: string;
}>();

const badgeClassName = computed(() => [
  "status-badge",
  `status-${props.status}`,
]);
</script>

<template>
  <span :class="badgeClassName">{{ label }}</span>
</template>
