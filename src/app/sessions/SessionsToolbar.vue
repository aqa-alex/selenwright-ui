<script setup lang="ts">
import { computed } from "vue";
import { icon } from "../../components/icons.js";
import type { ConsoleSession } from "../../data/service";
import {
  type SessionProtocolFilter,
  type SessionStatusFilter,
  useSessionsStore,
} from "../stores/sessions";
import type { SessionFilters } from "./sessionTable";
import { buildBrowserFilterOptions } from "./sessionTable";

const props = defineProps<{
  filters: SessionFilters;
  sessions: ConsoleSession[];
}>();

const sessionsStore = useSessionsStore();
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

function inputValue(event: Event) {
  return (event.target as HTMLInputElement | HTMLSelectElement | null)?.value ?? "";
}
</script>

<template>
  <div class="toolbar">
    <label class="search-field">
      <span v-html="searchIcon"></span>
      <input
        aria-label="Search sessions"
        placeholder="Search session id, name, browser"
        type="search"
        :value="filters.search"
        @input="(event) => sessionsStore.setSearch(inputValue(event))"
      />
    </label>
    <label class="filter-select">
      <span>Protocol</span>
      <select
        :value="filters.protocol"
        @change="(event) => sessionsStore.setProtocolFilter(inputValue(event) as SessionProtocolFilter)"
      >
        <option v-for="option in protocolOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>
    <label class="filter-select">
      <span>Status</span>
      <select
        :value="filters.status"
        @change="(event) => sessionsStore.setStatusFilter(inputValue(event) as SessionStatusFilter)"
      >
        <option v-for="option in statusOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>
    <label class="filter-select">
      <span>Browser</span>
      <select
        :value="filters.browser"
        @change="(event) => sessionsStore.setBrowserFilter(inputValue(event))"
      >
        <option v-for="option in browserOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>
    <label class="toggle-chip">
      <input
        :checked="filters.activeOnly"
        type="checkbox"
        @change="(event) => sessionsStore.setActiveOnly((event.target as HTMLInputElement).checked)"
      />
      <span>Active only</span>
    </label>
  </div>
</template>
