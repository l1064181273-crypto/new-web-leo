import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch();
const output = "artifacts/screenshots";
await mkdir(output, { recursive: true });
const errors = [];
try {
  for (const [name, viewport] of Object.entries({
    desktop: { width: 1440, height: 900 },
    mobile: { width: 390, height: 844 },
  })) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:5174/", { waitUntil: "networkidle" });
    await page.locator(".desktop-boot").waitFor({ state: "detached" });
    await page.screenshot({
      path: `${output}/${name}.png`,
      animations: "disabled",
    });
    for (const app of ["profile", "atlas", "music", "notes", "connect", "projects", "resume", "food", "cinema"]) {
      await page.goto(`http://127.0.0.1:5174/?app=${app}`, {
        waitUntil: "networkidle",
      });
      await page.locator(".desktop-boot").waitFor({ state: "detached" });
      if (app === "connect") {
        await page.getByRole("button", { name: /查看联系方式/ }).click();
        await page.getByRole("button", { name: "复制微信号" }).waitFor();
      }
      await page.screenshot({
        path: `${output}/${name}-${app}.png`,
        animations: "disabled",
      });
    }
    await page.close();
  }
  await writeFile(`${output}/errors.json`, JSON.stringify(errors, null, 2));
  console.log({ errors });
} finally {
  await browser.close();
}
