import { computed, type ComputedRef, type MaybeRefOrGetter, toValue } from "vue";
import { useConsoleSnapshotQuery } from "../queries/useConsoleSnapshotQuery";
import type { SessionDetailPageModel } from "../session-detail/sessionDetail";
import { useConsoleStore } from "../stores/console";
import { usePreferencesStore } from "../stores/preferences";
import { useUiStore } from "../stores/ui";

export function useSessionDetailPageModel(
  sessionIdInput: MaybeRefOrGetter<string>,
): ComputedRef<SessionDetailPageModel> {
  const snapshotQuery = useConsoleSnapshotQuery();
  const uiStore = useUiStore();
  const preferencesStore = usePreferencesStore();
  const consoleStore = useConsoleStore();

  return computed<SessionDetailPageModel>(() => {
    const dataset = snapshotQuery.data.value;
    const routeSessionId = toValue(sessionIdInput);
    const session =
      dataset?.sessions.find((entry) => entry.id === routeSessionId) || null;
    return {
      liveLogs: { ...consoleStore.liveLogs },
      logFiles: { ...consoleStore.logFiles },
      logSearch: uiStore.logSearch,
      logs: dataset?.logs ?? [],
      preferences: {
        timeFormat: preferencesStore.timeFormat,
        timezone: preferencesStore.timezone,
      },
      routeSessionId,
      session,
      terminatingSessionId: consoleStore.terminatingSessionId,
    };
  });
}
