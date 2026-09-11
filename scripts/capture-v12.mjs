import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const output = "artifacts/expanded-site-v12";
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
    const snapshot = window.__sandboxMetrics;
    return {
      fps: snapshot.fps,
      calls: snapshot.calls,
      triangles: snapshot.triangles,
      instances: snapshot.instances,
      site: snapshot.site,
      construction: snapshot.construction,
      districts: snapshot.districts,
      lod: snapshot.lod,
      clearanceViolations: snapshot.clearanceViolations,
      minimumBoundaryClearance: snapshot.minimumBoundaryClearance,
    };
  });
}

try {
  const desktop = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await openScene(desktop);
  const stages = {};
  for (const [name, value] of [
    ["earthworks", "0.08"],
    ["districts", "0.48"],
    ["complete", "0.96"],
  ]) {
    await desktop.locator("#camera-view").selectOption("overview");
    await desktop.locator("#build-stage").selectOption(value);
    await desktop.waitForFunction(
      expected =>
        Math.abs(window.__sandboxMetrics?.construction?.progress - expected) <
        .001,
      Number(value),
    );
    await desktop.waitForTimeout(1700);
    await desktop.screenshot({ path: `${output}/${name}-overview.png` });
    stages[name] = await sample(desktop);
  }

  await desktop.locator("#build-stage").selectOption("0.48");
  await desktop.locator("#camera-view").selectOption("street");
  await desktop.waitForTimeout(1700);
  await desktop.screenshot({ path: `${output}/districts-near-lod.png` });
  const near = await sample(desktop);
  await desktop.close();

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  await openScene(mobile);
  await mobile.locator("#build-stage").selectOption("0.48");
  await mobile.waitForTimeout(1700);
  await mobile.screenshot({ path: `${output}/districts-mobile.png` });
  const mobileSample = await sample(mobile);
  await mobile.close();

  const report = {
    errors,
    externalRequests: [...new Set(externalRequests)],
    stages,
    near,
    mobile: mobileSample,
  };
  await writeFile(
    `${output}/report.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );

  if (errors.length)
    throw new Error(`Capture reported ${errors.length} page error(s).`);
  if (externalRequests.length)
    throw new Error("Standalone sandbox made external network requests.");
  if (Math.abs(stages.districts.site.expansionFactor - 1.5) > .002)
    throw new Error("Expanded site area is not 1.5x.");
  if (stages.districts.lod.lowDetailZones !== 3)
    throw new Error("Overview did not select all low-detail districts.");
  if (near.lod.highDetailZones < 2)
    throw new Error("Near camera did not select high-detail districts.");
  if (mobileSample.lod.lowDetailZones !== 3)
    throw new Error("Mobile overview did not retain low-detail districts.");
  if (Math.min(stages.districts.fps, near.fps, mobileSample.fps) < 45)
    throw new Error("Expanded site did not meet the 45 FPS floor.");
} finally {
  await browser.close();
}

console.log("Expanded Site v12 evidence captured.");
