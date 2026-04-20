import { defineStore } from "pinia";
import type { ConsoleSession } from "../api";
import {
  fetchIdentity,
  login as apiLogin,
  logout as apiLogout,
  type AuthMode,
  type UserIdentity,
} from "../api/identity";

export interface IdentityState {
  user: string;
  isAdmin: boolean;
  authMode: AuthMode;
  authenticated: boolean;
  loaded: boolean;
  groups: string[];
}

export const useIdentityStore = defineStore("identity", {
  state: (): IdentityState => ({
    user: "unknown",
    isAdmin: false,
    authMode: "none",
    authenticated: false,
    loaded: false,
    groups: [],
  }),
  getters: {
    effectiveAdmin(state): boolean {
      return state.authMode === "none" || state.isAdmin;
    },
    requiresLogin(state): boolean {
      return state.authMode === "embedded" && !state.authenticated;
    },
  },
  actions: {
    setIdentity(identity: UserIdentity) {
      this.user = identity.user;
      this.isAdmin = identity.isAdmin;
      this.authMode = identity.authMode;
      this.authenticated = identity.authenticated;
      this.groups = [...identity.groups];
      this.loaded = true;
    },
    async load() {
      const identity = await fetchIdentity();
      this.setIdentity(identity);
    },
    async login(username: string, password: string) {
      const identity = await apiLogin(username, password);
      this.setIdentity(identity);
    },
    async logout() {
      await apiLogout();
      this.resetToAnonymous();
    },
    // resetToAnonymous flips the store to the "logged-out" shape without
    // calling POST /api/logout — invoked by the global 401 handler when the
    // server-side session is already gone (restart / TTL / revocation).
    resetToAnonymous() {
      this.user = "unknown";
      this.isAdmin = false;
      this.authenticated = false;
      this.groups = [];
    },
    canManageSession(session: ConsoleSession): boolean {
      if (this.effectiveAdmin) {
        return true;
      }
      const owner = session.metadata.quota;
      if (this.user !== "" && this.user === owner) {
        return true;
      }
      const ownerGroups = session.metadata.ownerGroups;
      if (!ownerGroups || ownerGroups.length === 0 || this.groups.length === 0) {
        return false;
      }
      const mine = new Set(this.groups);
      for (const g of ownerGroups) {
        if (mine.has(g)) {
          return true;
        }
      }
      return false;
    },
  },
});
