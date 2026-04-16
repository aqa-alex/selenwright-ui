import { useMutation } from "@tanstack/vue-query";
import { recreateStack } from "../api";
import { useSettingsStore } from "../stores/settings";

export function useRecreateStackMutation() {
  const settingsStore = useSettingsStore();

  return useMutation({
    mutationFn: () => recreateStack(),
    onMutate: () => {
      settingsStore.setStackRecreateError("");
    },
    onSuccess: () => {
      settingsStore.setStackRecreating(true);
    },
    onError: (error: unknown) => {
      settingsStore.setStackRecreateError(
        error instanceof Error ? error.message : "Stack recreate failed.",
      );
    },
  });
}
