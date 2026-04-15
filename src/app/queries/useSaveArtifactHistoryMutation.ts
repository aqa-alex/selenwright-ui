import { useMutation, useQueryClient } from "@tanstack/vue-query";
import {
  saveArtifactHistorySettings,
  type ArtifactHistorySettingsUpdate,
} from "../../data/service";
import { useSettingsStore } from "../stores/settings";
import { CONSOLE_SNAPSHOT_QUERY_KEY } from "./useConsoleSnapshotQuery";

export function useSaveArtifactHistoryMutation() {
  const queryClient = useQueryClient();
  const settingsStore = useSettingsStore();

  return useMutation({
    mutationFn: (payload: ArtifactHistorySettingsUpdate) =>
      saveArtifactHistorySettings(payload),
    onMutate: () => {
      settingsStore.setHistorySaving(true);
      settingsStore.setHistoryError("");
    },
    onSuccess: (_data, payload) => {
      settingsStore.syncFromBackend({
        enabled: payload.enabled,
        retentionDays: payload.retentionDays,
      });
      queryClient.invalidateQueries({ queryKey: CONSOLE_SNAPSHOT_QUERY_KEY });
    },
    onError: (error: unknown) => {
      settingsStore.setHistoryError(
        error instanceof Error ? error.message : "Artifact history settings update failed",
      );
    },
    onSettled: () => {
      settingsStore.setHistorySaving(false);
    },
  });
}
