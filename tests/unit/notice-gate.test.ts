import { describe, expect, it } from "vitest";
import { createNoticeGate } from "../../src/app/composables/useGlobalErrorHandler";

describe("createNoticeGate", () => {
  it("rejects empty messages", () => {
    const clock = { now: 0 };
    const gate = createNoticeGate(() => clock.now);
    expect(gate("")).toBe(false);
  });

  it("lets the first non-empty message through", () => {
    const clock = { now: 0 };
    const gate = createNoticeGate(() => clock.now);
    expect(gate("Upstream unreachable")).toBe(true);
  });

  it("suppresses an identical message inside the dedup window", () => {
    const clock = { now: 0 };
    const gate = createNoticeGate(() => clock.now);

    expect(gate("Upstream unreachable")).toBe(true);

    clock.now = 2_000; // still within 5s dedup window
    expect(gate("Upstream unreachable")).toBe(false);

    clock.now = 6_000; // outside dedup window
    expect(gate("Upstream unreachable")).toBe(true);
  });

  it("throttles distinct messages to at most one per second", () => {
    const clock = { now: 0 };
    const gate = createNoticeGate(() => clock.now);

    expect(gate("First")).toBe(true);

    clock.now = 500;
    expect(gate("Second")).toBe(false); // throttled

    clock.now = 1_100;
    expect(gate("Second")).toBe(true);
  });
});
