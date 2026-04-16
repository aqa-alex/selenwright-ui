import { computed, type ComputedRef, type MaybeRefOrGetter, toValue } from "vue";
import { createEmptyDataset } from "../api";
import type { OperationsPageModel, OperationsRouteName } from "../operations/operationsPage";
import { useConsoleSnapshotQuery } from "../queries/useConsoleSnapshotQuery";
import { usePreferencesStore } from "../stores/preferences";
import { useSettingsStore } from "../stores/settings";

const emptyDataset = createEmptyDataset();

export function useOperationsPageModel(
  routeNameInput: MaybeRefOrGetter<OperationsRouteName>,
): ComputedRef<OperationsPageModel> {
  const snapshotQuery = useConsoleSnapshotQuery();
  const preferencesStore = usePreferencesStore();
  const settingsStore = useSettingsStore();

  return computed<OperationsPageModel>(() => {
    const dataset = snapshotQuery.data.value ?? emptyDataset;
    return {
      artifactHistoryUi: { ...settingsStore.artifactHistory },
      browsers: dataset.browsers,
      configuration: dataset.configuration,
      connection: dataset.connection,
      preferences: {
        artifactPaneWidths: { ...preferencesStore.artifactPaneWidths },
        detailPanel: preferencesStore.detailPanel,
        themeMode: preferencesStore.themeMode,
        timeFormat: preferencesStore.timeFormat,
        timezone: preferencesStore.timezone,
      },
      routeName: toValue(routeNameInput),
      settings: dataset.settings,
      stackUi: { ...settingsStore.stack },
      system: dataset.system,
    };
  });
}
