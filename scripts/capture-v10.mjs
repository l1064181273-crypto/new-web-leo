import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const output = "artifacts/worker-posture-v10";
await mkdir(output, { recursive: true });
const errors = [];
const externalRequests = [];
const browser = await chromium.launch({
  args: process.platform === "darwin" ? ["--use-angle=metal"] : [],
});

async function openScene(page, viewport) {
  await page.setViewportSize(viewport);
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (/^https?:/i.test(request.url()))
      externalRequests.push(request.url());
  });
  await page.context().setOffline(true);
  await page.goto(
    `${pathToFileURL(resolve("public/construction-sandbox.html"))}?capture`,
  );
  await page.waitForFunction(() => window.__sandboxMetrics?.frame > 20);
  await page.locator("#cycle").uncheck();
  await page.locator("#time").selectOption("0.5");
}

try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await openScene(page, { width: 1440, height: 900 });
  await page.locator("#build-stage").selectOption("0.48");
  await page.locator("#camera-view").selectOption("workers");
  await page.waitForFunction(
    () =>
      window.__sandboxMetrics?.settings?.camera === "workers" &&
      window.__sandboxMetrics?.workers?.posture?.maxForwardLegSwing > .05,
  );
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${output}/worker-gait-a.png` });
  const gaitA = await page.evaluate(() => ({
    posture: window.__sandboxMetrics.workers.posture,
    active: window.__sandboxMetrics.workers.active,
    perimeter: window.__sandboxMetrics.workers.perimeter,
    officeIntrusions: window.__sandboxMetrics.workers.officeIntrusions,
    minimumLampClearance: window.__sandboxMetrics.minimumLampClearance,
    loader: window.__sandboxMetrics.loader,
    violations: window.__sandboxMetrics.clearanceViolations,
    fps: window.__sandboxMetrics.fps,
  }));
  await page.waitForTimeout(420);
  await page.screenshot({ path: `${output}/worker-gait-b.png` });
  const gaitB = await page.evaluate(
    () => window.__sandboxMetrics.workers.posture,
  );

  await page.locator("#camera-view").selectOption("overview");
  await page.locator("#build-stage").selectOption("0.3");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${output}/perimeter-overview.png` });
  await page.locator("#build-stage").selectOption("0.08");
  await page.locator("#camera-view").selectOption("street");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${output}/collision-clearance.png` });

  const stages = {};
  for (const value of ["0.08", "0.3", "0.48", "0.65", "0.84", "0.96"]) {
    await page.locator("#build-stage").selectOption(value);
    await page.waitForFunction(
      expected =>
        Math.abs(window.__sandboxMetrics?.construction?.progress - expected) <
        .001,
      Number(value),
    );
    stages[value] = await page.evaluate(() => ({
      phase: window.__sandboxMetrics.construction.phase,
      workers: window.__sandboxMetrics.workers.active,
      activePerimeter: window.__sandboxMetrics.workers.perimeter.active,
      officeIntrusions: window.__sandboxMetrics.workers.officeIntrusions,
      posture: window.__sandboxMetrics.workers.posture,
      minimumLampClearance: window.__sandboxMetrics.minimumLampClearance,
      loader: window.__sandboxMetrics.loader,
      violations: window.__sandboxMetrics.clearanceViolations,
      fps: window.__sandboxMetrics.fps,
    }));
  }
  await page.close();

  const mobile = await browser.newPage({ deviceScaleFactor: 1 });
  await openScene(mobile, { width: 390, height: 844 });
  await mobile.locator("#build-stage").selectOption("0.48");
  await mobile.locator("#camera-view").selectOption("workers");
  await mobile.waitForTimeout(1800);
  await mobile.screenshot({ path: `${output}/worker-gait-mobile.png` });
  const mobileMetrics = await mobile.evaluate(() => ({
    fps: window.__sandboxMetrics.fps,
    posture: window.__sandboxMetrics.workers.posture,
    violations: window.__sandboxMetrics.clearanceViolations,
  }));
  await mobile.close();

  await writeFile(
    `${output}/report.json`,
    `${JSON.stringify(
      {
        errors,
        externalRequests: [...new Set(externalRequests)],
        gaitA,
        gaitB,
        stages,
        mobile: mobileMetrics,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await browser.close();
}

if (errors.length)
  throw new Error(`Capture reported ${errors.length} page error(s).`);
if (externalRequests.length)
  throw new Error("Standalone sandbox made external network requests.");

console.log("Worker posture v10 evidence captured.");
