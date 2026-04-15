import { useQuery } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { loadLogFileContent } from "../../data/service";

/**
 * Fetches the content of a saved log file on demand.
 *
 * Saved logs are immutable per filename, so we cache forever
 * (`staleTime: Infinity`) and let the caller decide when to refetch
 * (e.g., a Retry button after a load error).
 *
 * The query is disabled when `filename` is empty so the hook can be
 * mounted unconditionally next to its consumer without firing a
 * request for non-log routes.
 */
export function useLogFileContentQuery(
  filename: MaybeRefOrGetter<string | null | undefined>,
  options: { enabled?: MaybeRefOrGetter<boolean> } = {},
) {
  const enabled = computed(() => {
    const extraEnabled = options.enabled !== undefined ? toValue(options.enabled) : true;
    return Boolean(toValue(filename)) && extraEnabled;
  });

  return useQuery<string>({
    enabled,
    queryKey: computed(() => ["console", "logFile", toValue(filename) ?? ""] as const),
    queryFn: () => loadLogFileContent(toValue(filename) || ""),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
