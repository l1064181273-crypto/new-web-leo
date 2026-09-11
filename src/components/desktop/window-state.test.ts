import { describe, expect, it } from "vitest";
import { fitWindow, windowReducer, type WindowState } from "./window-state";

const atlas: WindowState = {
  id: "atlas",
  x: 20,
  y: 30,
  width: 800,
  height: 550,
  minimized: false,
  maximized: false,
};
const notes: WindowState = { ...atlas, id: "notes" };
describe("desktop window lifecycle", () => {
  it("opens one instance per app and retains its geometry", () => {
    const result = windowReducer([atlas, notes], {
      type: "open",
      window: { ...atlas, x: 600 },
    });
    expect(result).toEqual([{ ...notes, minimized: true }, atlas]);
  });
  it("restores minimized apps without resetting their frame", () => {
    const result = windowReducer(
      [{ ...atlas, minimized: true, maximized: true }],
      { type: "open", window: atlas },
    );
    expect(result[0]).toMatchObject({
      minimized: false,
      maximized: true,
      x: 20,
    });
  });
  it("focuses, maximizes, restores and closes only the target app", () => {
    let state = windowReducer([atlas, notes], { type: "focus", id: "atlas" });
    expect(state[1]).toEqual(atlas);
    state = windowReducer(state, { type: "maximize", id: "atlas" });
    expect(state[1].maximized).toBe(true);
    state = windowReducer(state, { type: "maximize", id: "atlas" });
    expect(state[1]).toEqual(atlas);
    expect(windowReducer(state, { type: "close", id: "atlas" })).toEqual([
      { ...notes, minimized: true },
    ]);
  });
  it("constrains moved windows to smaller viewports", () => {
    expect(fitWindow({ ...atlas, x: 1200, y: -50 }, 390, 650)).toEqual({
      width: 390,
      height: 550,
      x: 0,
      y: 0,
    });
    expect(fitWindow({ ...atlas, x: 999, y: 999 }, 1440, 750)).toEqual({
      width: 800,
      height: 550,
      x: 640,
      y: 200,
    });
  });
});
