import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Lossless PNG derivatives for 96px @2x desktop icons, plus a high-quality
// JPEG derivative for the 174px @2x portrait. Originals are never overwritten.
// Requires Node.js and macOS's built-in /usr/bin/sips; no npm dependencies.
const root = fileURLToPath(new URL("../", import.meta.url));
const sips = "/usr/bin/sips";
const destination = "src/assets/optimized";
const reportDirectory = "artifacts/asset-optimization-studio-v2";
const iconNames = ["github", "local", "life", "ai", "agriculture", "build"];
const jobs = [
  ...iconNames.map((name) => ({
    source: `src/assets/macos-icons/${name}.png`,
    output: `${destination}/${name}-192.png`,
    sourceFormat: "png",
    format: "png",
    height: 192,
    width: 192,
    alpha: true,
    options: ["--resampleHeightWidth", "192", "192", "-s", "format", "png"],
  })),
  {
    // The original is JPEG data despite its .png extension. Retain its full
    // landscape composition and opaque white background; do not crop or mask.
    source: "src/assets/avatar-3d.png",
    output: `${destination}/avatar-3d-348h.jpg`,
    sourceFormat: "jpeg",
    format: "jpeg",
    height: 348,
    alpha: false,
    options: ["--resampleHeight", "348", "-s", "format", "jpeg", "-s", "formatOptions", "90"],
  },
];

function inspect(relativePath) {
  const absolutePath = path.join(root, relativePath);
  const properties = execFileSync(sips, [
    "-g", "pixelWidth", "-g", "pixelHeight", "-g", "format", "-g", "hasAlpha", absolutePath,
  ], { encoding: "utf8" });
  const property = (name) => properties.match(new RegExp(`^\\s+${name}: (.+)$`, "m"))?.[1];
  const data = readFileSync(absolutePath);
  return {
    file: relativePath,
    width: Number(property("pixelWidth")),
    height: Number(property("pixelHeight")),
    format: property("format"),
    alpha: property("hasAlpha") === "yes",
    bytes: data.length,
    sha256: createHash("sha256").update(data).digest("hex"),
  };
}

if (process.platform !== "darwin") {
  throw new Error("This reproducible image pipeline uses macOS sips. Originals remain untouched.");
}

// Validate every input before producing any output. The only overwrite targets
// are the seven explicitly named generated files in src/assets/optimized.
const originals = jobs.map((job) => {
  const input = inspect(job.source);
  if (input.format !== job.sourceFormat || input.alpha !== job.alpha) {
    throw new Error(`Unexpected input format/transparency: ${job.source}`);
  }
  if (input.height < job.height || (job.width && input.width !== input.height)) {
    throw new Error(`Unexpected input dimensions: ${job.source}`);
  }
  return input;
});

mkdirSync(path.join(root, destination), { recursive: true });
const results = jobs.map((job, index) => {
  execFileSync(sips, [path.join(root, job.source), ...job.options, "--out", path.join(root, job.output)], {
    encoding: "utf8",
  });
  const output = inspect(job.output);
  const sourceAfter = inspect(job.source);
  if (sourceAfter.sha256 !== originals[index].sha256) throw new Error(`Original changed: ${job.source}`);
  if (output.height !== job.height || (job.width && output.width !== job.width)) {
    throw new Error(`Unexpected derivative dimensions: ${job.output}`);
  }
  if (output.format !== job.format || output.alpha !== originals[index].alpha) {
    throw new Error(`Derivative format/transparency mismatch: ${job.output}`);
  }
  if (output.bytes >= originals[index].bytes) throw new Error(`Derivative is not smaller: ${job.output}`);
  return {
    source: originals[index],
    output,
    savedBytes: originals[index].bytes - output.bytes,
    savedPercent: Number(((1 - output.bytes / originals[index].bytes) * 100).toFixed(2)),
  };
});

const sourceBytes = results.reduce((sum, item) => sum + item.source.bytes, 0);
const outputBytes = results.reduce((sum, item) => sum + item.output.bytes, 0);
const report = {
  tool: execFileSync(sips, ["--version"], { encoding: "utf8" }).trim(),
  originalsUnchanged: true,
  sourceBytes,
  outputBytes,
  savedBytes: sourceBytes - outputBytes,
  savedPercent: Number(((1 - outputBytes / sourceBytes) * 100).toFixed(2)),
  files: results,
};
mkdirSync(path.join(root, reportDirectory), { recursive: true });
writeFileSync(path.join(root, reportDirectory, "desktop-derivatives.json"), `${JSON.stringify(report, null, 2)}\n`);
console.table(results.map((item) => ({
  file: item.output.file,
  pixels: `${item.output.width} × ${item.output.height}`,
  originalBytes: item.source.bytes,
  optimizedBytes: item.output.bytes,
  saved: `${item.savedPercent}%`,
  alpha: item.output.alpha,
})));
console.log(`Total: ${sourceBytes} → ${outputBytes} bytes; saved ${report.savedPercent}%. All source SHA-256 hashes unchanged.`);
