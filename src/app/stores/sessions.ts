import { defineStore } from "pinia";

export type SessionSort = "session" | "browser" | "status" | "started" | "duration";
export type SessionStatusFilter = "all" | "running" | "pending" | "queued" | "completed" | "failed";
export type SessionProtocolFilter = "all" | "selenium" | "playwright";

export interface SessionsFilters {
  activeOnly: boolean;
  browser: string;
  protocol: SessionProtocolFilter;
  search: string;
  sort: SessionSort;
  status: SessionStatusFilter;
}

export interface SessionsState {
  filters: SessionsFilters;
  selectedSessionId: string | null;
}

const defaultFilters: SessionsFilters = {
  activeOnly: false,
  browser: "all",
  protocol: "all",
  search: "",
  sort: "started",
  status: "all",
};

export const useSessionsStore = defineStore("sessions", {
  state: (): SessionsState => ({
    filters: { ...defaultFilters },
    selectedSessionId: null,
  }),
  actions: {
    setBrowserFilter(value: string) {
      this.filters.browser = value;
    },
    setProtocolFilter(value: SessionProtocolFilter) {
      this.filters.protocol = value;
    },
    setStatusFilter(value: SessionStatusFilter) {
      this.filters.status = value;
    },
    setActiveOnly(active: boolean) {
      this.filters.activeOnly = active;
    },
    setSearch(query: string) {
      this.filters.search = query;
    },
    setSort(sort: SessionSort) {
      this.filters.sort = sort;
    },
    setSelectedSessionId(id: string | null) {
      this.selectedSessionId = id;
    },
    resetFilters() {
      this.filters = { ...defaultFilters };
    },
  },
});
