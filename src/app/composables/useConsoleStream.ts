import { useQueryClient } from "@tanstack/vue-query";
import { onBeforeUnmount, onMounted } from "vue";
import {
  subscribeToConsoleData,
  type ConsoleDataSubscription,
  type ConsoleDataset,
} from "../../data/service";
import { CONSOLE_SNAPSHOT_QUERY_KEY } from "../queries/useConsoleSnapshotQuery";

export interface ConsoleStreamHandlers {
  onDataset?: (dataset: ConsoleDataset) => void;
  onError?: (error: Error) => void;
}

/**
 * Subscribe to /api/stream/console for the lifetime of the consumer.
 * Each incoming snapshot is written into the Vue Query cache keyed by
 * `CONSOLE_SNAPSHOT_QUERY_KEY`, which makes it the single source of
 * truth for the console dataset.
 *
 * Mount this once at the app root (App.vue). Additional consumers
 * would open duplicate EventSources and race each other.
 */
export function useConsoleStream(handlers: ConsoleStreamHandlers = {}) {
  const queryClient = useQueryClient();
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
            nextDataset,
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

  onMounted(start);
  onBeforeUnmount(stop);

  return { start, stop };
}
