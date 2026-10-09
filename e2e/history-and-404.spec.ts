import { expect, test, type Page } from "@playwright/test";

async function ready(page: Page) {
  await page.goto("/");
  await expect(page.locator(".desktop-boot")).toHaveCount(0);
}

async function openApp(page: Page, name: string) {
  await page.getByRole("button", { name: `打开 ${name}`, exact: true }).first().click();
  await expect(page.getByRole("dialog", { name: `${name} 窗口`, exact: true })).toBeVisible();
}

test("back closes the topmost window and forward reopens it", async ({ page }) => {
  await ready(page);
  await openApp(page, "Profile");
  await expect(page).toHaveURL(/[?&]app=profile(?:&|$)/);
  await expect(page).toHaveTitle("Profile · Haonan Li");
  await page.keyboard.press("Control+k");
  const search = page.getByRole("combobox", { name: "搜索桌面应用" });
  await search.fill("Cinema");
  await search.press("Enter");
  await expect(page).toHaveURL(/[?&]app=cinema(?:&|$)/);
  await expect(page).toHaveTitle("Cinema · Haonan Li");
  const length = await page.evaluate(() => history.length);
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "搜索桌面应用" }).fill("Cinema");
  await page.getByRole("combobox", { name: "搜索桌面应用" }).press("Enter");
  expect(await page.evaluate(() => history.length)).toBe(length);

  await page.goBack();
  await expect(page).toHaveURL(/[?&]app=profile(?:&|$)/);
  await expect(page.getByRole("dialog", { name: "Profile 窗口", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Cinema 窗口", exact: true })).toBeHidden();

  await page.goForward();
  await expect(page).toHaveURL(/[?&]app=cinema(?:&|$)/);
  await expect(page.getByRole("dialog", { name: "Cinema 窗口", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "关闭窗口", exact: true }).click();
  await expect(page).toHaveURL(/[?&]app=profile(?:&|$)/);
  await expect(page.locator(".desktop-window:visible")).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL((url) => !url.searchParams.has("app"));
  await expect(page.locator(".desktop-window:visible")).toHaveCount(0);
  await expect(page).toHaveTitle("Haonan Li · Personal Desktop");

  await page.goForward();
  await expect(page.getByRole("dialog", { name: "Profile 窗口", exact: true })).toBeVisible();
});

test("a deep link stays on the site when its window is closed and keeps other query params", async ({ page }) => {
  await page.goto("/?app=cinema&collection=films");
  await expect(page.locator(".desktop-boot")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Cinema 窗口", exact: true })).toBeVisible();
  const length = await page.evaluate(() => history.length);
  await page.getByRole("button", { name: "关闭窗口", exact: true }).click();
  await expect(page).toHaveURL(/[?&]collection=films(?:&|$)/);
  await expect(page).toHaveURL((url) => !url.searchParams.has("app"));
  expect(await page.evaluate(() => history.length)).toBe(length);
  await expect(page.locator(".leo-desktop")).toBeVisible();
  await expect(page.locator(".desktop-window:visible")).toHaveCount(0);
});

test("mobile home and back gesture leave the app without leaving the site", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Desktop uses the same history path; this checks the fullscreen mobile controls.");
  await ready(page);
  await openApp(page, "Cinema");
  await page.getByRole("button", { name: "回到桌面", exact: true }).click();
  await expect(page).toHaveURL((url) => !url.searchParams.has("app"));
  await expect(page.locator(".desktop-window:visible")).toHaveCount(0);
  await page.goForward();
  await expect(page.getByRole("dialog", { name: "Cinema 窗口", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.locator(".desktop-window:visible")).toHaveCount(0);
  await expect(page.locator(".leo-desktop")).toBeVisible();
});

test("unknown paths render the in-app not found page", async ({ page }) => {
  await page.goto("/abc");
  await expect(page.getByRole("heading", { name: "找不到这个页面" })).toBeVisible();
  await expect(page.getByText("404 · 这个地址不在 Leo 的桌面里。")).toBeVisible();
  await page.getByRole("link", { name: "返回桌面" }).click();
  await expect(page.locator(".desktop-boot")).toHaveCount(0);
  await expect(page.locator(".leo-desktop")).toBeVisible();
});

test("legacy photos and film routes still open their apps", async ({ page }) => {
  await page.goto("/photos");
  await expect(page.locator(".desktop-boot")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Personal Atlas 窗口", exact: true })).toBeVisible();
  await page.goto("/film");
  await expect(page.locator(".desktop-boot")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Cinema 窗口", exact: true })).toBeVisible();
});

test("static crawl and sandbox files are served as themselves", async ({ page }) => {
  const robots = await page.request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(robots.headers()["content-type"] ?? "").toContain("text/plain");
  expect(await robots.text()).toContain("Sitemap: https://www.lihaonany.me/sitemap.xml");

  const sitemap = await page.request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const sitemapBody = await sitemap.text();
  expect(sitemapBody).toContain("https://www.lihaonany.me/?app=cinema");
  expect(sitemapBody).not.toContain("<div id=\"root\">");

  const sandbox = await page.request.get("/construction-sandbox.html");
  expect(sandbox.status()).toBe(200);
  expect(await sandbox.text()).toContain("一座可以慢慢看的微型工地");

  const favicon = await page.request.get("/favicon.ico");
  expect(favicon.status()).toBe(200);
  expect(favicon.headers()["content-type"] ?? "").not.toContain("text/html");
});
