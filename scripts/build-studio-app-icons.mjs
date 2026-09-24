import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Standalone icon candidates only. Does not edit Desktop, old icons or games.
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(path.join(root,"package.json"));
const { buildSync } = require("esbuild");
let sharp;
for (const location of [process.env.STUDIO_ICON_SHARP_MODULE,"sharp",path.join(os.homedir(),".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp")].filter(Boolean)) {
  try { sharp=require(location); break; }
  catch (error) { if (error.code!=="MODULE_NOT_FOUND") throw error; }
}
if (!sharp) throw new Error("Set STUDIO_ICON_SHARP_MODULE to an already-installed Sharp package. No dependencies are installed by this script.");
const artifactDirectory=path.join(root,"artifacts/studio-app-icons");
const names=["studio-little-works","studio-cat-garden"];
const hash=data=>createHash("sha256").update(data).digest("hex");
const existingAssets=["public/desktop","src/assets/optimized"].flatMap(directory=>readdirSync(path.join(root,directory),{withFileTypes:true})
  .filter(entry=>entry.isFile()&&!names.some(name=>entry.name.startsWith(name)))
  .map(entry=>`${directory}/${entry.name}`));
const inputs=[...existingAssets,"src/components/cat-game/PixelCat.tsx"].map(file=>({file,sha256:hash(readFileSync(path.join(root,file)))}));

const defs=(name,top,bottom)=>`<defs>
  <linearGradient id="${name}-base" x1="0" y1="0" x2=".82" y2="1"><stop stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>
  <linearGradient id="${name}-rim" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffffff" stop-opacity=".55"/><stop offset=".45" stop-color="#ffffff" stop-opacity=".12"/><stop offset="1" stop-color="#000000" stop-opacity=".12"/></linearGradient>
  <filter id="${name}-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="9" flood-color="#082a3b" flood-opacity=".3"/></filter>
  <filter id="${name}-object-shadow" x="-25%" y="-20%" width="150%" height="155%"><feDropShadow dx="0" dy="8" stdDeviation="4" flood-color="#0c2636" flood-opacity=".2"/></filter>
  <clipPath id="${name}-clip"><rect x="28" y="22" width="456" height="456" rx="102"/></clipPath>
</defs>`;
const tile=(name)=>`<g filter="url(#${name}-shadow)"><rect x="28" y="22" width="456" height="456" rx="102" fill="url(#${name}-base)"/></g>
  <rect x="30" y="24" width="452" height="452" rx="100" fill="none" stroke="url(#${name}-rim)" stroke-width="3"/>
  <path d="M60 124Q69 52 139 43H368" fill="none" stroke="#ffffff" stroke-opacity=".14" stroke-width="4" stroke-linecap="round"/>`;
const point=(x,y,z=0)=>[274+(x-y)*27,337+(x+y)*13-z*28];
const xy=point=>point.map(value=>Number(value.toFixed(2))).join(",");
const polygon=(points,fill,other="")=>`<polygon points="${points.map(p=>xy(point(...p))).join(" ")}" fill="${fill}" ${other}/>`;
const line=(points,stroke,width=3,other="")=>`<polyline points="${points.map(p=>xy(point(...p))).join(" ")}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" ${other}/>`;
const box=(x,y,z,w,d,h,top,left,right)=>[
  polygon([[x,y+d,z+h],[x+w,y+d,z+h],[x+w,y+d,z],[x,y+d,z]],left),
  polygon([[x+w,y,z+h],[x+w,y+d,z+h],[x+w,y+d,z],[x+w,y,z]],right),
  polygon([[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]],top),
].join("");

function works() {
  let art=box(-4,-2,-.3,8,5,.3,"#abc4d1","#698da4","#7fa3b8");
  art+=polygon([[-3.7,-1.7,.015],[3.7,-1.7,.015],[3.7,2.7,.015],[-3.7,2.7,.015]],"#b9ced6");
  // Three broad floor plates and a few posts stay legible at 66 CSS pixels.
  art+=box(-.22,-1.45,0,3.35,3.05,.16,"#e0e8df","#a3bbc1","#bbcdd0");
  for (let floor=0;floor<3;floor++) {
    const z=.12+floor*1.18;
    for (const x of [.0,1.35,2.68]) {
      for (const y of [-1.25,1.16]) art+=box(x,y,z,.22,.22,1.04,"#f1f4e9","#94b0bd","#c2d3d5");
    }
    art+=box(-.16,-1.4,z+1.02,3.23,2.94,.22,"#edf1e7","#c4d3d2","#d5e1dc");
  }
  const x=-2.9,y=.8,h=6.65;
  art+=box(x-.44,y-.44,0,.88,.88,.25,"#f1ca6b","#b68a39","#d3a346");
  // One continuous brass silhouette; lattice is secondary, never the outline.
  art+=line([[x-.18,y,h],[x-.18,y,.25]],"#b98532",8);
  art+=line([[x+.18,y,h],[x+.18,y,.25]],"#f3cd72",8);
  for(let z=.42;z<h-.2;z+=.91) art+=line([[x-.18,y,z],[x+.18,y,z+.81],[x-.18,y,z+.81]],"#d7ac53",3);
  art+=box(x-.28,y-.26,h-.16,.56,.52,.57,"#f5d382","#ba8b37","#dab054");
  art+=box(-4.28,y-.17,h+.06,8.28,.34,.29,"#f6d683","#d4a13e","#b98930");
  art+=line([[-4.2,y,h+.27],[x,y,h+1.05],[3.92,y,h+.27]],"#dcb459",3.5);
  art+=box(-4.37,y-.3,h-.41,.72,.62,.52,"#b3c8d0","#657f8b","#8caab9");
  art+=line([[3.48,y,h+.08],[3.48,y,3.7]],"#526f7d",3.4);
  art+=line([[3.35,y,3.7],[3.35,y,3.42],[3.64,y,3.36],[3.77,y,3.55]],"#e8b956",5.3);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <title>Little Works app icon</title><desc>A brass crane and a small concrete frame on a mist-blue miniature base.</desc>
    ${defs("works","#547d99","#193d61")}${tile("works")}
    <g clip-path="url(#works-clip)"><ellipse cx="270" cy="374" rx="175" ry="62" fill="#0c2940" opacity=".16"/>
      <g filter="url(#works-object-shadow)">${art}</g>
    </g>
  </svg>`;
}

function renderActualCat() {
  const built=buildSync({stdin:{contents:`
    import { createElement } from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { PixelCat } from "./src/components/cat-game/PixelCat";
    export const svg = renderToStaticMarkup(createElement(PixelCat,{coat:"ginger",size:350,sleeping:false}));
  `,resolveDir:root,sourcefile:"studio-icon-cat.tsx",loader:"tsx"},bundle:true,write:false,platform:"node",format:"cjs",jsx:"automatic",external:["react","react-dom/server","react/jsx-runtime"]});
  const module={exports:{}};
  new Function("require","module","exports",built.outputFiles[0].text)(require,module,module.exports);
  return module.exports.svg;
}

function garden() {
  const cat=renderActualCat();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <title>牧猫庭院 app icon</title><desc>The game's actual orange PixelCat sitting in a green garden.</desc>
    ${defs("garden","#c3d7a3","#73966a")}
    <defs><filter id="cat-lift" x="-20%" y="-20%" width="140%" height="155%">
      <feMorphology in="SourceAlpha" operator="dilate" radius="3" result="outline"/>
      <feFlood flood-color="#5c714c" flood-opacity=".65"/><feComposite in2="outline" operator="in" result="edge"/>
      <feOffset in="SourceAlpha" dy="10"/><feGaussianBlur stdDeviation="5"/><feColorMatrix type="matrix" values="0 0 0 0 .15 0 0 0 0 .28 0 0 0 0 .19 0 0 0 .23 0" result="shadow"/>
      <feMerge><feMergeNode in="shadow"/><feMergeNode in="edge"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter></defs>
    ${tile("garden")}
    <g clip-path="url(#garden-clip)">
      <ellipse cx="256" cy="384" rx="167" ry="51" fill="#526e45" opacity=".16"/>
      <ellipse cx="253" cy="382" rx="157" ry="43" fill="#aec88b"/>
      <path d="M81 348c-12-20-9-42 7-54 13 24 11 41-1 57m8 22c-1-24 12-40 30-42-2 23-12 36-29 42" fill="#6b925e"/>
      <path d="M419 367c-8-24-3-43 15-52 9 23 5 39-10 53m-11 20c-12-20-27-27-43-21 12 18 25 24 43 21" fill="#587d54"/>
      <g transform="translate(81 72)" filter="url(#cat-lift)">${cat}</g>
    </g>
  </svg>`;
}

mkdirSync(artifactDirectory,{recursive:true});
const results=[];
for(const [index,svg] of [works(),garden()].entries()) {
  const name=names[index];
  const svgPath=`public/desktop/${name}.svg`;
  const pngPath=`public/desktop/${name}.png`;
  writeFileSync(path.join(root,svgPath),svg);
  const png=await sharp(Buffer.from(svg)).png({compressionLevel:9}).toBuffer();
  const metadata=await sharp(png).metadata();
  if(metadata.width!==512||metadata.height!==512||!metadata.hasAlpha) throw new Error(`Invalid icon dimensions or alpha: ${name}`);
  writeFileSync(path.join(root,pngPath),png);
  await sharp(png).resize(256,256).png().toFile(path.join(artifactDirectory,`${name}-256.png`));
  await sharp(png).resize(66,66).png().toFile(path.join(artifactDirectory,`${name}-66.png`));
  results.push({name,svg:svgPath,png:pngPath,width:512,height:512,bytes:png.length,sha256:hash(png),embedded:`data:image/png;base64,${png.toString("base64")}`});
}
const wallpaper=await sharp(path.join(root,"public/desktop/wallpaper.jpg")).resize(960,610).jpeg({quality:90}).toBuffer();
const sheet=`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="610" viewBox="0 0 960 610">
  <image href="data:image/jpeg;base64,${wallpaper.toString("base64")}" width="960" height="610"/>
  <rect width="960" height="610" fill="#102e57" opacity=".33"/>
  <g font-family="'Avenir Next', Avenir, sans-serif" fill="#f7faff">
    <text x="48" y="49" font-size="25" font-weight="600">Two little worlds.</text><text x="912" y="47" text-anchor="end" font-size="15">256 px / 66 px</text>
    <image href="${results[0].embedded}" x="128" y="82" width="256" height="256"/>
    <image href="${results[1].embedded}" x="576" y="82" width="256" height="256"/>
    <text x="256" y="380" text-anchor="middle" font-size="26" font-weight="600">Little Works</text>
    <text x="704" y="380" text-anchor="middle" font-family="'Hiragino Sans GB',sans-serif" font-size="26" font-weight="600">牧猫庭院</text>
    <image href="${results[0].embedded}" x="223" y="447" width="66" height="66"/>
    <image href="${results[1].embedded}" x="671" y="447" width="66" height="66"/>
    <text x="256" y="542" text-anchor="middle" font-size="15">66 px · actual-size check</text>
    <text x="704" y="542" text-anchor="middle" font-size="15">66 px · actual-size check</text>
  </g>
</svg>`;
await sharp(Buffer.from(sheet)).png().toFile(path.join(artifactDirectory,"studio-app-icons-comparison.png"));
for(const input of inputs) if(hash(readFileSync(path.join(root,input.file)))!==input.sha256) throw new Error(`Existing input changed: ${input.file}`);
const report={kind:"independent icon candidates; not wired into Desktop",icons:results.map(({embedded,...icon})=>icon),originalInputsUnchanged:true,originalInputs:inputs,renderer:sharp.versions,notes:["Little Works is a new simplified code-drawn crane and concrete frame.","The cat is rendered directly from the existing PixelCat component, with only an external lift/outline filter.","No original asset, component, app metadata, or dependency manifest is modified."]};
writeFileSync(path.join(artifactDirectory,"report.json"),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify({icons:report.icons,originalInputsUnchanged:true},null,2));
