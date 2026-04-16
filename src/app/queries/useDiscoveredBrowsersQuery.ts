import { useQuery } from "@tanstack/vue-query";
import { fetchDiscoveredBrowsers } from "../api";

export const DISCOVERED_BROWSERS_QUERY_KEY = ["discovered-browsers"] as const;

export function useDiscoveredBrowsersQuery() {
  return useQuery({
    queryKey: DISCOVERED_BROWSERS_QUERY_KEY,
    queryFn: fetchDiscoveredBrowsers,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
