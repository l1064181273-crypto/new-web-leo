import { act, renderHook, waitFor } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { useLocalState } from "./use-local-state";

const schema = z.object({ message: z.string() });
const fallback = { message: "A new page" };

describe("local state recovery", () => {
  beforeEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

  it("reads valid existing content without replacing it with the default", () => {
    localStorage.setItem("notes", JSON.stringify({ message: "Keep this" }));
    const { result } = renderHook(() => useLocalState("notes", fallback, schema));
    expect(result.current[0].message).toBe("Keep this");
    expect(result.current[2]).toBe(true);
    expect(result.current[3].recoveryRaw).toBeNull();
  });

  it("copies malformed original data before saving fallback content", async () => {
    const raw = '{"message": "unfinished';
    localStorage.setItem("notes", raw);
    const { result } = renderHook(() => useLocalState("notes", fallback, schema));
    await waitFor(() => expect(result.current[3].recoveryKey).not.toBeNull());
    expect(localStorage.getItem(result.current[3].recoveryKey!)).toBe(raw);
    expect(result.current[3].recoveryRaw).toBe(raw);
    expect(JSON.parse(localStorage.getItem("notes")!)).toEqual(fallback);
  });

  it("also preserves valid JSON that belongs to an incompatible schema", () => {
    localStorage.setItem("notes", '["an old format"]');
    const { result } = renderHook(() => useLocalState("notes", fallback, schema));
    expect(localStorage.getItem(result.current[3].recoveryKey!)).toBe('["an old format"]');
  });

  it("never overwrites the original when its recovery copy cannot be saved", () => {
    const raw = "important but invalid";
    localStorage.setItem("notes", raw);
    const originalSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
      if (key.includes(":recovery:")) throw new DOMException("Full", "QuotaExceededError");
      return originalSet.call(this, key, value);
    });
    const { result } = renderHook(() => useLocalState("notes", fallback, schema));
    act(() => result.current[1]({ message: "New temporary text" }));
    expect(result.current[2]).toBe(false);
    expect(result.current[0].message).toBe("New temporary text");
    expect(localStorage.getItem("notes")).toBe(raw);
  });

  it("keeps edits in memory and reports blocked storage", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
    const { result } = renderHook(() => useLocalState("notes", fallback, schema));
    act(() => result.current[1]({ message: "Do not lose this session" }));
    expect(result.current[0].message).toBe("Do not lose this session");
    expect(result.current[2]).toBe(false);
  });

  it("never writes fallback or later edits over an unknown value after a failed initial read", () => {
    const original = JSON.stringify({ message: "An existing page we must not replace" });
    localStorage.setItem("notes", original);
    vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => { throw new DOMException("Read denied", "SecurityError"); });
    const write = vi.spyOn(Storage.prototype, "setItem");
    const { result, rerender } = renderHook(() => useLocalState("notes", fallback, schema));
    expect(result.current[0]).toEqual(fallback);
    expect(result.current[2]).toBe(false);
    expect(result.current[3].readFailed).toBe(true);
    expect(write).not.toHaveBeenCalled();
    act(() => result.current[1]({ message: "Temporary session text" }));
    act(() => result.current[1](previous => ({ message: `${previous.message}, still local` })));
    rerender();
    expect(result.current[0].message).toBe("Temporary session text, still local");
    expect(result.current[2]).toBe(false);
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem("notes")).toBe(original);
  });

  it("reads the untouched original on a fresh mount after access recovers", () => {
    const original = { message: "The original page" };
    localStorage.setItem("notes", JSON.stringify(original));
    vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => { throw new Error("Transient read failure"); });
    const first = renderHook(() => useLocalState("notes", fallback, schema));
    act(() => first.result.current[1]({ message: "Memory-only draft" }));
    first.unmount();
    const reopened = renderHook(() => useLocalState("notes", fallback, schema));
    expect(reopened.result.current[0]).toEqual(original);
    expect(reopened.result.current[2]).toBe(true);
    expect(reopened.result.current[3].readFailed).toBe(false);
    act(() => reopened.result.current[1]({ message: "Safe saved edit after reopening" }));
    expect(JSON.parse(localStorage.getItem("notes")!)).toEqual({ message: "Safe saved edit after reopening" });
  });

  it("does not let a stale second mount overwrite the first mount's successful edit", () => {
    const first = renderHook(() => useLocalState("notes", fallback, schema));
    const second = renderHook(() => useLocalState("notes", fallback, schema));
    act(() => first.result.current[1]({ message: "Saved in window A" }));
    act(() => second.result.current[1]({ message: "Still available in window B" }));
    expect(JSON.parse(localStorage.getItem("notes")!)).toEqual({ message: "Saved in window A" });
    expect(second.result.current[0].message).toBe("Still available in window B");
    expect(second.result.current[2]).toBe(false);
    expect(second.result.current[3].conflict).toBe(true);
    act(() => first.result.current[1]({ message: "A can safely continue" }));
    expect(first.result.current[2]).toBe(true);
    expect(JSON.parse(localStorage.getItem("notes")!).message).toBe("A can safely continue");
  });

  it.each([
    ["valid replacement", JSON.stringify({ message: "External content" })],
    ["malformed replacement", '{"message": "unfinished'],
    ["unknown format", '["do not normalize or overwrite this"]'],
    ["external deletion", null],
  ])("checks the current raw baseline before writing without relying on a storage event (%s)", (_kind, external) => {
    const { result } = renderHook(() => useLocalState("notes", fallback, schema));
    if (external === null) localStorage.removeItem("notes");
    else localStorage.setItem("notes", external);
    act(() => result.current[1]({ message: "Keep this temporary edit" }));
    expect(localStorage.getItem("notes")).toBe(external);
    expect(result.current[0].message).toBe("Keep this temporary edit");
    expect(result.current[2]).toBe(false);
    expect(result.current[3].conflict).toBe(true);
    expect(Object.keys(localStorage).some(key => key.includes(":recovery:"))).toBe(false);
  });

  it("marks a storage-event conflict without replacing edits and stays memory-only for the mount", () => {
    const { result } = renderHook(() => useLocalState("notes", fallback, schema));
    act(() => result.current[1]({ message: "My current draft" }));
    const baseline = localStorage.getItem("notes")!;
    const external = JSON.stringify({ message: "Another tab" });
    act(() => {
      localStorage.setItem("notes", external);
      window.dispatchEvent(new StorageEvent("storage", { key: "notes", newValue: external, storageArea: localStorage }));
    });
    expect(result.current[0].message).toBe("My current draft");
    expect(result.current[2]).toBe(false);
    expect(result.current[3].conflict).toBe(true);
    localStorage.setItem("notes", baseline);
    act(() => result.current[1]({ message: "Do not resume writes automatically" }));
    expect(localStorage.getItem("notes")).toBe(baseline);
    expect(result.current[2]).toBe(false);
  });

  it("accepts same-raw-value external writes and advances the baseline after each own successful write", () => {
    const { result } = renderHook(() => useLocalState("notes", fallback, schema));
    for (const message of ["First saved edit", "Second saved edit"]) {
      act(() => result.current[1]({ message }));
      const raw = localStorage.getItem("notes")!;
      act(() => {
        localStorage.setItem("notes", raw);
        window.dispatchEvent(new StorageEvent("storage", { key: "notes", newValue: raw, storageArea: localStorage }));
      });
      expect(result.current[2]).toBe(true);
      expect(result.current[3].conflict).toBe(false);
    }
    act(() => result.current[1]({ message: "Third saved edit" }));
    expect(JSON.parse(localStorage.getItem("notes")!).message).toBe("Third saved edit");
  });

  it("checks live storage instead of treating a delayed old event payload as a new conflict", () => {
    const { result } = renderHook(() => useLocalState("notes", fallback, schema));
    act(() => result.current[1]({ message: "Current saved text" }));
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: "notes", newValue: JSON.stringify(fallback), storageArea: localStorage })));
    expect(result.current[3].conflict).toBe(false);
    expect(result.current[2]).toBe(true);
    expect(result.current[0].message).toBe("Current saved text");
  });

  it("ignores unrelated keys and sessionStorage events, but treats a relevant clear notification as deletion", () => {
    const { result } = renderHook(() => useLocalState("notes", fallback, schema));
    localStorage.setItem("unrelated-audit-key", "preserve me");
    localStorage.removeItem("notes");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "elsewhere", storageArea: localStorage }));
      window.dispatchEvent(new StorageEvent("storage", { key: "notes", storageArea: sessionStorage }));
    });
    expect(result.current[3].conflict).toBe(false);
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: null, storageArea: localStorage })));
    expect(result.current[3].conflict).toBe(true);
    expect(localStorage.getItem("notes")).toBeNull();
    expect(localStorage.getItem("unrelated-audit-key")).toBe("preserve me");
  });

  it("does not recover over an external update made between the initial malformed read and the first effect", () => {
    const original = "malformed old content";
    const external = JSON.stringify({ message: "Already repaired elsewhere" });
    localStorage.setItem("notes", original);
    const { result } = renderHook(() => {
      const state = useLocalState("notes", fallback, schema);
      useLayoutEffect(() => { localStorage.setItem("notes", external); }, []);
      return state;
    });
    expect(localStorage.getItem("notes")).toBe(external);
    expect(result.current[3].recoveryRaw).toBe(original);
    expect(result.current[3].recoveryKey).toBeNull();
    expect(result.current[3].conflict).toBe(true);
    expect(Object.keys(localStorage)).toEqual(["notes"]);
  });

  it("rechecks after making a recovery copy before replacing the main key", () => {
    const original = "old malformed text";
    const external = JSON.stringify({ message: "External edit during backup" });
    localStorage.setItem("notes", original);
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
      setItem.call(this, key, value);
      if (key.startsWith("notes:recovery:")) setItem.call(this, "notes", external);
    });
    const { result } = renderHook(() => useLocalState("notes", fallback, schema));
    expect(localStorage.getItem("notes")).toBe(external);
    expect(localStorage.getItem(result.current[3].recoveryKey!)).toBe(original);
    expect(result.current[3].conflict).toBe(true);
    expect(result.current[2]).toBe(false);
  });

  it("locks the mount to memory when the pre-write read fails and does not retry unsafe writes", () => {
    const { result } = renderHook(() => useLocalState("notes", fallback, schema));
    const original = localStorage.getItem("notes");
    vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => { throw new Error("Read denied before write"); });
    const writes = vi.spyOn(Storage.prototype, "setItem");
    act(() => result.current[1]({ message: "First unsaved edit" }));
    act(() => result.current[1]({ message: "Second unsaved edit" }));
    expect(writes).not.toHaveBeenCalled();
    expect(localStorage.getItem("notes")).toBe(original);
    expect(result.current[0].message).toBe("Second unsaved edit");
    expect(result.current[3].readFailed).toBe(true);
    expect(result.current[2]).toBe(false);
  });

  it("protects content when reading a matching external storage event fails", () => {
    const { result } = renderHook(() => useLocalState("notes", fallback, schema));
    const original = localStorage.getItem("notes");
    vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => { throw new Error("Read denied during event"); });
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: "notes", storageArea: localStorage })));
    expect(result.current[3].readFailed).toBe(true);
    expect(result.current[2]).toBe(false);
    act(() => result.current[1]({ message: "Keep this in memory" }));
    expect(localStorage.getItem("notes")).toBe(original);
  });

  it("removes its storage listener on unmount and reads the new external value on a fresh mount", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const first = renderHook(() => useLocalState("notes", fallback, schema));
    const external = JSON.stringify({ message: "Latest external page" });
    localStorage.setItem("notes", external);
    act(() => first.result.current[1]({ message: "Temporary local page" }));
    expect(first.result.current[3].conflict).toBe(true);
    first.unmount();
    expect(remove).toHaveBeenCalledWith("storage", expect.any(Function));
    const reopened = renderHook(() => useLocalState("notes", fallback, schema));
    expect(reopened.result.current[0].message).toBe("Latest external page");
    expect(reopened.result.current[3].conflict).toBe(false);
    expect(reopened.result.current[2]).toBe(true);
    act(() => reopened.result.current[1]({ message: "Safely edited after reopening" }));
    expect(JSON.parse(localStorage.getItem("notes")!).message).toBe("Safely edited after reopening");
  });
});
