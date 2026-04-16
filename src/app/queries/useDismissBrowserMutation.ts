import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { dismissBrowser } from "../api";
import { DISCOVERED_BROWSERS_QUERY_KEY } from "./useDiscoveredBrowsersQuery";

export function useDismissBrowserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (digest: string) => dismissBrowser(digest),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DISCOVERED_BROWSERS_QUERY_KEY });
    },
  });
}
