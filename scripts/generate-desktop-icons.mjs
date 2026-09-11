import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const subjects = {
  daily:
    "an elegant ivory travel journal with a tiny coral bookmark and embossed sunrise symbol, on a deep emerald green badge",
  photos:
    "a sculptural brushed silver camera lens with optical cyan and violet glass reflections, on a pale icy blue badge",
  food: "a minimal porcelain rice bowl with two ivory chopsticks and a tiny red accent, on a rich warm coral badge",
  notes:
    "a folded ivory paper notebook and one graphite pencil with a mustard yellow tip, on a sunny soft yellow badge",
  cinema:
    "a premium black and ivory film clapperboard over two layered teal film frames, on a charcoal badge",
  games:
    "three rows of small coral teal and gold arcade bricks floating above a silver paddle and a single pearlescent ball, on a deep teal badge",
  projects:
    "three tidy architectural frosted glass blocks rising like a bar chart, brushed silver bases and tiny cobalt details, on a pale lavender grey badge",
  cats: "a tiny friendly curled white ceramic cat sleeping, sophisticated designer collectible, on a pale sage green badge",
};
const common =
  "Premium macOS desktop app icon, realistic high-end 3D product render, front-facing centered composition, a single rounded square enamel badge filling the entire square image edge to edge, rounded corners, tactile ceramic and glass material, fine beveled edges, gentle studio lighting from top left, subtle ambient occlusion, crisp silhouette readable at 64 pixels, minimalist crafted design, no text, no letters, no watermark, no photography, no extra objects outside badge. ";
const pendingHash =
  "e330cd023298a812503e10a067a3f88e1cbc094f37f6fd2a88fdb6799495b37e";
await mkdir("public/desktop/designed", { recursive: true });
await mkdir("artifacts/interaction-v2/icon-sources", { recursive: true });
for (const name of process.argv.slice(2)) {
  if (!subjects[name]) throw new Error(`Unknown icon ${name}`);
  const destination = `public/desktop/designed/${name}.png`;
  try {
    const current = await readFile(destination);
    if (createHash("sha256").update(current).digest("hex") !== pendingHash) {
      console.log(`${name}: already generated`);
      continue;
    }
  } catch {
    /* New icon. */
  }
  const prompt = common + subjects[name];
  const url = `https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=${encodeURIComponent(prompt)}&image_size=square`;
  const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (!response.headers.get("content-type")?.startsWith("image/")) {
    throw new Error(
      `${name}: expected image, got ${data.toString("utf8").slice(0, 400)}`,
    );
  }
  if (createHash("sha256").update(data).digest("hex") === pendingHash) {
    console.log(`${name}: generation pending`);
    continue;
  }
  await writeFile(destination, data);
  await writeFile(
    `artifacts/interaction-v2/icon-sources/${name}.json`,
    JSON.stringify(
      {
        prompt,
        url,
        bytes: data.length,
        sha256: createHash("sha256").update(data).digest("hex"),
      },
      null,
      2,
    ),
  );
  console.log(`${name}: ${data.length} bytes`);
}
