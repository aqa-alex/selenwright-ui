import { computed, type ComputedRef } from "vue";
import { useConsoleSnapshotQuery } from "../queries/useConsoleSnapshotQuery";
import { usePreferencesStore } from "../stores/preferences";
import { useSessionsStore } from "../stores/sessions";
import type { SessionsPageModel } from "../sessions/sessionTable";

export function useSessionsPageModel(): ComputedRef<SessionsPageModel> {
  const snapshotQuery = useConsoleSnapshotQuery();
  const sessionsStore = useSessionsStore();
  const preferencesStore = usePreferencesStore();

  return computed<SessionsPageModel>(() => ({
    filters: { ...sessionsStore.filters },
    preferences: {
      timeFormat: preferencesStore.timeFormat,
      timezone: preferencesStore.timezone,
    },
    selectedSessionId: sessionsStore.selectedSessionId,
    sessions: snapshotQuery.data.value?.sessions ?? [],
  }));
}
