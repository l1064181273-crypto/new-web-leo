import { createHash } from "node:crypto";
import {
  readdir,
  readFile,
  writeFile,
  mkdir,
  copyFile,
  access,
  rename,
} from "node:fs/promises";
import path from "node:path";

const original = "../lhn/src/assets";
const destination = "src/assets";
const report = [];
async function walk(directory, relative = "") {
  for (const entry of await readdir(path.join(directory, relative), {
    withFileTypes: true,
  })) {
    const file = path.join(relative, entry.name);
    if (entry.isDirectory()) await walk(directory, file);
    else if (/\.(png|jpe?g|webp)$/i.test(file)) {
      const source = await readFile(path.join(directory, file));
      const target = path.join(destination, file);
      let current;
      try {
        current = await readFile(target);
      } catch {
        /* Missing assets are copied below. */
      }
      if (current && !source.equals(current))
        throw new Error(`Asset conflict: ${file}`);
      if (!current) {
        await mkdir(path.dirname(target), { recursive: true });
        await copyFile(path.join(directory, file), target);
      }
      report.push({
        file,
        bytes: source.length,
        sha256: createHash("sha256").update(source).digest("hex"),
        status: current ? "identical-reused" : "copied",
      });
    }
  }
}
await walk(original);
await mkdir("artifacts", { recursive: true });
await writeFile(
  "artifacts/media-migration.json",
  JSON.stringify(report, null, 2),
);

// These URLs already belong to the supplied repository; no template code is downloaded.
// The desktop icon URLs used to be read from macxfolioAssets in PortfolioDesk.tsx.
const downloads = {
  wallpaper:
    "https://framerusercontent.com/images/WQXZydZdQpBJUrzYn7dlVOwzAVk.png?width=6016&height=5150",
  neko: "https://webneko.net/lucky/sleep1.gif",
  about:
    "https://framerusercontent.com/images/cJYhDULgupLu6dqAItTs6sT1xE.png?width=2469&height=2469",
  music:
    "https://framerusercontent.com/images/YqNlwVIK7rA6jF6BGN2QuviBMXk.png?width=2478&height=2472",
  resume:
    "https://framerusercontent.com/images/4g2FaJC8YD1UjBtuLdnGpDvQ.png?width=2466&height=2475",
  cats: "https://framerusercontent.com/images/NBs3etFTadPxbSVNjpbB56GouU.png?width=478&height=561",
  source:
    "https://framerusercontent.com/images/PWuUiO2aouvctH4NNK1MNPe9o.png?width=312&height=312",
  local:
    "https://framerusercontent.com/images/xybTQ8M8gQkUOzQ57Horl5riXsc.png?width=736&height=547",
  commerce:
    "https://framerusercontent.com/images/HcRlNxppO9AMHI0KhcKJtc3wvO0.png?width=1199&height=1740",
  ai: "https://framerusercontent.com/images/oPWqkM4Rtq6IW8rAis6I2SC7CfE.png?width=1200&height=1200",
  agriculture:
    "https://framerusercontent.com/images/BL7zv9EGej7d1dYE5rLEhB911pI.png?width=735&height=490",
  build:
    "https://framerusercontent.com/images/uy87JonjAVE23J7z8J81GA0A0U.png?width=750&height=994",
  life: "https://framerusercontent.com/images/JNuFoJNZB5xor0NzSTUqoFLBk.png?width=2478&height=2502",
  dockFinder:
    "https://framerusercontent.com/images/EVSY45U60gTa9UjvovzPTZx7Hw.png?width=180&height=180",
  dockPhotos:
    "https://framerusercontent.com/images/yFESVGBo8X29XNkGZlJPVzWkQgI.png?width=180&height=180",
  dockFinalCut:
    "https://framerusercontent.com/images/qQXlQqG22a2tDAPOZckDUXrENk.png?width=177&height=180",
  dockMail:
    "https://framerusercontent.com/images/ZAH3C8amQUigspCjEG1FJWPjI.png?width=180&height=180",
};
await mkdir("public/desktop", { recursive: true });
for (const [name, url] of Object.entries(downloads)) {
  if (name === "wallpaper") {
    try { await access("public/desktop/wallpaper.jpg"); continue; } catch { /* Original is needed only for the initial conversion. */ }
  }
  const target = `public/desktop/${name}.${name === "neko" ? "gif" : "png"}`;
  try {
    await access(target);
    continue;
  } catch {
    /* Keep existing downloads. */
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (
    !response.ok ||
    !response.headers.get("content-type")?.startsWith("image/")
  )
    throw new Error(`Image download failed: ${name} (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(`${target}.tmp`, bytes);
  await rename(`${target}.tmp`, target);
  console.log(`${name}: ${bytes.length} bytes`);
}
await writeFile(
  "artifacts/desktop-asset-sources.json",
  JSON.stringify(downloads, null, 2),
);
console.log(`Verified ${report.length} original images.`);
