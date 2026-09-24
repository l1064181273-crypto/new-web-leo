# Desktop image derivatives · Studio V2

This pass touches only seven newly generated assets. Every original image is preserved byte-for-byte. No Desktop/Profile import was changed by this pass, and other photographs were not processed.

## Reproduce

On macOS with Node.js:

```sh
node scripts/build-desktop-derivatives.mjs
```

The script uses the built-in `sips` image tool (`sips-316` for the recorded run), checks input formats and dimensions, generates only the seven explicit output paths below, verifies original SHA-256 hashes, then records metadata in `artifacts/asset-optimization-studio-v2/desktop-derivatives.json`. It installs nothing and does not invoke an image-generation service.

Icons are resized from 512 × 512 to 192 × 192, sufficient for a 96 CSS-pixel icon at device pixel ratio 2. They remain lossless PNGs with alpha channels. The avatar source is actually JPEG-encoded, 1376 × 768, despite its `.png` filename; it has an opaque white background. Its derivative is quality-90 JPEG at 623 × 348, keeping the original aspect ratio and composition. Height 348 preserves a 2× short edge for the current 174px square `object-fit: cover` portrait; resizing the longest edge to 348 would be too small for that crop.

## Import mapping and sizes

| Original import under `@/assets/` | New import under `@/assets/` | Before (bytes) | After (bytes) | Reduction |
| --- | --- | ---: | ---: | ---: |
| `macos-icons/github.png` | `optimized/github-192.png` | 212,414 | 31,370 | 85.23% |
| `macos-icons/local.png` | `optimized/local-192.png` | 175,630 | 40,700 | 76.83% |
| `macos-icons/life.png` | `optimized/life-192.png` | 132,083 | 31,046 | 76.50% |
| `macos-icons/ai.png` | `optimized/ai-192.png` | 126,392 | 29,099 | 76.98% |
| `macos-icons/agriculture.png` | `optimized/agriculture-192.png` | 140,897 | 32,684 | 76.80% |
| `macos-icons/build.png` | `optimized/build-192.png` | 185,122 | 32,900 | 82.23% |
| `avatar-3d.png` | `optimized/avatar-3d-348h.jpg` | 432,007 | 34,428 | 92.03% |
| **Total** | | **1,404,545** | **232,227** | **83.47%** |

The six desktop icons alone fall from 972,538 to 197,799 bytes, saving 774,739 bytes. These are file-size savings, not measured page-load timings; runtime benefit begins only after the main agent switches active imports. The avatar is used by both `StudioProfile.tsx` and `StudioAbout.tsx` (Contact), and the older `ProfileApp.tsx` also still references it.

## Verification

- Read-only dimensions, encoding, and alpha inspection completed before conversion.
- All seven derivative images visually inspected. Artwork, rounded edges, translucent shadows, and portrait composition are retained; no new visual content was generated.
- PNG scanlines decoded for all six icons with Node's built-in zlib: each still contains fully transparent, partially transparent, and opaque pixels. Transparency was not merely represented by an unused alpha channel.
- `node --check scripts/build-desktop-derivatives.mjs` passed.
- A second generation produced identical derivative hashes and an identical report on this machine.
- All seven original SHA-256 hashes were unchanged after both generations.
- Desktop integration and final browser comparison remain with the main agent. For future displays larger than 96px icons / 174px square avatar at 2×, retain the originals or generate an appropriately larger derivative.
