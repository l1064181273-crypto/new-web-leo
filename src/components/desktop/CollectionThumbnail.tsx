import { useState } from "react";
import { collectionImageSources, type CollectionImageSlot } from "@/data/collection-images";
import type { MediaItem } from "@/data/media";

export function CollectionThumbnail({ item, slot, alt = "", lazy = true }: {
  item: MediaItem;
  slot: CollectionImageSlot;
  alt?: string;
  lazy?: boolean;
}) {
  const [fallbackFor, setFallbackFor] = useState<string | null>(null);
  const sources = collectionImageSources(item, slot);
  const useOriginal = fallbackFor === item.image;
  return <img {...sources} src={useOriginal ? item.image : sources.src} srcSet={useOriginal ? undefined : sources.srcSet} sizes={useOriginal ? undefined : sources.sizes} alt={alt} loading={lazy ? "lazy" : "eager"} decoding="async" draggable={false} onError={() => {
    // One original fallback only; a broken original must not cause a retry loop.
    if (!useOriginal && sources.srcSet) setFallbackFor(item.image);
  }} />;
}
