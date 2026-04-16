import { defineStore } from "pinia";
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
}

export const useIdentityStore = defineStore("identity", {
  state: (): IdentityState => ({
    user: "unknown",
    isAdmin: false,
    authMode: "none",
    authenticated: false,
    loaded: false,
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
      this.user = "unknown";
      this.isAdmin = false;
      this.authenticated = false;
    },
    canManageSession(sessionOwner: string): boolean {
      if (this.effectiveAdmin) {
        return true;
      }
      return this.user !== "" && this.user === sessionOwner;
    },
  },
});
