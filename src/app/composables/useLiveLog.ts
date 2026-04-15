import { computed, onBeforeUnmount, toValue, watch, type MaybeRefOrGetter } from "vue";
import {
  subscribeToLiveLogs,
  type ConsoleDataset,
  type ConsoleSession,
  type LiveLogSubscription,
} from "../api";
import { useConsoleSnapshotQuery } from "../queries/useConsoleSnapshotQuery";
import { useConsoleStore, type LiveLogStatus } from "../stores/console";

function findSession(dataset: ConsoleDataset | undefined, sessionId: string): ConsoleSession | null {
  if (!dataset || !sessionId) {
    return null;
  }
  return dataset.sessions.find((session) => session.id === sessionId) || null;
}

function canOpenEventSource() {
  return typeof window !== "undefined" && typeof EventSource !== "undefined";
}

export function useLiveLog(sessionIdInput: MaybeRefOrGetter<string | null | undefined>) {
  const consoleStore = useConsoleStore();
  const snapshotQuery = useConsoleSnapshotQuery();

  let subscription: LiveLogSubscription | null = null;
  let subscriptionToken = 0;

  const activeSessionId = computed<string>(() => {
    const id = toValue(sessionIdInput) || "";
    const session = findSession(snapshotQuery.data.value, id);
    return session?.artifacts.liveLogs ? id : "";
  });

  function stop() {
    if (!subscription) {
      return;
    }
    subscriptionToken += 1;
    const previous = subscription;
    subscription = null;
    previous.close();
  }

  function start(sessionId: string) {
    if (!canOpenEventSource()) {
      return;
    }
    stop();
    consoleStore.startLiveLogConnecting(sessionId);
    const token = ++subscriptionToken;
    subscription = subscribeToLiveLogs(sessionId, {
      onChunk(chunk) {
        if (token !== subscriptionToken) return;
        consoleStore.appendLiveLogChunk(sessionId, chunk);
      },
      onError(error) {
        if (token !== subscriptionToken) return;
        consoleStore.setLiveLogState({
          error: error instanceof Error ? error.message : "Live log stream unavailable",
        });
      },
      onStatusChange(nextStatus) {
        if (token !== subscriptionToken) return;
        consoleStore.setLiveLogState({
          error:
            nextStatus.status === "open" || nextStatus.status === "streaming"
              ? ""
              : consoleStore.liveLogs.error,
          message: nextStatus.message,
          sessionId,
          source: "live",
          status: nextStatus.status as LiveLogStatus,
        });
      },
    });
  }

  watch(
    activeSessionId,
    (nextId) => {
      if (!nextId) {
        stop();
        return;
      }
      if (subscription && consoleStore.liveLogs.sessionId === nextId) {
        return;
      }
      start(nextId);
    },
    { immediate: true },
  );

  watch(
    () => snapshotQuery.data.value,
    (dataset) => {
      const trackedId = consoleStore.liveLogs.sessionId;
      if (!trackedId) return;
      const tracked = findSession(dataset, trackedId);
      if (!tracked || !tracked.artifacts.liveLogs) {
        stop();
        consoleStore.markLiveLogInactive();
      }
    },
  );

  onBeforeUnmount(stop);

  function reconnect() {
    const id = toValue(sessionIdInput) || "";
    const session = findSession(snapshotQuery.data.value, id);
    if (!session?.artifacts.liveLogs) return;
    start(id);
  }

  return { reconnect, stop };
}
