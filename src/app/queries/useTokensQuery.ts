import { useQuery } from "@tanstack/vue-query";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import { fetchTokens } from "../api/tokens";

export const TOKENS_QUERY_KEY = ["admin-tokens"] as const;

export function useTokensQuery(ownerFilter: MaybeRefOrGetter<string>) {
  const owner = computed(() => toValue(ownerFilter).trim());
  return useQuery({
    queryKey: computed(() => [...TOKENS_QUERY_KEY, owner.value]),
    queryFn: () => fetchTokens(owner.value || undefined),
  });
}
