import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const output = "artifacts/living-site-v9";
for (const directory of ["time", "building", "mobile", "cycle", "validation"])
  await mkdir(`${output}/${directory}`, { recursive: true });

const browser = await chromium.launch({
  args: process.platform === "darwin" ? ["--use-angle=metal"] : [],
});
const errors = [];
const externalRequests = [];
const metrics = {
  time: {},
  building: {},
  mobile: {},
  cycle: {},
};

function watch(page) {
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (/^https?:/i.test(request.url()))
      externalRequests.push(request.url());
  });
}

async function openStandalone(page, query = "capture") {
  await page.goto(
    `${pathToFileURL(resolve("public/construction-sandbox.html"))}?${query}`,
  );
  await page.waitForFunction(() => window.__sandboxMetrics?.frame > 20);
}

async function readMetrics(page) {
  return page.evaluate(() => {
    const snapshot = window.__sandboxMetrics;
    return {
      fps: snapshot.fps,
      calls: snapshot.calls,
      triangles: snapshot.triangles,
      instances: snapshot.instances,
      lighting: snapshot.lighting,
      construction: snapshot.construction,
      building: snapshot.building,
      workers: snapshot.workers,
      activity: snapshot.activity,
      vehicles: snapshot.vehicles,
      loader: snapshot.loader,
      clearanceViolations: snapshot.clearanceViolations,
      minimumBoundaryClearance: snapshot.minimumBoundaryClearance,
    };
  });
}

async function auditCanvas(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("#scene");
    const gl = canvas?.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!canvas || !gl)
      return { width: canvas?.width ?? 0, height: canvas?.height ?? 0, nonBlank: false };
    const width = Math.min(48, canvas.width);
    const height = Math.min(48, canvas.height);
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(
      Math.max(0, Math.floor((canvas.width - width) / 2)),
      Math.max(0, Math.floor((canvas.height - height) / 2)),
      width,
      height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
    const colors = new Set();
    let luminance = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      colors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
      luminance += pixels[index] + pixels[index + 1] + pixels[index + 2];
    }
    return {
      width: canvas.width,
      height: canvas.height,
      distinctColors: colors.size,
      averageChannel: luminance / (width * height * 3),
      nonBlank: colors.size > 8 && luminance > 0,
    };
  });
}

try {
  const desktop = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  watch(desktop);
  await desktop.context().setOffline(true);
  await openStandalone(desktop);
  await desktop.locator("#cycle").uncheck();

  for (const [name, value] of [
    ["night", "0"],
    ["dawn", "0.25"],
    ["noon", "0.5"],
    ["dusk", "0.75"],
  ]) {
    await desktop.locator("#time").selectOption(value);
    await desktop.waitForFunction(
      expected => window.__sandboxMetrics?.lighting?.phase === expected,
      {
        night: "夜晚",
        dawn: "黎明",
        noon: "正午",
        dusk: "黄昏",
      }[name],
    );
    await desktop.screenshot({ path: `${output}/time/${name}.png` });
    metrics.time[name] = await readMetrics(desktop);
  }

  await desktop.locator("#time").selectOption("0.5");
  for (const [name, value] of [
    ["0.08", "0.08"],
    ["0.3", "0.3"],
    ["0.48", "0.48"],
    ["0.65", "0.65"],
    ["0.84", "0.84"],
    ["0.96", "0.96"],
  ]) {
    await desktop.locator("#build-stage").selectOption(value);
    await desktop.waitForFunction(
      expected =>
        Math.abs(window.__sandboxMetrics?.construction?.progress - expected) <
        .001,
      Number(value),
    );
    await desktop.waitForTimeout(250);
    await desktop.screenshot({ path: `${output}/building/stage-${name}.png` });
    metrics.building[name] = await readMetrics(desktop);
  }

  await desktop.locator("#build-stage").selectOption("0.3");
  await desktop.locator("#camera-view").selectOption("street");
  await desktop.waitForTimeout(1100);
  await desktop.screenshot({ path: `${output}/building/worker-roles.png` });
  metrics.canvas = await auditCanvas(desktop);
  await desktop.close();

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  watch(mobile);
  await mobile.context().setOffline(true);
  await openStandalone(mobile);
  await mobile.locator("#cycle").uncheck();
  await mobile.locator("#time").selectOption("0.75");
  await mobile.locator("#build-stage").selectOption("0.65");
  await mobile.waitForFunction(
    () =>
      window.__sandboxMetrics?.lighting?.phase === "黄昏" &&
      Math.abs(window.__sandboxMetrics?.construction?.progress - .65) < .001,
  );
  await mobile.screenshot({ path: `${output}/mobile/dusk-structure.png` });
  metrics.mobile = await readMetrics(mobile);
  metrics.mobileCanvas = await auditCanvas(mobile);
  await mobile.close();

  const cycle = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  watch(cycle);
  await cycle.context().setOffline(true);
  await openStandalone(cycle, "capture&buildTime=207.9");
  await cycle.waitForTimeout(250);
  await cycle.screenshot({ path: `${output}/cycle/reset-transition.png` });
  metrics.cycle = await readMetrics(cycle);
  await cycle.close();
} finally {
  await writeFile(
    `${output}/time/metrics.json`,
    `${JSON.stringify(metrics.time, null, 2)}\n`,
  );
  await writeFile(
    `${output}/building/metrics.json`,
    `${JSON.stringify(metrics.building, null, 2)}\n`,
  );
  await writeFile(
    `${output}/validation/capture-report.json`,
    `${JSON.stringify(
      {
        errors,
        externalRequests: [...new Set(externalRequests)],
        canvas: metrics.canvas,
        mobile: metrics.mobile,
        mobileCanvas: metrics.mobileCanvas,
        cycle: metrics.cycle,
      },
      null,
      2,
    )}\n`,
  );
  await browser.close();
}

if (errors.length)
  throw new Error(`Capture reported ${errors.length} page error(s).`);
if (externalRequests.length)
  throw new Error("Standalone sandbox made external network requests.");
if (!metrics.canvas?.nonBlank || !metrics.mobileCanvas?.nonBlank)
  throw new Error("Canvas pixel audit found a blank render.");

console.log("Living Site v9 evidence captured.");
