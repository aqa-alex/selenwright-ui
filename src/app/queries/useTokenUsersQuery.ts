import { useQuery } from "@tanstack/vue-query";
import { fetchTokenUsers } from "../api/tokens";

export const TOKEN_USERS_QUERY_KEY = ["admin-token-users"] as const;

export function useTokenUsersQuery() {
  return useQuery({
    queryKey: TOKEN_USERS_QUERY_KEY,
    queryFn: fetchTokenUsers,
  });
}
