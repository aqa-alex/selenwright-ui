import { useQueryClient } from "@tanstack/vue-query";
import { computed, onScopeDispose, watch } from "vue";
import {
  enrichDatasetArtifacts,
  subscribeToConsoleData,
  type ConsoleDataSubscription,
  type ConsoleDataset,
} from "../api";
import { CONSOLE_SNAPSHOT_QUERY_KEY } from "../queries/useConsoleSnapshotQuery";
import { useIdentityStore } from "../stores/identity";

function mergeDatasetPreservingSectionErrors(
  previous: ConsoleDataset | undefined,
  next: ConsoleDataset,
): ConsoleDataset {
  if (!previous) {
    return next;
  }

  const errors = next.sectionErrors;
  const shouldPreserveLogs = Boolean(errors.logs) && previous.logs.length > 0;
  const shouldPreserveVideos = Boolean(errors.videos) && previous.videos.length > 0;
  const shouldPreserveDownloads =
    Boolean(errors.downloads) && previous.downloads.length > 0;

  if (!shouldPreserveLogs && !shouldPreserveVideos && !shouldPreserveDownloads) {
    return next;
  }

  const merged: ConsoleDataset = {
    ...next,
    downloads: shouldPreserveDownloads ? previous.downloads : next.downloads,
    logs: shouldPreserveLogs ? previous.logs : next.logs,
    videos: shouldPreserveVideos ? previous.videos : next.videos,
  };

  enrichDatasetArtifacts(merged);
  return merged;
}

export interface ConsoleStreamHandlers {
  onDataset?: (dataset: ConsoleDataset) => void;
  onError?: (error: Error) => void;
}

export function useConsoleStream(handlers: ConsoleStreamHandlers = {}) {
  const queryClient = useQueryClient();
  const identityStore = useIdentityStore();
  let subscription: ConsoleDataSubscription | null = null;

  function start() {
    if (subscription) {
      return;
    }
    try {
      subscription = subscribeToConsoleData({
        onDataset(nextDataset) {
          queryClient.setQueryData<ConsoleDataset>(
            CONSOLE_SNAPSHOT_QUERY_KEY,
            (previous) => mergeDatasetPreservingSectionErrors(previous, nextDataset),
          );
          handlers.onDataset?.(nextDataset);
        },
        onError(error) {
          handlers.onError?.(error);
        },
      });
    } catch {
      subscription = null;
    }
  }

  function stop() {
    if (!subscription) {
      return;
    }
    subscription.close();
    subscription = null;
  }

  // The server pins a stream to the credentials it was opened with, so the
  // stream must be (re)opened whenever the signed-in identity changes and must
  // not be opened at all before the user is signed in.
  const streamIdentity = computed(() =>
    identityStore.loaded && !identityStore.requiresLogin
      ? `${identityStore.authMode}:${identityStore.user}`
      : null,
  );
  watch(
    streamIdentity,
    (next) => {
      stop();
      if (next) {
        start();
      }
    },
    { immediate: true },
  );
  onScopeDispose(stop);

  return { start, stop };
}
