import { computed, type ComputedRef, type MaybeRefOrGetter, toValue } from "vue";
import type { ArtifactPageKey, ArtifactPageModel } from "../artifacts/artifactsPage";
import { useConsoleSnapshotQuery } from "../queries/useConsoleSnapshotQuery";
import { useConsoleStore } from "../stores/console";
import { usePreferencesStore } from "../stores/preferences";
import { useUiStore } from "../stores/ui";

export function useArtifactPageModel(
  pageKeyInput: MaybeRefOrGetter<ArtifactPageKey>,
): ComputedRef<ArtifactPageModel> {
  const snapshotQuery = useConsoleSnapshotQuery();
  const uiStore = useUiStore();
  const preferencesStore = usePreferencesStore();
  const consoleStore = useConsoleStore();

  return computed<ArtifactPageModel>(() => {
    const dataset = snapshotQuery.data.value;
    const pageKey = toValue(pageKeyInput);
    return {
      artifactSessionFilter: uiStore.artifactSessionFilter,
      downloads: dataset?.downloads ?? [],
      logFiles: { ...consoleStore.logFiles },
      logs: dataset?.logs ?? [],
      page: uiStore.artifactPageNumbers[pageKey],
      perPage: uiStore.artifactPageSizes[pageKey],
      logSearch: uiStore.logSearch,
      pageKey,
      preferences: {
        artifactPaneWidths: { ...preferencesStore.artifactPaneWidths },
        timeFormat: preferencesStore.timeFormat,
        timezone: preferencesStore.timezone,
      },
      selectedArtifacts: { ...uiStore.selectedArtifacts },
      sessions: dataset?.sessions ?? [],
      videos: dataset?.videos ?? [],
    };
  });
}
