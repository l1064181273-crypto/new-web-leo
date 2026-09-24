import { describe, expect, it } from "vitest";
import {
  BUILD_CHAPTERS,
  BUILD_CYCLE_SECONDS,
  BUILD_GROW_END,
  BUILD_RESET_START,
  CAMERA_NAMES,
  DEFAULT_SETTINGS,
  EQUIPMENT,
  OBSERVATION_TIMELINE,
  OBSERVATION_VERSION,
  SITE_ZONES,
  constructionAt,
  formatSceneTime,
  getChapter,
  getQualityProfile,
  getSceneFov,
  normalizeSettings,
  readObservation,
} from "../../sandbox/studio-state.js";

const savedObservation = () => ({
  version: OBSERVATION_VERSION,
  constructionTimeline: OBSERVATION_TIMELINE,
  settings: { ...DEFAULT_SETTINGS, time: .75, buildMode: "manual", manualBuild: .65, rain: true },
  cameraPosition: [-18, 12, 18],
  cameraTarget: [-.8, 3.2, -.7],
  simulationTime: 74.3,
  constructionTime: 101.8,
  fleetTime: 33.1,
  weatherTime: 71.2,
  loaderActivity: .7,
  savedAt: "2026-09-12T10:00:00.000Z",
});

describe("Little Works observation files", () => {
  it("round-trips the scene clocks, exact camera and conditions without losing the chosen stage", () => {
    const original = savedObservation();
    const restored = readObservation(JSON.stringify(original));
    expect(restored).toEqual(original);
    expect(restored.settings).not.toBe(original.settings);
    expect(restored.cameraPosition).not.toBe(original.cameraPosition);
  });

  it("does not accept corrupted, unrelated or unusable observations", () => {
    for (const value of [null, "", "{broken", "[]", "null", { ...savedObservation(), version: 1 }, { ...savedObservation(), cameraPosition: [0, NaN, 0] }, { ...savedObservation(), cameraTarget: [0, 0] }, { ...savedObservation(), cameraPosition: [2000, 0, 0] }, { ...savedObservation(), cameraTarget: [-18, 12, 18] }]) {
      expect(readObservation(value)).toBeNull();
    }
  });

  it("normalizes out-of-range stored settings and ignores unknown data", () => {
    const result = readObservation({ ...savedObservation(), simulationTime: Infinity, fleetTime: -20, loaderActivity: 8, settings: { speed: 99, time: -.25, dust: 42, rain: "yes", quality: "ultra", camera: "not-a-view", buildMode: "manual", manualBuild: 5 } });
    expect(result.settings).toMatchObject({ speed: 2, time: .75, dust: .5, rain: false, quality: "auto", camera: "overview", manualBuild: 1 });
    expect(result.simulationTime).toBe(0);
    expect(result.fleetTime).toBe(0);
    expect(result.loaderActivity).toBe(1);
  });

  it("does not treat serialized strings as booleans or arbitrary values as camera presets", () => {
    expect(normalizeSettings({ paused: "false", cycle: "false", labels: "true", orbit: "yes", camera: "__proto__" })).toMatchObject({ paused: false, cycle: true, labels: false, orbit: false, camera: "overview" });
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps version 2 observations compatible and accepts the finished-building view", () => {
    const original = savedObservation();
    expect(OBSERVATION_VERSION).toBe(2);
    expect(readObservation(original)?.constructionTime).toBe(original.constructionTime);
    const completed = readObservation({ ...original, settings: { ...original.settings, camera: "finished", manualBuild: 1 } });
    expect(completed?.settings).toMatchObject({ camera: "finished", manualBuild: 1, buildMode: "manual" });
    expect(getChapter(completed?.settings.manualBuild).id).toBe("handover");
  });

  it("migrates legacy automatic growth, finished hold and reset phases without changing progress", () => {
    const legacy = { ...savedObservation(), constructionTimeline: undefined, settings: { ...DEFAULT_SETTINGS, buildMode: "auto" } };
    const smooth = (value: number) => value * value * (3 - 2 * value);
    for (const cycle of [0, 1, 8]) {
      for (const position of [0, .23, .46, .91, .92, .94, .945, .969, .97, .98, .985, .9999]) {
        const constructionTime = (cycle + position) * 210;
        const restored = readObservation({ ...legacy, constructionTime });
        const expected = position < .92 ? position / .92 : position < .97 ? 1 : 1 - smooth((position - .97) / .03);
        expect(restored?.constructionTimeline).toBe(OBSERVATION_TIMELINE);
        expect(constructionAt(restored?.constructionTime).progress, `cycle ${cycle}, position ${position}`).toBeCloseTo(expected, 8);
        expect(Math.floor(restored!.constructionTime / BUILD_CYCLE_SECONDS)).toBe(cycle);
        expect(restored?.simulationTime).toBe(legacy.simulationTime);
        expect(readObservation(restored)).toEqual(restored);
      }
    }
    for (const [oldPosition, newPosition] of [[.46, .44], [.945, .93], [.985, .99], [1, 1]]) {
      const restored = readObservation({ ...legacy, constructionTime: oldPosition * 210 });
      expect(restored?.constructionTime).toBeCloseTo(newPosition * BUILD_CYCLE_SECONDS, 8);
    }
  });

  it("keeps legacy clock migration continuous across phase boundaries and cycle rollover", () => {
    const legacy = { ...savedObservation(), constructionTimeline: undefined, settings: { ...DEFAULT_SETTINGS, buildMode: "auto" } };
    for (const boundary of [.92, .97, 1]) {
      const before = readObservation({ ...legacy, constructionTime: (boundary - 1e-8) * 210 });
      const after = readObservation({ ...legacy, constructionTime: (boundary + 1e-8) * 210 });
      expect(after!.constructionTime).toBeGreaterThan(before!.constructionTime);
      expect(after!.constructionTime - before!.constructionTime).toBeLessThan(.0001);
    }
    const extreme = readObservation({ ...legacy, constructionTime: 1e12 });
    expect(extreme!.constructionTime).toBeGreaterThanOrEqual(0);
    expect(extreme!.constructionTime).toBeLessThanOrEqual(1e7);
    expect(readObservation(extreme)).toEqual(extreme);
  });

  it("does not reinterpret current automatic clocks or legacy manually selected progress", () => {
    const current = { ...savedObservation(), constructionTime: 197.4, settings: { ...DEFAULT_SETTINGS, buildMode: "auto" } };
    expect(readObservation(current)?.constructionTime).toBe(197.4);
    expect(constructionAt(readObservation(current)?.constructionTime).progress).toBeCloseTo(197.4 / (270 * .88));
    const oldManual = { ...savedObservation(), constructionTimeline: undefined };
    const restored = readObservation(oldManual);
    expect(restored?.constructionTime).toBe(oldManual.constructionTime);
    expect(restored?.settings.manualBuild).toBe(oldManual.settings.manualBuild);
    expect(restored?.constructionTimeline).toBe(OBSERVATION_TIMELINE);
  });

  it("rejects unknown timeline formats instead of silently misreading their clock", () => {
    for (const constructionTimeline of ["office-v5", "other-timeline", null, 4, {}])
      expect(readObservation({ ...savedObservation(), constructionTimeline })).toBeNull();
  });
});

describe("Little Works construction timeline", () => {
  it("builds through fit-out and handover, holds the complete office, then resets continuously", () => {
    expect(constructionAt(0).progress).toBe(0);
    expect(constructionAt(BUILD_CYCLE_SECONDS * .44).progress).toBeCloseTo(.5);
    expect(constructionAt(BUILD_CYCLE_SECONDS * .94).progress).toBe(1);
    expect(constructionAt(BUILD_CYCLE_SECONDS * .99).progress).toBeCloseTo(.5);
    expect(constructionAt(BUILD_CYCLE_SECONDS).progress).toBe(0);
    expect(constructionAt(BUILD_CYCLE_SECONDS - .001).progress).toBeLessThan(.0001);
    let previous = 0;
    const sampleStep = .02;
    // The cubic reset's steepest slope is 1.5; bound actual frame-to-frame
    // movement against the shorter 5.4-second reset rather than a magic limit.
    const maxStep = 1.5 * sampleStep / (BUILD_CYCLE_SECONDS * (1 - BUILD_RESET_START)) + 1e-8;
    for (let second = 0; second < BUILD_CYCLE_SECONDS * 3; second += sampleStep) {
      const value = constructionAt(second).progress;
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
      expect(Math.abs(value - previous)).toBeLessThan(maxStep);
      previous = value;
    }
  });

  it("reserves 27 seconds at normal speed for the finished building without a reset jump", () => {
    expect(BUILD_CYCLE_SECONDS).toBe(270);
    expect(BUILD_GROW_END).toBe(.88);
    expect(BUILD_RESET_START).toBe(.98);
    expect((BUILD_RESET_START - BUILD_GROW_END) * BUILD_CYCLE_SECONDS).toBeCloseTo(27);
    for (let position = BUILD_GROW_END + .001; position < BUILD_RESET_START; position += .001) {
      expect(constructionAt(position * BUILD_CYCLE_SECONDS)).toMatchObject({ progress: 1, resetTransition: 0, chapter: { id: "handover" } });
    }
    for (const boundary of [BUILD_GROW_END, BUILD_RESET_START]) {
      const before = constructionAt((boundary - 1e-8) * BUILD_CYCLE_SECONDS).progress;
      const after = constructionAt((boundary + 1e-8) * BUILD_CYCLE_SECONDS).progress;
      expect(before).toBeCloseTo(after, 6);
    }
  });

  it("separates structural acceptance, paint, glazing, fit-out and final handover into nine ordered chapters", () => {
    expect(BUILD_CHAPTERS).toHaveLength(9);
    expect(BUILD_CHAPTERS.map(chapter => chapter.progress)).toEqual([.08, .3, .48, .65, .805, .86, .915, .96, 1]);
    expect(BUILD_CHAPTERS.map(chapter => chapter.end)).toEqual([.18, .38, .57, .78, .82, .88, .925, .975, 1.01]);
    expect(BUILD_CHAPTERS.slice(4).map(chapter => chapter.id)).toEqual(["topping-out", "facade", "glazing", "fit-out", "handover"]);
    for (const [index, chapter] of BUILD_CHAPTERS.entries()) {
      expect(chapter.number).toBe(String(index + 1).padStart(2, "0"));
      expect(chapter.progress).toBeLessThan(chapter.end);
      if (index > 0) {
        const previous = BUILD_CHAPTERS[index - 1];
        expect(chapter.progress).toBeGreaterThanOrEqual(previous.end);
        expect(getChapter(previous.end).id).toBe(chapter.id);
      }
    }
    expect(getChapter(.81).short).toBe("封顶");
    expect(getChapter(.87).short).toBe("粉刷");
    expect(getChapter(.92).short).toBe("门窗");
    expect(getChapter(.96).short).toBe("装修");
    expect(getChapter(1).short).toBe("交付");
  });

  it("holds manual construction while the independent machinery clock continues", () => {
    for (const chapter of BUILD_CHAPTERS) {
      expect(constructionAt(0, "manual", chapter.progress).progress).toBe(chapter.progress);
      expect(constructionAt(500, "manual", chapter.progress).progress).toBe(chapter.progress);
      expect(constructionAt(BUILD_CYCLE_SECONDS * .99, "manual", chapter.progress).resetTransition).toBe(0);
      expect(getChapter(chapter.progress).id).toBe(chapter.id);
    }
  });

  it("points each tour, zone and equipment action to an implemented camera and a meaningful working stage", () => {
    expect(new Set(SITE_ZONES.map(zone => zone.id)).size).toBe(11);
    for (const subject of [...BUILD_CHAPTERS, ...SITE_ZONES, ...EQUIPMENT]) expect(CAMERA_NAMES).toContain(subject.camera);
    for (const chapter of BUILD_CHAPTERS) expect(SITE_ZONES.some(zone => zone.id === chapter.zone)).toBe(true);
    for (const equipment of EQUIPMENT) expect(getChapter(equipment.stage)).toBeDefined();
  });
});

describe("Little Works display settings", () => {
  it("fits portrait views with a constant horizontal lens without changing desktop framing", () => {
    expect(getSceneFov(1280, 800)).toBe(42);
    expect(getSceneFov(844, 390)).toBe(42);
    for (const [width, height] of [[390, 844], [322, 761], [430, 932]]) {
      const vertical = getSceneFov(width, height);
      const horizontal = 2 * Math.atan(Math.tan(vertical * Math.PI / 360) * width / height) * 180 / Math.PI;
      expect(horizontal).toBeCloseTo(42, 10);
      expect(vertical).toBeGreaterThan(42);
    }
    expect(getSceneFov(0, 0)).toBe(42);
    expect(getSceneFov(NaN, Infinity)).toBe(42);
  });

  it("formats daylight landmarks and wraps midnight correctly", () => {
    expect([0, .25, .5, .75, 1, -.25].map(formatSceneTime)).toEqual(["00:00", "06:00", "12:00", "18:00", "00:00", "18:00"]);
  });

  it("keeps every minute selected on the daylight slider exact, including after saving", () => {
    for (let minute = 0; minute < 1440; minute++) {
      const expected = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
      const time = minute / 1440;
      expect(formatSceneTime(time), `selected minute ${minute}`).toBe(expected);
      expect(formatSceneTime(normalizeSettings({ time }).time), `restored minute ${minute}`).toBe(expected);
    }
  });

  it("bounds resolution on high-density devices and reduces real work in the lightweight setting", () => {
    const phone = getQualityProfile("auto", 390, 3);
    const desktop = getQualityProfile("auto", 1400, 3);
    const low = getQualityProfile("low", 1400, 3);
    expect(phone.ratio).toBeLessThan(desktop.ratio);
    expect(low.ratio).toBe(1);
    expect(low.rainCount).toBeLessThan(phone.rainCount);
    expect(low.dustCount).toBeLessThan(phone.dustCount);
    expect(low.shadows).toBe(false);
    expect(low.fps).toBe(30);
    expect(getQualityProfile("high", 1440, 4).ratio).toBe(2);
  });
});
