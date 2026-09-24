import template from "../../sandbox/index.html?raw";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { BUILD_CHAPTERS, BUILD_CYCLE_SECONDS, OBSERVATION_KEY, OBSERVATION_TIMELINE } from "../../sandbox/studio-state.js";
import { createOfficeBuilding } from "../../sandbox/office-building.js";
import { Box3, Color, Matrix4, Quaternion, Vector3 } from "three-r160";
import type { Scene, InstancedMesh, LineSegments, Mesh, BufferAttribute } from "three";

const gpuBoundary = vi.hoisted(() => ({ failure: null as Error | null, renderCalls: 0, scene: null as Scene | null }));

// Run the real scene controller and geometry in jsdom. Only the GPU and canvas
// drawing are replaced; controls, clocks, stage selection and persistence are real.
vi.mock("three-r160", async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    WebGLRenderer: class {
      ratio = 1;
      canvas: HTMLCanvasElement;
      shadowMap = { enabled: false, type: 0 };
      info = { autoReset: true, reset() {}, render: { calls: 80, triangles: 21000 }, memory: { geometries: 80, textures: 17 } };
      constructor({ canvas }: { canvas: HTMLCanvasElement }) { this.canvas = canvas; }
      setPixelRatio(value: number) { this.ratio = value; }
      getPixelRatio() { return this.ratio; }
      setSize(width: number, height: number) { this.canvas.width = width; this.canvas.height = height; }
      render(scene: Scene) {
        // Fault injection is confined to the GPU boundary, after real updates.
        gpuBoundary.renderCalls++;
        gpuBoundary.scene = scene;
        if (gpuBoundary.failure) throw gpuBoundary.failure;
      }
    },
  };
});

type Metrics = {
  frame: number;
  instances: number;
  settings: { paused: boolean; buildMode: string; time: number; speed: number; rain: boolean; externalPause: boolean };
  construction: { progress: number; cyclePosition: number };
  clocks: { simulation: number; construction: number; fleet: number; weather: number };
  camera: { position: number[]; target: number[]; focusScreen: { x: number; y: number }; horizontalOffset: number };
  clearanceViolations: number;
  vehicles: { x: number; z: number; visible: boolean }[];
  observation: { tourIndex: number; zone: string };
  site: { width: number; depth: number; previousArea: number; expansionFactor: number };
  zones: { name: string }[];
  building: { total: number; visible: number; permanentVisible: number; permanentTotal: number; paintedPanels: number; finishDetail: boolean; batches: { name: string; total: number; visible: number }[] };
  workers: { count: number; active: number; officeIntrusions: number; motionChecksum: number; roles: { workers: number; supervisors: number }; activeByTask: Record<string, number>; posture: { maxLateralLegSwing: number; lateralLegSwing: boolean; stopsAtRouteEnds: boolean }; perimeter: { count: number } };
  activity: Record<string, number>;
  minimumBoundaryClearance: number;
  minimumLampClearance: number;
  loader: { visible: boolean; boundaryClearance: number; truckClearance: number; spoilClearance: number };
  lod: { zones: { id: string; detail: string }[] };
};
const metrics = () => (window as unknown as { __sandboxMetrics: Metrics }).__sandboxMetrics;
const officeModel = createOfficeBuilding();
const officeGroups = ["structure", "facade", "glazing", "details", "nightWindows"] as const;
const officeName = (group: typeof officeGroups[number]) => `building-${group === "nightWindows" ? "night-windows" : group}`;
const officeMesh = (group: typeof officeGroups[number]) => gpuBoundary.scene?.getObjectByName(officeName(group)) as InstancedMesh;
const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const click = (id: string) => element<HTMLButtonElement>(id).click();
const change = (id: string, value: string) => {
  const target = element<HTMLSelectElement>(id);
  target.value = value;
  target.dispatchEvent(new Event("change", { bubbles: true }));
};
const input = (id: string, value: string) => {
  const target = element<HTMLInputElement>(id);
  target.value = value;
  target.dispatchEvent(new Event("input", { bubbles: true }));
};
const pointer = (type: string, x: number, y: number) => {
  const event = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true });
  Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: "mouse" } });
  element("scene").dispatchEvent(event);
};
let now = 1000;
const frames: FrameRequestCallback[] = [];
let reducedMotion = false;
const motionListeners = new Set<(event: { matches: boolean }) => void>();
const setReducedMotion = (matches: boolean) => {
  reducedMotion = matches;
  motionListeners.forEach(listener => listener({ matches }));
};
function advance(count = 1, step = 1000 / 60) {
  for (let index = 0; index < count; index++) {
    now += step;
    const frame = frames.shift();
    if (!frame) throw new Error("The scene stopped scheduling frames.");
    frame(now);
  }
}

beforeAll(async () => {
  document.body.innerHTML = template.split("<body>")[1].split("</body>")[0];
  const noop = () => undefined;
  const canvas2d = {
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
    createRadialGradient: () => ({ addColorStop: noop }),
    fillRect: noop, clearRect: noop, strokeRect: noop, fillText: noop, putImageData: noop,
    beginPath: noop, moveTo: noop, lineTo: noop, bezierCurveTo: noop, stroke: noop, drawImage: noop,
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(canvas2d as never);
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
  vi.stubGlobal("matchMedia", () => ({
    get matches() { return reducedMotion; },
    addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => motionListeners.add(listener),
    removeEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => motionListeners.delete(listener),
  }));
  const NativeURL = URL;
  vi.stubGlobal("URL", class extends NativeURL {
    static createObjectURL = vi.fn(() => "blob:little-works-test");
    static revokeObjectURL = vi.fn();
  });
  Object.defineProperties(element("scene"), {
    clientHeight: { configurable: true, value: innerHeight },
    setPointerCapture: { configurable: true, value: noop },
    releasePointerCapture: { configurable: true, value: noop },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value() { this.open = false; } });
  Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
  await import("../../sandbox/scene.js");
  advance(2);
});

beforeEach(() => {
  if (reducedMotion) setReducedMotion(false);
  localStorage.clear();
  window.dispatchEvent(new MessageEvent("message", { source: window, origin: window.location.origin, data: { type: "little-works-visibility", active: true } }));
  click("reset-confirm-button");
  advance(2);
});

afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Little Works scene controller", () => {
  it("creates real chapter, zone and equipment actions from the fieldbook", () => {
    expect(document.querySelectorAll("#build-chapters button")).toHaveLength(9);
    expect(document.querySelectorAll("#compact-chapters button")).toHaveLength(9);
    expect(document.querySelectorAll("#zone-list button")).toHaveLength(11);
    expect(document.querySelectorAll("#equipment-list details")).toHaveLength(6);
    expect(element("scene-error").hidden).toBe(true);
    (document.querySelectorAll("#zone-list button")[7] as HTMLButtonElement).click();
    advance();
    expect(metrics().observation.zone).toBe("east-precast");
    click("zone-stage");
    advance();
    expect(metrics().construction.progress).toBe(.915);
  });

  it("pauses all world clocks while leaving camera observation usable", () => {
    click("rain");
    advance(4);
    click("pause");
    const before = metrics().clocks;
    advance(8);
    expect(metrics().clocks).toEqual(before);
    const camera = metrics().camera.position;
    click("zoom-in");
    advance(2);
    expect(metrics().camera.position).not.toEqual(camera);
    expect(metrics().clocks).toEqual(before);
    click("pause");
    advance(2);
    expect(metrics().clocks.weather).toBeGreaterThan(before.weather);
  });

  it("changes construction without teleporting the fleet and resumes from the chosen progress", () => {
    advance(20);
    const fleet = metrics().vehicles;
    change("build-stage", "0.65");
    advance();
    expect(metrics().construction.progress).toBe(.65);
    for (let index = 0; index < fleet.length; index++) {
      const after = metrics().vehicles[index];
      expect(Math.hypot(after.x - fleet[index].x, after.z - fleet[index].z)).toBeLessThan(.05);
      expect(after.visible).toBe(true);
    }
    advance(20);
    expect(metrics().construction.progress).toBe(.65);
    click("auto-build");
    advance(2);
    expect(metrics().construction.progress).toBeGreaterThan(.65);
    expect(metrics().construction.progress).toBeLessThan(.652);
    expect(metrics().clearanceViolations).toBe(0);
  });

  it("restores the saved observation paused with its camera, fleet clock and weather intact", () => {
    change("build-stage", "0.65");
    change("time", "0.75");
    click("rain");
    click("zoom-in");
    advance(3);
    click("save-view");
    const saved = JSON.parse(localStorage.getItem(OBSERVATION_KEY) ?? "null");
    change("build-stage", "0.08");
    change("time", "0.5");
    click("rain");
    advance(8);
    click("restore-view");
    advance(2);
    expect(metrics().settings.paused).toBe(true);
    expect(metrics().settings.rain).toBe(true);
    expect(metrics().settings.time).toBe(.75);
    expect(metrics().construction.progress).toBe(.65);
    expect(metrics().clocks.fleet).toBeCloseTo(saved.fleetTime);
    expect(metrics().camera.position).toEqual(saved.cameraPosition);
    expect(metrics().camera.target).toEqual(saved.cameraTarget);
  });

  it("restores legacy automatic completion and saves the migrated clock without applying it twice", () => {
    click("save-view");
    const current = JSON.parse(localStorage.getItem(OBSERVATION_KEY) ?? "null");
    expect(current.constructionTimeline).toBe(OBSERVATION_TIMELINE);
    const legacy = { ...current, settings: { ...current.settings, buildMode: "auto" }, constructionTime: 197.4 };
    delete legacy.constructionTimeline;
    localStorage.setItem(OBSERVATION_KEY, JSON.stringify(legacy));
    click("restore-view"); advance(2);
    expect(metrics().settings).toMatchObject({ paused: true, buildMode: "auto" });
    expect(metrics().construction.progress).toBe(1);
    // 197.4 s was 40% through the legacy inspection hold. The same point
    // in the longer office handover hold is 248.4 s, not a return to 83%.
    expect(metrics().clocks.construction).toBeCloseTo(248.4, 8);
    const migratedClock = metrics().clocks.construction;
    click("save-view");
    const migrated = JSON.parse(localStorage.getItem(OBSERVATION_KEY) ?? "null");
    expect(migrated.constructionTimeline).toBe(OBSERVATION_TIMELINE);
    expect(migrated.constructionTime).toBe(migratedClock);
    input("build-progress", "30"); advance(2);
    expect(metrics().construction.progress).toBe(.3);
    click("restore-view"); advance(2);
    expect(metrics().construction.progress).toBe(1);
    expect(metrics().clocks.construction).toBe(migratedClock);
    expect(metrics().settings).toMatchObject({ paused: true, buildMode: "auto" });
  });

  it("handles inaccessible storage without interrupting the scene", () => {
    click("save-view");
    const previousObservation = localStorage.getItem(OBSERVATION_KEY);
    click("rain");
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("quota", "QuotaExceededError"); });
    click("save-view");
    expect(element("storage-status").textContent).toContain("没有存下");
    expect(localStorage.getItem(OBSERVATION_KEY)).toBe(previousObservation);
    expect(element<HTMLButtonElement>("restore-view").disabled).toBe(false);
    advance();
    expect(metrics().frame).toBeGreaterThan(0);
    setItem.mockRestore();
    click("restore-view");
    expect(metrics().settings.rain).toBe(false);
  });

  it("restores the saved camera exactly even when a previous drag still has inertia", () => {
    advance(65);
    click("pause");
    click("save-view");
    const saved = JSON.parse(localStorage.getItem(OBSERVATION_KEY) ?? "null");
    pointer("pointerdown", 200, 200);
    pointer("pointermove", 320, 225);
    pointer("pointerup", 320, 225);
    advance();
    expect(metrics().camera.position).not.toEqual(saved.cameraPosition);
    click("restore-view");
    advance(3);
    metrics().camera.position.forEach((value, index) => expect(value).toBeCloseTo(saved.cameraPosition[index], 10));
    expect(metrics().camera.target).toEqual(saved.cameraTarget);
  });

  it("does not move a selected daylight minute backwards while syncing its slider", () => {
    for (const minute of [2, 13, 143, 719, 1079, 1439, 0]) {
      input("day-progress", String(minute));
      advance();
      const expected = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
      expect(element<HTMLInputElement>("day-progress").value).toBe(String(minute));
      expect(element("day-progress-label").textContent).toBe(expected);
    }
  });

  it("reports asynchronous PNG download failures and keeps the capture button usable", () => {
    let encode: BlobCallback | undefined;
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => { encode = callback; });
    const createURL = vi.spyOn(URL, "createObjectURL").mockImplementationOnce(() => { throw new Error("Object URLs are unavailable"); });
    try {
      click("capture");
      expect(element<HTMLButtonElement>("capture").disabled).toBe(true);
      expect(() => encode?.(new Blob(["png"], { type: "image/png" }))).not.toThrow();
      expect(element<HTMLButtonElement>("capture").disabled).toBe(false);
      expect(element("scene-toast").textContent).toContain("无法");
      advance();
      expect(metrics().frame).toBeGreaterThan(0);
    } finally {
      toBlob.mockRestore();
      createURL.mockRestore();
    }
  });

  it("downloads a captioned PNG through a connected link, then releases its object URL", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let encode: BlobCallback | undefined;
    let photograph: { width: number; height: number } | undefined;
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (callback, type) {
      photograph = { width: this.width, height: this.height };
      encode = callback;
      expect(type).toBe("image/png");
    });
    let download = "";
    const linkClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
      expect(this.isConnected).toBe(true);
      expect(this.href).toBe("blob:little-works-test");
      download = this.download;
    });
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const context = element<HTMLCanvasElement>("scene").getContext("2d")!;
    const text = vi.spyOn(context, "fillText");
    try {
      change("build-stage", "0.65");
      input("day-progress", "2");
      advance();
      const offset = metrics().camera.horizontalOffset;
      click("capture");
      expect(photograph?.width).toBe(innerWidth);
      expect(photograph?.height).toBeGreaterThan(innerHeight);
      expect(text.mock.calls.some(([caption]) => String(caption).includes("65% · 00:02"))).toBe(true);
      encode?.(new Blob(["png"], { type: "image/png" }));
      expect(download).toBe("little-works-upper-floor-0002.png");
      expect(document.querySelector("a[download]")).toBeNull();
      expect(element<HTMLButtonElement>("capture").disabled).toBe(false);
      advance();
      expect(metrics().camera.horizontalOffset).toBe(offset);
      vi.advanceTimersByTime(59999);
      expect(revoke).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(revoke).toHaveBeenCalledWith("blob:little-works-test");
    } finally {
      toBlob.mockRestore(); linkClick.mockRestore(); revoke.mockRestore(); text.mockRestore();
      vi.useRealTimers();
    }
  });

  it("recovers from an empty PNG encoding result without pretending a download succeeded", () => {
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback(null));
    const createURL = vi.spyOn(URL, "createObjectURL");
    createURL.mockClear();
    try {
      click("capture");
      expect(element<HTMLButtonElement>("capture").disabled).toBe(false);
      expect(element("scene-toast").textContent).toContain("没有生成");
      expect(createURL).not.toHaveBeenCalled();
    } finally { toBlob.mockRestore(); createURL.mockRestore(); }
  });

  it("rejects an unrelated frame message, but stops simulation when its own desktop hides it", () => {
    const initial = metrics().clocks.simulation;
    window.dispatchEvent(new MessageEvent("message", { source: window, origin: "https://unrelated.example", data: { type: "little-works-visibility", active: false } }));
    advance(2);
    expect(metrics().clocks.simulation).toBeGreaterThan(initial);
    window.dispatchEvent(new MessageEvent("message", { source: window, origin: window.location.origin, data: { type: "little-works-visibility", active: false } }));
    const frame = metrics().frame;
    advance(4);
    expect(metrics().frame).toBe(frame);
  });

  it("does not add hidden time when the browser suspends every animation callback", () => {
    advance(3);
    const before = metrics().clocks.simulation;
    window.dispatchEvent(new MessageEvent("message", { source: window, origin: window.location.origin, data: { type: "little-works-visibility", active: false } }));
    now += 60000;
    window.dispatchEvent(new MessageEvent("message", { source: window, origin: window.location.origin, data: { type: "little-works-visibility", active: true } }));
    advance();
    expect(metrics().clocks.simulation - before).toBeCloseTo(1 / 60, 8);
  });

  it("preserves a deliberate pause through page backgrounding and WebGL restoration", () => {
    click("pause");
    advance();
    const before = metrics().clocks;
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    document.dispatchEvent(new Event("visibilitychange"));
    advance(4);
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event("visibilitychange"));
    advance();
    expect(metrics().clocks).toEqual(before);
    hidden.mockRestore();
    element("scene").dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    const frame = metrics().frame;
    advance(3);
    expect(metrics().frame).toBe(frame);
    click("capture");
    expect(element("scene-toast").textContent).toContain("暂时无法留影");
    element("scene").dispatchEvent(new Event("webglcontextrestored"));
    advance();
    expect(metrics().frame).toBeGreaterThan(frame);
    expect(metrics().settings.paused).toBe(true);
    expect(metrics().clocks).toEqual(before);
    expect(element("scene-error").hidden).toBe(true);
  });

  it("contains a GPU drawing failure instead of throwing again on every animation frame", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const frame = metrics().frame;
    gpuBoundary.failure = new Error("The GPU drawing boundary is unavailable.");
    try {
      expect(() => advance()).not.toThrow();
      expect(element("scene-error").hidden).toBe(false);
      expect(element("scene-error").textContent).toContain("重新载入");
      const calls = gpuBoundary.renderCalls;
      advance(5);
      expect(gpuBoundary.renderCalls).toBe(calls);
      expect(metrics().frame).toBe(frame);
    } finally {
      gpuBoundary.failure = null;
      element("scene").dispatchEvent(new Event("webglcontextrestored"));
      advance();
      log.mockRestore();
    }
  });

  it("keeps a restored context in its error state until an actual draw succeeds", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    element("scene").dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    gpuBoundary.failure = new Error("The restored context still cannot draw.");
    try {
      element("scene").dispatchEvent(new Event("webglcontextrestored"));
      expect(element("scene-error").hidden).toBe(false);
      expect(() => advance()).not.toThrow();
      expect(element("scene-error").hidden).toBe(false);
    } finally {
      gpuBoundary.failure = null;
      element("scene").dispatchEvent(new Event("webglcontextrestored"));
      advance();
      expect(element("scene-error").hidden).toBe(true);
      log.mockRestore();
    }
  });

  it("moves focus out of the retry control when WebGL recovers automatically", () => {
    element("scene").dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    const retry = element("scene-error").querySelector<HTMLButtonElement>("button")!;
    retry.focus();
    expect(document.activeElement).toBe(retry);
    element("scene").dispatchEvent(new Event("webglcontextrestored"));
    advance();
    expect(element("scene-error").hidden).toBe(true);
    expect(document.activeElement).toBe(element("scene"));
  });

  it("distinguishes rejected fullscreen entry from rejected fullscreen exit", async () => {
    const originalElement = Object.getOwnPropertyDescriptor(document, "fullscreenElement");
    const originalRequest = Object.getOwnPropertyDescriptor(document.documentElement, "requestFullscreen");
    const originalExit = Object.getOwnPropertyDescriptor(document, "exitFullscreen");
    let active = false;
    const request = vi.fn().mockRejectedValue(new DOMException("Entry denied", "NotAllowedError"));
    const exit = vi.fn().mockRejectedValue(new DOMException("Exit denied", "NotAllowedError"));
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => active ? document.documentElement : null });
    Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: request });
    Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exit });
    try {
      click("fullscreen");
      await Promise.resolve();
      expect(request).toHaveBeenCalledOnce();
      expect(element("scene-toast").textContent).toContain("没有开启全屏");
      expect(element("fullscreen").querySelector("span")?.textContent).toBe("全屏");
      active = true;
      document.dispatchEvent(new Event("fullscreenchange"));
      click("fullscreen");
      await Promise.resolve();
      expect(exit).toHaveBeenCalledOnce();
      expect(element("scene-toast").textContent).toContain("退出全屏");
      expect(element("fullscreen").getAttribute("aria-pressed")).toBe("true");
      expect(element("fullscreen").querySelector("span")?.textContent).toBe("退出");
    } finally {
      active = false;
      document.dispatchEvent(new Event("fullscreenchange"));
      if (originalElement) Object.defineProperty(document, "fullscreenElement", originalElement);
      else Reflect.deleteProperty(document, "fullscreenElement");
      if (originalRequest) Object.defineProperty(document.documentElement, "requestFullscreen", originalRequest);
      else Reflect.deleteProperty(document.documentElement, "requestFullscreen");
      if (originalExit) Object.defineProperty(document, "exitFullscreen", originalExit);
      else Reflect.deleteProperty(document, "exitFullscreen");
    }
  });

  it("rejects damaged observations, removes only its own save, and tolerates blocked reads", () => {
    click("pause");
    advance();
    const before = metrics().clocks;
    localStorage.setItem(OBSERVATION_KEY, "{damaged");
    localStorage.setItem("unrelated-note", "keep me");
    click("settings-toggle");
    expect(element<HTMLButtonElement>("restore-view").disabled).toBe(true);
    expect(element("storage-status").textContent).toContain("无法读取");
    click("forget-view");
    expect(localStorage.getItem(OBSERVATION_KEY)).toBeNull();
    expect(localStorage.getItem("unrelated-note")).toBe("keep me");
    const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
    try {
      click("settings-toggle");
      expect(element("storage-status").textContent).toContain("没有开放本地存储");
      expect(element<HTMLButtonElement>("restore-view").disabled).toBe(true);
      advance();
      expect(metrics().clocks).toEqual(before);
    } finally { read.mockRestore(); click("settings-close"); }
  });

  it("keeps an explicit observation when a confirmed scene reset starts a new world", () => {
    change("build-stage", "0.86");
    input("day-progress", "1079");
    advance();
    click("save-view");
    const saved = localStorage.getItem(OBSERVATION_KEY);
    click("reset-scene");
    click("reset-cancel");
    advance();
    expect(metrics().construction.progress).toBe(.86);
    click("reset-scene");
    click("reset-confirm-button");
    advance();
    expect(metrics().construction.progress).toBeLessThan(.001);
    expect(localStorage.getItem(OBSERVATION_KEY)).toBe(saved);
    click("restore-view");
    advance();
    expect(metrics().construction.progress).toBe(.86);
    expect(metrics().settings.paused).toBe(true);
    expect(element("day-progress-label").textContent).toBe("17:59");
  });

  it("supports exact zero and completion timeline endpoints and a continuous cycle restart", () => {
    click("pause");
    for (const progress of [0, 100, 0, 100]) {
      input("build-progress", String(progress));
      advance(2);
      expect(metrics().construction.progress).toBe(progress / 100);
      expect(metrics().settings.buildMode).toBe("manual");
      expect(element<HTMLInputElement>("build-progress").value).toBe(String(progress));
      expect(metrics().vehicles.every(vehicle => Number.isFinite(vehicle.x) && Number.isFinite(vehicle.z) && vehicle.visible)).toBe(true);
    }
    click("auto-build");
    advance();
    expect(metrics().construction.progress).toBe(1);
    click("save-view");
    const saved = JSON.parse(localStorage.getItem(OBSERVATION_KEY) ?? "null");
    localStorage.setItem(OBSERVATION_KEY, JSON.stringify({ ...saved, constructionTime: BUILD_CYCLE_SECONDS - .06 }));
    click("restore-view");
    advance();
    const before = metrics().vehicles;
    click("pause");
    advance(8);
    expect(metrics().clocks.construction).toBeGreaterThan(BUILD_CYCLE_SECONDS);
    expect(metrics().construction.progress).toBeGreaterThan(0);
    expect(metrics().construction.progress).toBeLessThan(.001);
    metrics().vehicles.forEach((vehicle, index) => {
      expect(vehicle.visible).toBe(true);
      expect(Math.hypot(vehicle.x - before[index].x, vehicle.z - before[index].z)).toBeLessThan(.3);
    });
    expect(metrics().clearanceViolations).toBe(0);
  });

  it("completes all nine tour stops and leaves the finished office available", () => {
    click("start-tour");
    for (let stop = 0; stop < 9; stop++) {
      advance();
      expect(metrics().observation.tourIndex).toBe(stop);
      expect(metrics().construction.progress).toBe(BUILD_CHAPTERS[stop].progress);
      expect(element("tour-step").textContent).toBe(`第 ${stop + 1} / 9 站`);
      click("tour-next");
    }
    advance();
    expect(metrics().observation.tourIndex).toBe(-1);
    expect(metrics().construction.progress).toBe(1);
    expect(element("tour-progress").hidden).toBe(true);
  });

  it("selects every chapter from 1–9 and exposes the same stages in both navigation controls", () => {
    click("pause");
    element("scene").focus();
    const buttons = [...document.querySelectorAll<HTMLButtonElement>("#build-chapters button")];
    const compact = [...document.querySelectorAll<HTMLButtonElement>("#compact-chapters button")];
    const options = [...element<HTMLSelectElement>("build-stage").options].filter(option => /^\d/.test(option.value));
    expect(options.map(option => Number(option.value))).toEqual([.08, .3, .48, .65, .805, .86, .915, .96, 1]);
    for (const index of [0, 1, 2, 3, 4, 5, 6, 7, 8, 4, 0, 8]) {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: String(index + 1), bubbles: true }));
      advance();
      expect(metrics().construction.progress).toBe(BUILD_CHAPTERS[index].progress);
      expect(element<HTMLSelectElement>("build-stage").value).toBe(String(BUILD_CHAPTERS[index].progress));
      buttons[index].click(); advance();
      expect(metrics().construction.progress).toBe(BUILD_CHAPTERS[index].progress);
      compact[index].click(); advance();
      expect(metrics().construction.progress).toBe(BUILD_CHAPTERS[index].progress);
    }
  });

  it("keeps the focused subject in the visible area beside the open fieldbook", () => {
    const notebook = element("fieldbook");
    const bounds = vi.spyOn(notebook, "getBoundingClientRect").mockReturnValue({ x: 24, y: 109, width: 280, height: 400, left: 24, right: 304, top: 109, bottom: 509, toJSON: () => ({}) });
    if (!notebook.hidden) click("fieldbook-toggle");
    click("fieldbook-toggle");
    click("quick-tour");
    advance(65);
    expect(metrics().camera.horizontalOffset).toBe(-162);
    expect(metrics().camera.focusScreen.x).toBeCloseTo(innerWidth / 2 + 162, 2);
    expect(metrics().camera.focusScreen.x).toBeGreaterThan(304);
    click("fieldbook-close");
    advance();
    expect(metrics().camera.focusScreen.x).toBeCloseTo(innerWidth / 2, 2);
    bounds.mockRestore();
  });

  it("lets Escape leave a tour even while its next button has keyboard focus", () => {
    click("quick-tour");
    expect(document.activeElement).toBe(element("tour-next"));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    advance();
    expect(metrics().observation.tourIndex).toBe(-1);
    expect(document.activeElement).toBe(element("fieldbook-toggle"));
  });

  it("uses one tab stop and arrow, Home and End navigation for the fieldbook tabs", () => {
    if (element("fieldbook").hidden) click("fieldbook-toggle");
    click("tab-story");
    element("tab-story").focus();
    for (const [key, selected] of [["ArrowRight", "zones"], ["End", "guide"], ["ArrowRight", "story"], ["ArrowLeft", "guide"], ["Home", "story"]]) {
      document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      expect(document.activeElement).toBe(element(`tab-${selected}`));
      expect(element(`tab-${selected}`).getAttribute("aria-selected")).toBe("true");
      expect(element(`panel-${selected}`).hidden).toBe(false);
      expect(document.querySelectorAll('[role="tab"][tabindex="0"]')).toHaveLength(1);
    }
  });

  it("returns keyboard focus to the scene when a small-screen zone choice closes the fieldbook", () => {
    const width = Object.getOwnPropertyDescriptor(window, "innerWidth")!;
    Object.defineProperty(window, "innerWidth", { configurable: true, get: () => 390 });
    try {
      if (element("fieldbook").hidden) click("fieldbook-toggle");
      click("tab-zones");
      const zone = document.querySelector<HTMLButtonElement>("#zone-list button")!;
      zone.focus(); zone.click();
      expect(element("fieldbook").hidden).toBe(true);
      expect(document.activeElement).toBe(element("scene"));
    } finally { Object.defineProperty(window, "innerWidth", width); }
  });

  it("leaves native modal keyboard handling intact instead of triggering scene shortcuts", () => {
    click("settings-toggle");
    const before = metrics().settings;
    for (const key of [" ", "r", "h", "1", "7", "8", "9", "ArrowRight", "Escape"]) {
      const event = new KeyboardEvent("keydown", { key, code: key === " " ? "Space" : key, bubbles: true, cancelable: true });
      element("scene-settings").dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      expect(metrics().settings).toEqual(before);
    }
    click("settings-close");
  });

  it("stops residual camera inertia and smooth scrolling when reduced motion is requested", () => {
    advance(65);
    pointer("pointerdown", 200, 200);
    pointer("pointermove", 330, 240);
    pointer("pointerup", 330, 240);
    advance();
    setReducedMotion(true);
    advance();
    const position = metrics().camera.position;
    advance(10);
    expect(metrics().camera.position).toEqual(position);
    expect(metrics().settings.paused).toBe(true);
    expect(element<HTMLInputElement>("orbit").disabled).toBe(true);
    const scroller = element("fieldbook-scroll");
    const scrollTo = vi.fn();
    Object.defineProperty(scroller, "scrollTo", { configurable: true, value: scrollTo });
    click("book-scroll-hint");
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "auto" }));
    setReducedMotion(false);
    expect(metrics().settings.paused).toBe(true);
  });

  it("provides speed control from settings and limits actual rendering in lightweight mode", () => {
    change("speed-preset", "0.5");
    expect(metrics().settings.speed).toBe(.5);
    expect(element<HTMLInputElement>("speed").value).toBe("0.5");
    change("quality", "low");
    const before = metrics().frame;
    advance(60);
    const rendered = metrics().frame - before;
    expect(rendered).toBeGreaterThanOrEqual(29);
    expect(rendered).toBeLessThanOrEqual(31);
  });

  it("retains the baseline site, articulated machines, worker roles and near/far detail", () => {
    expect(metrics().site).toMatchObject({ width: 31.5, depth: 24.25, previousArea: 27.5 * 20.25 });
    expect(metrics().site.expansionFactor).toBeCloseTo(1.371717, 5);
    expect(metrics().zones.filter(zone => zone.name === "excavator")).toHaveLength(2);
    expect(metrics().workers).toMatchObject({ count: 28, roles: { workers: 23, supervisors: 5 }, perimeter: { count: 8 }, posture: { lateralLegSwing: false, stopsAtRouteEnds: true } });
    const instances = metrics().instances;
    change("build-stage", "0.08"); advance();
    expect(metrics().activity.excavators).toBe(2);
    change("build-stage", "0.48"); advance();
    expect(metrics().activity.cranes).toBe(2);
    expect(metrics().vehicles).toHaveLength(3);
    change("build-stage", "0.86");
    change("camera-view", "logistics"); advance(65);
    expect(metrics().lod.zones.some(zone => zone.detail === "high")).toBe(true);
    change("camera-view", "overview"); advance(65);
    expect(metrics().lod.zones.every(zone => zone.detail === "low")).toBe(true);
    change("quality", "low"); advance();
    expect(metrics().instances).toBe(instances);
    expect(metrics().workers.count).toBe(28);
  });

  it("opens all three new facilities and retains them before excavation starts", () => {
    input("build-progress", "0"); advance(2);
    for (const id of ["entrance", "material-yard", "welfare"]) {
      expect(metrics().lod.zones.find(zone => zone.id === id)?.detail).not.toBe("hidden");
      expect(gpuBoundary.scene?.getObjectByName(`district:${id}`)?.visible).toBe(true);
    }
    const buttons = [...document.querySelectorAll<HTMLButtonElement>("#zone-list button")];
    for (const [index, id] of [[8, "entrance"], [9, "material-yard"], [10, "welfare"]] as const) {
      buttons[index].click(); advance(65);
      expect(metrics().observation.zone).toBe(id);
      expect(metrics().lod.zones.find(zone => zone.id === id)?.detail).toBe("high");
    }
    click("site-plan"); advance(65);
    expect(metrics().camera.position[1]).toBeGreaterThan(35);
    expect(metrics().lod.zones.every(zone => zone.detail !== "high")).toBe(true);
  });

  it("does not re-upload worker or rain buffers while observing a paused world", () => {
    change("build-stage", "0.65"); click("rain"); advance(3); click("pause"); advance(2);
    const workers = gpuBoundary.scene?.getObjectByName("site-workers") as InstancedMesh;
    const tools = gpuBoundary.scene?.getObjectByName("worker-tools") as InstancedMesh;
    const rain = gpuBoundary.scene?.getObjectByName("site-rain") as LineSegments;
    const rainPosition = rain.geometry.attributes.position as BufferAttribute;
    const versions = [workers.instanceMatrix.version, tools.instanceMatrix.version, rainPosition.version];
    click("zoom-in"); advance(20);
    expect([workers.instanceMatrix.version, tools.instanceMatrix.version, rainPosition.version]).toEqual(versions);
    input("build-progress", "84"); advance(2);
    expect(workers.instanceMatrix.version).toBeGreaterThan(versions[0]);
    expect(rainPosition.version).toBeGreaterThan(versions[2]);
    expect(metrics().workers.active).toBe(metrics().activity.workers);
    expect(metrics().settings.paused).toBe(true);
  });

  it("finishes every actual office instance, retires temporary works, and reverses without stale geometry", () => {
    click("pause");
    change("quality", "high");
    change("camera-view", "finished"); advance(65);
    input("build-progress", "100"); advance(2);
    const matrices = new Map(officeGroups.map(group => [group, Array.from(officeMesh(group).instanceMatrix.array)]));
    let permanentCount = 0;
    for (const group of officeGroups) {
      const mesh = officeMesh(group);
      expect(mesh.isInstancedMesh, group).toBe(true);
      expect(mesh.instanceMatrix.count, group).toBe(officeModel[group].length);
      expect(mesh.count, group).toBeLessThanOrEqual(officeModel[group].length);
      officeModel[group].forEach((entry, index) => {
        const matrix = new Matrix4();
        mesh.getMatrixAt(index, matrix);
        const position = new Vector3(), scale = new Vector3();
        matrix.decompose(position, new Quaternion(), scale);
        const temporary = (entry.removeAt ?? 2) < 2;
        const factor = temporary ? .001 : 1;
        expect(scale.x, `${group}[${index}] width`).toBeCloseTo(entry.w * factor, 5);
        expect(scale.y, `${group}[${index}] height`).toBeCloseTo(entry.h * factor, 5);
        expect(scale.z, `${group}[${index}] depth`).toBeCloseTo(entry.d * factor, 5);
        if (!temporary) {
          permanentCount++;
          expect(position.x).toBeCloseTo(entry.x, 5);
          expect(position.y).toBeCloseTo(entry.y, 5);
          expect(position.z).toBeCloseTo(entry.z, 5);
        }
      });
    }
    expect(metrics().building.permanentVisible).toBe(permanentCount);
    expect(metrics().building.permanentTotal).toBe(permanentCount);
    expect(metrics().building.total).toBe(officeGroups.reduce((total, group) => total + officeModel[group].length, 0));
    expect(metrics().building.batches.map(batch => batch.name)).toEqual(officeGroups.map(officeName));
    expect(officeMesh("structure").count).toBe(60);
    for (const percent of [65, 80.5, 86, 91.5, 96, 100, 0, 100]) {
      input("build-progress", String(percent)); advance(2);
      expect(metrics().construction.progress).toBeCloseTo(percent / 100, 10);
      if (percent === 65) expect(officeMesh("structure").count).toBeGreaterThan(60);
      if (percent === 0) {
        expect(metrics().building.permanentVisible).toBe(0);
        for (const group of officeGroups) expect(officeMesh(group).visible, group).toBe(false);
      }
    }
    for (const group of officeGroups)
      expect(Array.from(officeMesh(group).instanceMatrix.array), group).toEqual(matrices.get(group));
  });

  it("paints wall colors through the construction timeline and exactly restores the unpainted state", () => {
    click("pause");
    const index = officeModel.facade.findIndex(entry => entry.paintColor);
    const entry = officeModel.facade[index];
    expect(index).toBeGreaterThanOrEqual(0);
    const color = new Color();
    const from = new Color(entry.c), to = new Color(entry.paintColor);
    for (const [progress, blend] of [[entry.paintFrom, 0], [(entry.paintFrom + entry.paintTo) / 2, .5], [entry.paintTo, 1], [entry.paintFrom, 0]]) {
      input("build-progress", String(progress * 100)); advance(2);
      officeMesh("facade").getColorAt(index, color);
      const expected = from.clone().lerp(to, blend);
      expect(color.r).toBeCloseTo(expected.r, 5);
      expect(color.g).toBeCloseTo(expected.g, 5);
      expect(color.b).toBeCloseTo(expected.b, 5);
    }
    input("build-progress", "100"); advance(2);
    expect(metrics().building.paintedPanels).toBe(officeModel.facade.filter(entry => entry.paintColor).length);
  });

  it("keeps completed office buffers cached while changing camera, daylight and detail quality", () => {
    input("build-progress", "100"); click("rain"); click("pause"); advance(3);
    change("quality", "high"); change("camera-view", "finished"); advance(65);
    expect(officeMesh("details").visible).toBe(true);
    const versions = officeGroups.map(group => [officeMesh(group).instanceMatrix.version, officeMesh(group).instanceColor?.version]);
    const geometry = officeMesh("structure").geometry;
    for (const group of officeGroups) expect(officeMesh(group).geometry).toBe(geometry);
    const clocks = metrics().clocks;
    change("time", "0"); advance(2);
    expect(officeMesh("nightWindows").visible).toBe(true);
    change("time", "0.5"); advance(2);
    expect(officeMesh("nightWindows").visible).toBe(false);
    change("camera-view", "overview"); advance(65);
    expect(officeMesh("details").visible).toBe(false);
    change("camera-view", "finished"); advance(65);
    expect(officeMesh("details").visible).toBe(true);
    change("quality", "low"); advance(4);
    expect(officeMesh("details").visible).toBe(false);
    expect(metrics().building.finishDetail).toBe(false);
    expect(officeGroups.map(group => [officeMesh(group).instanceMatrix.version, officeMesh(group).instanceColor?.version])).toEqual(versions);
    expect(metrics().clocks).toEqual(clocks);
  });

  it("uses opaque shared glass and emissive-style windows without multiplying shadow lights", () => {
    input("build-progress", "100"); advance(2);
    for (const group of ["glazing", "nightWindows"] as const) {
      const mesh = officeMesh(group);
      expect(Array.isArray(mesh.material)).toBe(false);
      expect((mesh.material as { transparent: boolean }).transparent).toBe(false);
      expect(mesh.castShadow).toBe(false);
    }
    expect(officeMesh("details").castShadow).toBe(false);
    const pointLights: unknown[] = [], shadowLights: unknown[] = [];
    gpuBoundary.scene?.traverse(object => {
      if (object.type === "PointLight") pointLights.push(object);
      if (object.type.endsWith("Light") && object.castShadow) shadowLights.push(object);
    });
    expect(pointLights).toHaveLength(4);
    expect(shadowLights).toHaveLength(1);
    change("time", "0"); input("build-progress", "65"); advance(2);
    expect(officeMesh("nightWindows").visible).toBe(false);
  });

  it("stops rendered rain above finished office roofs, including pieces beyond the old slab", () => {
    change("quality", "high"); click("rain"); input("build-progress", "100"); click("pause"); advance(3);
    const rain = gpuBoundary.scene?.getObjectByName("site-rain") as LineSegments;
    const positions = rain.geometry.attributes.position.array;
    let coveredDrops = 0;
    for (let offset = 0; offset < rain.geometry.drawRange.count * 3; offset += 6) {
      const x = positions[offset] - 4.5, y = positions[offset + 1], z = positions[offset + 2] + 1.55;
      const roofs = officeModel.roofs.filter(roof => x >= roof.x - roof.w / 2 && x <= roof.x + roof.w / 2 && z >= roof.z - roof.d / 2 && z <= roof.z + roof.d / 2);
      if (!roofs.length) continue;
      coveredDrops++;
      expect(y, `rain at local (${x}, ${z})`).toBeGreaterThanOrEqual(Math.max(...roofs.map(roof => roof.y)) - 1e-5);
    }
    expect(coveredDrops).toBeGreaterThan(0);
  });

  it("keeps new finished-building solids out of actual loader and worker body poses", () => {
    const unit = new Box3(new Vector3(-.5, -.5, -.5), new Vector3(.5, .5, .5));
    const matrix = new Matrix4();
    const instanceBounds = (mesh: InstancedMesh, index: number) => {
      mesh.getMatrixAt(index, matrix);
      matrix.premultiply(mesh.matrixWorld);
      return unit.clone().applyMatrix4(matrix);
    };
    const overlaps = (first: Box3, second: Box3) =>
      Math.min(first.max.x, second.max.x) - Math.max(first.min.x, second.min.x) > .005 &&
      Math.min(first.max.y, second.max.y) - Math.max(first.min.y, second.min.y) > .005 &&
      Math.min(first.max.z, second.max.z) - Math.max(first.min.z, second.min.z) > .005;
    const contacts = new Set<string>();
    change("quality", "high"); change("camera-view", "finished"); change("speed-preset", "2");
    for (const percent of [83, 86, 89, 91.5, 94, 96, 98, 100, 89]) {
      input("build-progress", String(percent));
      for (let frame = 0; frame < 150; frame++) {
        advance(1, 50);
        if (frame % 5 !== 0) continue;
        gpuBoundary.scene!.updateMatrixWorld(true);
        const solids = (["facade", "glazing", "details"] as const).flatMap(group => {
          const mesh = officeMesh(group);
          if (!mesh.visible) return [];
          return officeModel[group].flatMap((entry, index) => {
            const bounds = instanceBounds(mesh, index);
            // A fully hidden scale=.001 entry is not an occupied work area.
            if (bounds.max.y - bounds.min.y < .008 || bounds.max.x - bounds.min.x < .008 || bounds.max.z - bounds.min.z < .008) return [];
            return [{ bounds, label: `${group}[${index}]:${entry.kind}` }];
          });
        });
        const loader = gpuBoundary.scene!.getObjectByName("site-loader")!;
        expect(loader).toBeDefined();
        loader.traverse(object => {
          const mesh = object as InstancedMesh;
          if (!mesh.visible || !mesh.geometry) return;
          mesh.geometry.computeBoundingBox();
          const bounds = mesh.isInstancedMesh
            ? Array.from({ length: mesh.count }, (_, index) => instanceBounds(mesh, index))
            : [mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld)];
          for (const body of bounds) for (const solid of solids)
            if (overlaps(body, solid.bounds)) contacts.add(`loader / ${solid.label} at ${percent}%`);
        });
        const workers = gpuBoundary.scene!.getObjectByName("site-workers") as InstancedMesh;
        // Torso and head are unambiguous body occupancy, unlike a working hand
        // or tool deliberately touching a panel during installation.
        for (let worker = 0; worker < 28; worker++) for (const part of [0, 1]) {
          const body = instanceBounds(workers, worker * 10 + part);
          if (body.max.y - body.min.y < .06) continue;
          for (const solid of solids)
            if (overlaps(body, solid.bounds)) contacts.add(`worker ${worker} / ${solid.label} at ${percent}%`);
        }
      }
      expect(metrics().workers.count).toBe(28);
      expect(metrics().vehicles).toHaveLength(3);
      expect(metrics().clearanceViolations).toBe(0);
    }
    expect([...contacts]).toEqual([]);
  }, 15000);

  it("reuses geometry through repeated views and keeps full-stage bounds before reveal", () => {
    const collect = () => {
      const objects = new Set();
      gpuBoundary.scene?.traverse(object => { const mesh = object as Mesh; if (mesh.geometry) objects.add(mesh.geometry); });
      return objects;
    };
    const before = collect();
    const road = gpuBoundary.scene?.getObjectByName("site-roads") as InstancedMesh;
    const building = gpuBoundary.scene?.getObjectByName("building-structure") as InstancedMesh;
    expect(road.isInstancedMesh).toBe(true);
    expect(road.count).toBe(5);
    expect(building.boundingBox?.max.y).toBeGreaterThan(5.5);
    for (const camera of ["entrance", "materials", "welfare", "overview"]) {
      change("camera-view", camera); change("quality", "low"); advance(3);
      change("build-stage", "0.86"); change("quality", "high"); advance(3);
    }
    expect(collect()).toEqual(before);
  });

  it("keeps geometry and activity bounded through every manual construction percentage", () => {
    let previousPermanent = 0;
    for (let percent = 0; percent <= 100; percent++) {
      input("build-progress", String(percent)); advance();
      const current = metrics();
      expect(current.building.permanentVisible).toBeGreaterThanOrEqual(previousPermanent);
      expect(current.building.visible).toBeLessThanOrEqual(current.building.total);
      expect(current.clearanceViolations).toBe(0);
      expect(current.workers.officeIntrusions).toBe(0);
      expect(current.workers.posture.maxLateralLegSwing).toBe(0);
      expect(current.workers.active).toBeLessThanOrEqual(28);
      expect(Number.isFinite(current.workers.motionChecksum)).toBe(true);
      previousPermanent = current.building.permanentVisible;
    }
    expect(metrics().building.permanentVisible).toBe(metrics().building.permanentTotal);
    input("build-progress", "0"); advance();
    expect(metrics().building.permanentVisible).toBe(0);
  });

  it("runs two real construction cycles in rain without traffic, worker or clearance regressions", () => {
    change("quality", "low"); change("speed-preset", "2"); click("rain");
    let collisionFrames = 0, intrusionFrames = 0, invalidFrames = 0, loops = 0;
    let minimumBoundary = Infinity, minimumLamp = Infinity, minimumLoaderTruck = Infinity, minimumSpoil = Infinity;
    let previousCycle = metrics().construction.cyclePosition, peakPermanent = 0;
    const activeTasks = new Set<string>();
    // 50 ms frames at 2× speed advance the real construction clock by .1 s.
    for (let frame = 0; frame < Math.ceil(BUILD_CYCLE_SECONDS * 2 / .1) + 20; frame++) {
      advance(1, 50);
      const current = metrics();
      collisionFrames += current.clearanceViolations > 0 ? 1 : 0;
      intrusionFrames += current.workers.officeIntrusions > 0 ? 1 : 0;
      invalidFrames += current.vehicles.length !== 3 || current.vehicles.some(vehicle => !vehicle.visible || !Number.isFinite(vehicle.x + vehicle.z)) || !current.loader.visible || !Number.isFinite(current.workers.motionChecksum) ? 1 : 0;
      minimumBoundary = Math.min(minimumBoundary, current.minimumBoundaryClearance);
      minimumLamp = Math.min(minimumLamp, current.minimumLampClearance);
      minimumLoaderTruck = Math.min(minimumLoaderTruck, current.loader.truckClearance);
      minimumSpoil = Math.min(minimumSpoil, current.loader.spoilClearance);
      peakPermanent = Math.max(peakPermanent, current.building.permanentVisible);
      for (const [task, count] of Object.entries(current.workers.activeByTask)) if (count > 0) activeTasks.add(task);
      if (previousCycle > .99 && current.construction.cyclePosition < .01) loops++;
      previousCycle = current.construction.cyclePosition;
    }
    expect(loops).toBe(2);
    expect(collisionFrames + intrusionFrames + invalidFrames).toBe(0);
    expect(minimumBoundary).toBeGreaterThan(.05);
    expect(minimumLamp).toBeGreaterThan(.35);
    expect(minimumLoaderTruck).toBeGreaterThan(.05);
    expect(minimumSpoil).toBeGreaterThan(.005);
    expect(peakPermanent).toBe(metrics().building.permanentTotal);
    expect([...activeTasks].sort()).toEqual(["carrying", "patrol", "rebar", "signalling", "tools"]);
  }, 15000);
});
