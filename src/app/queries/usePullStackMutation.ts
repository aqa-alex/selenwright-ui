import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { pullStackImages } from "../api";
import { useSettingsStore } from "../stores/settings";
import { STACK_STATUS_QUERY_KEY } from "./useStackStatusQuery";

export function usePullStackMutation() {
  const queryClient = useQueryClient();
  const settingsStore = useSettingsStore();

  return useMutation({
    mutationFn: () => pullStackImages(),
    onMutate: () => {
      settingsStore.setStackPulling(true);
      settingsStore.setStackPullError("");
      settingsStore.setStackPullResult(null);
    },
    onSuccess: (data) => {
      settingsStore.setStackPullResult(data);
      queryClient.invalidateQueries({ queryKey: STACK_STATUS_QUERY_KEY });
    },
    onError: (error: unknown) => {
      settingsStore.setStackPullError(
        error instanceof Error ? error.message : "Image pull failed.",
      );
    },
    onSettled: () => {
      settingsStore.setStackPulling(false);
    },
  });
}
