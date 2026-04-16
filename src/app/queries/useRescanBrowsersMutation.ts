import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { rescanBrowsers } from "../api";
import { DISCOVERED_BROWSERS_QUERY_KEY } from "./useDiscoveredBrowsersQuery";
import { CONSOLE_SNAPSHOT_QUERY_KEY } from "./useConsoleSnapshotQuery";

export function useRescanBrowsersMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => rescanBrowsers(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DISCOVERED_BROWSERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CONSOLE_SNAPSHOT_QUERY_KEY });
    },
  });
}
