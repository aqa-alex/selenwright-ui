import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { terminateSession, type ConsoleDataset, type TerminateProtocol } from "../api";
import { useConsoleStore } from "../stores/console";
import { CONSOLE_SNAPSHOT_QUERY_KEY } from "./useConsoleSnapshotQuery";

export interface TerminateSessionVariables {
  id: string;
  protocol: TerminateProtocol;
}

export function useTerminateSessionMutation() {
  const queryClient = useQueryClient();
  const consoleStore = useConsoleStore();

  return useMutation({
    mutationFn: ({ id, protocol }: TerminateSessionVariables) =>
      terminateSession(id, protocol),
    onMutate: ({ id }) => {
      consoleStore.setTerminating(id);
    },
    onSuccess: (_data, { id }) => {
      // Optimistically drop the session from the cached snapshot so the UI
      // updates immediately. The SSE stream is the source of truth and will
      // deliver the authoritative snapshot within one watch interval, so we
      // deliberately skip the redundant invalidateQueries refetch here.
      queryClient.setQueryData<ConsoleDataset>(
        CONSOLE_SNAPSHOT_QUERY_KEY,
        (previous) =>
          previous
            ? { ...previous, sessions: previous.sessions.filter((s) => s.id !== id) }
            : previous,
      );
    },
    onSettled: () => {
      consoleStore.setTerminating("");
    },
  });
}
