import { useQuery } from "@tanstack/vue-query";
import { loadConsoleData, type ConsoleDataset } from "../../data/service";

export const CONSOLE_SNAPSHOT_QUERY_KEY = ["console", "snapshot"] as const;

export function useConsoleSnapshotQuery() {
  return useQuery<ConsoleDataset>({
    queryKey: CONSOLE_SNAPSHOT_QUERY_KEY,
    queryFn: () => loadConsoleData(),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}
