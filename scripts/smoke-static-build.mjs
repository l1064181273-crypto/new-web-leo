import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import ts from "typescript";

// Read-only build smoke check. No browser, external network, credentials,
// writes or deployment actions. --preview temporarily serves only loopback.
// Build with Vite's --manifest before running this script.
const root = fileURLToPath(new URL("../", import.meta.url));
const [directory, base = "/", mode] = process.argv.slice(2);
assert(directory, "Usage: node scripts/smoke-static-build.mjs BUILD_DIRECTORY [/base/] [--preview]");
assert(mode === undefined || mode === "--preview", "The only optional mode is --preview.");
assert(base.startsWith("/") && base.endsWith("/") && !base.includes("..") && !base.includes("//"), "Use / or an absolute /subpath/ base.");
const output = path.resolve(directory);
assert(statSync(output).isDirectory(), "Build output must be a directory.");
const origin = "https://static-smoke.invalid";
const manifest = JSON.parse(readFileSync(path.join(output, ".vite/manifest.json"), "utf8"));
const html = readFileSync(path.join(output, "index.html"), "utf8");
const errors = [];
const warnings = [];
const checked = new Set();
const external = new Set();

const hash = file => createHash("sha256").update(readFileSync(file)).digest("hex");
function files(directory, relative = "") {
  return readdirSync(path.join(directory, relative), { withFileTypes: true }).flatMap(entry => {
    const file = path.posix.join(relative, entry.name);
    return entry.isDirectory() ? files(directory, file) : entry.isFile() ? [file] : [];
  });
}
function checkFile(relative, from) {
  const absolute = path.resolve(output, relative);
  if (!absolute.startsWith(`${output}${path.sep}`)) { errors.push(`Out-of-build reference from ${from}: ${relative}`); return; }
  if (!existsSync(absolute) || !statSync(absolute).isFile()) { errors.push(`Missing resource from ${from}: ${relative}`); return; }
  checked.add(relative);
}
function checkUrl(value, owner) {
  if (!value || /^(?:data:|blob:|mailto:|tel:|#)/i.test(value)) return;
  let url;
  try { url = new URL(value, `${origin}${base}${owner}`); }
  catch { errors.push(`Invalid URL from ${owner}: ${value}`); return; }
  if (url.origin !== origin) { external.add(url.origin); return; }
  if (!url.pathname.startsWith(base)) { errors.push(`Escapes deployment base from ${owner}: ${url.pathname}`); return; }
  let relative;
  try { relative = decodeURIComponent(url.pathname.slice(base.length)); }
  catch { errors.push(`Invalid path encoding from ${owner}: ${url.pathname}`); return; }
  checkFile(relative || "index.html", owner);
}

assert(manifest["index.html"]?.isEntry, "Vite manifest has no index.html entry.");
for (const [key, entry] of Object.entries(manifest)) {
  for (const file of [entry.file, ...(entry.css ?? []), ...(entry.assets ?? [])]) checkFile(file, key);
  for (const imported of [...(entry.imports ?? []), ...(entry.dynamicImports ?? [])]) {
    if (!manifest[imported]) errors.push(`Missing manifest import from ${key}: ${imported}`);
  }
}
for (const file of files(output).filter(file => file.endsWith(".css"))) {
  const css = readFileSync(path.join(output, file), "utf8");
  for (const match of css.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/g)) checkUrl(match[2], file);
}
for (const file of files(output).filter(file => file.endsWith(".js"))) {
  const js = readFileSync(path.join(output, file), "utf8");
  // Parse without executing. import.meta.glob leaves /src/... object keys in
  // production; those keys are identities, not URLs sent to the browser.
  const source = ts.createSourceFile(file, js, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const visit = node => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const identityKey = (ts.isPropertyAssignment(node.parent) && node.parent.name === node)
        || (ts.isElementAccessExpression(node.parent) && node.parent.argumentExpression === node);
      if (!identityKey && node.text.startsWith("/") && /\.(?:js|css|jpe?g|png|gif|webp|svg|mp3|woff2?|ico|html)(?:[?#].*)?$/.test(node.text)) checkUrl(node.text, file);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
const page = new JSDOM(html).window;
for (const element of page.document.querySelectorAll("script[src], link[href], img[src]")) checkUrl(element.getAttribute("src") ?? element.getAttribute("href"), "index.html");
const metadata = Object.fromEntries([...page.document.querySelectorAll("meta[property], meta[name]")].map(element => [element.getAttribute("property") ?? element.getAttribute("name"), element.getAttribute("content")]));
for (const name of ["og:image", "twitter:image"]) {
  if (!metadata[name]) errors.push(`Missing sharing metadata: ${name}`);
  else {
    checkUrl(metadata[name], "index.html");
    if (!/^https:\/\//.test(metadata[name])) warnings.push(`${name} needs an absolute HTTPS URL after the final public origin is chosen.`);
  }
}
if (!page.document.querySelector('link[rel="canonical"]')) warnings.push("No canonical URL is set; confirm the final public origin before publishing.");
if (!metadata["og:url"]) warnings.push("No og:url is set; confirm the final public origin before publishing.");
if (html.includes("%BASE_URL%") || html.includes("/src/main.tsx")) errors.push("Untransformed source tokens remain in built index.html.");
page.close();

const publicFiles = files(path.join(root, "public"));
for (const file of publicFiles) {
  checkFile(file, "public/");
  if (existsSync(path.join(output, file)) && hash(path.join(output, file)) !== hash(path.join(root, "public", file))) errors.push(`Public resource changed while copying: ${file}`);
}
const catalog = [...readFileSync(path.join(root, "src/data/media.ts"), "utf8").matchAll(/^\s+\["(?:daily|photos|artists|films|games|food)", "([^"]+)",/gm)].map(match => match[1]);
assert.equal(catalog.length, 45, "Review the expected current catalog if media.ts intentionally changes.");
let verifiedOriginals = 0;
for (const file of catalog) {
  const built = manifest[`src/assets/${file}`]?.file;
  if (!built || !existsSync(path.join(output, built))) errors.push(`Original catalog asset missing: ${file}`);
  else if (hash(path.join(root, "src/assets", file)) !== hash(path.join(output, built))) errors.push(`Original catalog bytes changed: ${file}`);
  else verifiedOriginals++;
}
for (const removed of ["daily-1.jpg", "photo-12.jpg"]) {
  if (manifest[`src/assets/${removed}`]) errors.push(`Removed media restored in build: ${removed}`);
}
const legacyRoutes = [...readFileSync(path.join(root, "src/App.tsx"), "utf8").matchAll(/<Route path="(\/[^\"]+)"/g)].map(match => match[1]);
const hostFallbackRequired = legacyRoutes.filter(route => !existsSync(path.join(output, route.slice(1))));
if (hostFallbackRequired.length) warnings.push("Legacy clean routes require a host SPA fallback; this filesystem audit cannot verify an unchosen hosting provider.");
if (base !== "/") warnings.push("robots.txt is copied under the project base; crawlers consult /robots.txt at the host root, not the project path.");
const previewChecks = [];
if (mode === "--preview") {
  const { preview } = await import("vite");
  const server = await preview({ base, build: { outDir: output }, preview: { host: "127.0.0.1", port: 0, strictPort: true }, logLevel: "warn" });
  try {
    const address = server.httpServer.address();
    assert(address && typeof address !== "string", "Preview did not bind a local TCP port.");
    const local = `http://127.0.0.1:${address.port}${base}`;
    const entry = manifest["index.html"];
    const probes = [
      ["", "text/html"], ["?app=notes", "text/html"], ["photos", "text/html"],
      [entry.file, "text/javascript"], [entry.css[0], "text/css"],
      ["desktop/about.png", "image/png"], ["audio/lofi-ambient.mp3", "audio/mpeg"],
      ["construction-sandbox.html?v=studio-v2", "text/html"], ["robots.txt", "text/plain"],
    ];
    for (const [relative, expectedType] of probes) {
      const response = await fetch(`${local}${relative}`, { method: "HEAD", signal: AbortSignal.timeout(5000) });
      const type = response.headers.get("content-type")?.split(";")[0];
      previewChecks.push({ relative, status: response.status, type });
      if (response.status !== 200 || type !== expectedType) errors.push(`Local preview response mismatch: ${relative} (${response.status}, ${type})`);
    }
    const range = await fetch(`${local}audio/lofi-ambient.mp3`, { headers: { Range: "bytes=0-31" }, signal: AbortSignal.timeout(5000) });
    const bytes = (await range.arrayBuffer()).byteLength;
    previewChecks.push({ relative: "audio/lofi-ambient.mp3 (Range)", status: range.status, bytes });
    if (range.status !== 206 || bytes !== 32) errors.push("Local preview did not serve the requested audio byte range.");
    const missing = await fetch(`${local}assets/missing-static-smoke.js`, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    previewChecks.push({ relative: "assets/missing-static-smoke.js", status: missing.status, type: missing.headers.get("content-type") });
    if (missing.status === 200) warnings.push("Vite preview rewrites missing static files to HTML. A production host should return 404 for missing assets, not apply the page fallback to them.");
  } finally {
    server.httpServer.closeAllConnections?.();
    await new Promise(resolve => server.httpServer.close(resolve));
  }
}
console.log(JSON.stringify({ base, output, checkedResources: checked.size, manifestEntries: Object.keys(manifest).length, publicFiles: publicFiles.length, byteIdenticalCatalogOriginals: verifiedOriginals, externalOriginsInHtmlAndCss: [...external], metadata, hostFallbackRequired, previewChecks, warnings, errors }, null, 2));
if (errors.length) process.exitCode = 1;
