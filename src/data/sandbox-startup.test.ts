import template from "../../sandbox/index.html?raw";
import sceneSource from "../../sandbox/scene.js?raw";
import * as studioState from "../../sandbox/studio-state.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Execute the real startup guard in a fresh event target for each failure.
// Failure is injected before geometry, OrbitControls or a GPU can be created;
// the scene's imports remain unused except for the real settings helpers.
const source = sceneSource.replace(/^import .*;\s*$/gm, "");
type RendererConstructor = new (options: { canvas: HTMLCanvasElement }) => unknown;
function start(Renderer: RendererConstructor) {
  const frame = new EventTarget();
  const postMessage = vi.fn();
  const host = { postMessage };
  const location = { search: "", origin: "https://little-works.test", reload: vi.fn() };
  const execute = new Function(
    "THREE", "document", "window", "parent", "location", "matchMedia", "innerWidth", "innerHeight", "devicePixelRatio",
    ...Object.keys(studioState), source,
  );
  execute(
    { REVISION: "160", WebGLRenderer: Renderer }, document, frame, host, location,
    () => ({ matches: false }), 1024, 768, 1, ...Object.values(studioState),
  );
  return { frame, host, location, postMessage };
}

beforeEach(() => {
  document.body.innerHTML = template.split("<body>")[1].split("</body>")[0];
});

describe("Little Works startup failures", () => {
  it("provides a working reload action and a truthful parent status when WebGL is unsupported", () => {
    const runtime = start(class { constructor() { throw new Error("WebGL is unavailable."); } });
    const error = document.getElementById("scene-error")!;
    expect(error.hidden).toBe(false);
    expect(error.textContent).toContain("支持 WebGL");
    expect(runtime.postMessage).toHaveBeenCalledExactlyOnceWith({ type: "little-works-error" }, runtime.location.origin);
    error.querySelector<HTMLButtonElement>("button")!.click();
    expect(runtime.location.reload).toHaveBeenCalledOnce();
    const request = new Event("message");
    Object.defineProperties(request, {
      source: { value: runtime.host }, origin: { value: runtime.location.origin },
      data: { value: { type: "little-works-status-request" } },
    });
    runtime.frame.dispatchEvent(request);
    expect(runtime.postMessage).toHaveBeenLastCalledWith({ type: "little-works-error" }, runtime.location.origin);
    expect(runtime.postMessage).toHaveBeenCalledTimes(2);
  });

  it("shows the initialization fallback without ever reporting ready after renderer setup fails", () => {
    const failure = new Error("Renderer setup failed after construction.");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const runtime = start(class { setPixelRatio() { throw failure; } });
      const error = document.getElementById("scene-error")!;
      expect(error.hidden).toBe(false);
      expect(error.textContent).toContain("未能完成载入");
      expect(runtime.postMessage).toHaveBeenCalledExactlyOnceWith({ type: "little-works-error" }, runtime.location.origin);
      expect(log).toHaveBeenCalledWith("Little Works initialization failed:", failure);
      error.querySelector<HTMLButtonElement>("button")!.click();
      expect(runtime.location.reload).toHaveBeenCalledOnce();
    } finally { log.mockRestore(); }
  });
});
