import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch();
const out = "artifacts/interaction-v2/screenshots";
await mkdir(out, { recursive: true });
const errors = [];
try {
  for (const [name, viewport] of Object.entries({
    desktop: { width: 1440, height: 900 },
    mobile: { width: 390, height: 844 },
  })) {
    const page = await browser.newPage({ viewport });
    page.on("pageerror", (error) => errors.push(error.message));
    for (const app of ["", "projects", "photos", "games"]) {
      await page.goto(`http://127.0.0.1:5174/${app ? `?app=${app}` : ""}`, {
        waitUntil: "networkidle",
      });
      await page.locator(".desktop-boot").waitFor({ state: "detached" });
      await page.screenshot({
        path: `${out}/${name}-${app || "desktop"}.png`,
        animations: "disabled",
      });
      if (app === "games") {
        await page
          .getByRole("button", { name: "开始游戏", exact: true })
          .click();
        await page.waitForTimeout(700);
        await page.screenshot({ path: `${out}/${name}-game-running.png` });
      }
    }
    await page.close();
  }
  await writeFile(`${out}/errors.json`, JSON.stringify(errors, null, 2));
} finally {
  await browser.close();
}
