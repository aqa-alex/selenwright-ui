<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useIdentityStore } from "../stores/identity";

const identityStore = useIdentityStore();
const router = useRouter();

const username = ref("");
const password = ref("");
const error = ref("");
const submitting = ref(false);

async function handleSubmit() {
  error.value = "";
  if (!username.value.trim() || !password.value) {
    error.value = "Username and password are required.";
    return;
  }
  submitting.value = true;
  try {
    await identityStore.login(username.value.trim(), password.value);
    void router.replace("/sessions");
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Login failed.";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <form
      class="login-form"
      @submit.prevent="handleSubmit"
    >
      <h1 class="login-title">
        Selenwright
      </h1>
      <p class="login-subtitle">
        Sign in to continue
      </p>
      <label class="login-field">
        <span class="login-label">Username</span>
        <input
          v-model="username"
          autocomplete="username"
          autofocus
          class="login-input"
          :disabled="submitting"
          type="text"
        >
      </label>
      <label class="login-field">
        <span class="login-label">Password</span>
        <input
          v-model="password"
          autocomplete="current-password"
          class="login-input"
          :disabled="submitting"
          type="password"
        >
      </label>
      <div
        v-if="error"
        class="login-error"
      >
        {{ error }}
      </div>
      <button
        class="button login-button"
        :disabled="submitting"
        type="submit"
      >
        {{ submitting ? "Signing in..." : "Sign in" }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login-page {
  align-items: center;
  background: var(--bg-base);
  display: flex;
  height: 100vh;
  justify-content: center;
  width: 100%;
}

.login-form {
  background: var(--bg-panel);
  border: 1px solid var(--border-default);
  border-radius: var(--panel-radius);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 360px;
  padding: var(--space-7);
  width: 100%;
}

.login-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.login-subtitle {
  color: var(--text-secondary);
  font-size: 0.8125rem;
  margin: 0;
}

.login-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.login-label {
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
}

.login-input {
  background: var(--bg-base);
  border: 1px solid var(--border-default);
  border-radius: var(--control-radius);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  height: 36px;
  padding: 0 var(--space-3);
}

.login-input:focus {
  border-color: var(--focus-border-soft);
  box-shadow: 0 0 0 3px var(--focus-ring-soft);
  outline: none;
}

.login-input:disabled {
  color: var(--text-muted);
}

.login-error {
  background: color-mix(in srgb, var(--danger) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
  border-radius: var(--control-radius);
  color: var(--danger);
  font-size: 0.75rem;
  padding: var(--space-2) var(--space-3);
}

.login-button {
  height: 36px;
  width: 100%;
}
</style>
