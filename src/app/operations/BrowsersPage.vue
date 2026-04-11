<script setup lang="ts">
import { computed } from "vue";
import ConsolePanel from "../components/ui/ConsolePanel.vue";
import StatusBadge from "../components/ui/StatusBadge.vue";
import ProtocolBadge from "../session-detail/ProtocolBadge.vue";
import type { OperationsPageModel } from "./operationsPage";
import { getBrowserInventoryGroups, getBrowserStatusBadgeStatus } from "./operationsPage";

const props = defineProps<{
  model: OperationsPageModel;
}>();

const browserGroups = computed(() => getBrowserInventoryGroups(props.model.browsers));
</script>

<template>
  <div class="page-intro">
    <div>
      <h1>Browsers</h1>
      <p>Available browser and version inventory.</p>
    </div>
  </div>
  <div class="stack-layout">
    <ConsolePanel v-for="group in browserGroups" :key="group.browser" :title="group.label">
      <div class="table-shell">
        <table class="data-table">
          <thead>
            <tr>
              <th>Version</th>
              <th>Protocol</th>
              <th>Image / source</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in group.versions" :key="`${entry.browser}:${entry.version}:${entry.protocol}`">
              <td class="mono">{{ entry.version }}</td>
              <td><ProtocolBadge :protocol="entry.protocol" /></td>
              <td class="mono">{{ entry.source }}</td>
              <td>
                <StatusBadge
                  :label="entry.status"
                  :status="getBrowserStatusBadgeStatus(entry.status)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </ConsolePanel>
  </div>
</template>
