<script setup lang="ts">
import type { ConsoleSession } from "../../data/service";
import { buildArtifactIndicators } from "../sessions/sessionTable";

defineProps<{
  session: ConsoleSession;
}>();
</script>

<template>
  <span
    v-for="indicator in buildArtifactIndicators(session)"
    :key="indicator.key"
    class="artifact-chip"
  >
    {{ indicator.label }}
  </span>
  <span v-if="!buildArtifactIndicators(session).length" class="secondary-text">None</span>
</template>
