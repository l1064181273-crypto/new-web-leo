/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const config = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8")) as {
  rewrites: { source: string; destination: string }[];
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const legacyPaths = [
  "/photos",
  "/friend",
  "/daily",
  "/study",
  "/photography",
  "/gaming",
  "/music",
  "/film",
  "/food",
];
const staticPaths = [
  "/assets/index-abc123.js",
  "/desktop/wallpaper.jpg",
  "/desktop/about.png",
  "/construction-sandbox.html",
  "/sitemap.xml",
  "/robots.txt",
  "/favicon.ico",
  "/studio-preview-v2.png",
  "/desktop-preview.jpg",
  "/wechat-qr.jpg",
  "/placeholder.svg",
];

function matches(source: string, path: string) {
  if (source === "/((?!assets/).*)") return /^\/((?!assets\/).*)$/.test(path);
  const pattern = source
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace("\\(\\.\\*\\)", "(.*)");
  return new RegExp(`^${pattern}$`).test(path);
}

function cacheControl(path: string) {
  const matchesForPath = config.headers.filter((rule) => matches(rule.source, path));
  return matchesForPath.at(-1)?.headers.find((header) => header.key === "Cache-Control")?.value;
}

describe("vercel routing", () => {
  it("keeps the legacy rewrites and falls back to the SPA after them", () => {
    expect(config.rewrites.slice(0, legacyPaths.length).map((rule) => rule.source)).toEqual(legacyPaths);
    expect(config.rewrites.slice(0, legacyPaths.length).every((rule) => rule.destination === "/index.html")).toBe(true);
    expect(config.rewrites.at(-1)).toEqual({
      source: "/((?!assets/).*)",
      destination: "/index.html",
    });
  });

  it("does not rewrite missing hashed assets to index.html", () => {
    const destination = (path: string) =>
      config.rewrites.find((rule) => matches(rule.source, path))?.destination;
    expect(destination("/abc")).toBe("/index.html");
    expect(destination("/photos")).toBe("/index.html");
    expect(destination("/construction-sandbox.html")).toBe("/index.html");
    expect(destination("/assets/missing-abc123.js")).toBeUndefined();
    expect(destination("/assets/")).toBeUndefined();
  });

  it("caches hashed assets immutably, unhashed images for a week, and revalidates html", () => {
    expect(cacheControl("/assets/index-abc123.js")).toBe("public, max-age=31536000, immutable");
    expect(cacheControl("/desktop/wallpaper.jpg")).toBe("public, max-age=604800, stale-while-revalidate=86400");
    expect(cacheControl("/studio-preview-v2.png")).toBe("public, max-age=604800, stale-while-revalidate=86400");
    expect(cacheControl("/favicon.ico")).toBe("public, max-age=604800, stale-while-revalidate=86400");
    expect(cacheControl("/")).toBe("public, max-age=0, must-revalidate");
    expect(cacheControl("/index.html")).toBe("public, max-age=0, must-revalidate");
    expect(cacheControl("/index.html")).not.toContain("immutable");
    expect(cacheControl("/")).not.toContain("31536000");
  });

  it("does not give the catch-all a cache header that would pin html or static files", () => {
    for (const path of ["/", "/index.html", "/construction-sandbox.html", "/sitemap.xml", "/robots.txt"]) {
      expect(cacheControl(path) ?? "").not.toContain("immutable");
    }
    expect(staticPaths.filter((path) => path.startsWith("/assets/")).length).toBeGreaterThan(0);
  });
});

describe("crawl files", () => {
  const origin = "https://www.lihaonany.me";

  it("publishes absolute www urls and points robots at the sitemap", () => {
    const sitemap = readFileSync(resolve(process.cwd(), "public/sitemap.xml"), "utf8");
    const robots = readFileSync(resolve(process.cwd(), "public/robots.txt"), "utf8");
    const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    expect(locations[0]).toBe(`${origin}/`);
    for (const app of ["profile", "resume", "projects", "photos", "daily", "music", "cinema", "games", "food", "atlas", "notes", "source", "connect", "cats"]) {
      expect(locations).toContain(`${origin}/?app=${app}`);
    }
    for (const path of legacyPaths) expect(locations).toContain(`${origin}${path}`);
    expect(locations.every((location) => location.startsWith(`${origin}/`))).toBe(true);
    expect(locations.some((location) => location.startsWith("https://lihaonany.me/"))).toBe(false);
    expect(robots).toContain(`Sitemap: ${origin}/sitemap.xml`);
  });
});
