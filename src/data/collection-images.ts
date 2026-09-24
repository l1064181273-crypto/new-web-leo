import manifest from "./collection-image-variants.json";
import type { MediaItem } from "./media";

const assets = import.meta.glob<string>("/src/assets/collection-thumbs/**/*.{jpg,png}", { eager: true, import: "default" });
type ImageVariants = { width: number; height: number; variants: { file: string; width: number; height: number }[] };
const variantsByFile: Record<string, ImageVariants> = manifest;
export type CollectionImageSlot = "atlas-grid" | "atlas-posters" | "atlas-list" | "atlas-guide" | "filmstrip" | "cinema-shelf" | "ipod" | "ambient";

// These are the rendered slots in collections.css/desktop.css, not new crops.
// object-fit: cover needs enough source pixels for both edges of the slot.
// A one-column Atlas can approach 276px before a second 130px column fits.
const slots: Record<CollectionImageSlot, { width: number; ratio: number; responsive?: "grid" | "ambient" }> = {
  "atlas-grid": { width: 276, ratio: 1.25, responsive: "grid" },
  "atlas-posters": { width: 276, ratio: 2 / 3, responsive: "grid" },
  "atlas-list": { width: 60, ratio: 60 / 48 },
  "atlas-guide": { width: 40, ratio: 40 / 45 },
  filmstrip: { width: 61, ratio: 61 / 45 },
  "cinema-shelf": { width: 95, ratio: 95 / 99 },
  ipod: { width: 46, ratio: 46 / 49 },
  ambient: { width: 640, ratio: 640 / 135, responsive: "ambient" },
};

export function collectionImageSources(item: MediaItem, slotName: CollectionImageSlot) {
  const entry = variantsByFile[item.file];
  if (!entry) return { src: item.image };
  const variants = entry.variants.flatMap(variant => {
    const src = assets[`/src/assets/collection-thumbs/${variant.file}`];
    return src ? [{ src, width: variant.width }] : [];
  });
  const slot = slots[slotName];
  const cropScale = Math.max(1, entry.width / entry.height / slot.ratio);
  const pixels = (value: number) => Math.ceil(value * cropScale);
  const sizes = slot.responsive === "grid"
    ? `(max-width: 720px) calc(${50 * cropScale}vw - ${24 * cropScale}px), ${pixels(slot.width)}px`
    : slot.responsive === "ambient"
      ? "(max-width: 720px) calc(100vw - 36px), calc(100vw - 50px)"
      : `${pixels(slot.width)}px`;
  const fallback = slot.responsive === "ambient" ? undefined : variants.find(variant => variant.width >= pixels(slot.width));
  return {
    src: fallback?.src ?? item.image,
    srcSet: variants.length ? [...variants, { src: item.image, width: entry.width }].map(variant => `${variant.src} ${variant.width}w`).join(", ") : undefined,
    sizes: variants.length ? sizes : undefined,
    width: entry.width,
    height: entry.height,
  };
}
