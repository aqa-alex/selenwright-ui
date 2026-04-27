import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { pullFromRegistry } from "../api";
import type { RegistryPullRequest, RegistryPullResult } from "../api";
import { DISCOVERED_BROWSERS_QUERY_KEY } from "./useDiscoveredBrowsersQuery";
import { CONSOLE_SNAPSHOT_QUERY_KEY } from "./useConsoleSnapshotQuery";

export function usePullFromRegistryMutation() {
  const queryClient = useQueryClient();

  return useMutation<RegistryPullResult, Error, RegistryPullRequest>({
    mutationFn: (request: RegistryPullRequest) => pullFromRegistry(request),
    onSuccess: () => {
      // Pulled images now live in the local daemon — let the existing label
      // discovery surface them in the "Discovered images" panel.
      queryClient.invalidateQueries({ queryKey: DISCOVERED_BROWSERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CONSOLE_SNAPSHOT_QUERY_KEY });
    },
  });
}
