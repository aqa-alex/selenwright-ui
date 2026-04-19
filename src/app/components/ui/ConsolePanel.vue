<script setup lang="ts">
defineProps<{
  title?: string;
}>();
</script>

<template>
  <section class="panel">
    <div
      v-if="$slots.header || title"
      class="panel-header"
    >
      <h2 v-if="title">
        {{ title }}
      </h2>
      <slot name="header" />
    </div>
    <slot />
  </section>
</template>
