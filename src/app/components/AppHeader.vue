<script setup lang="ts">
import { useRouter } from "vue-router";
import { useIdentityStore } from "../stores/identity";
import QuickJump from "./QuickJump.vue";
import ThemeSwitcher from "./ThemeSwitcher.vue";

const identityStore = useIdentityStore();
const router = useRouter();

async function handleLogout() {
  await identityStore.logout();
  void router.replace("/login");
}
</script>

<template>
  <header
    class="topbar"
    role="banner"
  >
    <div class="brand-block">
      <a
        class="brand-link"
        href="/sessions"
        data-link
      >
        <span class="brand-mark">
          <img
            alt="Selenwright logo"
            class="brand-favicon"
            src="/favicon.ico"
          >
        </span>
        <span class="brand-copy">
          <strong>Selenwright</strong>
          <span>Browser session console</span>
        </span>
      </a>
    </div>
    <div class="topbar-tools">
      <QuickJump />
      <ThemeSwitcher />
      <span
        v-if="identityStore.authenticated && identityStore.authMode === 'embedded'"
        class="topbar-identity"
      >
        <span class="topbar-user">{{ identityStore.user }}</span>
        <button
          class="button secondary topbar-logout"
          type="button"
          @click="handleLogout"
        >
          Sign out
        </button>
      </span>
    </div>
  </header>
</template>

<style scoped>
.topbar-identity {
  align-items: center;
  display: flex;
  gap: var(--space-2);
}

.topbar-user {
  color: var(--text-secondary);
  font-size: 0.75rem;
}

.topbar-logout {
  font-size: 0.6875rem;
  height: 26px;
  padding: 0 var(--space-2);
}
</style>
