import { expect, test } from "@playwright/test";

test("desktop icons share one frame and custom positions persist", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Touch layouts use a fixed grid.");
  await page.goto("/");
  await expect(page.locator(".desktop-boot")).toHaveCount(0);

  const shortcuts = page.locator(".desktop-shortcut:visible");
  await expect(shortcuts).toHaveCount(14);
  const frames = page.locator(".desktop-shortcut:visible .desktop-icon-frame");
  await expect(frames).toHaveCount(14);
  expect(
    await frames.evaluateAll((elements) =>
      elements.every((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          rect.width === 76 &&
          rect.height === 76 &&
          style.borderRadius === "16px" &&
          style.borderTopWidth === "0px" &&
          (style.backgroundColor === "rgba(0, 0, 0, 0)" ||
            element.classList.contains("desktop-icon-frame-notes"))
        );
      }),
    ),
  ).toBe(true);
  const visibleSizes = await page
    .locator(".desktop-shortcut:visible .desktop-icon-frame img")
    .evaluateAll((images) =>
      images.map((image) => {
        const element = image as HTMLImageElement;
        const canvas = document.createElement("canvas");
        canvas.width = element.naturalWidth;
        canvas.height = element.naturalHeight;
        const context = canvas.getContext("2d")!;
        context.drawImage(element, 0, 0);
        const pixels = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        ).data;
        let minX = canvas.width,
          minY = canvas.height,
          maxX = -1,
          maxY = -1;
        for (let y = 0; y < canvas.height; y++)
          for (let x = 0; x < canvas.width; x++)
            if (pixels[(y * canvas.width + x) * 4 + 3] > 16) {
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
            }
        const style = getComputedStyle(element);
        const scale = new DOMMatrixReadOnly(style.transform).a;
        const fit =
          style.objectFit === "cover"
            ? Math.max(76 / canvas.width, 76 / canvas.height)
            : Math.min(76 / canvas.width, 76 / canvas.height);
        return Math.min(
          76,
          Math.max(maxX - minX + 1, maxY - minY + 1) * fit * scale,
        );
      }),
    );
  visibleSizes.push(76);
  expect(Math.min(...visibleSizes)).toBeGreaterThan(74);
  expect(Math.max(...visibleSizes) - Math.min(...visibleSizes)).toBeLessThan(2);
  await expect(
    page.locator(".shortcut-notes").locator("svg"),
  ).toHaveCount(1);
  await expect(
    page.locator(".shortcut-resume").locator("img"),
  ).toHaveCount(1);

  const icon = page.getByRole("button", { name: "打开 GitHub" });
  const before = (await icon.boundingBox())!;
  await page.mouse.move(before.x + 40, before.y + 40);
  await page.mouse.down();
  await page.mouse.move(before.x + 210, before.y + 145, { steps: 12 });
  await page.mouse.up();
  await page.mouse.move(1400, 850);
  await page.waitForTimeout(80);
  const moved = (await icon.boundingBox())!;
  expect(moved.x).toBeGreaterThan(before.x + 120);
  expect(moved.y).toBeGreaterThan(before.y + 70);
  await expect(page.locator(".desktop-window:visible")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("leo-desktop-icon-layout-v1") ?? "{}"),
    ),
  ).toHaveProperty("source");

  await page.reload();
  await expect(page.locator(".desktop-boot")).toHaveCount(0);
  const restored = (await icon.boundingBox())!;
  expect(Math.abs(restored.x - moved.x)).toBeLessThan(3);
  expect(Math.abs(restored.y - moved.y)).toBeLessThan(3);

  await page.getByRole("button", { name: "控制中心" }).click();
  await page.getByRole("button", { name: "重置图标布局" }).click();
  const reset = (await icon.boundingBox())!;
  expect(Math.abs(reset.x - before.x)).toBeLessThan(3);
  expect(Math.abs(reset.y - before.y)).toBeLessThan(3);
});
