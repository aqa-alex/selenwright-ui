import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { terminateSession, type ConsoleDataset } from "../../data/service";
import { useConsoleStore } from "../stores/console";
import { CONSOLE_SNAPSHOT_QUERY_KEY } from "./useConsoleSnapshotQuery";

export interface TerminateSessionVariables {
  id: string;
  protocol: string;
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
      queryClient.setQueryData<ConsoleDataset>(
        CONSOLE_SNAPSHOT_QUERY_KEY,
        (previous) =>
          previous
            ? { ...previous, sessions: previous.sessions.filter((s) => s.id !== id) }
            : previous,
      );
      queryClient.invalidateQueries({ queryKey: CONSOLE_SNAPSHOT_QUERY_KEY });
    },
    onSettled: () => {
      consoleStore.setTerminating("");
    },
  });
}
