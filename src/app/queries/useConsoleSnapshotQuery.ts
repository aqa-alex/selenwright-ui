import { useQuery, type UseQueryReturnType } from "@tanstack/vue-query";
import { computed, type ComputedRef } from "vue";
import {
  buildConsoleDatasetFromSnapshot,
  fetchArtifactHistorySettings,
  fetchConfiguration,
  fetchJson,
  type ConsoleDataset,
  type MetaResponse,
  type RawArtifactItem,
  type RawDownloadItem,
  type RawStatusPayload,
  type SnapshotResult,
} from "../api";
import { useIdentityStore } from "../stores/identity";

export const CONSOLE_SNAPSHOT_QUERY_KEY = ["console", "snapshot"] as const;
export const STATUS_POLL_INTERVAL_MS = 3_000;
export const ARTIFACTS_POLL_INTERVAL_MS = 30_000;

// Keys carry the signed-in identity so a user switch never shows the previous
// user's data, while CONSOLE_SNAPSHOT_QUERY_KEY stays a prefix that mutations
// can invalidate wholesale.
export function consoleQueryKey(identityKey: string | null, ...section: string[]) {
  return [...CONSOLE_SNAPSHOT_QUERY_KEY, identityKey, ...section];
}

export function useConsoleIdentityKey(): ComputedRef<string | null> {
  const identityStore = useIdentityStore();
  return computed(() =>
    identityStore.loaded && !identityStore.requiresLogin
      ? `${identityStore.authMode}:${identityStore.user}`
      : null,
  );
}

function useConsoleSourceQuery<T>(
  identityKey: ComputedRef<string | null>,
  section: string[],
  queryFn: () => Promise<T>,
  options: { refetchInterval?: number; staleTime: number },
): UseQueryReturnType<T, Error> {
  return useQuery({
    enabled: computed(() => identityKey.value !== null),
    queryFn,
    queryKey: computed(() => consoleQueryKey(identityKey.value, ...section)),
    refetchInterval: options.refetchInterval,
    staleTime: options.staleTime,
  });
}

// Each upstream source has its own cadence: live status is polled, artifact
// lists only change when a session ends, and configuration / history settings
// only change on an upstream restart or through the UI's own mutations.
// Only the App-level observer (poll: true) carries refetchInterval — every
// observer runs its own interval timer, so page-level observers just read.
export function useConsoleQueries({ poll }: { poll: boolean }) {
  const identityKey = useConsoleIdentityKey();
  const artifactsOptions = {
    refetchInterval: poll ? ARTIFACTS_POLL_INTERVAL_MS : undefined,
    staleTime: ARTIFACTS_POLL_INTERVAL_MS,
  };

  return {
    config: useConsoleSourceQuery(identityKey, ["config"], fetchConfiguration, {
      staleTime: Infinity,
    }),
    downloads: useConsoleSourceQuery(
      identityKey,
      ["artifacts", "downloads"],
      () => fetchJson<RawDownloadItem[]>("/api/downloads"),
      artifactsOptions,
    ),
    historySettings: useConsoleSourceQuery(
      identityKey,
      ["historySettings"],
      fetchArtifactHistorySettings,
      { staleTime: Infinity },
    ),
    identityKey,
    logs: useConsoleSourceQuery(
      identityKey,
      ["artifacts", "logs"],
      () => fetchJson<RawArtifactItem[]>("/api/logs"),
      artifactsOptions,
    ),
    meta: useConsoleSourceQuery(identityKey, ["meta"], () => fetchJson<MetaResponse>("/api/meta"), {
      staleTime: Infinity,
    }),
    status: useConsoleSourceQuery(
      identityKey,
      ["status"],
      () => fetchJson<RawStatusPayload>("/api/status"),
      {
        refetchInterval: poll ? STATUS_POLL_INTERVAL_MS : undefined,
        staleTime: STATUS_POLL_INTERVAL_MS,
      },
    ),
    videos: useConsoleSourceQuery(
      identityKey,
      ["artifacts", "videos"],
      () => fetchJson<RawArtifactItem[]>("/api/videos"),
      artifactsOptions,
    ),
  };
}

// Artifact lists keep their last good value through a failed refresh; live
// status and configuration report the failure instead of showing stale data.
function toSnapshotResult<T>(
  query: UseQueryReturnType<T, Error>,
  keepLastGood: boolean,
): SnapshotResult<T> | undefined {
  const value = query.data.value;
  if (query.isError.value && !(keepLastGood && value !== undefined)) {
    return { error: query.error.value?.message || "Request failed", ok: false };
  }
  return value === undefined ? undefined : { ok: true, value };
}

export function useConsoleSnapshotQuery(): { data: ComputedRef<ConsoleDataset | undefined> } {
  const queries = useConsoleQueries({ poll: false });

  const data = computed<ConsoleDataset | undefined>(() => {
    const { status } = queries;
    if (status.data.value === undefined && !status.isError.value) {
      return undefined;
    }
    return buildConsoleDatasetFromSnapshot({
      config: toSnapshotResult(queries.config, false),
      downloads: toSnapshotResult(queries.downloads, true),
      fetchedAt: status.dataUpdatedAt.value
        ? new Date(status.dataUpdatedAt.value).toISOString()
        : undefined,
      historySettings: toSnapshotResult(queries.historySettings, false),
      logs: toSnapshotResult(queries.logs, true),
      status: toSnapshotResult(queries.status, false),
      target: queries.meta.data.value?.target,
      videos: toSnapshotResult(queries.videos, true),
    });
  });

  return { data };
}
