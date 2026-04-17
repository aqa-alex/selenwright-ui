import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { createToken, type CreateTokenRequest, type CreateTokenResult } from "../api/tokens";
import { TOKENS_QUERY_KEY } from "./useTokensQuery";
import { TOKEN_USERS_QUERY_KEY } from "./useTokenUsersQuery";

export function useCreateTokenMutation() {
  const queryClient = useQueryClient();
  return useMutation<CreateTokenResult, Error, CreateTokenRequest>({
    mutationFn: createToken,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TOKENS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: TOKEN_USERS_QUERY_KEY });
    },
  });
}
