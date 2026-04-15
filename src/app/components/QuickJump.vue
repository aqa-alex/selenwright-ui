<script setup lang="ts">
import { icon } from "../../components/icons.js";
import { navigate } from "../../lib/router.js";
import { useUiStore } from "../stores/ui";
import type { ShellQuickJumpResult } from "../types";

defineProps<{
  quickJumpQuery: string;
  quickJumpResults: ShellQuickJumpResult[];
}>();

const uiStore = useUiStore();
const searchIcon = icon("search");

function onQueryInput(event: Event) {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  uiStore.setQuickJumpQuery(target.value);
}

function openResult(path: string) {
  uiStore.clearQuickJumpQuery();
  navigate(path);
}
</script>

<template>
  <div class="quick-jump">
    <span v-html="searchIcon"></span>
    <input
      aria-label="Global search and quick jump"
      placeholder="Quick jump"
      spellcheck="false"
      type="search"
      :value="quickJumpQuery"
      @input="onQueryInput"
    />
    <div v-if="quickJumpQuery.trim()" class="quick-jump-results">
      <div v-if="!quickJumpResults.length" class="quick-jump-empty">No matches</div>
      <button
        v-for="result in quickJumpResults.slice(0, 6)"
        v-else
        :key="`${result.kind}:${result.path}`"
        class="quick-jump-result"
        type="button"
        @click="openResult(result.path)"
      >
        <span>
          <strong>{{ result.title }}</strong>
          <span>{{ result.meta }}</span>
        </span>
        <span class="quick-jump-kind">{{ result.kind }}</span>
      </button>
    </div>
  </div>
</template>
