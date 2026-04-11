import type {
  ColumnDef,
  ColumnFiltersState,
  FilterFn,
  RowSelectionState,
  SortingFn,
  SortingState,
} from "@tanstack/vue-table";
import type { ConsoleSession } from "../../data/service";

export const activeStatuses = new Set(["running", "pending", "queued"]);

export type SessionSortKey = "browser" | "duration" | "session" | "started" | "status";

export interface SessionFilters {
  activeOnly: boolean;
  browser: string;
  protocol: string;
  search: string;
  sort: SessionSortKey | string;
  status: string;
}

export interface SessionsPageModel {
  filters: SessionFilters;
  preferences: {
    timeFormat?: string;
    timezone?: string;
  };
  selectedSessionId: string | null;
  sessions: ConsoleSession[];
}

export interface FilterOption {
  label: string;
  value: string;
}

export interface ArtifactIndicator {
  label: string;
  key: string;
}

const descendingSorts = new Set<SessionSortKey>(["duration", "started"]);

const exactOrAllFilter: FilterFn<ConsoleSession> = (row, columnId, filterValue) => {
  return filterValue === "all" || row.getValue(columnId) === filterValue;
};

const activeOnlyFilter: FilterFn<ConsoleSession> = (row, columnId, filterValue) => {
  return !filterValue || activeStatuses.has(String(row.getValue(columnId)));
};

const searchFilter: FilterFn<ConsoleSession> = (row, _columnId, filterValue) => {
  return sessionMatchesSearch(row.original, String(filterValue || ""));
};

const compareSessionNames: SortingFn<ConsoleSession> = (left, right) =>
  compareValues(left.original.name, right.original.name);

const compareSessionBrowsers: SortingFn<ConsoleSession> = (left, right) =>
  compareValues(left.original.browser, right.original.browser);

const compareSessionStatuses: SortingFn<ConsoleSession> = (left, right) =>
  compareValues(left.original.status, right.original.status);

const compareSessionStarted: SortingFn<ConsoleSession> = (left, right) =>
  compareValues(
    new Date(left.original.startedAt).getTime(),
    new Date(right.original.startedAt).getTime(),
  );

const compareSessionDuration: SortingFn<ConsoleSession> = (left, right) =>
  compareValues(left.original.durationMs, right.original.durationMs);

export function createSessionTableColumns(): ColumnDef<ConsoleSession>[] {
  return [
    {
      accessorFn: getSessionSearchText,
      enableSorting: false,
      filterFn: searchFilter,
      header: "Search",
      id: "search",
    },
    {
      accessorKey: "protocol",
      enableSorting: false,
      filterFn: exactOrAllFilter,
      header: "Protocol",
      id: "protocol",
    },
    {
      accessorKey: "status",
      filterFn: exactOrAllFilter,
      header: "Status",
      id: "status",
      sortingFn: compareSessionStatuses,
    },
    {
      accessorKey: "browser",
      filterFn: exactOrAllFilter,
      header: "Browser",
      id: "browser",
      sortingFn: compareSessionBrowsers,
    },
    {
      accessorFn: (session) => session.status,
      enableSorting: false,
      filterFn: activeOnlyFilter,
      header: "Active",
      id: "active",
    },
    {
      accessorFn: (session) => session.name,
      header: "Session",
      id: "session",
      sortingFn: compareSessionNames,
    },
    {
      accessorFn: (session) => new Date(session.startedAt).getTime(),
      header: "Started",
      id: "started",
      sortingFn: compareSessionStarted,
    },
    {
      accessorFn: (session) => session.durationMs,
      header: "Duration",
      id: "duration",
      sortingFn: compareSessionDuration,
    },
  ];
}

export function buildSessionColumnFilters(filters: SessionFilters): ColumnFiltersState {
  const columnFilters: ColumnFiltersState = [];
  const search = filters.search.trim().toLowerCase();

  if (search) {
    columnFilters.push({ id: "search", value: search });
  }

  if (filters.protocol !== "all") {
    columnFilters.push({ id: "protocol", value: filters.protocol });
  }

  if (filters.status !== "all") {
    columnFilters.push({ id: "status", value: filters.status });
  }

  if (filters.browser !== "all") {
    columnFilters.push({ id: "browser", value: filters.browser });
  }

  if (filters.activeOnly) {
    columnFilters.push({ id: "active", value: true });
  }

  return columnFilters;
}

export function buildSessionSorting(sort: string): SortingState {
  const sortKey = normalizeSessionSort(sort);
  return [{ desc: descendingSorts.has(sortKey), id: sortKey }];
}

export function buildSessionRowSelection(selectedSessionId: string | null): RowSelectionState {
  return selectedSessionId ? { [selectedSessionId]: true } : {};
}

export function getFilteredSessionsForState(
  sessions: ConsoleSession[],
  filters: SessionFilters,
): ConsoleSession[] {
  return sessions
    .filter((session) => sessionMatchesFilters(session, filters))
    .sort((left, right) => sortSessions(left, right, filters.sort));
}

export function sessionMatchesFilters(session: ConsoleSession, filters: SessionFilters): boolean {
  if (filters.protocol !== "all" && session.protocol !== filters.protocol) {
    return false;
  }
  if (filters.status !== "all" && session.status !== filters.status) {
    return false;
  }
  if (filters.browser !== "all" && session.browser !== filters.browser) {
    return false;
  }
  if (filters.activeOnly && !activeStatuses.has(session.status)) {
    return false;
  }
  return sessionMatchesSearch(session, filters.search);
}

export function sessionMatchesSearch(session: ConsoleSession, search: string): boolean {
  const query = search.trim().toLowerCase();
  return !query || getSessionSearchText(session).includes(query);
}

export function getSessionSearchText(session: ConsoleSession): string {
  return [
    session.id,
    session.name,
    session.browser,
    session.browserVersion,
    session.protocol,
  ]
    .join(" ")
    .toLowerCase();
}

export function sortSessions(
  left: ConsoleSession,
  right: ConsoleSession,
  sort: string,
): number {
  switch (normalizeSessionSort(sort)) {
    case "browser":
      return compareValues(left.browser, right.browser);
    case "duration":
      return compareValues(right.durationMs, left.durationMs);
    case "session":
      return compareValues(left.name, right.name);
    case "status":
      return compareValues(left.status, right.status);
    case "started":
    default:
      return compareValues(
        new Date(right.startedAt).getTime(),
        new Date(left.startedAt).getTime(),
      );
  }
}

export function buildBrowserFilterOptions(sessions: ConsoleSession[]): FilterOption[] {
  const browserOptions = Array.from(new Set(sessions.map((session) => session.browser)))
    .sort()
    .map((name) => ({ label: titleCaseSessionValue(name), value: name }));

  return [{ label: "All", value: "all" }, ...browserOptions];
}

export function buildArtifactIndicators(session: ConsoleSession): ArtifactIndicator[] {
  const indicators: ArtifactIndicator[] = [];
  if (session.artifacts.video) {
    indicators.push({ key: "video", label: "Video" });
  }
  if (session.artifacts.logs) {
    indicators.push({ key: "logs", label: "Logs" });
  }
  if (session.artifacts.downloads) {
    indicators.push({
      key: "downloads",
      label: `DL ${session.artifacts.downloads}`,
    });
  }
  return indicators;
}

export function titleCaseSessionValue(value: string): string {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

export function isActiveSessionStatus(status: string): boolean {
  return activeStatuses.has(status);
}

function normalizeSessionSort(sort: string): SessionSortKey {
  if (
    sort === "browser" ||
    sort === "duration" ||
    sort === "session" ||
    sort === "status" ||
    sort === "started"
  ) {
    return sort;
  }
  return "started";
}

function compareValues(left: unknown, right: unknown): number {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}
