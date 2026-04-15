import { useShellStore } from "../stores/shell";

function copyUsingFallback(value: string): boolean {
  if (typeof document === "undefined") return false;
  const activeElement =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const input = document.createElement("textarea");
  input.setAttribute("aria-hidden", "true");
  input.readOnly = true;
  input.value = value;
  input.style.left = "0";
  input.style.opacity = "0";
  input.style.pointerEvents = "none";
  input.style.position = "fixed";
  input.style.top = "0";
  document.body.append(input);
  try {
    input.focus({ preventScroll: true });
    input.select();
    input.setSelectionRange(0, input.value.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    input.remove();
    activeElement?.focus({ preventScroll: true });
  }
}

export function useClipboard() {
  const shellStore = useShellStore();

  return async function copy(value: string | null | undefined) {
    const text = String(value ?? "");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        shellStore.setNotice("Copied to clipboard");
        return true;
      }
    } catch {
      /* fall through to textarea fallback */
    }
    if (copyUsingFallback(text)) {
      shellStore.setNotice("Copied to clipboard");
      return true;
    }
    shellStore.setNotice("Clipboard write failed");
    return false;
  };
}
