import { expect, test, type Page } from "@playwright/test";

async function ready(page: Page, app = "") {
  await page.goto(app ? `/?app=${app}` : "/");
  await expect(page.locator(".desktop-boot")).toHaveCount(0);
}

async function openNotesList(page: Page) {
  await expect(page.locator(".studio-notes")).toBeVisible();
  const trigger = page.getByRole("button", { name: "打开便签列表", exact: true });
  if (await trigger.isVisible()) await trigger.click();
}

async function selectTestNote(page: Page) {
  await page.getByRole("navigation", { name: "便签列表", exact: true })
    .getByRole("button", { name: /E2E test note/ }).click();
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

test("atlas loads all 45 selected images and filters each album", async ({
  page,
}, testInfo) => {
  await ready(page, "atlas");
  const atlas = page.getByRole("dialog", {
    name: "Personal Atlas 窗口",
    exact: true,
  });
  await expect(atlas.locator(".media-open")).toHaveCount(45);
  await expect(atlas.getByText("和朋友们的出行", { exact: true })).toHaveCount(0);
  await expect(atlas.getByText("听海", { exact: true })).toHaveCount(0);
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
    ["日常点滴", 6],
    ["光影瞬间", 12],
    ["音乐收藏", 7],
    ["电影收藏", 6],
    ["游戏收藏", 4],
    ["舌尖记忆", 10],
  ] as const) {
    await atlas.getByRole("navigation", { name: "相册分类", exact: true })
      .getByRole("button", { name: new RegExp(name) }).click();
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
  await photography.getByRole("button", { name: "收藏照片", exact: true }).click();
  await photography.getByRole("button", { name: "下一张作品" }).click();
  await expect(photography.getByRole("img", { name: "欧式校园" })).toBeVisible();
  await photography.locator(".photo-studio").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(photography.getByRole("img", { name: "暮色苍山" })).toBeVisible();
  await photography.getByRole("button", { name: "放大 暮色苍山", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "暮色苍山", exact: true })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("dialog", { name: "欧式校园", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(photography).toBeVisible();
  await expect(photography.getByRole("button", { name: "放大 暮色苍山", exact: true })).toBeFocused();
  await page.reload();
  await expect(photography.getByRole("button", { name: "取消收藏照片", exact: true })).toHaveAttribute("aria-pressed", "true");
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
  await atlas.getByLabel("搜索收藏").fill("苍山");
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
  await expect(atlas.getByLabel("搜索收藏")).toHaveValue("苍山");
  await expect(page.locator(".desktop-window:visible")).toHaveCount(1);
  if (!isMobile) {
    const original = (await atlas.boundingBox())!;
    await atlas.getByRole("button", { name: "放大窗口", exact: true }).click();
    await expect(atlas.getByRole("button", { name: "还原窗口", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect((await atlas.boundingBox())!.width).toBeGreaterThanOrEqual(original.width);
    await atlas.getByRole("button", { name: "还原窗口", exact: true }).click();
    await expect(atlas.getByRole("button", { name: "放大窗口", exact: true })).toHaveAttribute("aria-pressed", "false");
    await expect.poll(async () => (await atlas.boundingBox())!.width).toBeCloseTo(original.width, 0);
    await expect(atlas.getByLabel("搜索收藏")).toHaveValue("苍山");
    const previous = await atlas.boundingBox();
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

test("Music exposes the chart top ten and plays local audio only on request", async ({ page }) => {
  await ready(page, "music");
  const player = page.getByRole("dialog", { name: "Music 窗口", exact: true });
  const audio = player.locator("audio");
  expect(
    await audio.evaluate((element: HTMLAudioElement) => element.paused),
  ).toBe(true);
  await expect(player.getByRole("list", { name: "试听歌曲列表", exact: true }).getByRole("listitem")).toHaveCount(10);
  await expect(player.getByRole("link", { name: "查看 Billboard 榜单来源", exact: true })).toHaveAttribute("href", /billboard\.com/);
  await expect(player.locator(".ipod-screen")).toContainText("Lose Control");
  await player.getByRole("button", { name: "下一首", exact: true }).click();
  await expect(player.locator(".ipod-screen")).toContainText("A Bar Song");
  await player.getByRole("button", { name: "下一首", exact: true }).click();
  await expect(player.locator(".ipod-screen")).toContainText("Beautiful Things");
  await player.getByRole("button", { name: "MENU", exact: true }).click();
  await expect(player.locator(".ipod-screen")).toContainText("BILLBOARD 2024");
  // Keep functional playback independent of iTunes availability. The local
  // source uses the same player controls and native HTMLAudioElement events.
  await player.getByRole("navigation", { name: "音频来源", exact: true })
    .getByRole("button", { name: "本站背景音", exact: true }).click();
  await expect(player.locator(".ipod-screen")).toContainText("Lofi · 桌面背景音");
  await expect(audio).toHaveAttribute("src", /\/audio\/lofi-ambient\.mp3$/);
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
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
});

test("notes persist, export, restore from trash and confirm permanent deletion", async ({
  page,
}) => {
  await ready(page, "notes");
  const notes = page.getByRole("dialog", {
    name: "Field Notes 窗口",
    exact: true,
  });
  await openNotesList(page);
  await page.getByRole("button", { name: "新建笔记", exact: true }).click();
  await notes.getByLabel("笔记标题").fill("E2E test note");
  await notes.getByLabel("笔记内容").fill("A local-only note.");
  await page.reload();
  await expect(page.locator(".desktop-boot")).toHaveCount(0);
  // Selection is session-local; data persistence is checked after reopening
  // the saved entry, not by assuming it sorts ahead of the pinned welcome note.
  await openNotesList(page);
  await selectTestNote(page);
  await expect(notes.getByLabel("笔记标题")).toHaveValue("E2E test note");
  await expect(notes.getByLabel("笔记内容")).toHaveValue("A local-only note.");
  const downloaded = page.waitForEvent("download");
  await notes.getByRole("button", { name: "导出笔记", exact: true }).click();
  expect((await downloaded).suggestedFilename()).toBe("E2E test note.txt");
  await notes.getByRole("button", { name: "移到最近删除", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await openNotesList(page);
  await page.getByRole("button", { name: "最近删除 · 1", exact: true }).click();
  await selectTestNote(page);
  await expect(notes.getByLabel("笔记标题")).toHaveValue("E2E test note");
  await expect(notes.getByLabel("笔记内容")).toHaveAttribute("readonly", "");
  await notes.getByRole("button", { name: "永久删除这篇便签", exact: true }).click();
  const confirmation = page.getByRole("alertdialog", { name: "永久删除这篇便签？", exact: true });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "取消，保留便签", exact: true }).click();
  await expect(confirmation).toBeHidden();
  await expect(notes.getByLabel("笔记标题")).toHaveValue("E2E test note");
  await notes.getByRole("button", { name: "恢复便签", exact: true }).click();
  await expect(notes.getByLabel("笔记标题")).toHaveValue("E2E test note");
  await expect(notes.getByLabel("笔记内容")).toBeEditable();
  await expect(notes.getByLabel("笔记内容")).toHaveValue("A local-only note.");

  await notes.getByRole("button", { name: "移到最近删除", exact: true }).click();
  await openNotesList(page);
  await page.getByRole("button", { name: "最近删除 · 1", exact: true }).click();
  await selectTestNote(page);
  await notes.getByRole("button", { name: "永久删除这篇便签", exact: true }).click();
  await confirmation.getByRole("button", { name: "确认永久删除 1 篇", exact: true }).click();
  await expect(confirmation).toBeHidden();
  await expect(notes.getByLabel("笔记标题")).toHaveCount(0);
  await expect(notes.getByRole("status").filter({ hasText: "已永久删除 1 篇便签" })).toBeVisible();
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
  await contact
    .getByRole("button", { name: "复制微信号", exact: true })
    .click();
  await expect(contact.getByRole("status")).toHaveText("未能自动复制，请选中下方微信号手动复制。");
  await ready(page, "notes");
  await expect(page.getByLabel("笔记标题")).toHaveValue("给路过这个桌面的人");
  await expect(page.getByRole("button", { name: "导出原始数据", exact: true })).toBeVisible();
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
  await contact
    .getByRole("button", { name: "复制微信号", exact: true })
    .click();
  await expect(
    contact.getByRole("button", { name: "已复制微信号", exact: true }),
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
    .getByRole("combobox", { name: "搜索桌面应用", exact: true })
    .fill("Herding");
  await expect(page.getByRole("option", { name: /Herding Cats/ })).toBeVisible();
  await page.getByRole("combobox", { name: "搜索桌面应用", exact: true }).press("Enter");
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
    await page.getByLabel("搜索收藏").fill("test-no-match");
    await expect(
      page.getByRole("heading", { name: "没有找到相关收藏" }),
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
