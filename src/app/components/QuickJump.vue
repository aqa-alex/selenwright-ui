<script setup lang="ts">
import { icon } from "../../components/icons.js";
import type { ShellQuickJumpResult } from "../types";

defineProps<{
  quickJumpQuery: string;
  quickJumpResults: ShellQuickJumpResult[];
}>();

const searchIcon = icon("search");
</script>

<template>
  <div class="quick-jump">
    <span v-html="searchIcon"></span>
    <input
      aria-label="Global search and quick jump"
      data-input="quick-jump"
      placeholder="Quick jump"
      spellcheck="false"
      type="search"
      :value="quickJumpQuery"
    />
    <div v-if="quickJumpQuery.trim()" class="quick-jump-results">
      <div v-if="!quickJumpResults.length" class="quick-jump-empty">No matches</div>
      <button
        v-for="result in quickJumpResults.slice(0, 6)"
        v-else
        :key="`${result.kind}:${result.path}`"
        class="quick-jump-result"
        data-action="open-quick-jump-result"
        :data-path="result.path"
        type="button"
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
