import { useRouter } from "vue-router";
import { type ArtifactPage, useUiStore } from "../stores/ui";

/**
 * Pre-filter the artifacts page by a given session id, then navigate to it.
 * Used by session-detail panels to deep-link from a session into its
 * matching artifact tab.
 */
export function useOpenArtifactPage() {
  const uiStore = useUiStore();
  const router = useRouter();
  return function openArtifactPage(page: ArtifactPage, sessionId: string | null = null) {
    uiStore.setArtifactSessionFilter(sessionId ?? "");
    void router.push(`/artifacts/${page}`);
  };
}
