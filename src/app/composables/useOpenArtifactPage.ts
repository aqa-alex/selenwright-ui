import { navigate } from "../../lib/router.js";
import { type ArtifactPage, useUiStore } from "../stores/ui";

/**
 * Pre-filter the artifacts page by a given session id, then navigate to it.
 * Used by session-detail panels to deep-link from a session into its
 * matching artifact tab.
 */
export function useOpenArtifactPage() {
  const uiStore = useUiStore();
  return function openArtifactPage(page: ArtifactPage, sessionId: string | null = null) {
    uiStore.setArtifactSessionFilter(sessionId ?? "");
    navigate(`/artifacts/${page}`);
  };
}
