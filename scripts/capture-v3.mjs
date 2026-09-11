import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const browser = await chromium.launch({ args: process.platform === "darwin" ? ["--use-angle=metal"] : [] });
const out = "artifacts/sandbox-v3/screenshots";
await mkdir(out, { recursive: true });
const errors = [];
const samples = [];
try {
  for (const [name, viewport] of Object.entries({
    desktop: { width: 1440, height: 900 },
    mobile: { width: 390, height: 844 },
  })) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    page.on("pageerror", (error) => errors.push(error.message));
    if (!process.argv.includes("--scene-only")) {
      for (const app of ["", "daily", "photos", "cinema", "food", "music", "cats"]) {
        await page.goto(`http://127.0.0.1:5174/${app ? `?app=${app}` : ""}`);
        await page.locator(".desktop-boot").waitFor({ state: "detached" });
        await page.waitForTimeout(900);
        await page.screenshot({ path: `${out}/${name}-${app || "desktop"}.png` });
      }
    }
    const requests = [];
    page.on("request", request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    await page.context().setOffline(true);
    await page.goto(`${pathToFileURL(resolve("public/construction-sandbox.html"))}?capture`);
    await page.waitForFunction(() => window.__sandboxMetrics?.frame > 10);
    await page.waitForTimeout(2500);
    samples.push({ name, requests, ...await page.evaluate(() => window.__sandboxMetrics) });
    await page.screenshot({ path: `${out}/${name}-sandbox-day.png` });
    await page.locator("#time").selectOption("0");
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}/${name}-sandbox-night.png` });
    await page.locator("#rain").click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}/${name}-sandbox-rain.png` });
    await page.close();
  }
} finally {
  await writeFile(`${out}/capture-report.json`, JSON.stringify({ errors, samples }, null, 2));
  await browser.close();
}
