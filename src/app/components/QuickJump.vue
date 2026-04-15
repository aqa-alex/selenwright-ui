<script setup lang="ts">
import { storeToRefs } from "pinia";
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from "vue";
import { useRoute } from "vue-router";
import { icon } from "../../components/icons.js";
import { navigate } from "../../lib/router.js";
import { useQuickJumpResults } from "../composables/useQuickJumpResults";
import { useUiStore } from "../stores/ui";

const uiStore = useUiStore();
const { quickJumpQuery } = storeToRefs(uiStore);
const quickJumpResults = useQuickJumpResults();
const searchIcon = icon("search");
const inputRef = useTemplateRef<HTMLInputElement>("inputRef");

function onQueryInput(event: Event) {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  uiStore.setQuickJumpQuery(target.value);
}

function openResult(path: string) {
  uiStore.clearQuickJumpQuery();
  navigate(path);
}

function onKeyDown(event: KeyboardEvent) {
  const activeElement = document.activeElement;
  const isTyping =
    activeElement instanceof HTMLElement &&
    (activeElement.tagName === "INPUT" ||
      activeElement.tagName === "TEXTAREA" ||
      activeElement.tagName === "SELECT" ||
      activeElement.isContentEditable);

  if (event.key === "/" && !isTyping) {
    event.preventDefault();
    const input = inputRef.value;
    if (input) {
      input.focus();
      input.select();
    }
    return;
  }

  if (quickJumpQuery.value && event.key === "Escape") {
    uiStore.clearQuickJumpQuery();
    return;
  }

  if (activeElement === inputRef.value && event.key === "Enter") {
    const firstResult = quickJumpResults.value[0];
    if (firstResult) {
      event.preventDefault();
      openResult(firstResult.path);
    }
  }
}

const route = useRoute();
watch(
  () => route.path,
  () => {
    uiStore.clearQuickJumpQuery();
  },
);

onMounted(() => {
  document.addEventListener("keydown", onKeyDown);
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeyDown);
});
</script>

<template>
  <div class="quick-jump">
    <span v-html="searchIcon"></span>
    <input
      ref="inputRef"
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
