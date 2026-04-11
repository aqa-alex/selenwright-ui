/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";

  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}

declare module "*novnc-client/core/rfb.js" {
  export default class RFB {
    scaleViewport: boolean;
    resizeSession: boolean;
    viewOnly: boolean;
    constructor(
      target: HTMLElement,
      url: string,
      options?: Record<string, unknown>,
    );
    addEventListener(type: string, listener: (event: Event) => void): void;
    disconnect(): void;
  }
}
