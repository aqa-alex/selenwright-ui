import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { revokeTokensByOwner } from "../api/tokens";
import { TOKENS_QUERY_KEY } from "./useTokensQuery";
import { TOKEN_USERS_QUERY_KEY } from "./useTokenUsersQuery";

export function useRevokeTokensByOwnerMutation() {
  const queryClient = useQueryClient();
  return useMutation<number, Error, string>({
    mutationFn: revokeTokensByOwner,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TOKENS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: TOKEN_USERS_QUERY_KEY });
    },
  });
}
