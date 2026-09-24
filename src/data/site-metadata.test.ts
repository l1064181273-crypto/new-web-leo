/// <reference types="node" />
import { statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import html from "../../index.html?raw";

const productionOrigin = "https://lihaonany.me/";
const previewUrl = `${productionOrigin}studio-preview-v2.png`;
const head = new DOMParser().parseFromString(html, "text/html").head;

describe("production site metadata", () => {
  it("uses one canonical URL and a matching Open Graph URL", () => {
    const canonical = head.querySelectorAll('link[rel="canonical"]');
    const openGraphUrl = head.querySelectorAll('meta[property="og:url"]');
    expect(canonical).toHaveLength(1);
    expect(openGraphUrl).toHaveLength(1);
    expect(canonical[0].getAttribute("href")).toBe(productionOrigin);
    expect(openGraphUrl[0].getAttribute("content")).toBe(productionOrigin);
  });

  it.each(['meta[property="og:image"]', 'meta[name="twitter:image"]'])(
    "provides the absolute production preview URL for %s",
    (selector) => {
      const images = head.querySelectorAll(selector);
      expect(images).toHaveLength(1);
      expect(images[0].getAttribute("content")).toBe(previewUrl);
    },
  );

  it("includes the non-empty preview image in the public build assets", () => {
    const imagePath = resolve(process.cwd(), "public", new URL(previewUrl).pathname.slice(1));
    const imageFile = statSync(imagePath);
    expect(imageFile.isFile()).toBe(true);
    expect(imageFile.size).toBeGreaterThan(0);
  });
});
