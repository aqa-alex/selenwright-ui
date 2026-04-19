<script setup lang="ts">
import { computed } from "vue";
import { formatDateTime, titleCase } from "../../lib/format";
import ConsolePanel from "../components/ui/ConsolePanel.vue";
import type { OperationsPageModel } from "./operationsPage";

const props = defineProps<{
  model: OperationsPageModel;
}>();

const system = computed(() => props.model.system);
</script>

<template>
  <div class="page-intro">
    <div>
      <h1>System</h1>
      <p>Runtime health, queue depth, and browser usage.</p>
    </div>
  </div>
  <ConsolePanel title="Current usage">
    <div class="summary-grid">
      <div
        v-for="item in system.usageSummary"
        :key="item.label"
        class="summary-card"
      >
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </div>
  </ConsolePanel>
  <div class="two-column-layout wide">
    <ConsolePanel title="Browser usage">
      <div class="table-shell">
        <table class="data-table">
          <thead>
            <tr>
              <th>Browser</th>
              <th>Total sessions</th>
              <th>Running now</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in system.browserUsage"
              :key="entry.browser"
            >
              <td>{{ titleCase(entry.browser) }}</td>
              <td>{{ entry.count }}</td>
              <td>{{ entry.running }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </ConsolePanel>
    <ConsolePanel title="Health notes">
      <div class="stack-layout compact">
        <div
          v-for="note in system.healthNotes"
          :key="note"
          class="note-block"
        >
          {{ note }}
        </div>
        <div class="note-block">
          <strong>Last reload</strong>
          <span>{{ formatDateTime(system.lastReloadTime, model.preferences) }}</span>
        </div>
        <div class="note-block">
          <strong>Runtime</strong>
          <span>{{ model.connection.statusEndpointMessage }}</span>
        </div>
      </div>
    </ConsolePanel>
  </div>
</template>
