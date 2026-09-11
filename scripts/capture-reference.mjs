import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const output = "artifacts/reference";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await page.goto("https://macxfolio.framer.website/", {
    waitUntil: "domcontentloaded",
  });
  await page.getByText("Masen James", { exact: true }).first().waitFor();
  await page.waitForTimeout(7500);
  await page.screenshot({
    path: `${output}/desktop.png`,
    animations: "disabled",
    timeout: 15000,
  });
  const extract = () =>
    page.evaluate(() => ({
      title: document.title,
      elements: [...document.querySelectorAll("[data-framer-name]")]
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            name: element.getAttribute("data-framer-name"),
            text: element.textContent?.slice(0, 100),
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            font: style.fontFamily,
            size: style.fontSize,
            background: style.background,
            radius: style.borderRadius,
          };
        })
        .filter((element) => element.width && element.height),
      images: [...document.images].map((img) => ({
        src: img.currentSrc,
        alt: img.alt,
      })),
      links: [...document.querySelectorAll("a")].map((a) => ({
        text: a.textContent,
        href: a.getAttribute("href"),
        label: a.getAttribute("aria-label"),
      })),
    }));
  await writeFile(
    `${output}/desktop.json`,
    JSON.stringify(await extract(), null, 2),
  );
  console.log(await page.locator("a").allTextContents());
  await page.getByText("Music", { exact: true }).first().dblclick();
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: `${output}/music.png`,
    animations: "disabled",
    timeout: 15000,
  });
  await writeFile(
    `${output}/music.json`,
    JSON.stringify(await extract(), null, 2),
  );
  for (const [name, label] of [["profile", "About Me"], ["project", "Sorae"]]) {
    await page.goto("https://macxfolio.framer.website/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(7500);
    await page.getByText(label, { exact: true }).first().dblclick();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${output}/${name}.png`, animations: "disabled", timeout: 15000 });
    await writeFile(`${output}/${name}.json`, JSON.stringify(await extract(), null, 2));
  }
  await page.goto("https://macxfolio.framer.website/", {
    waitUntil: "domcontentloaded",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(7500);
  await page.screenshot({
    path: `${output}/mobile.png`,
    animations: "disabled",
    timeout: 15000,
  });
  console.log("Reference captured.");
} finally {
  await browser.close();
}
