import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_CACHED_LOG_FILES,
  MAX_LIVE_LOG_CHARS,
  applyLiveLogBuffer,
  useConsoleStore,
} from "../../src/app/stores/console";

describe("applyLiveLogBuffer", () => {
  it("returns the combined string when under the cap", () => {
    expect(applyLiveLogBuffer("abc", "def", false)).toEqual({
      content: "abcdef",
      truncated: false,
    });
  });

  it("preserves a previous truncation flag even when under the cap", () => {
    expect(applyLiveLogBuffer("abc", "def", true)).toEqual({
      content: "abcdef",
      truncated: true,
    });
  });

  it("trims from the head when the combined size exceeds MAX_LIVE_LOG_CHARS", () => {
    const existing = "x".repeat(MAX_LIVE_LOG_CHARS);
    const chunk = "y".repeat(1024);
    const result = applyLiveLogBuffer(existing, chunk, false);

    expect(result.content.length).toBe(MAX_LIVE_LOG_CHARS);
    expect(result.truncated).toBe(true);
    // The tail of the new chunk must survive; the head of existing must be dropped.
    expect(result.content.endsWith(chunk)).toBe(true);
  });
});

describe("console store live log buffer", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("caps appended content at MAX_LIVE_LOG_CHARS and flags truncated", () => {
    const store = useConsoleStore();
    const sessionId = "session-a";

    store.appendLiveLogChunk(sessionId, "seed ");
    store.appendLiveLogChunk(sessionId, "a".repeat(MAX_LIVE_LOG_CHARS));

    expect(store.liveLogs.content.length).toBe(MAX_LIVE_LOG_CHARS);
    expect(store.liveLogs.truncated).toBe(true);
    // The tail of the final chunk must be preserved.
    expect(store.liveLogs.content.endsWith("a".repeat(100))).toBe(true);
  });

  it("resets truncated when a new session starts from scratch", () => {
    const store = useConsoleStore();
    store.appendLiveLogChunk("session-a", "a".repeat(MAX_LIVE_LOG_CHARS + 5));
    expect(store.liveLogs.truncated).toBe(true);

    store.startLiveLogConnecting("session-b");
    expect(store.liveLogs.truncated).toBe(false);
    expect(store.liveLogs.content).toBe("");
  });
});

describe("console store logFiles LRU", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("evicts the least-recently-used file when adding past MAX_CACHED_LOG_FILES", () => {
    const store = useConsoleStore();

    for (let index = 0; index < MAX_CACHED_LOG_FILES; index += 1) {
      store.setLogFileContent(`file-${index}.log`, `content ${index}`);
    }

    expect(Object.keys(store.logFiles)).toHaveLength(MAX_CACHED_LOG_FILES);

    store.setLogFileContent("overflow.log", "overflow content");

    expect(Object.keys(store.logFiles)).toHaveLength(MAX_CACHED_LOG_FILES);
    expect(store.logFiles["file-0.log"]).toBeUndefined();
    expect(store.logFiles["overflow.log"]?.content).toBe("overflow content");
  });

  it("updates in place without evicting when re-writing an existing file", () => {
    const store = useConsoleStore();

    for (let index = 0; index < MAX_CACHED_LOG_FILES; index += 1) {
      store.setLogFileContent(`file-${index}.log`, `content ${index}`);
    }
    store.setLogFileContent("file-0.log", "refreshed");

    expect(store.logFiles["file-0.log"]?.content).toBe("refreshed");
    expect(Object.keys(store.logFiles)).toHaveLength(MAX_CACHED_LOG_FILES);
  });

  it("removes a filename from the order list on clearLogFile", () => {
    const store = useConsoleStore();
    store.setLogFileContent("file-a.log", "a");
    store.setLogFileContent("file-b.log", "b");

    store.clearLogFile("file-a.log");

    expect(store.logFiles["file-a.log"]).toBeUndefined();
    expect(store.logFilesOrder).toEqual(["file-b.log"]);
  });
});
