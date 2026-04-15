import { describe, expect, it } from "vitest";
import { formatDuration, timeAgo } from "../../src/lib/format";

describe("formatDuration", () => {
  it("renders an em-dash for non-finite input", () => {
    expect(formatDuration(Number.NaN)).toBe("—");
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe("—");
  });

  it("caps negative values at zero seconds", () => {
    expect(formatDuration(-5)).toBe("0s");
  });

  it("picks the largest non-zero unit", () => {
    expect(formatDuration(3_600_000)).toBe("1h 0m");
    expect(formatDuration(65_000)).toBe("1m 5s");
    expect(formatDuration(5_000)).toBe("5s");
  });
});

describe("timeAgo", () => {
  it("renders an em-dash for unparseable input", () => {
    expect(timeAgo("not-a-date")).toBe("—");
  });

  it("treats near-present timestamps as 'just now'", () => {
    const now = Date.UTC(2026, 3, 15, 10, 0, 0);
    expect(timeAgo(now - 30_000, now)).toBe("just now");
  });

  it("formats minutes, hours, and days", () => {
    const now = Date.UTC(2026, 3, 15, 10, 0, 0);
    expect(timeAgo(now - 5 * 60_000, now)).toBe("5m ago");
    expect(timeAgo(now - 3 * 60 * 60_000, now)).toBe("3h ago");
    expect(timeAgo(now - 2 * 24 * 60 * 60_000, now)).toBe("2d ago");
  });
});
