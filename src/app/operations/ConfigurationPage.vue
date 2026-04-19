<script setup lang="ts">
import { computed } from "vue";
import ConsolePanel from "../components/ui/ConsolePanel.vue";
import KeyValueList from "./KeyValueList.vue";
import type { OperationsPageModel } from "./operationsPage";
import {
  getConfigurationEmptyLabel,
  getConfigurationRawSections,
  getConfigurationStatusClass,
} from "./operationsPage";

const props = defineProps<{
  model: OperationsPageModel;
}>();

const configuration = computed(() => props.model.configuration);
const detailOpen = computed(() => props.model.preferences.detailPanel === "expanded");
const emptyLabel = computed(() => getConfigurationEmptyLabel(configuration.value));
const rawSections = computed(() => getConfigurationRawSections(configuration.value));
const statusClass = computed(() => getConfigurationStatusClass(configuration.value));
</script>

<template>
  <div class="page-intro">
    <div>
      <h1>Configuration</h1>
      <p>Runtime limits, paths, logging, and feature availability.</p>
    </div>
  </div>
  <div class="stack-layout">
    <div
      v-if="!configuration.available"
      :class="['note-block', statusClass]"
    >
      {{ configuration.message }}
    </div>
    <div class="two-column-layout">
      <ConsolePanel title="Limits and timeouts">
        <KeyValueList
          :empty-label="emptyLabel"
          :items="configuration.limits"
        />
      </ConsolePanel>
      <ConsolePanel title="Paths and storage">
        <KeyValueList
          :empty-label="emptyLabel"
          :items="configuration.paths"
        />
      </ConsolePanel>
      <ConsolePanel title="Logging">
        <KeyValueList
          :empty-label="emptyLabel"
          :items="configuration.logging"
        />
      </ConsolePanel>
      <ConsolePanel title="Feature availability">
        <KeyValueList
          :empty-label="emptyLabel"
          :items="configuration.featureAvailability"
        />
      </ConsolePanel>
    </div>
    <ConsolePanel title="Raw configuration">
      <div
        v-if="!rawSections.length"
        class="note-block configuration-panel-empty"
      >
        No raw configuration data
      </div>
      <template v-else>
        <details
          v-for="section in rawSections"
          :key="section.persistId"
          :data-persist-id="section.persistId"
          :open="detailOpen"
        >
          <summary>{{ section.title }}</summary>
          <div class="details-body">
            <pre class="code-block">{{ section.content }}</pre>
          </div>
        </details>
      </template>
    </ConsolePanel>
  </div>
</template>
