import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// A composed sharing illustration, not a browser screenshot. The original
// wallpaper, avatar, icons and game sources are read-only inputs.
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(path.join(root, "package.json"));
const { buildSync } = require("esbuild");
const sharpLocations = [
  process.env.SHARE_CARD_SHARP_MODULE,
  "sharp",
  path.join(os.homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp"),
].filter(Boolean);
let sharp;
for (const location of sharpLocations) {
  try {
    sharp = require(location);
    break;
  } catch (error) {
    if (error.code !== "MODULE_NOT_FOUND") throw error;
  }
}
if (!sharp) throw new Error("Sharp is required. Set SHARE_CARD_SHARP_MODULE to an installed sharp package; this script does not install dependencies.");

const outputDirectory = path.join(root, "artifacts/share-card-v2");
const sourcePaths = [
  "public/desktop/wallpaper.jpg",
  "src/assets/optimized/avatar-3d-348h.jpg",
  "src/assets/optimized/life-192.png",
  "public/desktop/music.png",
  "src/components/cat-game/GardenBoard.tsx",
  "src/components/cat-game/PixelCat.tsx",
  "src/components/cat-game/engine.ts",
];
const hash = (data) => createHash("sha256").update(data).digest("hex");
const inputHashes = sourcePaths.map((file) => ({ file, sha256: hash(readFileSync(path.join(root, file))) }));
const dataImage = async (file, width, height, fit = "cover") => {
  const buffer = await sharp(path.join(root, file)).resize(width, height, { fit }).png().toBuffer();
  return `data:image/png;base64,${buffer.toString("base64")}`;
};

// Render the actual sunny-porch map through the existing React SVG component.
// Esbuild compiles in memory; there is no browser, network call or game edit.
const gardenBundle = buildSync({
  stdin: {
    contents: `
      import { createElement } from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      import GardenBoard from "./src/components/cat-game/GardenBoard";
      import { createGarden } from "./src/components/cat-game/engine";
      export const svg = renderToStaticMarkup(createElement(GardenBoard, {
        state: createGarden("sunny-porch", "cozy"), route: [], callPulse: 0,
        interactive: false, onTile: () => {},
      }));
    `,
    resolveDir: root,
    sourcefile: "share-card-garden.tsx",
    loader: "tsx",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  jsx: "automatic",
  external: ["react", "react-dom/server", "react/jsx-runtime"],
});
const gardenModule = { exports: {} };
new Function("require", "module", "exports", gardenBundle.outputFiles[0].text)(require, gardenModule, gardenModule.exports);
const gardenSvg = gardenModule.exports.svg
  .replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg" width="528" height="432"');
const gardenImage = `data:image/svg+xml;base64,${Buffer.from(gardenSvg).toString("base64")}`;

// A deliberately simplified, code-drawn interpretation of Little Works.
// Construction motifs match the real sandbox: cranes, slab frame, excavator,
// blue site cabin, stocked materials, workers and a perimeter traffic loop.
const point = (x, y, z = 0) => [281 + (x - y) * 19, 63 + (x + y) * 8.4 - z * 13];
const xy = (p) => p.map((value) => Number(value.toFixed(2))).join(",");
const polygon = (points, fill, other = "") => `<polygon points="${points.map((p) => xy(point(...p))).join(" ")}" fill="${fill}" ${other}/>`;
const line = (points, stroke, width = 1.5, other = "") => `<polyline points="${points.map((p) => xy(point(...p))).join(" ")}" fill="none" stroke="${stroke}" stroke-width="${width}" ${other}/>`;
const box = (x, y, z, w, d, h, top, left, right) => [
  polygon([[x,y,z+h],[x,y+d,z+h],[x,y+d,z],[x,y,z]], left),
  polygon([[x,y+d,z+h],[x+w,y+d,z+h],[x+w,y+d,z],[x,y+d,z]], left),
  polygon([[x+w,y,z+h],[x+w,y+d,z+h],[x+w,y+d,z],[x+w,y,z]], right),
  polygon([[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]], top),
].join("");
const ellipse = (x, y, z, rx, ry, fill) => {
  const [cx, cy] = point(x, y, z);
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
};

function truck(x, y, direction = "x") {
  const swap = (a, b) => direction === "x" ? [a, b] : [b, a];
  const draw = (dx, dy, z, w, d, h, top, left, right) => {
    const [px, py] = swap(dx, dy);
    const [pw, pd] = swap(w, d);
    return box(x+px, y+py, z, pw, pd, h, top, left, right);
  };
  return draw(0,0,.13,1.5,.72,.2,"#3f4d58","#283742","#33434d")
    + draw(0,0,.3,.49,.72,.56,"#f5cf6e","#c09031","#d4a03a")
    + draw(.52,0,.3,.98,.72,.39,"#b89a6d","#ad7d3b","#b98a43")
    + draw(.03,.05,.7,.3,.6,.02,"#7298a9","#7298a9","#7298a9");
}

function crane(x, y, height, length) {
  const ink = "#b58b31";
  let art = box(x-.35,y-.35,0,.7,.7,.22,"#bbb3a0","#948d7f","#a49b88");
  art += line([[x-.12,y,height],[x-.12,y,.25]], ink, 2.4);
  art += line([[x+.12,y,height],[x+.12,y,.25]], "#f0c861", 2.8);
  for (let z=.3; z<height; z+=.6) {
    art += line([[x-.12,y,z],[x+.12,y,z+.55],[x-.12,y,z+.55]], "#c69e47", 1.15);
  }
  art += line([[x-1.1,y,height],[x+length,y,height]], ink, 5);
  art += line([[x-1.1,y,height+.18],[x+length,y,height+.18]], "#f2d16d", 2.5);
  for (let arm=-.95; arm<length; arm+=.5) {
    art += line([[x+arm,y,height-.11],[x+arm+.4,y,height+.24]], "#f7d67e", 1.1);
  }
  art += line([[x-1.1,y,height],[x,y,height+1],[x+length,y,height]], "#cbaa50", 1.4);
  art += line([[x+length-.6,y,height],[x+length-.6,y,1.8]], "#62707b", 1.15);
  art += line([[x+length-.7,y,1.8],[x+length-.7,y,1.56],[x+length-.5,y,1.52]], "#62707b", 1.7);
  art += box(x-1.2,y-.2,height-.32,.6,.4,.33,"#698696","#4f6b7a","#5e7782");
  return art;
}

function constructionScene() {
  let art = '<rect width="590" height="267" fill="#e9edea"/>';
  art += ellipse(6.5,5,-.55,213,68,"#71889623");
  art += box(0,0,-.52,13,10,.52,"#d5cbb0","#9b977e","#a5a288");
  art += polygon([[.25,.25],[12.75,.25],[12.75,9.75],[.25,9.75]],"#697882");
  art += polygon([[1.5,1.5],[11.5,1.5],[11.5,8.5],[1.5,8.5]],"#c8bf9f");
  art += line([[.83,.83,.02],[12.17,.83,.02],[12.17,9.17,.02],[.83,9.17,.02],[.83,.83,.02]],"#e4e2c8",1.5,'stroke-dasharray="8 9"');
  // Foundation bay and soil stockpile.
  art += polygon([[2.2,2.2],[5.4,2.2],[5.4,5.3],[2.2,5.3]],"#948567");
  art += line([[2.2,2.2,.08],[5.4,2.2,.08],[5.4,5.3,.08],[2.2,5.3,.08],[2.2,2.2,.08]],"#7d725c",2);
  for (let index=0; index<15; index++) {
    const x=2.35+(index%4)*.7;
    const y=2.4+Math.floor(index/4)*.7;
    art += box(x,y,.02,.32,.29,(index%3)*.08+.08,"#b29a74","#947f5c","#a18865");
  }
  art += polygon([[6,6.2,0],[6.5,5.9,.7],[7,6.5,.14],[6.55,7.1,0]],"#a99671");
  art += polygon([[6.5,5.9,.7],[7.3,6.4,0],[7,6.5,.14]],"#917c5b");
  // Concrete frame: a real construction motif, not a promise of exact UI.
  art += box(7.3,2,0,3.75,3.45,.18,"#d9dedb","#a7b1ad","#b7c1bc");
  for (let floor=0; floor<3; floor++) {
    const z=.18+floor*.97;
    for (const x of [7.5,9.08,10.62]) {
      for (const y of [2.2,3.6,4.93]) art += box(x,y,z,.16,.16,.88,"#dce3df","#99a8a9","#bac6c2");
    }
    art += box(7.3,2,z+.87,3.75,3.45,.15,"#e4e8e3","#acb9b7","#c1cac5");
  }
  art += line([[7.35,2,3.2],[11.03,2,3.2],[11.03,5.4,3.2]],"#c8a760",1.4);
  // Site cabin with blue cladding and windows.
  art += box(2.15,6.2,0,3.05,1.15,1.05,"#7698a6","#446879","#577e8e");
  for (let x=2.28; x<5.1; x+=.26) art += line([[x,7.35,.12],[x,7.35,.98]],"#7298a8",.65);
  art += box(2.62,7.352,.48,.58,.015,.35,"#c7dbdd","#c7dbdd","#c7dbdd");
  art += box(3.65,7.352,.48,.58,.015,.35,"#c7dbdd","#c7dbdd","#c7dbdd");
  // Stored beams and light office block.
  for (let i=0;i<5;i++) art += box(7.15+i*.27,6.42,0,.13,1.17,.15,"#aa7962","#815746","#986851");
  art += box(9.02,6.77,0,1.85,.86,.77,"#eeeadb","#bebdb0","#cfcec0");
  for (let i=0;i<3;i++) art += box(9.16+i*.48,7.63,.3,.32,.014,.27,"#a8c9d1","#a8c9d1","#a8c9d1");
  // Excavator, delivery trucks and a few tiny workers.
  art += box(3.8,3.28,.07,.92,.74,.17,"#354851","#34434a","#465960");
  art += box(3.86,3.34,.24,.75,.57,.36,"#e8bd55","#ba8e31","#d0a53b");
  art += box(4.02,3.43,.58,.34,.33,.43,"#708c91","#d5aa49","#668088");
  art += line([[4.2,3.42,.65],[3.45,3.42,1.75],[2.94,3.42,.73]],"#d6a53c",5.3);
  art += box(2.85,3.25,.36,.35,.43,.32,"#c39133","#8d6c29","#ad7c2c");
  art += truck(7.7,.42);
  art += truck(11.78,6.35,"y");
  for (const [x,y] of [[5.7,5.8],[10.8,5.7],[5.1,7.85],[8.3,1.65]]) {
    art += ellipse(x,y,.02,2.4,1.25,"#55657044");
    art += line([[x,y,.08],[x,y,.38]],"#537b8e",2.5);
    art += ellipse(x,y,.43,1.7,1.55,"#edc55e");
  }
  art += crane(5.8,2.62,5.65,4.6);
  art += crane(2.4,5.7,3.8,2.6);
  return art;
}

const [wallpaper, avatar, photos, music] = await Promise.all([
  dataImage(sourcePaths[0],1200,630),
  dataImage(sourcePaths[1],152,152),
  dataImage(sourcePaths[2],104,104,"contain"),
  dataImage(sourcePaths[3],104,104,"contain"),
]);
const dots = (x,y) => ["#ec9b96","#edce85","#a7c5ab"].map((fill,index) => `<circle cx="${x+index*15}" cy="${y}" r="4" fill="${fill}"/>`).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <title>Haonan Li — 欢迎来到我的桌面</title>
  <desc>Designed sharing illustration of a personal desktop with Little Works and the actual 牧猫庭院 sunny-porch map. This is not a browser screenshot.</desc>
  <defs>
    <linearGradient id="legibility" x1="0" x2="1"><stop offset="0" stop-color="#082657" stop-opacity=".92"/><stop offset=".42" stop-color="#123875" stop-opacity=".76"/><stop offset="1" stop-color="#1747a6" stop-opacity=".12"/></linearGradient>
    <filter id="window-shadow" x="-30%" y="-30%" width="170%" height="180%"><feDropShadow dx="0" dy="15" stdDeviation="15" flood-color="#062354" flood-opacity=".28"/></filter>
    <filter id="icon-shadow" x="-40%" y="-30%" width="180%" height="180%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#062354" flood-opacity=".3"/></filter>
    <clipPath id="portrait"><circle cx="104" cy="100" r="36"/></clipPath>
    <clipPath id="works-content"><rect x="538" y="111" width="590" height="267"/></clipPath>
    <clipPath id="garden-content"><rect x="815" y="351" width="294" height="241" rx="7"/></clipPath>
  </defs>
  <image href="${wallpaper}" width="1200" height="630"/>
  <rect width="1200" height="630" fill="url(#legibility)"/>
  <g font-family="'Avenir Next', Avenir, sans-serif" fill="#f7faff">
    <circle cx="104" cy="100" r="38" fill="#ffffff"/>
    <image href="${avatar}" x="68" y="64" width="72" height="72" clip-path="url(#portrait)"/>
    <text x="157" y="97" font-size="29" font-weight="600">Haonan Li</text>
    <text x="158" y="123" font-size="14" letter-spacing="2.1" fill="#dae8ff">PERSONAL DESKTOP</text>
    <g font-family="'Hiragino Sans GB', 'Arial Unicode MS', sans-serif" font-weight="600" font-size="65" letter-spacing="-2">
      <text x="63" y="248">欢迎来到</text>
      <text x="63" y="333">我的桌面。</text>
    </g>
    <text x="68" y="391" font-family="'Hiragino Sans GB', 'Arial Unicode MS', sans-serif" font-size="23" fill="#e4edff">风景、音乐，还有可以玩的小想法。</text>
    <g filter="url(#icon-shadow)">
      <image href="${photos}" x="65" y="433" width="61" height="61"/>
      <image href="${music}" x="142" y="433" width="61" height="61"/>
    </g>
    <text x="68" y="562" font-family="'Hiragino Sans GB', 'Arial Unicode MS', sans-serif" font-size="26" fill="#f7faff">随便点点，待一会儿。</text>
  </g>
  <g filter="url(#window-shadow)">
    <rect x="536" y="62" width="594" height="350" rx="17" fill="#f7faff" stroke="#ffffff" stroke-width="2"/>
    ${dots(555,87)}
    <text x="612" y="94" font-family="'Avenir Next', Avenir, sans-serif" font-size="25" font-weight="600" fill="#193b53">Little Works</text>
    <text x="1105" y="92" text-anchor="end" font-family="'Hiragino Sans GB', 'Arial Unicode MS', sans-serif" font-size="15" fill="#557078">工地沙盘</text>
    <g clip-path="url(#works-content)"><g transform="translate(538 111)">${constructionScene()}</g></g>
    <text x="557" y="398" font-family="'Hiragino Sans GB', 'Arial Unicode MS', sans-serif" font-size="18" fill="#3e5d67">看一座小世界，慢慢发生。</text>
  </g>
  <g filter="url(#window-shadow)">
    <rect x="798" y="298" width="328" height="311" rx="17" fill="#f7f8ec" stroke="#ffffff" stroke-width="2"/>
    ${dots(817,324)}
    <text x="963" y="334" text-anchor="middle" font-family="'Hiragino Sans GB', 'Arial Unicode MS', sans-serif" font-size="27" font-weight="600" fill="#325747">牧猫庭院</text>
    <image href="${gardenImage}" x="815" y="351" width="294" height="241" clip-path="url(#garden-content)"/>
  </g>
</svg>`;

mkdirSync(outputDirectory, { recursive: true });
writeFileSync(path.join(outputDirectory, "studio-preview-v2.svg"), svg);
writeFileSync(path.join(outputDirectory, "sunny-porch-source.svg"), gardenSvg);
const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: false }).toBuffer();
const metadata = await sharp(png).metadata();
if (metadata.width !== 1200 || metadata.height !== 630) throw new Error("Invalid sharing-card dimensions.");
// Check the entire background behind both large title lines, including the
// lightest part of the original wallpaper, before drawing any foreground text.
const backgroundSvg = `${svg.slice(0, svg.indexOf('  <g font-family='))}</svg>`;
const titleBackground = await sharp(Buffer.from(backgroundSvg)).extract({left:63,top:184,width:340,height:155}).removeAlpha().raw().toBuffer();
const luminance = (rgb) => rgb.map((channel) => {
  const srgb=channel/255;
  return srgb <= .04045 ? srgb/12.92 : ((srgb+.055)/1.055)**2.4;
}).reduce((value,channel,index) => value+channel*[.2126,.7152,.0722][index],0);
const whiteLuminance = luminance([247,250,255]);
let minimumTitleContrast=Infinity;
for (let index=0;index<titleBackground.length;index+=3) {
  minimumTitleContrast=Math.min(minimumTitleContrast,(whiteLuminance+.05)/(luminance([...titleBackground.subarray(index,index+3)])+.05));
}
if (minimumTitleContrast<4.5) throw new Error(`Title contrast fell below 4.5:1: ${minimumTitleContrast}`);
writeFileSync(path.join(root, "public/studio-preview-v2.png"), png);
await sharp(png).resize(320,168).png().toFile(path.join(outputDirectory,"studio-preview-v2-320.png"));
for (const input of inputHashes) {
  if (hash(readFileSync(path.join(root,input.file))) !== input.sha256) throw new Error(`Read-only source changed: ${input.file}`);
}
const report = {
  kind: "composed illustration, not a browser screenshot",
  output: "public/studio-preview-v2.png",
  width: metadata.width,
  height: metadata.height,
  bytes: png.length,
  sha256: hash(png),
  minimumTitleBackgroundContrast: Number(minimumTitleContrast.toFixed(2)),
  inputsUnchanged: true,
  sourceInputs: inputHashes,
  renderer: sharp.versions,
  typography: { display: "Hiragino Sans GB", latin: "Avenir Next", fallback: "Arial Unicode MS" },
  notes: [
    "Little Works is a simplified code-drawn construction illustration, not an exact application capture.",
    "The garden is rendered from the actual GardenBoard component and sunny-porch cozy initial state.",
    "No AI image generation, network requests, browser automation, or application source changes.",
  ],
};
writeFileSync(path.join(outputDirectory,"report.json"),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify({output:report.output,width:report.width,height:report.height,bytes:report.bytes,sha256:report.sha256,inputsUnchanged:true},null,2));
