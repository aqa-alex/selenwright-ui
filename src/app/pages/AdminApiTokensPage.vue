<script setup lang="ts">
import { computed, ref } from "vue";
import ConsoleButton from "../components/ui/ConsoleButton.vue";
import ConsolePanel from "../components/ui/ConsolePanel.vue";
import { usePreferencesStore } from "../stores/preferences";
import { useIdentityStore } from "../stores/identity";
import { useCreateTokenMutation } from "../queries/useCreateTokenMutation";
import { useRevokeTokenMutation } from "../queries/useRevokeTokenMutation";
import { useRevokeTokensByOwnerMutation } from "../queries/useRevokeTokensByOwnerMutation";
import { useTokensQuery } from "../queries/useTokensQuery";
import { useTokenUsersQuery } from "../queries/useTokenUsersQuery";
import { formatDateTime, timeAgo } from "../../lib/format";

const identityStore = useIdentityStore();
const preferencesStore = usePreferencesStore();

const ownerFilter = ref("");
const tokensQuery = useTokensQuery(ownerFilter);
const usersQuery = useTokenUsersQuery();

const createMutation = useCreateTokenMutation();
const revokeMutation = useRevokeTokenMutation();
const bulkRevokeMutation = useRevokeTokensByOwnerMutation();

const createDialogOpen = ref(false);
const createDraft = ref({ owner: "", name: "" });
const createError = ref("");
const plaintextToken = ref<{ id: string; token: string } | null>(null);
const confirmRevokeId = ref<string | null>(null);
const confirmBulkOwner = ref<string | null>(null);

const tokens = computed(() => tokensQuery.data.value ?? []);
const users = computed(() => usersQuery.data.value ?? []);
const loadError = computed(() => {
  const e = tokensQuery.error.value;
  return e instanceof Error ? e.message : "";
});
const createError403 = computed(() =>
  (createMutation.error.value instanceof Error ? createMutation.error.value.message : "") ||
  createError.value,
);
const formatPrefs = computed(() => ({
  timeFormat: preferencesStore.timeFormat,
  timezone: preferencesStore.timezone,
}));

function openCreate() {
  createDraft.value = { owner: users.value[0] ?? "", name: "" };
  createError.value = "";
  createMutation.reset();
  createDialogOpen.value = true;
}

function submitCreate() {
  const owner = createDraft.value.owner.trim();
  const name = createDraft.value.name.trim();
  if (!owner) {
    createError.value = "Owner is required.";
    return;
  }
  if (!name) {
    createError.value = "Name is required.";
    return;
  }
  createError.value = "";
  createMutation.mutate(
    { owner, name },
    {
      onSuccess: (result) => {
        plaintextToken.value = result;
        createDialogOpen.value = false;
      },
    },
  );
}

function copyTokenToClipboard() {
  const value = plaintextToken.value?.token;
  if (!value) return;
  void navigator.clipboard?.writeText(value);
}

async function doRevoke(id: string) {
  await revokeMutation.mutateAsync(id);
  confirmRevokeId.value = null;
}

async function doBulkRevoke(owner: string) {
  await bulkRevokeMutation.mutateAsync(owner);
  confirmBulkOwner.value = null;
}

function formatCreated(iso: string): string {
  if (!iso) return "—";
  return formatDateTime(iso, formatPrefs.value);
}

function formatLastUsed(iso?: string): string {
  if (!iso) return "never";
  return timeAgo(iso);
}
</script>

<template>
  <div
    v-if="!identityStore.effectiveAdmin"
    class="page-intro"
  >
    <div>
      <h1>API Tokens</h1>
      <p>Admin access required.</p>
    </div>
  </div>
  <template v-else>
    <div class="page-intro">
      <div>
        <h1>API Tokens</h1>
        <p>
          Admin-issued bearer tokens for Playwright/Selenium clients. The plaintext
          is shown once at creation — distribute it through a secret manager.
        </p>
      </div>
      <div class="page-intro-actions">
        <ConsoleButton
          kind="primary"
          @click="openCreate"
        >
          Create token
        </ConsoleButton>
      </div>
    </div>

    <ConsolePanel>
      <div class="admin-tokens-filter">
        <label class="admin-tokens-filter-field">
          <span class="hint-text">Filter by owner</span>
          <select
            v-model="ownerFilter"
            class="admin-tokens-filter-select"
          >
            <option value="">All owners</option>
            <option
              v-for="u in users"
              :key="u"
              :value="u"
            >{{ u }}</option>
          </select>
        </label>
        <ConsoleButton
          v-if="ownerFilter"
          kind="danger"
          :disabled="bulkRevokeMutation.isPending.value"
          @click="confirmBulkOwner = ownerFilter"
        >
          Revoke all for {{ ownerFilter }}
        </ConsoleButton>
      </div>

      <div
        v-if="loadError"
        class="note-block log-note-error"
      >
        {{ loadError }}
      </div>

      <div class="table-shell">
        <table class="data-table">
          <thead>
            <tr>
              <th>Owner</th>
              <th>Name</th>
              <th>Created</th>
              <th>Last used</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="t in tokens"
              :key="t.id"
            >
              <td class="mono">
                {{ t.owner }}
              </td>
              <td>{{ t.name }}</td>
              <td>{{ formatCreated(t.createdAt) }}</td>
              <td>{{ formatLastUsed(t.lastUsedAt) }}</td>
              <td class="actions-cell">
                <ConsoleButton
                  kind="danger"
                  :disabled="revokeMutation.isPending.value"
                  @click="confirmRevokeId = t.id"
                >
                  Revoke
                </ConsoleButton>
              </td>
            </tr>
            <tr v-if="!tokens.length && !tokensQuery.isLoading.value">
              <td
                colspan="5"
                class="secondary-text admin-tokens-empty"
              >
                No tokens{{ ownerFilter ? ` for ${ownerFilter}` : "" }}.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </ConsolePanel>

    <!-- Create dialog -->
    <div
      v-if="createDialogOpen"
      class="modal-backdrop"
      @click.self="createDialogOpen = false"
    >
      <div class="modal">
        <h2>Create API token</h2>
        <div class="modal-field">
          <label for="admin-tokens-owner">Owner</label>
          <select
            id="admin-tokens-owner"
            v-model="createDraft.owner"
          >
            <option
              v-for="u in users"
              :key="u"
              :value="u"
            >
              {{ u }}
            </option>
          </select>
          <p
            v-if="!users.length"
            class="hint-text"
          >
            No users found. Add users to htpasswd first, then SIGHUP the upstream.
          </p>
        </div>
        <div class="modal-field">
          <label for="admin-tokens-name">Name</label>
          <input
            id="admin-tokens-name"
            v-model="createDraft.name"
            type="text"
            placeholder="laptop, ci-runner, …"
            maxlength="64"
          >
          <p class="hint-text">
            Free-form identifier shown in the table. Not a secret.
          </p>
        </div>
        <div
          v-if="createError403"
          class="note-block log-note-error"
        >
          {{ createError403 }}
        </div>
        <div class="drawer-actions">
          <ConsoleButton
            kind="secondary"
            @click="createDialogOpen = false"
          >
            Cancel
          </ConsoleButton>
          <ConsoleButton
            kind="primary"
            :disabled="createMutation.isPending.value"
            @click="submitCreate"
          >
            {{ createMutation.isPending.value ? "Creating…" : "Create" }}
          </ConsoleButton>
        </div>
      </div>
    </div>

    <!-- Show plaintext once -->
    <div
      v-if="plaintextToken"
      class="modal-backdrop"
      @click.self="plaintextToken = null"
    >
      <div class="modal">
        <h2>Token created</h2>
        <p>
          Copy the token now — it will not be shown again. Deliver it through a secret
          manager (1Password, Bitwarden, Keybase). Do not paste into chat.
        </p>
        <div class="admin-tokens-plaintext">
          <code class="mono">{{ plaintextToken.token }}</code>
          <ConsoleButton
            kind="secondary"
            @click="copyTokenToClipboard"
          >
            Copy
          </ConsoleButton>
        </div>
        <p class="hint-text">
          Token id: <span class="mono">{{ plaintextToken.id }}</span>
        </p>
        <div class="drawer-actions">
          <ConsoleButton
            kind="primary"
            @click="plaintextToken = null"
          >
            Done
          </ConsoleButton>
        </div>
      </div>
    </div>

    <!-- Revoke confirm -->
    <div
      v-if="confirmRevokeId"
      class="modal-backdrop"
      @click.self="confirmRevokeId = null"
    >
      <div class="modal">
        <h2>Revoke this token?</h2>
        <p>Clients using it will start getting 401s immediately. This cannot be undone.</p>
        <div class="drawer-actions">
          <ConsoleButton
            kind="secondary"
            @click="confirmRevokeId = null"
          >
            Cancel
          </ConsoleButton>
          <ConsoleButton
            kind="danger"
            :disabled="revokeMutation.isPending.value"
            @click="doRevoke(confirmRevokeId)"
          >
            {{ revokeMutation.isPending.value ? "Revoking…" : "Revoke" }}
          </ConsoleButton>
        </div>
      </div>
    </div>

    <!-- Bulk revoke confirm -->
    <div
      v-if="confirmBulkOwner"
      class="modal-backdrop"
      @click.self="confirmBulkOwner = null"
    >
      <div class="modal">
        <h2>Revoke every token for {{ confirmBulkOwner }}?</h2>
        <p>Every token owned by this user will be invalidated at once. Use for offboarding.</p>
        <div class="drawer-actions">
          <ConsoleButton
            kind="secondary"
            @click="confirmBulkOwner = null"
          >
            Cancel
          </ConsoleButton>
          <ConsoleButton
            kind="danger"
            :disabled="bulkRevokeMutation.isPending.value"
            @click="doBulkRevoke(confirmBulkOwner)"
          >
            {{ bulkRevokeMutation.isPending.value ? "Revoking…" : "Revoke all" }}
          </ConsoleButton>
        </div>
      </div>
    </div>
  </template>
</template>

<style scoped>
.admin-tokens-filter {
  align-items: flex-end;
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.admin-tokens-filter-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.admin-tokens-filter-select,
.modal select,
.modal input[type="text"] {
  background: var(--surface-2, #1a1a1a);
  border: 1px solid var(--border, #333);
  border-radius: var(--radius-1, 4px);
  color: inherit;
  font: inherit;
  padding: var(--space-2) var(--space-3);
  min-width: 12rem;
}

.admin-tokens-empty {
  padding: var(--space-3);
  text-align: center;
}

.modal-backdrop {
  align-items: center;
  background: rgb(0 0 0 / 0.5);
  display: flex;
  inset: 0;
  justify-content: center;
  position: fixed;
  z-index: 1000;
}

.modal {
  background: var(--surface-1, #111);
  border: 1px solid var(--border, #333);
  border-radius: var(--radius-2, 8px);
  box-shadow: 0 10px 40px rgb(0 0 0 / 0.4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 32rem;
  padding: var(--space-4);
  width: calc(100% - 2rem);
}

.modal h2 {
  margin: 0;
}

.modal-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.admin-tokens-plaintext {
  align-items: center;
  background: var(--surface-2, #1a1a1a);
  border: 1px solid var(--border, #333);
  border-radius: var(--radius-1, 4px);
  display: flex;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
}

.admin-tokens-plaintext code {
  flex: 1;
  overflow-wrap: anywhere;
  user-select: all;
}
</style>
