import { watch, type Ref } from "vue";
import type { ArtifactPage } from "../stores/ui";
import { useUiStore } from "../stores/ui";

interface ArtifactItemLike {
  filename: string;
}

export function useAutoSelectArtifact(
  pageKey: Ref<ArtifactPage>,
  filteredItems: Ref<ArtifactItemLike[]>,
) {
  const uiStore = useUiStore();

  watch(
    [pageKey, filteredItems],
    ([currentPage, items]) => {
      const current = uiStore.selectedArtifacts[currentPage];
      if (!items.length) {
        if (current !== null) uiStore.selectArtifact(currentPage, null);
        return;
      }
      if (!current || !items.find((item) => item.filename === current)) {
        uiStore.selectArtifact(currentPage, items[0].filename);
      }
    },
    { immediate: true },
  );
}
