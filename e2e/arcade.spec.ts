import { test, expect } from "@playwright/test";

test("desktop icons are non-personal artwork", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".desktop-boot")).toHaveCount(0);
  const sources = await page
    .locator(".desktop-shortcut img")
    .evaluateAll((images) =>
      images.map((image) => (image as HTMLImageElement).src),
    );
  expect(
    sources.every((src) => !/\/(photo-|daily-|game-|food\/|films\/)/.test(src)),
  ).toBe(true);
  const reqs: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("text_to_image")) reqs.push(request.url());
  });
  await page.reload();
  expect(reqs).toEqual([]);
});

test("project navigation matches the single overlay and mobile pager", async ({
  page,
  isMobile,
}) => {
  await page.goto("/?app=projects");
  await expect(page.locator(".desktop-boot")).toHaveCount(0);
  const project = page.getByRole("dialog", {
    name: "Projects 窗口",
    exact: true,
  });
  await expect(project.locator(".os-project-breadcrumb")).toBeHidden();
  if (isMobile) {
    await expect(project.locator(".os-project-sidebar")).toBeHidden();
    await project
      .getByRole("button", { name: "下一个项目", exact: true })
      .click();
    await expect(project.locator(".current-section")).toHaveText("City Lens");
    await project
      .getByRole("button", { name: "上一个项目", exact: true })
      .click();
  } else {
    await project
      .getByRole("button", { name: "City Lens", exact: true })
      .click();
    await expect(project.locator(".current-section")).toHaveText("City Lens");
  }
  await project.getByRole("button", { name: "返回桌面", exact: true }).click();
  await expect(project).toBeHidden();
  await expect(page.locator(".desktop-dock")).toBeVisible();
});

test("Herding Cats matches the reference embed and keyboard controls", async ({
  page,
  isMobile,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?app=games");
  await expect(page.locator(".desktop-boot")).toHaveCount(0);
  const game = page.getByRole("dialog", {
    name: "Herding Cats 窗口",
    exact: true,
  });
  if (isMobile) await expect(game.locator(".window-titlebar")).toBeVisible();
  else await expect(game.locator(".window-titlebar")).toBeHidden();
  const iframe = game.locator('iframe[title="Herding Cats"]');
  await expect(iframe).toHaveAttribute(
    "src",
    "https://herding-cats-ten.vercel.app/",
  );
  const box = (await game.boundingBox())!;
  const viewport = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
  }));
  expect(box.width).toBe(isMobile ? viewport.width : 700);
  expect(box.height).toBe(isMobile ? viewport.height : 560);
  const embedded = page.frame({ url: /herding-cats-ten\.vercel\.app/ });
  expect(embedded).toBeTruthy();
  await expect(embedded!.getByText(/Move:/)).toBeVisible({ timeout: 30000 });
  await expect(embedded!.locator("canvas")).toBeVisible({ timeout: 30000 });
  await iframe.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.screenshot({ path: info.outputPath("herding-cats.png") });
  expect(errors).toEqual([]);
});

test("a throttled opening animation never leaves an invisible window", async ({ page }) => {
  await page.goto("/?app=projects");
  await page.addStyleTag({ content: ".window-inner { animation-delay: 60s !important; animation-fill-mode: backwards !important; animation-play-state: paused !important; }" });
  const project = page.getByRole("dialog", { name: "Projects 窗口", exact: true });
  await expect(project).toHaveCSS("opacity", "1");
  await expect(project.getByRole("button", { name: "回到桌面", exact: true })).toBeVisible();
});
