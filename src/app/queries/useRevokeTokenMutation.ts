import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { revokeToken } from "../api/tokens";
import { TOKENS_QUERY_KEY } from "./useTokensQuery";

export function useRevokeTokenMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: revokeToken,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TOKENS_QUERY_KEY });
    },
  });
}
