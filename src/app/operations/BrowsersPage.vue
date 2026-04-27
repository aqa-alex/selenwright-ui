<script setup lang="ts">
import { computed, ref } from "vue";
import ConsoleButton from "../components/ui/ConsoleButton.vue";
import ConsolePanel from "../components/ui/ConsolePanel.vue";
import StatusBadge from "../components/ui/StatusBadge.vue";
import ProtocolBadge from "../session-detail/ProtocolBadge.vue";
import { useDiscoveredBrowsersQuery } from "../queries/useDiscoveredBrowsersQuery";
import { useAdoptBrowserMutation } from "../queries/useAdoptBrowserMutation";
import { useDismissBrowserMutation } from "../queries/useDismissBrowserMutation";
import { useRescanBrowsersMutation } from "../queries/useRescanBrowsersMutation";
import { useListRegistryMutation } from "../queries/useListRegistryMutation";
import { usePullFromRegistryMutation } from "../queries/usePullFromRegistryMutation";
import { useIdentityStore } from "../stores/identity";
import type {
  RegistryListing,
  RegistryPullItem,
  RegistryPullRef,
} from "../api";
import type { OperationsPageModel } from "./operationsPage";
import { getBrowserInventoryGroups, getBrowserStatusBadgeStatus } from "./operationsPage";

const props = defineProps<{
  model: OperationsPageModel;
}>();

const identityStore = useIdentityStore();
const browserGroups = computed(() => getBrowserInventoryGroups(props.model.browsers));

const discoveredQuery = useDiscoveredBrowsersQuery();
const adoptMutation = useAdoptBrowserMutation();
const dismissMutation = useDismissBrowserMutation();
const rescanMutation = useRescanBrowsersMutation();
const listRegistryMutation = useListRegistryMutation();
const pullRegistryMutation = usePullFromRegistryMutation();

const discoveredImages = computed(() => discoveredQuery.data.value ?? []);
const hasDiscovered = computed(() => discoveredImages.value.length > 0);

const registryHost = ref<string>("");
const registryListing = ref<RegistryListing | null>(null);
const registryError = ref<string>("");
const expanded = ref<Record<string, boolean>>({});
const selectedRefs = ref<string[]>([]);
const pullResults = ref<RegistryPullItem[] | null>(null);
const pullError = ref<string>("");

const listingHasRepos = computed(
  () => (registryListing.value?.repos.length ?? 0) > 0,
);
const totalTagCount = computed(() =>
  (registryListing.value?.repos ?? []).reduce(
    (sum, r) => sum + r.tags.length,
    0,
  ),
);
const isListPending = computed(() => listRegistryMutation.isPending.value);
const isPullPending = computed(() => pullRegistryMutation.isPending.value);
const listDisabled = computed(
  () =>
    !registryHost.value.trim() ||
    isListPending.value ||
    isPullPending.value ||
    !identityStore.effectiveAdmin,
);
const pullDisabled = computed(
  () =>
    selectedRefs.value.length === 0 ||
    isPullPending.value ||
    isListPending.value ||
    !identityStore.effectiveAdmin,
);

function refKey(repo: string, tag: string): string {
  return `${repo} ${tag}`;
}

function selectedTagsForRepo(repo: string): number {
  let count = 0;
  for (const key of selectedRefs.value) {
    const sep = key.indexOf(" ");
    if (sep > 0 && key.slice(0, sep) === repo) {
      count++;
    }
  }
  return count;
}

function toggleRepo(repo: string): void {
  expanded.value[repo] = !expanded.value[repo];
}

function onListRegistry(): void {
  const host = registryHost.value.trim();
  if (!host) return;
  registryError.value = "";
  pullResults.value = null;
  pullError.value = "";
  listRegistryMutation.mutate(host, {
    onSuccess: (listing) => {
      registryListing.value = listing;
      selectedRefs.value = [];
      // Always start collapsed — operator chooses what to expand. This keeps
      // small (selenwright, 9 repos) and large (selenoid, 22+ repos) results
      // visually consistent and avoids dumping every tag into view by default.
      expanded.value = {};
    },
    onError: (err) => {
      registryListing.value = null;
      registryError.value = err instanceof Error ? err.message : String(err);
    },
  });
}

function onPullSelected(): void {
  if (selectedRefs.value.length === 0) return;
  const listing = registryListing.value;
  if (!listing) return;
  const refs: RegistryPullRef[] = [];
  for (const key of selectedRefs.value) {
    const sep = key.indexOf(" ");
    if (sep <= 0) continue;
    refs.push({ repo: key.slice(0, sep), tag: key.slice(sep + 1) });
  }
  pullError.value = "";
  pullResults.value = null;
  // Hub builds refs as "<namespace>/<repo>:<tag>"; OCI as "<host>/<repo>:<tag>".
  // Compute the same string client-side to match successful pulls and clear
  // their checkboxes after the round-trip.
  const expectedRefFor = (repo: string, tag: string): string =>
    listing.source === "hub" && listing.namespace
      ? `${listing.namespace}/${repo}:${tag}`
      : `${listing.host}/${repo}:${tag}`;

  pullRegistryMutation.mutate(
    {
      host: listing.host,
      source: listing.source,
      namespace: listing.namespace,
      refs,
    },
    {
      onSuccess: (result) => {
        pullResults.value = result.results;
        const ok = new Set(
          result.results.filter((r) => r.ok).map((r) => r.ref),
        );
        if (ok.size === 0) return;
        selectedRefs.value = selectedRefs.value.filter((key) => {
          const sep = key.indexOf(" ");
          if (sep <= 0) return true;
          const repo = key.slice(0, sep);
          const tag = key.slice(sep + 1);
          return !ok.has(expectedRefFor(repo, tag));
        });
      },
      onError: (err) => {
        pullError.value = err instanceof Error ? err.message : String(err);
      },
    },
  );
}

function truncateDigest(digest: string): string {
  if (digest.startsWith("sha256:")) {
    return digest.slice(0, 19);
  }
  const at = digest.lastIndexOf("@");
  if (at >= 0 && digest.length > at + 19) {
    return digest.slice(0, at + 19);
  }
  return digest.length > 32 ? `${digest.slice(0, 29)}...` : digest;
}

function repoTagDisplay(img: { repoTags: string[]; digest: string }): string {
  return img.repoTags.length > 0 ? img.repoTags[0] : truncateDigest(img.digest);
}
</script>

<template>
  <div class="page-intro">
    <div>
      <h1>Browsers</h1>
      <p>Available browser and version inventory.</p>
    </div>
    <div class="page-intro-actions">
      <ConsoleButton
        kind="secondary"
        :disabled="rescanMutation.isPending.value || !identityStore.effectiveAdmin"
        :title="identityStore.effectiveAdmin ? undefined : 'Admin access required'"
        @click="rescanMutation.mutate()"
      >
        {{ rescanMutation.isPending.value ? "Scanning..." : "Rescan" }}
      </ConsoleButton>
    </div>
  </div>
  <div class="stack-layout">
    <ConsolePanel
      v-if="identityStore.effectiveAdmin"
      title="Pull from registry"
    >
      <p class="hint-text">
        Enter a Docker Hub namespace (e.g. <code>selenwright</code>,
        <code>library</code>) or a registry host (e.g.
        <code>registry.example.com</code>, <code>localhost:5000</code>).
        Private registries that require authentication are not supported in
        this phase.
      </p>
      <div class="registry-input-row">
        <label class="search-field compact registry-host-field">
          <input
            v-model="registryHost"
            placeholder="selenwright or registry.example.com"
            type="text"
            spellcheck="false"
            autocapitalize="off"
            autocomplete="off"
            @keydown.enter.prevent="onListRegistry"
          >
        </label>
        <ConsoleButton
          kind="secondary"
          :disabled="listDisabled"
          :title="identityStore.effectiveAdmin ? undefined : 'Admin access required'"
          @click="onListRegistry"
        >
          {{ isListPending ? "Listing…" : "List images" }}
        </ConsoleButton>
      </div>

      <p
        v-if="registryError"
        class="registry-error"
      >
        {{ registryError }}
      </p>

      <div
        v-if="registryListing && !registryError"
        class="registry-listing"
      >
        <p class="hint-text">
          {{ registryListing.repos.length }} repo(s), {{ totalTagCount }} tag(s)
          total<template v-if="registryListing.source === 'hub'">
            via Docker Hub namespace <code>{{ registryListing.namespace }}</code>
          </template><template v-else>
            via OCI registry <code>{{ registryListing.host }}</code>
          </template>.
          Selected: {{ selectedRefs.length }}.
        </p>
        <p
          v-if="!listingHasRepos"
          class="hint-text"
        >
          Registry returned an empty catalog.
        </p>
        <ul
          v-if="listingHasRepos"
          class="registry-repo-list"
        >
          <li
            v-for="repo in registryListing.repos"
            :key="repo.repo"
            class="registry-repo"
          >
            <button
              class="registry-repo-toggle"
              type="button"
              :aria-expanded="!!expanded[repo.repo]"
              @click="toggleRepo(repo.repo)"
            >
              <span class="registry-repo-marker">{{ expanded[repo.repo] ? "▾" : "▸" }}</span>
              <span class="mono">{{ repo.repo }}</span>
              <span class="registry-repo-meta">
                {{ repo.tags.length }} tag(s)<template v-if="selectedTagsForRepo(repo.repo) > 0">,
                  {{ selectedTagsForRepo(repo.repo) }} selected</template>
              </span>
            </button>
            <ul
              v-if="expanded[repo.repo]"
              class="registry-tag-list"
            >
              <li
                v-for="tag in repo.tags"
                :key="tag"
                class="registry-tag"
              >
                <label>
                  <input
                    v-model="selectedRefs"
                    type="checkbox"
                    :value="refKey(repo.repo, tag)"
                  >
                  <span class="mono">{{ tag }}</span>
                </label>
              </li>
            </ul>
          </li>
        </ul>
        <ul
          v-if="registryListing.errors && registryListing.errors.length > 0"
          class="registry-error-list"
        >
          <li
            v-for="entry in registryListing.errors"
            :key="entry.repo"
            class="registry-error"
          >
            <span class="mono">{{ entry.repo }}</span>: {{ entry.error }}
          </li>
        </ul>
        <div class="drawer-actions registry-pull-actions">
          <ConsoleButton
            kind="primary"
            :disabled="pullDisabled"
            :title="identityStore.effectiveAdmin ? undefined : 'Admin access required'"
            @click="onPullSelected"
          >
            {{ isPullPending ? "Pulling…" : `Pull ${selectedRefs.length} image(s)` }}
          </ConsoleButton>
        </div>
      </div>

      <p
        v-if="pullError"
        class="registry-error"
      >
        {{ pullError }}
      </p>

      <div
        v-if="pullResults && pullResults.length > 0"
        class="registry-results"
      >
        <p class="hint-text">
          Pull results:
        </p>
        <ul class="registry-result-list">
          <li
            v-for="item in pullResults"
            :key="item.ref"
            :class="['registry-result', item.ok ? 'is-ok' : 'is-err']"
          >
            <span class="mono">{{ item.ref }}</span>
            <span v-if="item.ok"> — pulled</span>
            <span v-else> — {{ item.error || "failed" }}</span>
          </li>
        </ul>
      </div>
    </ConsolePanel>

    <ConsolePanel
      v-for="group in browserGroups"
      :key="group.browser"
      :title="group.label"
    >
      <div class="table-shell">
        <table class="data-table">
          <thead>
            <tr>
              <th>Version</th>
              <th>Protocol</th>
              <th>Image / source</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in group.versions"
              :key="`${entry.browser}:${entry.version}:${entry.protocol}`"
            >
              <td class="mono">
                {{ entry.version }}
              </td>
              <td><ProtocolBadge :protocol="entry.protocol" /></td>
              <td class="mono">
                {{ entry.source }}
              </td>
              <td>
                <StatusBadge
                  :label="entry.status"
                  :status="getBrowserStatusBadgeStatus(entry.status)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </ConsolePanel>

    <ConsolePanel
      v-if="hasDiscovered"
      title="Discovered images"
    >
      <div class="table-shell">
        <table class="data-table">
          <thead>
            <tr>
              <th>Browser</th>
              <th>Version</th>
              <th>Tag</th>
              <th>Digest</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="img in discoveredImages"
              :key="img.digest"
            >
              <td class="mono">
                {{ img.browser }}
              </td>
              <td class="mono">
                {{ img.version }}
              </td>
              <td class="mono">
                {{ repoTagDisplay(img) }}
              </td>
              <td class="mono">
                {{ truncateDigest(img.digest) }}
              </td>
              <td class="actions-cell">
                <ConsoleButton
                  kind="primary"
                  :disabled="adoptMutation.isPending.value || !identityStore.effectiveAdmin"
                  :title="identityStore.effectiveAdmin ? undefined : 'Admin access required'"
                  @click="adoptMutation.mutate(img.digest)"
                >
                  Adopt
                </ConsoleButton>
                <ConsoleButton
                  kind="secondary"
                  :disabled="dismissMutation.isPending.value || !identityStore.effectiveAdmin"
                  :title="identityStore.effectiveAdmin ? undefined : 'Admin access required'"
                  @click="dismissMutation.mutate(img.digest)"
                >
                  Dismiss
                </ConsoleButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </ConsolePanel>
  </div>
</template>

<style>
.registry-input-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.registry-host-field {
  flex: 1 1 320px;
  min-width: 220px;
}

.registry-listing {
  margin-top: 0.75rem;
}

.registry-repo-list {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.registry-repo {
  border: 1px solid var(--color-border, rgba(0, 0, 0, 0.1));
  border-radius: 4px;
  background: var(--color-surface-elevated, transparent);
}

.registry-repo-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  background: transparent;
  border: 0;
  cursor: pointer;
  padding: 0.4rem 0.6rem;
  font: inherit;
  color: inherit;
  text-align: left;
}

.registry-repo-marker {
  width: 1ch;
  display: inline-block;
  opacity: 0.7;
}

.registry-repo-meta {
  margin-left: auto;
  opacity: 0.7;
  font-size: 0.85em;
}

.registry-tag-list {
  list-style: none;
  margin: 0;
  padding: 0.25rem 0.6rem 0.6rem 1.6rem;
  display: grid;
  /* min 0 lets each cell shrink so long unbroken strings don't overflow */
  grid-template-columns: repeat(auto-fill, minmax(min(180px, 100%), 1fr));
  gap: 0.25rem 0.75rem;
}

.registry-tag {
  min-width: 0;
}

.registry-tag label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  min-width: 0;
  max-width: 100%;
}

.registry-tag label .mono {
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-all;
}

.registry-pull-actions {
  margin-top: 0.75rem;
}

.registry-error-list {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.registry-error {
  color: var(--color-status-error, #d33);
  margin: 0.5rem 0 0;
  font-size: 0.9em;
}

.registry-results {
  margin-top: 0.75rem;
}

.registry-result-list {
  list-style: none;
  margin: 0.25rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.registry-result.is-ok {
  color: var(--color-status-success, #2a8a3c);
}

.registry-result.is-err {
  color: var(--color-status-error, #d33);
}
</style>
