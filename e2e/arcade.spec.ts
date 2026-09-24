import { test, expect, type Locator } from "@playwright/test";

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

test("Workshop navigation and perspective tabs work inside one window", async ({ page }) => {
  await page.goto("/?app=projects");
  await expect(page.locator(".desktop-boot")).toHaveCount(0);
  const project = page.getByRole("dialog", {
    name: "Projects 窗口",
    exact: true,
  });
  const navigation = project.getByRole("navigation", { name: "创作工作台" });
  await expect(project.locator(".studio-workshop")).toBeVisible();
  await navigation.getByRole("button", { name: "City Lens", exact: true }).click();
  await expect(project.locator(".current-section")).toHaveText("City Lens");
  await expect(navigation.getByRole("button", { name: "City Lens", exact: true })).toHaveAttribute("aria-current", "true");
  const perspectives = project.getByRole("tablist", { name: "三个观察角度" });
  await perspectives.getByRole("tab", { name: "从人的视角", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(perspectives.getByRole("tab", { name: "从时间的视角", exact: true })).toBeFocused();
  await expect(perspectives.getByRole("tab", { name: "从时间的视角", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(project.getByRole("tabpanel", { name: "从时间的视角" })).toContainText("同一个地方，会有几种节奏？");
  await navigation.getByRole("button", { name: "小作品", exact: true }).click();
  await expect(project.locator(".current-section")).toHaveText("小作品");
  await expect(project.getByRole("button", { name: "进入 Little Works 沙盘", exact: true })).toBeVisible();
  await project.getByRole("button", { name: "回到桌面", exact: true }).click();
  await expect(project).toBeHidden();
  await expect(page.locator(".desktop-dock")).toBeVisible();
});

test("Cat Courtyard is local, playable and pauses without closing its window", async ({
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
  await expect(game.locator(".window-titlebar")).toBeVisible();
  await expect(game.locator("iframe")).toHaveCount(0);
  const box = (await game.boundingBox())!;
  const viewport = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
  }));
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  if (isMobile) expect(box).toMatchObject({ x: 0, y: 0, ...viewport });
  await game.getByRole("button", { name: "开始新一局", exact: true }).click();
  const board = game.getByTestId("cat-garden-stage");
  await expect(board).toHaveAttribute("data-player", "2,7");
  await board.focus();
  await page.keyboard.press("ArrowRight");
  await expect(board).toHaveAttribute("data-player", "3,7");
  await page.keyboard.press("Space");
  await game.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(game.getByRole("button", { name: "继续散步", exact: true })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(board).toHaveAttribute("data-player", "3,7");
  await expect(game).toBeVisible();
  await game.getByRole("button", { name: "继续散步", exact: true }).click();
  const moveLeft = game.getByRole("button", { name: "向左走一步", exact: true });
  if (isMobile) await moveLeft.tap();
  else await moveLeft.click();
  await expect(board).toHaveAttribute("data-player", "2,7");
  await page.screenshot({ path: info.outputPath("cat-courtyard.png") });
  expect(errors).toEqual([]);
});

for (const viewport of [
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
]) {
  test(`Cat Courtyard keeps welcome actions and play controls in one window at ${viewport.width}x${viewport.height}`, async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "These regressions cover wide desktop app containers.");
    await page.setViewportSize(viewport);
    await page.goto("/?app=games");
    await expect(page.locator(".desktop-boot")).toHaveCount(0);
    const game = page.getByRole("dialog", {
      name: "Herding Cats 窗口",
      exact: true,
    });
    const content = game.locator(".window-content");
    const app = game.locator(".herding-cats");
    const welcome = game.locator(".cat-overlay-welcome");
    await expect(welcome).toBeVisible();
    await page.evaluate(async () => { await document.fonts.ready; });
    await game.evaluate(async (element) => {
      await Promise.all(element.getAnimations().map((animation) =>
        animation.finished.catch(() => undefined),
      ));
    });

    const expectFullyInsideWindow = async (target: Locator, label: string) => {
      await expect(target, label).toBeVisible();
      // IntersectionObserver checks ancestor clipping without scrolling.
      await expect(target, label).toBeInViewport({ ratio: 1 });
      const box = (await target.boundingBox())!;
      const contentBox = (await content.boundingBox())!;
      const appBox = (await app.boundingBox())!;
      const left = Math.max(0, contentBox.x, appBox.x);
      const top = Math.max(0, contentBox.y, appBox.y);
      const right = Math.min(viewport.width, contentBox.x + contentBox.width, appBox.x + appBox.width);
      const bottom = Math.min(viewport.height, contentBox.y + contentBox.height, appBox.y + appBox.height);
      expect(box.width, `${label}: width`).toBeGreaterThan(0);
      expect(box.height, `${label}: height`).toBeGreaterThan(0);
      expect(box.x, `${label}: left edge`).toBeGreaterThanOrEqual(left - 1);
      expect(box.y, `${label}: top edge`).toBeGreaterThanOrEqual(top - 1);
      expect(box.x + box.width, `${label}: right edge`).toBeLessThanOrEqual(right + 1);
      expect(box.y + box.height, `${label}: bottom edge`).toBeLessThanOrEqual(bottom + 1);
      return box;
    };
    const expectNoScroll = async () => {
      expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual({ x: 0, y: 0 });
      expect(await game.locator(".window-content, .herding-cats, .cat-overlay-content").evaluateAll((elements) =>
        elements.every((element) => element.scrollTop === 0 && element.scrollLeft === 0),
      )).toBe(true);
    };

    const start = game.getByRole("button", { name: "开始新一局", exact: true });
    const chooseGarden = game.getByRole("button", { name: "选择庭院与查看纪录", exact: true });
    await expectFullyInsideWindow(start, "welcome start button");
    await expectFullyInsideWindow(chooseGarden, "welcome garden chooser");
    await expectNoScroll();

    // A physical click at the verified position cannot auto-scroll an offscreen button.
    const startBox = (await start.boundingBox())!;
    await page.mouse.click(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
    await expect(welcome).toHaveCount(0);
    const board = game.getByTestId("cat-garden-stage");
    await expect(board).toHaveAttribute("tabindex", "0");
    const boardBox = await expectFullyInsideWindow(board, "entire garden stage");
    await expectFullyInsideWindow(board.locator(".cat-garden-board"), "entire garden SVG");
    const controlsBox = await expectFullyInsideWindow(game.locator(".cat-game-controls"), "entire controls row");
    expect(controlsBox.y, "controls stay below the board").toBeGreaterThanOrEqual(boardBox.y + boardBox.height - 1);
    for (const name of ["向上走一步", "向左走一步", "向下走一步", "向右走一步", "暂停"]) {
      const button = game.getByRole("button", { name, exact: true });
      await expect(button).toBeEnabled();
      await expectFullyInsideWindow(button, name);
    }
    const call = game.getByRole("button", { name: /回家啦/ });
    await expect(call).toBeEnabled();
    await expectFullyInsideWindow(call, "call cats button");
    await expectNoScroll();
  });
}

test("original Unity game requires opt-in, retains its source and unloads on tab change", async ({ page }) => {
  const originalUrl = "https://herding-cats-ten.vercel.app/";
  const requests: string[] = [];
  // This test checks our integration contract, not the third-party Unity engine.
  await page.route(`${originalUrl}**`, async route => {
    requests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Original game test fixture</title><p>External page fixture</p>" });
  });
  await page.goto("/?app=games");
  await expect(page.locator(".desktop-boot")).toHaveCount(0);
  const game = page.getByRole("dialog", { name: "Herding Cats 窗口", exact: true });
  const tabs = game.getByRole("navigation", { name: "选择猫咪游戏" });
  const iframe = game.locator('iframe[title="原版 Herding Cats Unity 游戏"]');
  await expect(iframe).toHaveCount(0);
  expect(requests).toEqual([]);
  await tabs.getByRole("button", { name: "原版 Herding Cats", exact: true }).click();
  await expect(game.getByRole("link", { name: "打开源站", exact: true })).toHaveAttribute("href", originalUrl);
  await expect(iframe).toHaveCount(0);
  expect(requests).toEqual([]);
  await game.getByRole("button", { name: "载入原版游戏", exact: true }).click();
  await expect(iframe).toHaveAttribute("src", originalUrl);
  await expect(game.locator(".cat-original-footer").getByRole("status")).toHaveText("已连接外部页面；Unity 启动状态请看游戏画面。");
  expect(requests).toEqual([originalUrl]);
  await tabs.getByRole("button", { name: /牧猫庭院/ }).click();
  await expect(iframe).toHaveCount(0);
  await tabs.getByRole("button", { name: "原版 Herding Cats", exact: true }).click();
  await expect(game.getByRole("heading", { name: "原版已停止运行", exact: true })).toBeVisible();
  await expect(game.getByRole("button", { name: "重新载入原版", exact: true })).toBeVisible();
  expect(requests).toEqual([originalUrl]);
});

test("live original Unity game exposes its canvas and keyboard controls", async ({ page }, info) => {
  test.skip(process.env.LEO_E2E_LIVE_ORIGINAL !== "1", "Set LEO_E2E_LIVE_ORIGINAL=1 to explicitly contact the external Unity host.");
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/?app=games");
  await expect(page.locator(".desktop-boot")).toHaveCount(0);
  const game = page.getByRole("dialog", { name: "Herding Cats 窗口", exact: true });
  await game.getByRole("button", { name: "原版 Herding Cats", exact: true }).click();
  await game.getByRole("button", { name: "载入原版游戏", exact: true }).click();
  const iframe = game.locator('iframe[title="原版 Herding Cats Unity 游戏"]');
  await expect(iframe).toHaveAttribute("src", "https://herding-cats-ten.vercel.app/");
  const embedded = page.frameLocator('iframe[title="原版 Herding Cats Unity 游戏"]');
  await expect(embedded.getByText(/Move:/)).toBeVisible({ timeout: 60000 });
  await expect(embedded.locator("canvas")).toBeVisible({ timeout: 60000 });
  await iframe.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.screenshot({ path: info.outputPath("live-original-herding-cats.png") });
  expect(errors).toEqual([]);
});

test("a throttled opening animation never leaves an invisible window", async ({ page }) => {
  await page.goto("/?app=projects");
  await page.addStyleTag({ content: ".window-inner { animation-delay: 60s !important; animation-fill-mode: backwards !important; animation-play-state: paused !important; }" });
  const project = page.getByRole("dialog", { name: "Projects 窗口", exact: true });
  await expect(project).toHaveCSS("opacity", "1");
  await expect(project.getByRole("button", { name: "回到桌面", exact: true })).toBeVisible();
});
