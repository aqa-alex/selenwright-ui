import { useQueryClient } from "@tanstack/vue-query";
import { watch } from "vue";
import { buildSessionsFromStatus, type RawStatusPayload } from "../api";
import { isRecord } from "../api/guards";
import { consoleQueryKey, useConsoleQueries } from "../queries/useConsoleSnapshotQuery";

function collectSessionIds(payload: RawStatusPayload): Set<string> {
  if (!isRecord(payload.browsers)) {
    return new Set();
  }
  return new Set(buildSessionsFromStatus(payload.browsers).map((session) => session.id));
}

export function useConsolePolling() {
  const queryClient = useQueryClient();
  const { identityKey, status } = useConsoleQueries({ poll: true });

  // Saved logs, videos and downloads appear only once a session ends, so a
  // session dropping out of the status payload is the cue to refresh them.
  watch(
    () => status.data.value,
    (next, previous) => {
      if (!next || !previous) {
        return;
      }
      const current = collectSessionIds(next);
      for (const id of collectSessionIds(previous)) {
        if (!current.has(id)) {
          void queryClient.invalidateQueries({
            queryKey: consoleQueryKey(identityKey.value, "artifacts"),
          });
          return;
        }
      }
    },
  );
}
