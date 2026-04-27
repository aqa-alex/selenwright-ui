import { useMutation } from "@tanstack/vue-query";
import { checkStackUpdates } from "../api";
import { useSettingsStore } from "../stores/settings";

export function useCheckStackUpdatesMutation() {
  const settingsStore = useSettingsStore();

  return useMutation({
    mutationFn: () => checkStackUpdates(),
    onMutate: () => {
      settingsStore.setStackCheckingVersions(true);
      settingsStore.setStackVersionsError("");
    },
    onSuccess: (data) => {
      settingsStore.setStackVersions({
        services: data.services,
        checkedAt: data.checkedAt,
      });
    },
    onError: (error: unknown) => {
      settingsStore.setStackVersionsError(
        error instanceof Error ? error.message : "Version check failed.",
      );
    },
    onSettled: () => {
      settingsStore.setStackCheckingVersions(false);
    },
  });
}
