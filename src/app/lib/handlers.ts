// Bridge handlers registered by main.js (vanilla layer) and invoked by Vue
// components. Will collapse into Vue Query mutations once the data layer is
// fully migrated.

let saveArtifactHistoryHandler: (() => void | Promise<void>) | null = null;

export function setSaveArtifactHistoryHandler(handler: (() => void | Promise<void>) | null) {
  saveArtifactHistoryHandler = handler;
}

export function requestSaveArtifactHistory() {
  return saveArtifactHistoryHandler?.();
}
