<script setup lang="ts">
import { computed } from "vue";
import { icon } from "../../components/icons.js";
import type { ConsoleSession } from "../../data/service";
import type { SessionFilters } from "./sessionTable";
import { buildBrowserFilterOptions } from "./sessionTable";

const props = defineProps<{
  filters: SessionFilters;
  sessions: ConsoleSession[];
}>();

const searchIcon = icon("search");
const browserOptions = computed(() => buildBrowserFilterOptions(props.sessions));

const protocolOptions = [
  { label: "All", value: "all" },
  { label: "Selenium", value: "selenium" },
  { label: "Playwright", value: "playwright" },
];

const statusOptions = [
  { label: "All", value: "all" },
  { label: "Running", value: "running" },
  { label: "Pending", value: "pending" },
  { label: "Queued", value: "queued" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
];
</script>

<template>
  <div class="toolbar">
    <label class="search-field">
      <span v-html="searchIcon"></span>
      <input
        aria-label="Search sessions"
        data-input="session-search"
        placeholder="Search session id, name, browser"
        type="search"
        :value="filters.search"
      />
    </label>
    <label class="filter-select">
      <span>Protocol</span>
      <select data-input="protocol-filter" :value="filters.protocol">
        <option v-for="option in protocolOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>
    <label class="filter-select">
      <span>Status</span>
      <select data-input="status-filter" :value="filters.status">
        <option v-for="option in statusOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>
    <label class="filter-select">
      <span>Browser</span>
      <select data-input="browser-filter" :value="filters.browser">
        <option v-for="option in browserOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>
    <label class="toggle-chip">
      <input :checked="filters.activeOnly" data-input="active-only" type="checkbox" />
      <span>Active only</span>
    </label>
  </div>
</template>
