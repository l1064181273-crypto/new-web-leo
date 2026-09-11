import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const output = "artifacts/vehicle-continuity-v13";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  args: process.platform === "darwin" ? ["--use-angle=metal"] : [],
});
const errors = [];
const externalRequests = [];

function watch(page) {
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (/^https?:/i.test(request.url()))
      externalRequests.push(request.url());
  });
}

async function openScene(page) {
  watch(page);
  await page.context().setOffline(true);
  await page.goto(
    `${pathToFileURL(resolve("public/construction-sandbox.html"))}?capture`,
  );
  await page.waitForFunction(() => window.__sandboxMetrics?.frame > 20);
  await page.locator("#cycle").uncheck();
  await page.locator("#time").selectOption("0.5");
}

async function sample(page) {
  return page.evaluate(() => {
    const metrics = window.__sandboxMetrics;
    return {
      construction: metrics.construction,
      transport: metrics.transport,
      vehicles: metrics.vehicles,
      loader: metrics.loader,
      violations: metrics.clearanceViolations,
      fps: metrics.fps,
    };
  });
}

try {
  const desktop = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await openScene(desktop);
  await desktop.locator("#camera-view").selectOption("street");
  const stages = {};
  for (const [name, value] of [
    ["earthworks", "0.08"],
    ["structure", "0.48"],
    ["finishing", "0.84"],
    ["inspection", "0.96"],
  ]) {
    await desktop.locator("#build-stage").selectOption(value);
    await desktop.waitForFunction(
      expected =>
        Math.abs(window.__sandboxMetrics?.construction?.progress - expected) <
        .001,
      Number(value),
    );
    await desktop.waitForTimeout(1300);
    await desktop.screenshot({ path: `${output}/${name}.png` });
    stages[name] = await sample(desktop);
  }

  const timeline = [];
  await desktop.locator("#build-stage").selectOption("auto");
  for (let second = 0; second < 12; second++) {
    await desktop.waitForTimeout(1000);
    timeline.push(await sample(desktop));
  }
  await desktop.close();

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  await openScene(mobile);
  await mobile.locator("#build-stage").selectOption("0.48");
  await mobile.waitForTimeout(1300);
  await mobile.screenshot({ path: `${output}/mobile.png` });
  const mobileSample = await sample(mobile);
  await mobile.close();

  const report = {
    errors,
    externalRequests: [...new Set(externalRequests)],
    stages,
    timeline,
    mobile: mobileSample,
  };
  await writeFile(
    `${output}/report.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );

  const samples = [...Object.values(stages), ...timeline, mobileSample];
  if (errors.length)
    throw new Error(`Capture reported ${errors.length} page error(s).`);
  if (externalRequests.length)
    throw new Error("Standalone sandbox made external network requests.");
  if (samples.some(sample => sample.transport.visibleVehicles !== 3))
    throw new Error("A road vehicle disappeared during the audit.");
  if (samples.some(sample => sample.vehicles.some(vehicle => !vehicle.visible)))
    throw new Error("A vehicle reported an invisible state.");
  if (samples.some(sample => !sample.loader.visible))
    throw new Error("The loader disappeared during the audit.");
  if (samples.some(sample => sample.violations !== 0))
    throw new Error("Vehicle continuity introduced a clearance violation.");
  if (Math.min(...samples.map(sample => sample.fps)) < 45)
    throw new Error("Vehicle continuity did not meet the 45 FPS floor.");
} finally {
  await browser.close();
}

console.log("Vehicle continuity v13 evidence captured.");
