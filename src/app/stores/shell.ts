import { defineStore } from "pinia";

const defaultNoticeTtlMs = 1800;

export interface ShellState {
  notice: string;
  pageTitle: string;
  routeName: string;
  _noticeTimer: number;
}

export const useShellStore = defineStore("shell", {
  state: (): ShellState => ({
    notice: "",
    pageTitle: "Selenwright",
    routeName: "sessions",
    _noticeTimer: 0,
  }),
  actions: {
    setRouteName(routeName: string) {
      this.routeName = routeName;
    },
    setPageTitle(pageTitle: string) {
      this.pageTitle = pageTitle;
    },
    setNotice(message: string, ttlMs: number = defaultNoticeTtlMs) {
      if (typeof window !== "undefined" && this._noticeTimer) {
        window.clearTimeout(this._noticeTimer);
        this._noticeTimer = 0;
      }
      this.notice = message;
      if (message && typeof window !== "undefined") {
        this._noticeTimer = window.setTimeout(() => {
          this.notice = "";
          this._noticeTimer = 0;
        }, ttlMs);
      }
    },
  },
});
