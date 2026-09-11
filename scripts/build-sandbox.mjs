import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Script } from "node:vm";

const result = await build({
  entryPoints: ["sandbox/scene.js"],
  bundle: true,
  write: false,
  format: "iife",
  minify: true,
  target: "chrome110",
  alias: { three: "three-r160" },
  legalComments: "inline",
});
const js = result.outputFiles[0].text
  .replace(/<\/script/gi, "<\\/script")
  .replace(/[ \t]+$/gm, "");
const css = await readFile("sandbox/style.css", "utf8");
const template = await readFile("sandbox/index.html", "utf8");
const license = await readFile("node_modules/three-r160/LICENSE", "utf8");
new Script(js);
const html = template.replace("/*__STYLES__*/", () => css).replace("/*__SCRIPT__*/", () => js).replace("</head>", () => `<!-- Three.js r160 MIT license\n${license}\n-->\n</head>`);
new Script(html.split("<script>")[1].split("</script>")[0]);
await mkdir("public", { recursive: true });
await writeFile("public/construction-sandbox.html", html);
await mkdir("artifacts/sandbox-v3", { recursive: true });
await writeFile("artifacts/sandbox-v3/standalone-build.json", JSON.stringify({ bytes: Buffer.byteLength(html), sha256: createHash("sha256").update(html).digest("hex"), revision: "160", externalResources: 0 }, null, 2));
console.log(`Standalone sandbox: ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB, Three.js r160 bundled inline.`);
