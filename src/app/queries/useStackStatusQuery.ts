import { useQuery } from "@tanstack/vue-query";
import { fetchStackStatus } from "../api";
import type { StackStatus } from "../api";

export const STACK_STATUS_QUERY_KEY = ["stack", "status"] as const;

export function useStackStatusQuery() {
  return useQuery<StackStatus>({
    queryKey: STACK_STATUS_QUERY_KEY,
    queryFn: fetchStackStatus,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
