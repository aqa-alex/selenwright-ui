<script setup lang="ts">
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useVueTable,
  type Row,
} from "@tanstack/vue-table";
import { computed } from "vue";
import { icon } from "../../components/icons.js";
import type { ConsoleSession } from "../../data/service";
import { formatDateTime, formatDuration, formatStatus, timeAgo } from "../../lib/format.js";
import StatusBadge from "../components/ui/StatusBadge.vue";
import type { SessionsPageModel } from "./sessionTable";
import {
  buildArtifactIndicators,
  buildSessionColumnFilters,
  buildSessionRowSelection,
  buildSessionSorting,
  createSessionTableColumns,
  titleCaseSessionValue,
} from "./sessionTable";

const props = defineProps<{
  model: SessionsPageModel;
}>();

const columns = createSessionTableColumns();
const data = computed(() => props.model.sessions);
const columnFilters = computed(() => buildSessionColumnFilters(props.model.filters));
const rowSelection = computed(() => buildSessionRowSelection(props.model.selectedSessionId));
const sorting = computed(() => buildSessionSorting(props.model.filters.sort));

const table = useVueTable({
  columns,
  data,
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getRowId: (session) => session.id,
  getSortedRowModel: getSortedRowModel(),
  state: {
    get columnFilters() {
      return columnFilters.value;
    },
    get rowSelection() {
      return rowSelection.value;
    },
    get sorting() {
      return sorting.value;
    },
  },
});

const rows = computed(() => table.getRowModel().rows);

const tableHeaders = [
  { label: "Session", sort: "session" },
  { label: "Browser", sort: "browser" },
  { label: "Version" },
  { label: "Status", sort: "status" },
  { label: "Started", sort: "started" },
  { label: "Duration", sort: "duration" },
  { label: "Artifacts" },
];

function protocolIcon(session: ConsoleSession): string {
  return icon(session.protocol === "playwright" ? "sessions" : "browsers");
}

function rowClass(row: Row<ConsoleSession>) {
  return ["session-row", { selected: row.getIsSelected() }];
}
</script>

<template>
  <div class="table-shell">
    <table class="data-table sessions-table">
      <thead>
        <tr>
          <th v-for="header in tableHeaders" :key="header.label">
            <button
              v-if="header.sort"
              class="sort-button"
              data-action="set-sort"
              :data-sort="header.sort"
              type="button"
            >
              {{ header.label }}
            </button>
            <template v-else>{{ header.label }}</template>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.id"
          :class="rowClass(row)"
          data-action="open-session"
          :data-session-id="row.original.id"
          :tabindex="row.getIsSelected() ? 0 : -1"
        >
          <td>
            <div class="session-cell">
              <span
                :class="['protocol-icon', `protocol-${row.original.protocol}`]"
                v-html="protocolIcon(row.original)"
              ></span>
              <div>
                <strong>{{ row.original.name }}</strong>
                <span class="secondary-text mono">{{ row.original.id }}</span>
              </div>
            </div>
          </td>
          <td>{{ titleCaseSessionValue(row.original.browser) }}</td>
          <td class="mono">{{ row.original.browserVersion }}</td>
          <td>
            <StatusBadge :label="formatStatus(row.original.status)" :status="row.original.status" />
          </td>
          <td>
            <div class="stacked-cell">
              <span>{{ formatDateTime(row.original.startedAt, model.preferences) }}</span>
              <span class="secondary-text" :data-time-ago="row.original.startedAt">
                {{ timeAgo(row.original.startedAt) }}
              </span>
            </div>
          </td>
          <td
            class="mono"
            :data-duration-finished-at="row.original.finishedAt || ''"
            :data-duration-started-at="row.original.startedAt"
          >
            {{ formatDuration(row.original.durationMs) }}
          </td>
          <td>
            <span
              v-for="indicator in buildArtifactIndicators(row.original)"
              :key="indicator.key"
              class="artifact-chip"
            >
              {{ indicator.label }}
            </span>
            <span v-if="!buildArtifactIndicators(row.original).length" class="secondary-text">
              None
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
