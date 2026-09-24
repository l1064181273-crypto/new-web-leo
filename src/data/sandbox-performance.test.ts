import { describe, expect, it } from "vitest";
import { createFrameSampler } from "../../sandbox/performance.js";

describe("Little Works wall-clock frame sampler", () => {
  it("anchors at timestamp zero and emits only after a full 1500 ms window", () => {
    const sampler = createFrameSampler();
    expect(sampler.sample(0)).toBeNull();
    for (let now = 50; now < 1500; now += 50) expect(sampler.sample(now)).toBeNull();
    expect(sampler.sample(1500)).toEqual({
      fps: 20,
      averageFrameMs: 50,
      p95FrameMs: 50,
      frameCount: 30,
      windowMs: 1500,
    });
  });

  it("does not count the initial point as a frame or clamp 10 FPS into 20 FPS", () => {
    const sampler = createFrameSampler();
    for (let now = 0; now < 1500; now += 100) expect(sampler.sample(now)).toBeNull();
    expect(sampler.sample(1500)).toEqual({
      fps: 10,
      averageFrameMs: 100,
      p95FrameMs: 100,
      frameCount: 15,
      windowMs: 1500,
    });
  });

  it("uses actual elapsed time when a frame crosses the nominal window boundary", () => {
    const sampler = createFrameSampler();
    for (const now of [100, 500, 900, 1300]) expect(sampler.sample(now)).toBeNull();
    expect(sampler.sample(1700)).toEqual({
      fps: 2.5,
      averageFrameMs: 400,
      p95FrameMs: 400,
      frameCount: 4,
      windowMs: 1600,
    });
  });

  it("retains a genuine long frame instead of silently treating it as background time", () => {
    const sampler = createFrameSampler();
    sampler.sample(500);
    expect(sampler.sample(2500)).toEqual({
      fps: .5,
      averageFrameMs: 2000,
      p95FrameMs: 2000,
      frameCount: 1,
      windowMs: 2000,
    });
  });

  it("computes arithmetic interval mean and nearest-rank p95 from uneven frames", () => {
    const sampler = createFrameSampler();
    let now = 0;
    sampler.sample(now);
    // 20 intervals, total 1500 ms: the 19th sorted interval is 190 ms.
    for (const interval of [190, ...Array.from({ length: 18 }, () => 50)]) {
      now += interval;
      expect(sampler.sample(now)).toBeNull();
    }
    expect(sampler.sample(now + 410)).toEqual({
      fps: 20 * 1000 / 1500,
      averageFrameMs: 75,
      p95FrameMs: 190,
      frameCount: 20,
      windowMs: 1500,
    });
  });

  it("starts independent consecutive windows without losing or double-counting the shared anchor", () => {
    const sampler = createFrameSampler();
    for (let now = 0; now < 1500; now += 100) sampler.sample(now);
    const first = sampler.sample(1500);
    for (let now = 1750; now < 3000; now += 250) expect(sampler.sample(now)).toBeNull();
    expect(sampler.sample(3000)).toEqual({
      fps: 4,
      averageFrameMs: 250,
      p95FrameMs: 250,
      frameCount: 6,
      windowMs: 1500,
    });
    expect(first).toMatchObject({ fps: 10, frameCount: 15, windowMs: 1500 });
  });

  it("ignores duplicate timestamps without adding zero-length frames or erasing progress", () => {
    const sampler = createFrameSampler();
    for (let now = 0; now < 1500; now += 100) {
      expect(sampler.sample(now)).toBeNull();
      expect(sampler.sample(now)).toBeNull();
    }
    expect(sampler.sample(1500)).toMatchObject({ fps: 10, averageFrameMs: 100, frameCount: 15 });
    expect(sampler.sample(1500)).toBeNull();
  });

  it.each([NaN, Infinity, -Infinity, -1, undefined, null, "1500"])("discards a segment containing an invalid timestamp: %s", invalid => {
    const sampler = createFrameSampler();
    sampler.sample(0);
    sampler.sample(1000);
    expect(sampler.sample(invalid)).toBeNull();
    expect(sampler.sample(100_000)).toBeNull();
    for (let now = 100_100; now < 101_500; now += 100) expect(sampler.sample(now)).toBeNull();
    expect(sampler.sample(101_500)).toMatchObject({ fps: 10, p95FrameMs: 100, frameCount: 15, windowMs: 1500 });
  });

  it("reanchors after a backwards clock without negative or stale intervals", () => {
    const sampler = createFrameSampler();
    sampler.sample(2000);
    sampler.sample(3000);
    expect(sampler.sample(500)).toBeNull();
    for (let now = 600; now < 2000; now += 100) expect(sampler.sample(now)).toBeNull();
    expect(sampler.sample(2000)).toMatchObject({ fps: 10, averageFrameMs: 100, p95FrameMs: 100, windowMs: 1500 });
  });

  it.each([false, true])("reset omits a hidden/pause gap and clears a %s completed window", completed => {
    const sampler = createFrameSampler();
    sampler.sample(0);
    sampler.sample(completed ? 1500 : 1000);
    sampler.reset();
    sampler.reset();
    expect(sampler.sample(600_000)).toBeNull();
    for (let now = 600_100; now < 601_500; now += 100) expect(sampler.sample(now)).toBeNull();
    expect(sampler.sample(601_500)).toEqual({
      fps: 10,
      averageFrameMs: 100,
      p95FrameMs: 100,
      frameCount: 15,
      windowMs: 1500,
    });
  });

  it("retains fractional frame timings without rounding the sampling data", () => {
    const sampler = createFrameSampler();
    sampler.sample(0);
    for (let frame = 1; frame < 90; frame++) expect(sampler.sample(frame * 1000 / 60)).toBeNull();
    const sample = sampler.sample(1500);
    expect(sample.fps).toBe(60);
    expect(sample.averageFrameMs).toBeCloseTo(1000 / 60, 10);
    expect(sample.p95FrameMs).toBeCloseTo(1000 / 60, 10);
    expect(sample.frameCount).toBe(90);
  });

  it("keeps separate sampler instances independent", () => {
    const first = createFrameSampler(), second = createFrameSampler();
    first.sample(0);
    second.sample(5000);
    first.reset();
    expect(second.sample(6500)).toMatchObject({ fps: 1000 / 1500, frameCount: 1, windowMs: 1500 });
    expect(first.sample(6500)).toBeNull();
  });
});
