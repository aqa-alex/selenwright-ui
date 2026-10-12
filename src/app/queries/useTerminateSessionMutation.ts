import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { terminateSession, type TerminateProtocol } from "../api";
import { useConsoleStore } from "../stores/console";
import { consoleQueryKey, useConsoleIdentityKey } from "./useConsoleSnapshotQuery";

export interface TerminateSessionVariables {
  id: string;
  protocol: TerminateProtocol;
}

export function useTerminateSessionMutation() {
  const queryClient = useQueryClient();
  const consoleStore = useConsoleStore();
  const identityKey = useConsoleIdentityKey();

  return useMutation({
    mutationFn: ({ id, protocol }: TerminateSessionVariables) =>
      terminateSession(id, protocol),
    onMutate: ({ id }) => {
      consoleStore.setTerminating(id);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: consoleQueryKey(identityKey.value, "status") }),
    onSettled: () => {
      consoleStore.setTerminating("");
    },
  });
}
