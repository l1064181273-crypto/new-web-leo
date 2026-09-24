# Collection image derivatives · Studio V2

## Scope and reproduction

The authoritative catalog remains the 45 entries in `src/data/media.ts`. Every original stays byte-identical and is still used by the full-image viewer, download links, and the large Photography / Daybook / Cinema / food feature images. Neither `daily-1.jpg` nor `photo-12.jpg` is restored.

Run on macOS with Node.js, without installing any dependencies:

```sh
node scripts/build-collection-thumbnails.mjs
```

The script uses the built-in `sips` tool (`sips-316` in this run). It generates uncropped, aspect-ratio-preserving widths of 160, 320 and 640 pixels, never upscales, and skips a derivative when it is not at least 5% smaller than its original. The current originals are opaque, so the generated files are quality-90 JPEGs; the pipeline retains PNG for any future original with an alpha channel. This is image resizing, not AI image generation.

Outputs:

- 122 assets under `src/assets/collection-thumbs/`.
- Intrinsic dimensions and candidate widths in `src/data/collection-image-variants.json`.
- Original and derivative bytes, dimensions, formats and SHA-256 hashes in `artifacts/asset-optimization-studio-v2/collection-thumbnails.json` (local evidence, Git-ignored).

## File-size evidence

| Candidate requirement across all 45 images | Bytes | Reduction versus all originals |
| --- | ---: | ---: |
| Original files | 14,744,768 | — |
| At least 160px wide, otherwise original | 630,248 | 95.73% |
| At least 320px wide, otherwise original | 1,965,942 | 86.67% |
| At least 640px wide, otherwise original | 5,985,394 | 59.41% |

Each row chooses the smallest generated file meeting the requested width; where no candidate meets it, the original is counted. These are file-level comparisons, **not** measured page-load savings, LCP, or all-initial-network totals. Actual transfer depends on the viewport, device pixel ratio, browser cache, scrolling, and selected collection. The originals plus all generated sizes remain in the deployment: derivatives add 7,644,589 bytes of files, but `srcset` selects a candidate instead of fetching every size.

For example, the iPod's `photo-10.jpg` cover is 131,215 bytes as an original and 9,611 / 29,171 / 75,883 bytes at 160 / 320 / 640 pixels. Taylor Swift's opaque 1200px PNG is 918,302 bytes; its 320px JPEG is 25,323 bytes.

## Runtime integration

`collectionImageSources` uses the generated manifest and Vite asset URLs. `CollectionThumbnail` applies the candidate list to Atlas grids/lists/category navigation, the Photography filmstrip, the Cinema shelf, the iPod and the background-clip cover. Small crops account for both slot edges, so a wide source is not chosen solely from the visible slot width. The grid advertises a responsive mobile slot and a conservative desktop slot. Original dimensions reserve intrinsic space; existing CSS still controls the displayed crop.

All source sets include the original as the largest candidate. If metadata or a built derivative is missing, the original remains available. If a candidate fails at runtime, the component removes the source set and retries the original once; a broken original does not create a retry loop. Large-image viewers and download anchors do not use the thumbnail URLs.

The eager glob resolves asset URLs; it does not itself load every image in the browser. No new service worker or prefetch-all behavior was introduced.

## Verification

- Generated files visually inspected at representative sizes: detailed architecture, portrait/grass, smooth sky, barbecue, a film poster and an artist portrait.
- A repeat generation produced identical manifest content, original hashes, derivative hashes and evidence report.
- A separate production Vite output contains all 45 original hashes and all 122 derivative hashes; no shared `dist` was overwritten for this check.
- Tests verify exact catalog coverage, removed-image absence, dimensions/aspect ratio, ordered candidate widths, crop sizing, original fallback, thumbnail failure behavior, and original-only viewer/download links.
- Related collections/music suite: 43 passing tests across six files; targeted ESLint and app/node TypeScript checks pass.
- Browser layout, high-DPR candidate selection and actual playback remain the main agent's acceptance work. Unit tests and file-size counts do not establish those results.
