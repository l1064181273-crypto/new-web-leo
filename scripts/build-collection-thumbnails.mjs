import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Reproducible local derivatives, not new artwork. macOS sips is built in;
// originals and the authoritative media index are read-only in this pipeline.
const root = fileURLToPath(new URL("../", import.meta.url));
const sips = "/usr/bin/sips";
const widths = [160, 320, 640];
const sourceIndex = readFileSync(path.join(root, "src/data/media.ts"), "utf8");
const files = [...sourceIndex.matchAll(/^\s+\["(?:daily|photos|artists|films|games|food)", "([^"]+)",/gm)].map(match => match[1]);
if (process.platform !== "darwin") throw new Error("This image pipeline requires macOS sips; no files were changed.");
if (!files.length || new Set(files).size !== files.length) throw new Error("The media index is empty or contains duplicate IDs.");
if (files.some(file => file === "daily-1.jpg" || file === "photo-12.jpg" || file.includes("..") || path.isAbsolute(file))) {
  throw new Error("Refusing removed or out-of-scope media paths.");
}

function inspect(file) {
  const properties = execFileSync(sips, ["-g", "pixelWidth", "-g", "pixelHeight", "-g", "format", "-g", "hasAlpha", file], { encoding: "utf8" });
  const property = name => properties.match(new RegExp(`^\\s+${name}: (.+)$`, "m"))?.[1];
  const data = readFileSync(file);
  return {
    width: Number(property("pixelWidth")), height: Number(property("pixelHeight")),
    format: property("format"), alpha: property("hasAlpha") === "yes",
    bytes: data.length, sha256: createHash("sha256").update(data).digest("hex"),
  };
}
const originals = files.map(file => ({ file, ...inspect(path.join(root, "src/assets", file)) }));
const scratch = mkdtempSync(path.join(tmpdir(), "leo-collection-thumbs-"));
const manifest = {};
const report = [];
try {
  for (const original of originals) {
    if (!original.width || !original.height) throw new Error(`Unreadable image dimensions: ${original.file}`);
    const variants = [];
    for (const width of widths) {
      if (width >= original.width) continue; // No upscaling or equal-size recompression.
      const extension = original.alpha ? "png" : "jpg";
      const relative = original.file.replace(/\.[^.]+$/, `-${width}.${extension}`);
      const temporary = path.join(scratch, relative.replaceAll("/", "--"));
      const formatOptions = original.alpha ? ["-s", "format", "png"] : ["-s", "format", "jpeg", "-s", "formatOptions", "90"];
      execFileSync(sips, [path.join(root, "src/assets", original.file), "--resampleWidth", String(width), ...formatOptions, "--out", temporary], { encoding: "utf8" });
      const derivative = inspect(temporary);
      if (derivative.width !== width || derivative.alpha !== original.alpha) throw new Error(`Dimension or alpha mismatch: ${relative}`);
      if (Math.abs(derivative.width / derivative.height - original.width / original.height) > .02) throw new Error(`Aspect ratio changed: ${relative}`);
      // Already-small originals can be more efficient than another encoded file.
      if (derivative.bytes >= original.bytes * .95) continue;
      const destination = path.join(root, "src/assets/collection-thumbs", relative);
      mkdirSync(path.dirname(destination), { recursive: true });
      copyFileSync(temporary, destination);
      variants.push({ file: relative, width: derivative.width, height: derivative.height, bytes: derivative.bytes, sha256: derivative.sha256 });
    }
    if (inspect(path.join(root, "src/assets", original.file)).sha256 !== original.sha256) throw new Error(`Original changed: ${original.file}`);
    manifest[original.file] = { width: original.width, height: original.height, variants: variants.map(({ file, width, height }) => ({ file, width, height })) };
    report.push({ source: original, variants });
  }
  const sourceBytes = originals.reduce((sum, item) => sum + item.bytes, 0);
  const forMinimumWidth = requested => report.reduce((sum, item) => {
    const fitting = item.variants.find(variant => variant.width >= requested);
    return sum + (fitting?.bytes ?? item.source.bytes);
  }, 0);
  const totals = {
    sourceBytes,
    lowerTierBytes: forMinimumWidth(160),
    middleTierBytes: forMinimumWidth(320),
    upperTierBytes: forMinimumWidth(640),
    generatedBytes: report.reduce((sum, item) => sum + item.variants.reduce((total, variant) => total + variant.bytes, 0), 0),
    generatedFiles: report.reduce((sum, item) => sum + item.variants.length, 0),
  };
  writeFileSync(path.join(root, "src/data/collection-image-variants.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const reportDir = path.join(root, "artifacts/asset-optimization-studio-v2");
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(path.join(reportDir, "collection-thumbnails.json"), `${JSON.stringify({ tool: execFileSync(sips, ["--version"], { encoding: "utf8" }).trim(), quality: 90, widths, originalsUnchanged: true, totals, images: report }, null, 2)}\n`);
  console.log(JSON.stringify({ originals: originals.length, ...totals, manifestBytes: statSync(path.join(root, "src/data/collection-image-variants.json")).size }, null, 2));
} finally {
  // This is the newly created scratch directory, never an original asset path.
  rmSync(scratch, { recursive: true });
}
