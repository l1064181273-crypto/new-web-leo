import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const out = "artifacts/interaction-v2/reference";
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await page.goto("https://macxfolio.framer.website/", {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(7500);
  const record = async (name) => {
    const data = await page.evaluate(() => ({
      url: location.href,
      text: document.body.innerText.slice(-3000),
      nodes: [
        ...document.querySelectorAll(
          "[data-framer-name], [role=dialog], button",
        ),
      ]
        .map((el) => {
          const r = el.getBoundingClientRect(),
            s = getComputedStyle(el);
          return {
            name: el.getAttribute("data-framer-name"),
            tag: el.tagName,
            role: el.getAttribute("role"),
            text: el.textContent?.slice(0, 55),
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            cursor: s.cursor,
            bg: s.backgroundColor,
            z: s.zIndex,
            pointer: s.pointerEvents,
            position: s.position,
            transform: s.transform,
            opacity: s.opacity,
          };
        })
        .filter((n) => n.width && n.height),
    }));
    await writeFile(`${out}/${name}.json`, JSON.stringify(data, null, 2));
    await page.screenshot({
      path: `${out}/${name}.png`,
      animations: "disabled",
      timeout: 10000,
    });
    console.log(name, data.text.slice(-350));
  };
  await record("closed");
  await page.getByText("Sorae", { exact: true }).first().click();
  await page.waitForTimeout(700);
  await record("single-click");
  await page.getByText("Sorae", { exact: true }).first().dblclick();
  await page.waitForTimeout(700);
  await record("double-click");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  await record("escape");
  await page.getByText("Sorae", { exact: true }).first().click();
  await page.waitForTimeout(700);
  await page.mouse.click(20, 400);
  await page.waitForTimeout(700);
  await record("outside-click");
  for (const [name, selector] of [
    ["red", "Rectangle 1000001705"],
    ["yellow", "Rectangle 1000001706"],
    ["green", "Rectangle 1000001707"],
  ]) {
    await page.goto("https://macxfolio.framer.website/", {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(7500);
    await page.getByText("Sorae", { exact: true }).first().click();
    await page.waitForTimeout(500);
    await page.locator(`[data-framer-name="${selector}"]`).last().click();
    await page.waitForTimeout(600);
    await record(`control-${name}`);
  }
  await page.goto("https://macxfolio.framer.website/", {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(7500);
  await page.getByText("Sorae", { exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await record("escape-while-open");
  await page.getByText("Sorae", { exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.mouse.click(584, 837);
  await page.waitForTimeout(600);
  await record("switch-app");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("https://macxfolio.framer.website/", {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(7500);
  await page.getByText("Sorae", { exact: true }).first().click();
  await page.waitForTimeout(600);
  await record("mobile-open");
} finally {
  await browser.close();
}
