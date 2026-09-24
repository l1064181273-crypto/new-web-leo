import { describe, expect, it } from "vitest";
import { collectionImageSources } from "./collection-images";
import manifest from "./collection-image-variants.json";
import { media } from "./media";

describe("collection image variants", () => {
  it("covers exactly the current original catalog without restoring removed images", () => {
    expect(Object.keys(manifest).sort()).toEqual(media.map(item => item.file).sort());
    expect(Object.keys(manifest)).not.toContain("daily-1.jpg");
    expect(Object.keys(manifest)).not.toContain("photo-12.jpg");
  });

  it("resolves every derivative and retains the original as the largest candidate", () => {
    for (const item of media) {
      const entry = manifest[item.file as keyof typeof manifest];
      const props = collectionImageSources(item, "atlas-grid");
      const widths = entry.variants.map(variant => variant.width);
      expect(widths).toEqual([...new Set(widths)].sort((a, b) => a - b));
      expect(props.width).toBe(entry.width);
      expect(props.height).toBe(entry.height);
      for (const variant of entry.variants) {
        expect(variant.width).toBeLessThan(entry.width);
        expect(variant.file).not.toMatch(/(^\/|\.\.)/);
        expect(Math.abs(variant.width / variant.height - entry.width / entry.height)).toBeLessThan(.02);
        expect(props.srcSet).toContain(`${variant.width}w`);
      }
      if (entry.variants.length) expect(props.srcSet).toMatch(new RegExp(`${entry.width}w$`));
      expect(props.srcSet ?? props.src).toContain(item.image);
    }
  });

  it("uses smaller sources for small slots but accounts for cover cropping", () => {
    const portrait = media.find(item => item.id === "photo-10.jpg")!;
    const landscape = media.find(item => item.id === "photo-5.jpg")!;
    expect(collectionImageSources(portrait, "ipod").src).toContain("photo-10-160.jpg");
    expect(collectionImageSources(portrait, "ipod").sizes).toBe("46px");
    const landscapeEntry = manifest["photo-5.jpg"];
    const requiredWidth = Math.ceil(Math.max(60, 48 * landscapeEntry.width / landscapeEntry.height));
    expect(collectionImageSources(landscape, "atlas-list").sizes).toBe(`${requiredWidth}px`);
    expect(collectionImageSources(portrait, "atlas-grid").sizes).toContain("max-width: 720px");
  });

  it("falls back safely when a future original has no generated metadata", () => {
    const item = { ...media[0], file: "future-photo.jpg", image: "/future-photo.jpg" };
    expect(collectionImageSources(item, "filmstrip")).toEqual({ src: item.image });
  });
});
