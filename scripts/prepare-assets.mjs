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
import ts from "typescript";

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
const downloads = {
  wallpaper:
    "https://framerusercontent.com/images/WQXZydZdQpBJUrzYn7dlVOwzAVk.png?width=6016&height=5150",
  neko: "https://webneko.net/lucky/sleep1.gif",
};
const source = ts.createSourceFile(
  "PortfolioDesk.tsx",
  await readFile("src/components/PortfolioDesk.tsx", "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
function visit(node) {
  if (
    ts.isVariableDeclaration(node) &&
    node.name.getText(source) === "macxfolioAssets"
  ) {
    const object = ts.isAsExpression(node.initializer)
      ? node.initializer.expression
      : node.initializer;
    for (const property of object.properties)
      downloads[property.name.getText(source)] = property.initializer.text;
  }
  ts.forEachChild(node, visit);
}
visit(source);
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
