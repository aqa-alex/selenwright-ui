<script setup lang="ts">
import { computed } from "vue";
import { titleCaseSessionValue } from "../sessions/sessionTable";

const props = defineProps<{
  protocol: string;
}>();

const badgeClassName = computed(() => [
  "protocol-badge",
  `protocol-badge-${props.protocol}`,
]);
</script>

<template>
  <span :class="badgeClassName">{{ titleCaseSessionValue(protocol) }}</span>
</template>
