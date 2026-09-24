import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Optional historical asset generator; npm ci, dev and build do not invoke it.
// Existing icon assets are committed and need no image service to build.
// Manual use requires an explicitly selected, compatible HTTPS endpoint in
// LEO_ICON_IMAGE_ENDPOINT. Protocol: GET ?prompt=...&image_size=square, with raw
// image bytes in the response. Credentials and query parameters are not accepted
// in the endpoint URL. No default endpoint or service authorization is provided.
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
const requested = process.argv.slice(2);
if (!requested.length) throw new Error("Provide one or more icon names for this optional historical generator.");
for (const name of requested) {
  if (!Object.hasOwn(subjects, name)) throw new Error(`Unknown icon ${name}`);
}
const configuredEndpoint = process.env.LEO_ICON_IMAGE_ENDPOINT;
if (!configuredEndpoint) throw new Error("Optional generator disabled: set LEO_ICON_IMAGE_ENDPOINT to a compatible HTTPS image service before running it.");
let endpoint;
try {
  endpoint = new URL(configuredEndpoint);
} catch {
  throw new Error("LEO_ICON_IMAGE_ENDPOINT must be a valid HTTPS URL.");
}
if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
  throw new Error("LEO_ICON_IMAGE_ENDPOINT must use HTTPS and contain no credentials, query parameters or fragment.");
}
await mkdir("public/desktop/designed", { recursive: true });
await mkdir("artifacts/interaction-v2/icon-sources", { recursive: true });
for (const name of requested) {
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
  const url = new URL(endpoint);
  url.searchParams.set("prompt", prompt);
  url.searchParams.set("image_size", "square");
  const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (!response.headers.get("content-type")?.startsWith("image/")) {
    throw new Error(`${name}: expected an image response; response body omitted.`);
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
        source: "Explicitly configured LEO_ICON_IMAGE_ENDPOINT",
        bytes: data.length,
        sha256: createHash("sha256").update(data).digest("hex"),
      },
      null,
      2,
    ),
  );
  console.log(`${name}: ${data.length} bytes`);
}
