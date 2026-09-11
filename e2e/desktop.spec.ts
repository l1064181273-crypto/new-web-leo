import { expect, test, type Page } from "@playwright/test";

async function ready(page: Page, app = "") {
  await page.goto(app ? `/?app=${app}` : "/");
  await expect(page.locator(".desktop-boot")).toHaveCount(0);
}

test("desktop has local artwork, a dock and no overflowing shortcuts", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);
  for (const img of await page
    .locator(".desktop-shortcut:visible img, .desktop-dock img")
    .all()) {
    await expect
      .poll(() =>
        img.evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page.locator(".desktop-shortcut:visible").evaluateAll((elements) =>
      elements.every((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= innerWidth;
      }),
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("desktop.png"),
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("atlas loads all 47 original images and filters each album", async ({
  page,
}, testInfo) => {
  await ready(page, "atlas");
  const atlas = page.getByRole("dialog", {
    name: "Personal Atlas 窗口",
    exact: true,
  });
  await expect(atlas.locator(".media-open")).toHaveCount(47);
  for (const img of await atlas.locator(".media-open img").all()) {
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        img.evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  for (const [name, count] of [
    ["日常点滴", 7],
    ["光影瞬间", 13],
    ["音乐收藏", 7],
    ["电影收藏", 6],
    ["游戏收藏", 4],
    ["舌尖记忆", 10],
  ] as const) {
    await atlas.getByRole("button", { name: new RegExp(name) }).click();
    await expect(atlas.locator(".media-open")).toHaveCount(count);
  }
  await page.screenshot({
    path: testInfo.outputPath("food-album.png"),
    animations: "disabled",
  });
});

test("photography has a focused viewer, favorites and keyboard navigation", async ({ page }) => {
  await ready(page, "photos");
  const photography = page.getByRole("dialog", {
    name: "Photography 窗口",
    exact: true,
  });
  await expect(photography.getByRole("img", { name: "暮色苍山" })).toBeVisible();
  await photography.getByRole("button", { name: "收藏照片" }).click();
  await photography.getByRole("button", { name: "下一张作品" }).click();
  await expect(photography.getByRole("img", { name: "欧式校园" })).toBeVisible();
  await photography.locator(".photo-studio").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(photography.getByRole("img", { name: "暮色苍山" })).toBeVisible();
  await page.reload();
  await expect(photography.getByRole("button", { name: "收藏照片" })).toHaveAttribute("aria-pressed", "true");
});

test("reference overlays keep one app visible and return to the desktop", async ({
  page,
  isMobile,
}) => {
  await ready(page, "atlas");
  let atlas = page.getByRole("dialog", {
    name: "Personal Atlas 窗口",
    exact: true,
  });
  await atlas.getByLabel("搜索照片").fill("苍山");
  await atlas.getByRole("button", { name: "收起窗口", exact: true }).click();
  await expect(atlas).toBeHidden();
  await page
    .getByRole("navigation", { name: "应用程序坞" })
    .getByRole("button", { name: "打开 Profile", exact: true })
    .click();
  if (isMobile)
    await page.getByRole("button", { name: "回到桌面", exact: true }).click();
  await page
    .getByRole("navigation", { name: "应用程序坞" })
    .getByRole("button", { name: "打开 Personal Atlas", exact: true })
    .click();
  atlas = page.getByRole("dialog", {
    name: "Personal Atlas 窗口",
    exact: true,
  });
  await expect(atlas.getByLabel("搜索照片")).toHaveValue("苍山");
  await expect(page.locator(".desktop-window:visible")).toHaveCount(1);
  if (!isMobile) {
    const previous = await atlas.boundingBox();
    await expect(
      atlas.getByRole("button", { name: "最大化窗口", exact: true }),
    ).toHaveCount(0);
    const header = atlas.locator(".window-titlebar");
    const box = (await header.boundingBox())!;
    await page.mouse.move(box.x + 240, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + 285, box.y + 65, { steps: 8 });
    await page.mouse.up();
    expect((await atlas.boundingBox())!.x).toBeGreaterThan(previous!.x + 20);
  }
  await atlas.getByRole("button", { name: "关闭窗口", exact: true }).click();
  await expect(page.locator(".desktop-window:visible")).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "应用程序坞" })
    .getByRole("button", { name: "打开 Profile", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".desktop-window:visible")).toHaveCount(0);
  if (!isMobile) {
    await page
      .getByRole("navigation", { name: "应用程序坞" })
      .getByRole("button", { name: "打开 Profile", exact: true })
      .click();
    await page.mouse.click(20, 400);
    await expect(page.locator(".desktop-window:visible")).toHaveCount(0);
  }
});

test("Music stays opt-in and exposes the verified chart top ten", async ({ page }) => {
  await ready(page, "music");
  const player = page.getByRole("dialog", { name: "Music 窗口", exact: true });
  const audio = player.locator("audio");
  expect(
    await audio.evaluate((element: HTMLAudioElement) => element.paused),
  ).toBe(true);
  await expect(player.locator(".music-library, .track-list")).toHaveCount(0);
  await expect(player.locator(".ipod-screen")).toContainText("Lose Control");
  await player.getByRole("button", { name: "下一首", exact: true }).click();
  await expect(player.locator(".ipod-screen")).toContainText("A Bar Song");
  await player.getByRole("button", { name: "播放音乐", exact: true }).click();
  await expect
    .poll(() =>
      audio.evaluate((element: HTMLAudioElement) => element.currentTime),
    )
    .toBeGreaterThan(0);
  await player.getByRole("button", { name: "暂停音乐", exact: true }).click();
  expect(
    await audio.evaluate((element: HTMLAudioElement) => element.paused),
  ).toBe(true);
  await player.getByRole("button", { name: "下一首", exact: true }).click();
  await expect(player.locator(".ipod-screen")).toContainText("Beautiful Things");
  await player.getByRole("button", { name: "MENU", exact: true }).click();
  await expect(player.locator(".ipod-screen")).toContainText("BILLBOARD 2024");
});

test("notes persist, export, and require confirmation to delete", async ({
  page,
}) => {
  await ready(page, "notes");
  const notes = page.getByRole("dialog", {
    name: "Field Notes 窗口",
    exact: true,
  });
  await notes.getByRole("button", { name: "新建笔记", exact: true }).click();
  await notes.getByLabel("笔记标题").fill("E2E test note");
  await notes.getByLabel("笔记内容").fill("A local-only note.");
  await page.reload();
  await expect(notes.getByLabel("笔记标题")).toHaveValue("E2E test note");
  await expect(notes.getByLabel("笔记内容")).toHaveValue("A local-only note.");
  const downloaded = page.waitForEvent("download");
  await notes.getByRole("button", { name: "导出笔记", exact: true }).click();
  expect((await downloaded).suggestedFilename()).toBe("leo-note.txt");
  await notes.getByRole("button", { name: "删除笔记", exact: true }).click();
  await expect(notes.getByRole("alert")).toBeVisible();
  await notes.getByRole("button", { name: "取消", exact: true }).click();
  await expect(notes.getByLabel("笔记标题")).toHaveValue("E2E test note");
});

test("invalid storage and blocked clipboard are handled", async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    localStorage.setItem("leo-desktop-notes-v1", "{broken json");
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("blocked")) },
    });
  });
  await ready(page, "connect");
  const contact = page.getByRole("dialog", {
    name: "Connect 窗口",
    exact: true,
  });
  await contact.getByRole("button", { name: /查看联系方式/ }).click();
  await contact
    .getByRole("button", { name: "复制微信号", exact: true })
    .click();
  await expect(contact.getByRole("status")).toContainText("复制失败");
  await ready(page, "notes");
  await expect(page.getByLabel("笔记标题")).toHaveValue("保持好奇，持续创造");
});

test("successful clipboard feedback returns to its idle label", async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.resolve() },
    });
  });
  await ready(page, "connect");
  const contact = page.getByRole("dialog", {
    name: "Connect 窗口",
    exact: true,
  });
  await contact.getByRole("button", { name: /查看联系方式/ }).click();
  await contact
    .getByRole("button", { name: "复制微信号", exact: true })
    .click();
  await expect(
    contact.getByRole("button", { name: "已复制", exact: true }),
  ).toBeVisible();
  await expect(
    contact.getByRole("button", { name: "复制微信号", exact: true }),
  ).toBeVisible({ timeout: 3000 });
});

test("search, calendar, settings and legacy routes stay inside the desktop", async ({
  page,
  isMobile,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "搜索应用", exact: true }).click();
  await page
    .getByRole("textbox", { name: "搜索桌面应用", exact: true })
    .fill("Herding");
  await page.getByRole("button", { name: /Herding Cats 应用程序/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Herding Cats 窗口", exact: true }),
  ).toBeVisible();
  if (isMobile)
    await page.getByRole("button", { name: "回到桌面", exact: true }).click();
  else await page.mouse.click(20, 400);
  await page.getByRole("button", { name: "日历", exact: true }).click();
  await expect(page.locator(".calendar-grid .today")).toHaveCount(1);
  await page.getByRole("button", { name: "控制中心", exact: true }).click();
  await page.getByRole("button", { name: "暮色苍山", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "控制中心", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "暮色苍山", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/photography");
  await expect(
    page.getByRole("dialog", { name: "Photography 窗口", exact: true }),
  ).toBeVisible();
  await page.goto("/not-a-page");
  await expect(
    page.getByRole("heading", { name: "找不到这个页面" }),
  ).toBeVisible();
});

test("phone apps are fullscreen and desktop apps leave space for the dock", async ({
  page,
}) => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 768, height: 1024 },
    { width: 1440, height: 700 },
  ]) {
    await page.setViewportSize(viewport);
    await ready(page, "atlas");
    const windowBox = (await page
      .getByRole("dialog", { name: "Personal Atlas 窗口", exact: true })
      .boundingBox())!;
    const dockBox = (await page.locator(".desktop-dock").boundingBox())!;
    expect(windowBox.x).toBeGreaterThanOrEqual(0);
    expect(windowBox.x + windowBox.width).toBeLessThanOrEqual(
      viewport.width + 1,
    );
    if (viewport.width <= 720) {
      expect(windowBox).toMatchObject({
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
      });
      await expect(page.locator(".desktop-dock")).toBeHidden();
    } else
      expect(windowBox.y + windowBox.height).toBeLessThanOrEqual(dockBox.y);
    await page.getByLabel("搜索照片").fill("test-no-match");
    await expect(
      page.getByRole("heading", { name: "没有找到这段记忆" }),
    ).toBeVisible();
  }
});

test("unknown application query values do not crash the desktop", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page, "toString");
  await expect(page.locator(".desktop-window")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Haonan Li · Personal Desktop" }),
  ).toBeAttached();
  expect(errors).toEqual([]);
});
