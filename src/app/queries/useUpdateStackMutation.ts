import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { updateStack } from "../api";
import type { StackUpdateRequest } from "../api";
import { useSettingsStore } from "../stores/settings";
import { STACK_STATUS_QUERY_KEY } from "./useStackStatusQuery";

export function useUpdateStackMutation() {
  const queryClient = useQueryClient();
  const settingsStore = useSettingsStore();

  return useMutation({
    mutationFn: (request: StackUpdateRequest) => updateStack(request),
    onMutate: () => {
      settingsStore.setStackUpdating(true);
      settingsStore.setStackUpdateError("");
    },
    onSuccess: () => {
      // Reuse the existing applying-callout — same UX as the legacy recreate.
      settingsStore.setStackRecreating(true);
      // Versions become stale the moment we apply an upgrade. The operator
      // re-runs Check after services come back.
      settingsStore.clearStackVersions();
      queryClient.invalidateQueries({ queryKey: STACK_STATUS_QUERY_KEY });
    },
    onError: (error: unknown) => {
      settingsStore.setStackUpdateError(
        error instanceof Error ? error.message : "Stack update failed.",
      );
    },
    onSettled: () => {
      settingsStore.setStackUpdating(false);
    },
  });
}
