import { computed, type ComputedRef } from "vue";
import { formatStatus } from "../../lib/format";
import { buildSessionPath, navGroups } from "../router";
import { useConsoleSnapshotQuery } from "../queries/useConsoleSnapshotQuery";
import { useUiStore } from "../stores/ui";
import type { ShellQuickJumpResult } from "../types";

export function useQuickJumpResults(): ComputedRef<ShellQuickJumpResult[]> {
  const snapshotQuery = useConsoleSnapshotQuery();
  const uiStore = useUiStore();

  return computed<ShellQuickJumpResult[]>(() => {
    const query = uiStore.quickJumpQuery.trim().toLowerCase();
    if (!query) return [];

    const pageResults: ShellQuickJumpResult[] = navGroups
      .flatMap((group) => group.items)
      .map((item) => ({
        kind: "Page",
        meta: item.href,
        path: item.href,
        title: item.label,
      }))
      .filter(
        (entry) =>
          entry.title.toLowerCase().includes(query) ||
          entry.meta.toLowerCase().includes(query),
      );

    const sessions = snapshotQuery.data.value?.sessions ?? [];
    const sessionResults: ShellQuickJumpResult[] = sessions
      .filter((session) => {
        const haystack =
          `${session.name} ${session.id} ${session.browser} ${formatStatus(session.status)}`.toLowerCase();
        return haystack.includes(query);
      })
      .map((session) => ({
        kind: "Session",
        meta: `${session.browser} · ${formatStatus(session.status)}`,
        path: buildSessionPath(session.id),
        title: session.name,
      }));

    return [...pageResults, ...sessionResults].slice(0, 8);
  });
}
