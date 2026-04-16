<script setup lang="ts">
import { computed } from "vue";
import ConsoleButton from "../components/ui/ConsoleButton.vue";
import ConsolePanel from "../components/ui/ConsolePanel.vue";
import StatusBadge from "../components/ui/StatusBadge.vue";
import ProtocolBadge from "../session-detail/ProtocolBadge.vue";
import { useDiscoveredBrowsersQuery } from "../queries/useDiscoveredBrowsersQuery";
import { useAdoptBrowserMutation } from "../queries/useAdoptBrowserMutation";
import { useDismissBrowserMutation } from "../queries/useDismissBrowserMutation";
import { useRescanBrowsersMutation } from "../queries/useRescanBrowsersMutation";
import type { OperationsPageModel } from "./operationsPage";
import { getBrowserInventoryGroups, getBrowserStatusBadgeStatus } from "./operationsPage";

const props = defineProps<{
  model: OperationsPageModel;
}>();

const browserGroups = computed(() => getBrowserInventoryGroups(props.model.browsers));

const discoveredQuery = useDiscoveredBrowsersQuery();
const adoptMutation = useAdoptBrowserMutation();
const dismissMutation = useDismissBrowserMutation();
const rescanMutation = useRescanBrowsersMutation();

const discoveredImages = computed(() => discoveredQuery.data.value ?? []);
const hasDiscovered = computed(() => discoveredImages.value.length > 0);

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
        :disabled="rescanMutation.isPending.value"
        @click="rescanMutation.mutate()"
      >
        {{ rescanMutation.isPending.value ? "Scanning..." : "Rescan" }}
      </ConsoleButton>
    </div>
  </div>
  <div class="stack-layout">
    <ConsolePanel v-for="group in browserGroups" :key="group.browser" :title="group.label">
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
            <tr v-for="entry in group.versions" :key="`${entry.browser}:${entry.version}:${entry.protocol}`">
              <td class="mono">{{ entry.version }}</td>
              <td><ProtocolBadge :protocol="entry.protocol" /></td>
              <td class="mono">{{ entry.source }}</td>
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

    <ConsolePanel v-if="hasDiscovered" title="Discovered images">
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
            <tr v-for="img in discoveredImages" :key="img.digest">
              <td class="mono">{{ img.browser }}</td>
              <td class="mono">{{ img.version }}</td>
              <td class="mono">{{ repoTagDisplay(img) }}</td>
              <td class="mono">{{ truncateDigest(img.digest) }}</td>
              <td class="actions-cell">
                <ConsoleButton
                  kind="primary"
                  :disabled="adoptMutation.isPending.value"
                  @click="adoptMutation.mutate(img.digest)"
                >
                  Adopt
                </ConsoleButton>
                <ConsoleButton
                  kind="secondary"
                  :disabled="dismissMutation.isPending.value"
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
