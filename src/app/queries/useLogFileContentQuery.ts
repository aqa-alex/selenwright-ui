import { useQuery } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { loadLogFileContent } from "../../data/service";

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
