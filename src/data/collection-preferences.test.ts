import { describe, expect, it } from "vitest";
import { toggleSavedId } from "./collection-preferences";

describe("saved collection identities", () => {
  it("normalizes stale and duplicate values when the user changes a list", () => {
    expect(toggleSavedId(Array.from({ length: 100 }, () => "old"), "new", ["new"])).toEqual(["new"]);
    expect(toggleSavedId(["a", "a", "old"], "b", ["a", "b"])).toEqual(["a", "b"]);
  });
  it("removes every copy of a selected identity and rejects unknown new entries", () => {
    expect(toggleSavedId([4, 4, 7], 4, [4, 7])).toEqual([7]);
    expect(toggleSavedId([4, 4], 100, [4, 7])).toEqual([4]);
  });
  it("does not mutate the stored input", () => {
    const previous = ["a", "a", "old"];
    toggleSavedId(previous, "b", ["a", "b"]);
    expect(previous).toEqual(["a", "a", "old"]);
  });
});
