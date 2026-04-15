import { useRouter } from "vue-router";
import { type ArtifactPage, useUiStore } from "../stores/ui";

export function useOpenArtifactPage() {
  const uiStore = useUiStore();
  const router = useRouter();
  return function openArtifactPage(page: ArtifactPage, sessionId: string | null = null) {
    uiStore.setArtifactSessionFilter(sessionId ?? "");
    void router.push(`/artifacts/${page}`);
  };
}
