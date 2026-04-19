<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    kind?: "danger" | "primary" | "secondary";
    type?: "button" | "reset" | "submit";
  }>(),
  {
    disabled: false,
    kind: "primary",
    type: "button",
  },
);

const buttonClassName = computed(() => {
  if (props.kind === "secondary") {
    return "button secondary";
  }

  if (props.kind === "danger") {
    return "button danger";
  }

  return "button";
});
</script>

<template>
  <button
    :class="buttonClassName"
    :disabled="disabled"
    :type="type"
  >
    <slot />
  </button>
</template>
