import { expect, test, type Page } from "@playwright/test";

async function ready(page: Page, app = "") {
  await page.goto(app ? `/?app=${app}` : "/");
  await expect(page.locator(".desktop-boot")).toHaveCount(0);
}

test("desktop companion walks toward the pointer and pauses behind apps", async ({ page, isMobile }) => {
  test.skip(isMobile, "The desktop companion is intentionally hidden on touch layouts.");
  await ready(page);
  const cat = page.locator(".companion-cat");
  const before = await cat.evaluate(element => (element as HTMLElement).style.transform);
  await page.mouse.move(120, 240);
  await expect(cat).toHaveAttribute("data-state", "walking");
  await page.waitForTimeout(350);
  expect(await cat.evaluate(element => (element as HTMLElement).style.transform)).not.toBe(before);
  await expect(cat).toHaveAttribute("src", /desktop\/neko\/[a-z]+run[12]\.gif/);
  await page.getByRole("button", { name: "打开 Profile", exact: true }).first().click();
  await expect(cat).toBeHidden();
});

test("memory apps use distinct editorial interfaces", async ({ page }) => {
  for (const [app, selector, text] of [
    ["daily", ".daybook", "Daybook"],
    ["photos", ".photo-studio", "LIGHT / FIELD"],
    ["cinema", ".cinema-app", "INTERSTELLAR"],
    ["food", ".table-stories", "Table Stories"],
  ] as const) {
    await ready(page, app);
    await expect(page.locator(selector)).toBeVisible();
    await expect(page.locator(selector)).toContainText(text);
  }
  await page.getByRole("button", { name: /加入想吃清单/ }).click();
  await expect(page.locator(".table-stories")).toContainText("1 道想吃的风味");
});

test("Little Works renders with Three r160 and responds to simulation controls", async ({ page, isMobile }) => {
  test.skip(isMobile, "Mobile offline framing is covered by the standalone capture audit.");
  await ready(page, "cats");
  const iframe = page.locator('iframe[title="Little Works 建筑工地沙盘"]');
  await expect(iframe).toBeVisible();
  const frame = page.frames().find(candidate => candidate.url().includes("construction-sandbox.html"));
  expect(frame).toBeTruthy();
  await frame!.waitForFunction(() => window.__sandboxMetrics?.frame > 20);
  await expect.poll(() => frame!.evaluate(() => window.__sandboxMetrics.fps)).toBeGreaterThan(40);
  const baseline = await frame!.evaluate(() => ({
    revision: window.__sandboxMetrics.revision,
    frame: window.__sandboxMetrics.frame,
    calls: window.__sandboxMetrics.calls,
    instances: window.__sandboxMetrics.instances,
    violations: window.__sandboxMetrics.clearanceViolations,
    boundaryClearance: window.__sandboxMetrics.minimumBoundaryClearance,
    lampClearance: window.__sandboxMetrics.minimumLampClearance,
    site: window.__sandboxMetrics.site,
    lod: window.__sandboxMetrics.lod,
    vehicles: window.__sandboxMetrics.vehicles,
    workers: window.__sandboxMetrics.workers,
  }));
  expect(baseline).toMatchObject({ revision: "160", violations: 0 });
  expect(baseline.instances).toBeGreaterThan(2100);
  expect(baseline.calls).toBeGreaterThan(0);
  expect(baseline.boundaryClearance).toBeGreaterThan(0.5);
  expect(baseline.lampClearance).toBeGreaterThan(0.05);
  expect(baseline.site.expansionFactor).toBeCloseTo(1.5, 3);
  expect(baseline.site.area).toBeGreaterThan(baseline.site.previousArea);
  expect(baseline.site.lodZoneCount).toBe(3);
  expect(baseline.workers.count).toBe(28);
  expect(baseline.workers.roles).toEqual({ workers: 23, supervisors: 5 });
  expect(baseline.workers.helmetColors).toEqual({
    worker: "#f2ce56",
    supervisor: "#f3f4ed",
  });
  expect(baseline.workers.posture).toMatchObject({
    legSwingAxis: "x",
    lateralLegSwing: false,
    stopsAtRouteEnds: true,
  });
  expect(baseline.workers.posture.maxLateralLegSwing).toBe(0);
  await expect.poll(
    () => frame!.evaluate(
      () => window.__sandboxMetrics.workers.posture.maxForwardLegSwing,
    ),
  ).toBeGreaterThan(0.05);
  expect(baseline.workers.perimeter.count).toBe(8);
  expect(new Set(baseline.workers.perimeter.assignments).size).toBeGreaterThanOrEqual(7);
  expect(new Set(baseline.workers.perimeter.positions.map(position => position.z)).size).toBeGreaterThanOrEqual(6);
  expect(baseline.workers.perimeter.active).toBeGreaterThan(0);
  expect(baseline.workers.officeIntrusions).toBe(0);
  expect(Object.values(baseline.workers.tasks).every(count => count > 0)).toBe(true);
  expect(baseline.vehicles.every(vehicle => vehicle.wheelYaw === 0)).toBe(true);
  expect(baseline.vehicles.every(vehicle => vehicle.lampClearance > 0.05)).toBe(true);
  expect(baseline.vehicles.every(vehicle => vehicle.visible)).toBe(true);
  const parked = baseline.vehicles.find(vehicle => !vehicle.moving);
  expect(parked).toBeTruthy();
  await page.waitForTimeout(400);
  const motionAfter = await frame!.evaluate(
    id => ({
      parked: window.__sandboxMetrics.vehicles.find(vehicle => vehicle.id === id),
      workers: window.__sandboxMetrics.workers.motionChecksum,
    }),
    parked!.id,
  );
  expect(motionAfter.parked?.wheelRoll).toBe(parked!.wheelRoll);
  expect(motionAfter.workers).not.toBe(baseline.workers.motionChecksum);

  const stageSamples: {
    value: number;
    phase: string;
    permanentCompletion: number;
    activity: Window["__sandboxMetrics"]["activity"];
    workers: Window["__sandboxMetrics"]["workers"];
    loader: Window["__sandboxMetrics"]["loader"];
    lod: Window["__sandboxMetrics"]["lod"];
    districts: Window["__sandboxMetrics"]["districts"];
    vehicles: Window["__sandboxMetrics"]["vehicles"];
    transport: Window["__sandboxMetrics"]["transport"];
    violations: number;
  }[] = [];
  for (const [value, phase] of [
    ["0.08", "基坑与测量"],
    ["0.3", "基础与钢筋"],
    ["0.48", "主体结构"],
    ["0.65", "主体结构"],
    ["0.84", "安装与收尾"],
    ["0.96", "完工验收"],
  ] as const) {
    await frame!.getByRole("combobox", { name: /工序/ }).selectOption(value);
    await expect.poll(
      () => frame!.evaluate(() => window.__sandboxMetrics.construction.progress),
    ).toBeCloseTo(Number(value), 2);
    const sample = await frame!.evaluate(() => ({
      phase: window.__sandboxMetrics.construction.phase,
      permanentCompletion:
        window.__sandboxMetrics.building.permanentCompletion,
      activity: window.__sandboxMetrics.activity,
      workers: window.__sandboxMetrics.workers,
      loader: window.__sandboxMetrics.loader,
      lod: window.__sandboxMetrics.lod,
      districts: window.__sandboxMetrics.districts,
      vehicles: window.__sandboxMetrics.vehicles,
      transport: window.__sandboxMetrics.transport,
      violations: window.__sandboxMetrics.clearanceViolations,
    }));
    stageSamples.push({ value: Number(value), ...sample });
    expect(sample.phase).toBe(phase);
    expect(sample.violations).toBe(0);
    expect(sample.workers.active).toBeGreaterThan(0);
    expect(sample.workers.officeIntrusions).toBe(0);
    expect(sample.transport.visibleVehicles).toBe(3);
    expect(sample.vehicles.every(vehicle => vehicle.visible)).toBe(true);
    expect(sample.loader.visible).toBe(true);
    if (sample.loader.active) {
      expect(sample.loader.spoilClearance).toBeGreaterThan(0.005);
      expect(sample.loader.truckClearance).toBeGreaterThan(0.05);
    }
  }
  const completion = stageSamples.map(sample => sample.permanentCompletion);
  expect(completion).toEqual([...completion].sort((a, b) => a - b));
  expect(completion.at(-1)).toBe(1);
  expect(stageSamples[0].activity).toMatchObject({
    excavators: 2,
    dumpTrucks: 2,
    mixerTrucks: 0,
    loader: 1,
  });
  expect(stageSamples[2].activity).toMatchObject({
    excavators: 0,
    cranes: 2,
    mixerTrucks: 1,
    loader: 0,
  });
  expect(stageSamples[2].lod.lowDetailZones).toBe(3);
  expect(stageSamples[2].lod.highDetailZones).toBe(0);
  expect(
    stageSamples[2].districts.filter(district => district.status === "active").length,
  ).toBeGreaterThanOrEqual(3);
  expect(stageSamples[4].activity).toMatchObject({
    cranes: 1,
    dumpTrucks: 1,
    mixerTrucks: 0,
    loader: 1,
  });
  expect(stageSamples[5].phase).toBe("完工验收");
  expect(stageSamples[5].workers.activeByRole.supervisors).toBeGreaterThan(0);
  expect(stageSamples[5].loader.task).toBe("cleanup");
  expect(stageSamples.some(
    sample => sample.vehicles.some(vehicle => vehicle.mode === "returning"),
  )).toBe(true);

  await frame!.getByRole("checkbox", { name: "昼夜" }).uncheck();
  const lightingSamples: Record<
    string,
    Window["__sandboxMetrics"]["lighting"]
  > = {};
  for (const [value, phase] of [
    ["0", "夜晚"],
    ["0.25", "黎明"],
    ["0.5", "正午"],
    ["0.75", "黄昏"],
  ] as const) {
    await frame!.getByRole("combobox", { name: /时刻/ }).selectOption(value);
    await expect.poll(
      () => frame!.evaluate(() => window.__sandboxMetrics.lighting.phase),
    ).toBe(phase);
    lightingSamples[phase] = await frame!.evaluate(
      () => window.__sandboxMetrics.lighting,
    );
  }
  expect(new Set(Object.values(lightingSamples).map(sample => sample.sky)).size).toBe(4);
  expect(lightingSamples["正午"].sunIntensity).toBeGreaterThan(
    lightingSamples["黎明"].sunIntensity,
  );
  expect(lightingSamples["黎明"].sunIntensity).toBeGreaterThan(
    lightingSamples["夜晚"].sunIntensity,
  );
  expect(lightingSamples["夜晚"].lampFactor).toBeGreaterThan(
    lightingSamples["黄昏"].lampFactor,
  );
  expect(lightingSamples["黄昏"].lampFactor).toBeGreaterThan(
    lightingSamples["正午"].lampFactor,
  );

  await frame!.getByRole("button", { name: "暴雨" }).click();
  await expect(frame!.getByRole("button", { name: "暴雨" })).toHaveAttribute("aria-pressed", "true");
  await frame!.getByRole("combobox", { name: /时刻/ }).selectOption("0");
  await expect.poll(() => frame!.evaluate(() => window.__sandboxMetrics.settings.time)).toBe(0);
  await frame!.getByRole("combobox", { name: /镜头/ }).selectOption("street");
  await expect.poll(() => frame!.evaluate(() => window.__sandboxMetrics.settings.camera)).toBe("street");
  await frame!.getByRole("combobox", { name: /镜头/ }).selectOption("workers");
  await expect.poll(() => frame!.evaluate(() => window.__sandboxMetrics.settings.camera)).toBe("workers");
  await expect.poll(
    () => frame!.evaluate(() => window.__sandboxMetrics.lod.highDetailZones),
  ).toBeGreaterThan(0);
  await frame!.getByRole("button", { name: "暂停机械" }).click();
  const stopped = await frame!.evaluate(() => window.__sandboxMetrics.settings.paused);
  expect(stopped).toBe(true);
});

test("Little Works completes and resets its automatic construction loop", async ({ page }) => {
  await page.goto("/construction-sandbox.html?capture&buildTime=207.9");
  await page.waitForFunction(() => window.__sandboxMetrics?.frame > 20);
  const transition = await page.evaluate(() => ({
    construction: window.__sandboxMetrics.construction,
    building: window.__sandboxMetrics.building,
    activity: window.__sandboxMetrics.activity,
    transport: window.__sandboxMetrics.transport,
    vehicles: window.__sandboxMetrics.vehicles,
    loader: window.__sandboxMetrics.loader,
  }));
  expect(transition.construction.phase).toBe("新工期转场");
  expect(transition.construction.resetTransition).toBeGreaterThan(0.5);
  expect(transition.construction.progress).toBeLessThan(0.5);
  expect(transition.building.permanentCompletion).toBeLessThan(0.6);
  expect(
    transition.activity.excavators +
      transition.activity.cranes +
      transition.activity.dumpTrucks +
      transition.activity.mixerTrucks +
      transition.activity.loader +
      transition.activity.workers,
  ).toBe(0);
  expect(transition.transport.visibleVehicles).toBe(3);
  expect(transition.vehicles.every(vehicle => vehicle.visible)).toBe(true);
  expect(transition.loader.visible).toBe(true);

  await page.goto("/construction-sandbox.html?capture&buildTime=0");
  await page.waitForFunction(() => window.__sandboxMetrics?.frame > 20);
  const restarted = await page.evaluate(
    () => window.__sandboxMetrics.construction,
  );
  expect(restarted.phase).toBe("基坑与测量");
  expect(restarted.resetTransition).toBe(0);
  expect(restarted.progress).toBeLessThan(0.02);
});

declare global {
  interface Window {
    __sandboxMetrics: {
      revision: string;
      fps: number;
      frame: number;
      calls: number;
      instances: number;
      clearanceViolations: number;
      minimumBoundaryClearance: number;
      minimumLampClearance: number;
      site: {
        previousArea: number;
        area: number;
        expansionFactor: number;
        lodZoneCount: number;
        lodHighInstances: number;
        lodLowInstances: number;
      };
      lod: {
        highDetailZones: number;
        lowDetailZones: number;
        hiddenZones: number;
        renderedInstances: number;
        zones: {
          id: string;
          detail: "high" | "low" | "hidden";
          distance: number;
          reveal: number;
          highInstances: number;
          lowInstances: number;
        }[];
      };
      districts: {
        id: string;
        name: string;
        start: number;
        end: number;
        progress: number;
        status: "queued" | "active" | "complete" | "resetting";
      }[];
      transport: {
        visibleVehicles: number;
        workingVehicles: number;
        returningVehicles: number;
        standbyVehicles: number;
        transitSpeed: number;
        loaderMode: "grading" | "cleanup" | "returning" | "parked";
      };
      activity: {
        excavators: number;
        cranes: number;
        dumpTrucks: number;
        mixerTrucks: number;
        loader: number;
        workers: number;
      };
      building: {
        permanentCompletion: number;
      };
      construction: {
        cycleSeconds: number;
        cyclePosition: number;
        progress: number;
        phase: string;
        mode: "auto" | "manual";
        resetTransition: number;
      };
      lighting: {
        phase: string;
        sky: string;
        sunIntensity: number;
        hemiIntensity: number;
        lampFactor: number;
        exposure: number;
      };
      loader: {
        active: boolean;
        moving: boolean;
        task: "grading" | "cleanup" | "parked";
        wheelRoll: number;
        wheelYaw: number;
        boundaryClearance: number;
        truckClearance: number | null;
        spoilClearance: number;
        visible: boolean;
      };
      workers: {
        count: number;
        tasks: Record<string, number>;
        roles: {
          workers: number;
          supervisors: number;
        };
        helmetColors: {
          worker: string;
          supervisor: string;
        };
        active: number;
        activeByRole: {
          workers: number;
          supervisors: number;
        };
        activeByTask: Record<string, number>;
        posture: {
          legSwingAxis: "x";
          lateralLegSwing: boolean;
          stopsAtRouteEnds: boolean;
          maxForwardLegSwing: number;
          maxLateralLegSwing: number;
        };
        perimeter: {
          count: number;
          active: number;
          assignments: string[];
          positions: { x: number; z: number }[];
        };
        officeIntrusions: number;
        motionChecksum: number;
      };
      settings: {
        time: number;
        paused: boolean;
        camera: string;
        buildMode: "auto" | "manual";
      };
      vehicles: {
        id: number;
        moving: boolean;
        active: boolean;
        visible: boolean;
        mode: "working" | "returning" | "standby";
        wheelRoll: number;
        wheelYaw: number;
        boundaryClearance: number;
        lampClearance: number;
        extentX: number;
        extentZ: number;
      }[];
    };
  }
}
