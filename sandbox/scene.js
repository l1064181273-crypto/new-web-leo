import * as THREE from "three-r160";
import { OrbitControls } from "three-r160/examples/jsm/controls/OrbitControls.js";
import { lampPositions, loaderPaths, vehiclePose } from "./traffic.js";

const canvas = document.querySelector("#scene");
const errorBox = document.querySelector("#scene-error");
const query = new URLSearchParams(location.search);
const SITE_LAYOUT = {
  previousWidth: 22.5,
  previousDepth: 16.5,
  width: 27.5,
  depth: 20.25,
  fenceHalfX: 13.45,
  fenceHalfZ: 9.75,
};
SITE_LAYOUT.previousArea =
  SITE_LAYOUT.previousWidth *
  SITE_LAYOUT.previousDepth;
SITE_LAYOUT.area =
  SITE_LAYOUT.width *
  SITE_LAYOUT.depth;
SITE_LAYOUT.expansionFactor =
  SITE_LAYOUT.area /
  SITE_LAYOUT.previousArea;
const state = {
  speed: 1,
  paused: false,
  cycle: true,
  time: .5,
  dust: .5,
  rain: false,
  camera: "overview",
  buildMode: "auto",
  manualBuild: .08,
  buildProgress: 0,
  buildPhase: "基坑与测量",
  resetTransition: 0,
  externalPause: false,
};
const metrics = {
  revision: THREE.REVISION,
  fps: 0,
  calls: 0,
  triangles: 0,
  instances: 0,
  vehicles: [],
  knobs: [],
  zones: [],
  clearanceViolations: 0,
  frame: 0,
  site: { ...SITE_LAYOUT },
};
Object.defineProperty(window, "__sandboxMetrics", { get: () => ({ ...metrics, settings: { ...state } }) });
const clamp01 = value => Math.max(0, Math.min(1, value));
const smooth01 = value => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const resetActivityGate = () =>
  1 -
  smooth01(
    state.resetTransition / .28,
  );
function shuttleCycle(time, period, offset = 0) {
  const phase = ((((time + offset) % period) + period) % period) / period;
  if (phase < .34)
    return {
      position: smooth01(phase / .34),
      direction: 1,
      moving: true,
      atTarget: false,
    };
  if (phase < .54)
    return {
      position: 1,
      direction: 1,
      moving: false,
      atTarget: true,
    };
  if (phase < .88)
    return {
      position: 1 - smooth01((phase - .54) / .34),
      direction: -1,
      moving: true,
      atTarget: false,
    };
  return {
    position: 0,
    direction: -1,
    moving: false,
    atTarget: false,
  };
}
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: query.has("capture") });
} catch {
  errorBox.hidden = false;
  errorBox.textContent = "此设备无法启动 WebGL。请使用支持硬件加速的 Chrome 打开沙盘。";
}
if (renderer) initialize();

function initialize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 650 ? 1.3 : 1.6));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#2c3541");
  scene.fog = new THREE.FogExp2("#2c3541", .012);
  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, .1, 160);
  const desktopPosition = new THREE.Vector3(34, 16, 39);
  const mobilePosition = new THREE.Vector3(50, 25, 58);
  const resetCamera = () => {
    camera.position.copy(innerWidth / innerHeight < .75 ? mobilePosition : desktopPosition);
    controls?.target.set(0, 1.1, 0);
  };
  let controls;
  camera.position.copy(desktopPosition);
  controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.1, 0);
  controls.enableDamping = true;
  controls.dampingFactor = .06;
  controls.minDistance = 8;
  controls.maxDistance = 72;
  controls.minPolarAngle = .55;
  controls.maxPolarAngle = Math.PI / 2 - .09;
  controls.enablePan = false;
  controls.autoRotateSpeed = .17;
  resetCamera();
  const cameraViews = {
    street: {
      position: new THREE.Vector3(18, 5.2, 17),
      target: new THREE.Vector3(0, 1.15, 0),
    },
    crane: {
      position: new THREE.Vector3(-18, 12, 18),
      target: new THREE.Vector3(-.8, 3.2, -.7),
    },
    workers: {
      position: new THREE.Vector3(-1.5, 2.3, 10),
      mobilePosition: new THREE.Vector3(-1, 4.8, 17),
      target: new THREE.Vector3(-.5, .45, 2.3),
    },
  };
  let cameraTransition = null;
  function setCameraPreset(name) {
    state.camera = name;
    const view = name === "overview"
      ? {
          position: innerWidth / innerHeight < .75 ? mobilePosition : desktopPosition,
          target: new THREE.Vector3(0, 1.1, 0),
        }
      : cameraViews[name];
    const position =
      innerWidth / innerHeight < .75 && view.mobilePosition
        ? view.mobilePosition
        : view.position;
    cameraTransition = {
      fromPosition: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPosition: position.clone(),
      toTarget: view.target.clone(),
      started: performance.now(),
    };
  }
  let lastInteraction = performance.now();
  controls.addEventListener("start", () => { lastInteraction = performance.now(); cameraTransition = null; controls.autoRotate = false; });
  controls.addEventListener("end", () => { lastInteraction = performance.now(); });

  const hemi = new THREE.HemisphereLight("#d5edff", "#6b4935", 2.3);
  const sun = new THREE.DirectionalLight("#fff3d6", 3.7);
  sun.position.set(-10, 23, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 20, bottom: -20, near: 1, far: 70 });
  sun.shadow.normalBias = .06;
  sun.shadow.bias = -.0002;
  sun.target.position.set(0, 0, 0);
  scene.add(hemi, sun, sun.target);
  const fill = new THREE.DirectionalLight("#a7c7ee", 1.2);
  fill.position.set(12, 8, -15);
  const moon = new THREE.DirectionalLight("#7da9e8", .4);
  moon.position.set(10, 15, -12);
  scene.add(fill, moon);
  const lightingStops = [
    { at: 0, name: "夜晚", sky: "#081326", fog: "#0d1a2e", sun: "#7f9fd0", sunPower: .04, hemi: .34, fill: .18, moon: 1.15, lamps: 1, exposure: .9 },
    { at: .25, name: "黎明", sky: "#b36a73", fog: "#8a6470", sun: "#ffad6f", sunPower: 2.15, hemi: 1.05, fill: .42, moon: .15, lamps: .42, exposure: 1.04 },
    { at: .5, name: "正午", sky: "#6f9fbd", fog: "#7798a8", sun: "#fff0d0", sunPower: 4.15, hemi: 2.35, fill: 1.1, moon: 0, lamps: 0, exposure: 1.18 },
    { at: .75, name: "黄昏", sky: "#884b61", fog: "#69465b", sun: "#ff8552", sunPower: 1.7, hemi: .78, fill: .32, moon: .32, lamps: .72, exposure: 1 },
    { at: 1, name: "夜晚", sky: "#081326", fog: "#0d1a2e", sun: "#7f9fd0", sunPower: .04, hemi: .34, fill: .18, moon: 1.15, lamps: 1, exposure: .9 },
  ].map(stop => ({
    ...stop,
    sky: new THREE.Color(stop.sky),
    fog: new THREE.Color(stop.fog),
    sun: new THREE.Color(stop.sun),
  }));
  const lightingSky = new THREE.Color();
  const lightingFog = new THREE.Color();
  const lightingSun = new THREE.Color();
  function sampleLighting(value) {
    const t = ((value % 1) + 1) % 1;
    let index = 0;
    while (index < lightingStops.length - 2 && t > lightingStops[index + 1].at) index++;
    const from = lightingStops[index], to = lightingStops[index + 1];
    const mix = smooth01((t - from.at) / (to.at - from.at));
    return { from, to, mix };
  }
  const baseGeometry = new THREE.BoxGeometry(1, 1, 1);
  const surfaceCanvas = document.createElement("canvas");
  surfaceCanvas.width = surfaceCanvas.height = 64;
  const surfaceContext = surfaceCanvas.getContext("2d");
  const surfacePixels = surfaceContext.createImageData(64, 64);
  for (let i = 0; i < surfacePixels.data.length; i += 4) {
    const grain = 170 + ((i * 17 + Math.floor(i / 64) * 31) % 72);
    surfacePixels.data[i] = grain;
    surfacePixels.data[i + 1] = grain;
    surfacePixels.data[i + 2] = grain;
    surfacePixels.data[i + 3] = 255;
  }
  surfaceContext.putImageData(surfacePixels, 0, 0);
  const surfaceTexture = new THREE.CanvasTexture(surfaceCanvas);
  surfaceTexture.wrapS = surfaceTexture.wrapT = THREE.RepeatWrapping;
  surfaceTexture.repeat.set(2, 2);
  const roughMaterial = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    roughness: .82,
    roughnessMap: surfaceTexture,
    bumpMap: surfaceTexture,
    bumpScale: .018,
    metalness: .04,
  });
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 64;
  const shadowContext = shadowCanvas.getContext("2d");
  const shadowGradient = shadowContext.createRadialGradient(32, 32, 3, 32, 32, 30);
  shadowGradient.addColorStop(0, "rgba(4,10,14,.46)");
  shadowGradient.addColorStop(.58, "rgba(4,10,14,.23)");
  shadowGradient.addColorStop(1, "rgba(4,10,14,0)");
  shadowContext.fillStyle = shadowGradient;
  shadowContext.fillRect(0, 0, 64, 64);
  const contactShadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const contactShadowGeometry = new THREE.PlaneGeometry(1, 1);
  const contactShadowMaterial = new THREE.MeshBasicMaterial({
    map: contactShadowTexture,
    transparent: true,
    opacity: .72,
    depthWrite: false,
    toneMapped: false,
  });
  function contactShadow(parent, width, depth, y) {
    const shadow = new THREE.Mesh(contactShadowGeometry, contactShadowMaterial);
    shadow.position.y = y;
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(width, depth, 1);
    shadow.renderOrder = 1;
    parent.add(shadow);
  }
  const cubeMatrix = new THREE.Object3D();
  const tmpColor = new THREE.Color();
  const dynamic = [];

  function batch(parent, entries, material = roughMaterial, shadow = true) {
    if (!entries.length) return null;
    const mesh = new THREE.InstancedMesh(baseGeometry, material, entries.length);
    entries.forEach((e, i) => {
      cubeMatrix.position.set(e.x, e.y, e.z);
      cubeMatrix.scale.set(e.w, e.h, e.d);
      cubeMatrix.rotation.set(e.rx || 0, e.ry || 0, e.rz || 0);
      cubeMatrix.updateMatrix();
      mesh.setMatrixAt(i, cubeMatrix.matrix);
      mesh.setColorAt(i, tmpColor.set(e.c));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    metrics.instances += entries.length;
    return mesh;
  }
  const terrain = [];
  function box(list, x, y, z, w, h, d, c, ry = 0) { list.push({ x, y, z, w, h, d, c, ry }); }
  function localModel(entries) {
    const group = new THREE.Group();
    batch(group, entries);
    return group;
  }
  function meshBox(parent, x, y, z, w, h, d, material) {
    const mesh = new THREE.Mesh(baseGeometry, material);
    mesh.position.set(x, y, z); mesh.scale.set(w, h, d);
    mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function label(text, width, height, { background = "#ecddac", color = "#393d39", font = "bold 42px monospace", border = true } = {}) {
    const element = document.createElement("canvas");
    element.width = 512; element.height = 128;
    const ctx = element.getContext("2d");
    ctx.fillStyle = background; ctx.fillRect(0, 0, 512, 128);
    if (border) { ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.strokeRect(10, 10, 492, 108); }
    ctx.fillStyle = color; ctx.font = font; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 65, 468);
    const texture = new THREE.CanvasTexture(element); texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
    return mesh;
  }
  function sign(text, x, y, z, w = 2, h = .5, ry = 0, background) {
    const plate = label(text, w, h, { background });
    plate.position.set(x, y, z); plate.rotation.y = ry; scene.add(plate);
    return plate;
  }
  function groundSign(text, x, z, width = 3) {
    const plate = label(text, width, .5, { background: "#54595d", color: "#e9dcb6", border: false });
    plate.position.set(x, .033, z); plate.rotation.x = -Math.PI / 2; scene.add(plate);
  }

  // The workbench and construction model have separate elevations and footprints.
  const woodCanvas = document.createElement("canvas"); woodCanvas.width = 512; woodCanvas.height = 512;
  const wood = woodCanvas.getContext("2d"); wood.fillStyle = "#39291f"; wood.fillRect(0, 0, 512, 512);
  let seed = 481;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < 1600; i++) {
    wood.strokeStyle = `rgba(${random() > .5 ? "135,95,58" : "13,12,14"},${.04 + random() * .13})`;
    wood.lineWidth = .4 + random() * 2;
    const y = random() * 512; wood.beginPath(); wood.moveTo(0, y);
    wood.bezierCurveTo(170, y + random() * 16, 340, y - random() * 20, 512, y + random() * 8); wood.stroke();
  }
  const woodTexture = new THREE.CanvasTexture(woodCanvas);
  woodTexture.colorSpace = THREE.SRGBColorSpace; woodTexture.wrapS = woodTexture.wrapT = THREE.RepeatWrapping; woodTexture.repeat.set(2, 3);
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTexture, roughness: .44, metalness: .07 });
  meshBox(scene, 0, -1.28, 0, 36.5, .75, 29, woodMat);
  meshBox(scene, 0, -1.72, 0, 35.6, .14, 28.1, new THREE.MeshStandardMaterial({ color: "#201c1a", roughness: .6 }));
  const room = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: "#262a32", roughness: .9 }));
  room.rotation.x = -Math.PI / 2; room.position.y = -6; room.receiveShadow = true; scene.add(room);
  box(terrain, 0, -.68, 0, SITE_LAYOUT.width, .38, SITE_LAYOUT.depth, "#47515b");
  box(terrain, 0, -.46, 0, 27.1, .15, 19.85, "#b09b69");
  // Four slabs leave a real opening for the excavation; no painted hole or overlapping ground.
  box(terrain, -9.1, -.18, 0, 3.8, .4, 16, "#b8a477");
  box(terrain, 4.6, -.18, 0, 12.8, .4, 16, "#b5a078");
  box(terrain, -4.5, -.18, -5.5, 5.4, .4, 5, "#bba67b");
  box(terrain, -4.5, -.18, 4.7, 5.4, .4, 6.6, "#b09b6e");
  box(terrain, 0, -.18, 8.98, 27.1, .4, 1.85, "#ad9c75");
  box(terrain, 0, -.18, -8.98, 27.1, .4, 1.85, "#b6a37c");
  box(terrain, -12.3, -.18, 0, 2.5, .4, 16.1, "#ae9a70");
  box(terrain, 12.3, -.18, 0, 2.5, .4, 16.1, "#b7a77f");
  box(terrain, -4.5, -.51, -.8, 5.4, .06, 4.4, "#6f5841");
  for (let i = 0; i < 130; i++) {
    box(terrain, -7.05 + random() * 5.1, -.41, -2.86 + random() * 4.08, .19 + random() * .2, .15, .2 + random() * .2, ["#7f6749", "#977753", "#aa8b63"][i % 3]);
  }
  for (let i = 0; i < 27; i++) {
    box(terrain, -7.17 + i * .2, -.2, -2.99, .16, .6, .12, "#8a7255");
    box(terrain, -7.17 + i * .2, -.2, 1.39, .16, .6, .12, "#8a7255");
  }
  for (let i = 0; i < 22; i++) {
    box(terrain, -7.19, -.2, -2.9 + i * .2, .1, .6, .15, "#81664b");
    box(terrain, -1.81, -.2, -2.9 + i * .2, .1, .6, .15, "#81664b");
  }
  const roadMaterial = new THREE.MeshStandardMaterial({ color: "#65696a", roughness: .95, metalness: .03 });
  meshBox(scene, 0, .012, -5.9, 19.5, .025, 2, roadMaterial);
  meshBox(scene, 0, .012, 5.7, 19.5, .025, 2, roadMaterial);
  meshBox(scene, -8.85, .012, -.1, 2.05, .025, 10.2, roadMaterial);
  meshBox(scene, 8.85, .012, -.1, 2.05, .025, 10.2, roadMaterial);
  for (let i = -8; i <= 8; i += 1.2) for (const z of [-5.9, 5.7]) box(terrain, i, .031, z, .55, .009, .055, "#e4d4a8");
  for (let i = -4.8; i < 5; i += 1.2) for (const x of [-8.85, 8.85]) box(terrain, x, .031, i, .055, .009, .55, "#e4d4a8");
  groundSign("SERVICE LOOP  /  KEEP CLEAR", 3.6, 5.7, 4.2);

  const fenceColors = ["#80a8a8", "#e8dbb8", "#8fa1a7"];
  for (let i = 0; i < 54; i++) {
    const x = -13.25 + i * .5;
    for (const z of [-SITE_LAYOUT.fenceHalfZ, SITE_LAYOUT.fenceHalfZ]) {
      if (z > 0 && x > -8.5 && x < -5.5) continue;
      box(terrain, x, .48, z, .47, .94, .09, fenceColors[Math.floor(i / 8) % 3]);
      box(terrain, x, .97, z, .5, .055, .12, "#dfded1");
    }
  }
  for (let i = 0; i < 39; i++) for (const x of [-SITE_LAYOUT.fenceHalfX, SITE_LAYOUT.fenceHalfX]) {
    box(terrain, x, .48, -9.5 + i * .5, .09, .94, .47, fenceColors[Math.floor(i / 8) % 3]);
  }
  for (const x of [-8.6, -5.3]) { box(terrain, x, 1.1, SITE_LAYOUT.fenceHalfZ, .2, 2.2, .2, "#344b57"); }
  box(terrain, -6.95, 2.15, SITE_LAYOUT.fenceHalfZ, 3.5, .42, .22, "#385766");
  sign("LITTLE WORKS  /  SITE 001", -6.95, 2.17, SITE_LAYOUT.fenceHalfZ + .14, 3.2, .31, 0, "#e9c15b");
  sign("HARD HAT AREA", 7.4, .66, SITE_LAYOUT.fenceHalfZ + .07, 2.5, .5, 0, "#e5cb70");

  // In-progress concrete frame, scaffold, rebar, stairs and an active foundation bay.
  const building = new THREE.Group(); building.position.set(4.5, 0, -1.55); scene.add(building);
  const structure = [];
  const buildBox = (x, y, z, w, h, d, c, stage, removeAt = 2, ry = 0, rx = 0, rz = 0) =>
    structure.push({ x, y, z, w, h, d, c, stage, removeAt, ry, rx, rz });
  buildBox(0, .13, 0, 4.6, .22, 4.4, "#acaca1", .14);
  for (let level = 0; level < 3; level++) {
    const y = .35 + level * 1.65;
    const stage = .24 + level * .17;
    for (const x of [-1.8, 0, 1.8]) for (const z of [-1.7, 0, 1.7]) {
      buildBox(x, y + .73, z, .24, 1.45, .24, "#bbbcb3", stage);
      if (level === 2) for (let k = 0; k < 4; k++)
        buildBox(x + (k % 2 ? .065 : -.065), y + 1.66, z + (k > 1 ? .065 : -.065), .035, .45, .035, "#4d4f4c", .72);
    }
    buildBox(0, y + 1.49, 0, 4.5, .15, 4.2, level === 2 ? "#b7bbb5" : "#bec0b6", stage + .11);
    for (const x of [-1.8, 0, 1.8])
      buildBox(x, y + 1.38, 0, .23, .25, 3.6, "#a8aca5", stage + .07);
    for (const z of [-1.7, 0, 1.7])
      buildBox(0, y + 1.38, z, 3.7, .25, .23, "#b6b7ad", stage + .07);
    for (let x = -1.9; x <= 2; x += .4) {
      buildBox(x, y + 1.62, 2.03, .08, .45, .08, "#e7b440", stage + .12, .9);
      buildBox(x, y + 1.88, 2.03, .38, .045, .045, "#d79b31", stage + .12, .9);
    }
  }
  for (let z = -2.2; z <= 2.3; z += .55) {
    for (const x of [-2.45, 2.45]) {
      buildBox(x, 2.7, z, .048, 5.4, .048, "#798b90", .28, .91);
      for (let y = .7; y < 5.2; y += 1.1) {
        const scaffoldStage = .3 + y / 5.2 * .42;
        buildBox(x, y, z, .65, .08, .5, "#b8a782", scaffoldStage, .91);
        buildBox(x, y + .4, z + .23, .038, .86, .038, "#92a3a8", scaffoldStage, .91, 0, .6);
      }
    }
  }
  for (let i = 0; i < 11; i++)
    buildBox(-1.1, .36 + i * .15, -.9 + i * .19, .72, .14, .2, "#a3a59e", .34 + i * .012);
  for (let level = 0; level < 3; level++) {
    const wallY = .95 + level * 1.65;
    const finishStage = .78 + level * .035;
    for (const x of [-1.2, 0, 1.2]) {
      buildBox(x, wallY, -1.78, 1.05, 1.08, .11, "#d7ddda", finishStage);
      buildBox(x, wallY, 1.78, 1.05, .72, .08, "#668f9b", finishStage + .015);
    }
    for (const z of [-1.05, .1, 1.05]) {
      buildBox(-1.88, wallY, z, .11, 1.08, .95, "#d1d8d5", finishStage + .01);
      buildBox(1.88, wallY, z, .11, 1.08, .95, "#d1d8d5", finishStage + .01);
    }
  }
  for (const x of [-1.85, 1.85]) for (const z of [-1.75, 0, 1.75])
    buildBox(x, 5.35, z, .16, .45, .16, "#d8d8ce", .88);
  const buildingMesh = batch(building, structure);
  buildingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const permanentStructureCount = structure.filter(entry => entry.removeAt >= 2).length;
  dynamic.push(() => {
    let visible = 0, permanentVisible = 0;
    structure.forEach((entry, index) => {
      let reveal = smooth01((state.buildProgress - entry.stage) / .055);
      if (entry.removeAt < 2)
        reveal *= 1 - smooth01((state.buildProgress - entry.removeAt) / .045);
      const scale = Math.max(.001, reveal);
      const lateralScale = Math.max(.001, smooth01(reveal * 4));
      cubeMatrix.position.set(entry.x, entry.y - entry.h * (1 - scale) / 2, entry.z);
      cubeMatrix.scale.set(entry.w * lateralScale, entry.h * scale, entry.d * lateralScale);
      cubeMatrix.rotation.set(entry.rx || 0, entry.ry || 0, entry.rz || 0);
      cubeMatrix.updateMatrix();
      buildingMesh.setMatrixAt(index, cubeMatrix.matrix);
      if (reveal > .5) visible++;
      if (entry.removeAt >= 2 && reveal > .5) permanentVisible++;
    });
    buildingMesh.instanceMatrix.needsUpdate = true;
    metrics.building = {
      total: structure.length,
      visible,
      progress: state.buildProgress,
      completion: visible / structure.length,
      permanentVisible,
      permanentTotal: permanentStructureCount,
      permanentCompletion: permanentVisible / permanentStructureCount,
    };
  });
  metrics.zones.push({ name: "building", x: 4.5, z: -1.55, radius: 3.2 });

  // Rebar processing shelter and safely separated material stacks.
  box(terrain, -4.5, .06, 3.4, 4.2, .12, 2.2, "#a89d86");
  for (const x of [-6.5, -2.5]) for (const z of [2.45, 4.35]) box(terrain, x, .95, z, .1, 1.9, .1, "#6a7c7f");
  box(terrain, -4.5, 1.96, 3.4, 4.4, .14, 2.4, "#547e8f");
  for (let i = 0; i < 22; i++) box(terrain, -6.55 + i * .19, 2.045, 3.4, .04, .04, 2.35, "#6896a7");
  box(terrain, -4.6, .42, 3.25, 2.5, .1, .8, "#5f6c6d");
  for (let i = 0; i < 14; i++) box(terrain, -4.5, .54 + (i % 3) * .06, 2.91 + Math.floor(i / 3) * .09, 2.9, .045, .045, "#534d45");
  box(terrain, -2.9, .4, 3.8, .55, .8, .62, "#db9b41");
  for (let stack = 0; stack < 3; stack++) {
    const x = -.85 + stack * 1.2, z = 3.1;
    box(terrain, x, .1, z, .9, .18, 1.5, "#916640");
    for (let y = 0; y < 4; y++) for (let k = 0; k < 3; k++) box(terrain, x + (k - 1) * .24, .3 + y * .17, z, .22, .15, 1.35, ["#bfa78f", "#aaa59a", "#d7c7ab"][stack]);
  }
  for (let i = 0; i < 20; i++) box(terrain, 3.65 + i % 4 * .22, .12 + Math.floor(i / 4) * .11, 3.2, .12, .1, 1.7, "#565451");
  groundSign("REBAR", -4.5, 4.67, 1.5); groundSign("MATERIALS", 1.5, 4.65, 2.6);
  // Offices occupy the rear strip, outside all vehicle swept paths.
  const warmMaterial = new THREE.MeshStandardMaterial({ color: "#acc8d1", emissive: "#ffd786", emissiveIntensity: 0, roughness: .22, metalness: .12 });
  for (let office = 0; office < 2; office++) {
    const x = -1.8 + office * 3.6, z = -4.25;
    box(terrain, x, .77, z, 3.1, 1.48, 1.45, office ? "#dce0d7" : "#86b2ba");
    box(terrain, x, 1.59, z, 3.24, .15, 1.58, "#477083");
    for (let i = 0; i < 20; i++) box(terrain, x - 1.45 + i * .15, .8, z + .735, .028, 1.32, .025, "#b7cccc");
    box(terrain, x - .95, .6, z + .757, .5, 1.1, .035, "#4d6877");
    for (const offset of [.0, .9]) meshBox(scene, x + offset, 1, z + .758, .66, .48, .03, warmMaterial);
    box(terrain, x - .95, .06, z + 1, .72, .1, .4, "#9a9d95");
  }
  sign("SITE OFFICE", -1.3, 1.32, -3.46, 1.55, .21, 0, "#dfebd9");
  // Voxel spoil heaps, with low layers rather than intersecting oversized primitives.
  for (let ix = 0; ix < 11; ix++) for (let iz = 0; iz < 8; iz++) {
    const x = 5.2 + ix * .22, z = 2.4 + iz * .22;
    const height = Math.max(0, 5 - Math.floor(Math.hypot(ix - 5, iz - 4) * .9));
    for (let iy = 0; iy < height; iy++) box(terrain, x, .12 + iy * .2, z, .21, .19, .21, ["#9c7851", "#b48d5a", "#bf9b64", "#806547"][(ix + iy + iz) % 4]);
  }
  groundSign("SPOIL", 6.2, 4.65, 1.7);
  // Barrier rails, flags, service poles and compact work lights.
  for (let i = 0; i < 12; i++) {
    const x = -7 + i * .42;
    box(terrain, x, .33, 1.66, .06, .66, .06, "#e6ac35");
    box(terrain, x, .67, 1.66, .42, .06, .045, i % 2 ? "#444944" : "#e5b343");
  }
  const luminousMaterial = new THREE.MeshBasicMaterial({ color: "#ffe0a1" });
  const lamps = [];
  for (const [x, z] of lampPositions) {
    box(terrain, x, 1.5, z, .065, 3, .065, "#647d89");
    box(terrain, x + .17, 3, z, .4, .07, .08, "#697b7d");
    const head = meshBox(scene, x + .35, 2.95, z, .36, .14, .29, luminousMaterial);
    const light = new THREE.PointLight("#ffce7d", 0, 6, 2);
    light.position.set(x + .35, 2.8, z); scene.add(light);
    lamps.push({ head, light });
  }
  for (let i = 0; i < 44; i++) {
    const x = -12.9 + i * .6;
    box(terrain, x, 1.18 + .07 * Math.sin(i), -9.65, .18, .2, .04, ["#dd704b", "#ecd054", "#6cb5ba"][i % 3]);
  }
  for (const x of [-12.85, 12.85]) {
    box(terrain, x, 2.3, -8.8, .15, 4.6, .15, "#866644");
    box(terrain, x, 4.3, -8.8, 1, .09, .1, "#5b6365");
  }
  for (let i = 0; i < 50; i++) box(terrain, -12.85 + i * .525, 4.2 - Math.sin(i / 49 * Math.PI) * .65, -8.8, .55, .02, .02, "#333a3e");
  batch(scene, terrain);

  const lodDistricts = [];
  function addLodDistrict({
    id,
    position,
    start,
    highEntries,
    lowEntries,
    switchDistance = 30,
  }) {
    const root = new THREE.Group();
    root.position.set(position[0], 0, position[1]);
    scene.add(root);
    const highGroup = new THREE.Group();
    const lowGroup = new THREE.Group();
    root.add(highGroup, lowGroup);
    batch(highGroup, highEntries);
    batch(lowGroup, lowEntries, roughMaterial, false);
    const district = {
      id,
      root,
      highGroup,
      lowGroup,
      highInstances: highEntries.length,
      lowInstances: lowEntries.length,
      start,
      switchDistance,
      detail: "low",
    };
    lodDistricts.push(district);
    dynamic.push(() => {
      const reveal =
        smooth01(
          (state.buildProgress - start) / .12,
        ) *
        resetActivityGate();
      const distance = camera.position.distanceTo(root.position);
      if (district.detail === "high" && distance > switchDistance + 1.5)
        district.detail = "low";
      else if (district.detail === "low" && distance < switchDistance - 1.5)
        district.detail = "high";
      const highDetail = district.detail === "high";
      root.visible = reveal > .01;
      root.scale.set(1, Math.max(.001, reveal), 1);
      highGroup.visible = root.visible && highDetail;
      lowGroup.visible = root.visible && !highDetail;
      if (!root.visible) {
        metrics.lod.hiddenZones++;
      } else {
        metrics.lod[highDetail ? "highDetailZones" : "lowDetailZones"]++;
        metrics.lod.renderedInstances += highDetail
          ? highEntries.length
          : lowEntries.length;
      }
      metrics.lod.zones.push({
        id,
        detail: root.visible ? highDetail ? "high" : "low" : "hidden",
        distance: Number(distance.toFixed(2)),
        reveal: Number(reveal.toFixed(3)),
        highInstances: highEntries.length,
        lowInstances: lowEntries.length,
      });
    });
  }

  const logisticsHigh = [], logisticsLow = [];
  box(logisticsHigh, 0, .05, 0, 1.55, .1, 6.4, "#7e8b89");
  for (let bay = 0; bay < 3; bay++) {
    const z = -2.25 + bay * 2.2;
    box(logisticsHigh, 0, .48, z, 1.3, .82, 1.55, ["#5f8992", "#d1a64d", "#71878b"][bay]);
    for (let rib = -2; rib <= 2; rib++)
      box(logisticsHigh, .69, .48, z + rib * .26, .035, .7, .05, "#d8d6c7");
    box(logisticsHigh, 0, .93, z, 1.38, .08, 1.62, "#3e5965");
  }
  for (const z of [-2.8, -1.65, -.5, .65, 1.8, 2.8])
    box(logisticsHigh, -.56, .16, z, .32, .22, .42, "#b8935b");
  box(logisticsLow, 0, .05, 0, 1.55, .1, 6.4, "#7e8b89");
  for (let bay = 0; bay < 3; bay++)
    box(logisticsLow, 0, .5, -2.25 + bay * 2.2, 1.38, .9, 1.62, ["#5f8992", "#d1a64d", "#71878b"][bay]);
  addLodDistrict({
    id: "west-logistics",
    position: [-11.75, -.25],
    start: .1,
    highEntries: logisticsHigh,
    lowEntries: logisticsLow,
  });

  const utilitiesHigh = [], utilitiesLow = [];
  box(utilitiesHigh, 0, .04, 0, 8.4, .08, 1.15, "#5c6464");
  for (const z of [-.32, 0, .32])
    box(utilitiesHigh, 0, .2, z, 7.7, .1, .1, z ? "#62a1a6" : "#d6a34e");
  for (let i = 0; i < 18; i++) {
    const x = -3.85 + i * .45;
    box(utilitiesHigh, x, .16, -.32, .1, .3, .58, "#475d62");
    if (i % 3 === 0)
      box(utilitiesHigh, x, .42, .32, .18, .42, .18, "#d3ad5d");
  }
  box(utilitiesLow, 0, .04, 0, 8.4, .08, 1.15, "#5c6464");
  for (const z of [-.3, 0, .3])
    box(utilitiesLow, 0, .2, z, 7.7, .12, .12, z ? "#62a1a6" : "#d6a34e");
  addLodDistrict({
    id: "north-utilities",
    position: [0, 8.72],
    start: .28,
    highEntries: utilitiesHigh,
    lowEntries: utilitiesLow,
    switchDistance: 32,
  });

  const precastHigh = [], precastLow = [];
  box(precastHigh, 0, .05, 0, 1.55, .1, 6.4, "#8a887d");
  for (let i = 0; i < 10; i++) {
    const z = -2.7 + i * .6;
    for (const x of [-.62, .62])
      box(precastHigh, x, .72, z, .08, 1.35, .08, "#66787d");
    box(precastHigh, 0, 1.34, z, 1.35, .08, .1, "#718388");
  }
  for (let i = 0; i < 6; i++)
    box(precastHigh, 0, .3 + i * .16, -2.15 + i * .76, 1.05, .12, .42, i % 2 ? "#c7cfca" : "#86a9ad");
  box(precastLow, 0, .05, 0, 1.55, .1, 6.4, "#8a887d");
  box(precastLow, 0, .72, -1.7, 1.35, 1.35, 1.6, "#708489");
  box(precastLow, 0, .72, 1.3, 1.35, 1.35, 2.2, "#8da6a6");
  addLodDistrict({
    id: "east-precast",
    position: [11.75, .35],
    start: .44,
    highEntries: precastHigh,
    lowEntries: precastLow,
  });

  groundSign("LOGISTICS", -11.75, 3.55, 1.8);
  groundSign("UTILITIES", 0, 9.42, 2.2);
  groundSign("PRECAST", 11.75, 4.15, 1.7);
  metrics.site.lodZoneCount = lodDistricts.length;
  metrics.site.lodHighInstances = lodDistricts.reduce(
    (total, district) => total + district.highInstances,
    0,
  );
  metrics.site.lodLowInstances = lodDistricts.reduce(
    (total, district) => total + district.lowInstances,
    0,
  );

  // Wheels and articulated mechanisms use isolated local frames.
  const rubber = new THREE.MeshStandardMaterial({ color: "#2e3437", roughness: .95 });
  const steel = new THREE.MeshStandardMaterial({ color: "#819097", roughness: .38, metalness: .55 });
  function wheel(parent, x, y, z, radius = .3) {
    const axle = new THREE.Group();
    axle.position.set(x, y, z);
    axle.userData.radius = radius;
    parent.add(axle);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, .22, 12), rubber);
    mesh.rotation.z = Math.PI / 2; mesh.castShadow = true; axle.add(mesh);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * .42, radius * .42, .24, 8), steel);
    hub.rotation.z = Math.PI / 2; axle.add(hub);
    return axle;
  }
  function excavator(x, z, rotation, phase) {
    const machine = new THREE.Group(); machine.position.set(x, .08, z); machine.rotation.y = rotation; scene.add(machine);
    contactShadow(machine, 1.45, 1.9, -.045);
    const tracks = [];
    for (const side of [-1, 1]) {
      box(tracks, side * .53, .2, 0, .3, .39, 1.5, "#3b4447");
      for (let j = 0; j < 11; j++) box(tracks, side * .53, .4, -.68 + j * .135, .34, .055, .09, "#626766");
    }
    box(tracks, 0, .41, 0, 1.05, .18, .95, "#73766a");
    batch(machine, tracks);
    const turret = new THREE.Group(); turret.position.y = .56; machine.add(turret);
    const body = [];
    box(body, 0, .22, -.2, 1.1, .43, 1.12, "#e6aa35");
    box(body, -.25, .6, -.13, .54, .65, .66, "#e3b34f");
    box(body, -.25, .71, .212, .4, .4, .035, "#507783");
    box(body, -.53, .71, -.13, .025, .4, .53, "#486974");
    box(body, -.25, .96, -.13, .61, .09, .76, "#f0c454");
    box(body, .35, .47, -.45, .09, .28, .09, "#3a4145");
    batch(turret, body);
    const boom = new THREE.Group(); boom.position.set(.3, .25, .25); turret.add(boom);
    meshBox(boom, 0, .58, .42, .22, 1.3, .24, new THREE.MeshStandardMaterial({ color: "#e9b437", roughness: .7 })).rotation.x = .55;
    const arm = new THREE.Group(); arm.position.set(0, 1.12, .73); boom.add(arm);
    meshBox(arm, 0, -.39, .38, .19, 1.1, .2, new THREE.MeshStandardMaterial({ color: "#e0a632" })).rotation.x = -.7;
    const bucket = new THREE.Group(); bucket.position.set(0, -.8, .78); arm.add(bucket);
    const scoop = [];
    box(scoop, 0, -.09, .13, .66, .18, .48, "#635e4e");
    box(scoop, -.31, .08, .12, .07, .32, .5, "#706854"); box(scoop, .31, .08, .12, .07, .32, .5, "#706854");
    box(scoop, 0, .08, -.1, .6, .32, .06, "#776849");
    for (let j = 0; j < 4; j++) box(scoop, -.23 + j * .15, -.1, .42, .09, .12, .19, "#a89368");
    batch(bucket, scoop);
    const soil = meshBox(bucket, 0, .06, .13, .49, .18, .31, new THREE.MeshStandardMaterial({ color: "#987444" }));
    const hydraulic = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .95, 8), steel);
    hydraulic.position.set(.15, .54, .42); hydraulic.rotation.x = .6; boom.add(hydraulic);
    dynamic.push(time => {
      const p = (time * .085 + phase) % 1;
      const activity =
        (
          1 -
          smooth01(
            (state.buildProgress - .3) / .12,
          )
        ) *
        resetActivityGate();
      turret.rotation.y = THREE.MathUtils.lerp(-.18, -.45 + .38 * Math.sin(p * Math.PI * 2), activity);
      boom.rotation.x = THREE.MathUtils.lerp(-.16, -.4 + .32 * Math.sin(p * Math.PI * 2), activity);
      arm.rotation.x = THREE.MathUtils.lerp(.08, -.2 + .45 * Math.sin(p * Math.PI * 2 + 1), activity);
      bucket.rotation.x = THREE.MathUtils.lerp(-.15, -.3 + .7 * Math.sin(p * Math.PI * 2 + 2), activity);
      soil.visible = activity > .2 && p > .2 && p < .68;
      if (activity > .15) metrics.activity.excavators++;
    });
    metrics.zones.push({ name: "excavator", x, z, radius: 1.4 });
  }
  excavator(-6, -.2, Math.PI / 2, 0);
  excavator(-3, -1.9, -Math.PI / 2, .5);

  function crane(x, z, height, length, offset) {
    const root = new THREE.Group(); root.position.set(x, .1, z); scene.add(root);
    const parts = [];
    box(parts, 0, .14, 0, 1.1, .28, 1.1, "#afb0a0");
    for (const dx of [-.27, .27]) for (const dz of [-.27, .27]) box(parts, dx, height / 2, dz, .085, height, .085, "#e5b337");
    for (let y = .45; y < height; y += .48) {
      for (const dz of [-.27, .27]) { box(parts, 0, y, dz, .55, .06, .06, "#e7b934"); parts.push({ x: 0, y: y + .21, z: dz, w: .055, h: .66, d: .055, c: "#e2aa30", rz: .85 }); }
      for (const dx of [-.27, .27]) box(parts, dx, y, 0, .06, .055, .55, "#dfad30");
    }
    batch(root, parts);
    const rotating = new THREE.Group(); rotating.position.y = height; root.add(rotating);
    const top = [];
    for (let j = -5; j < length * 4; j++) {
      box(top, j * .25, 0, -.25, .26, .06, .06, "#edba3e"); box(top, j * .25, 0, .25, .26, .06, .06, "#edba3e");
      box(top, j * .25, .35, 0, .26, .06, .06, "#e5b334");
      top.push({ x: j * .25, y: .16, z: 0, w: .04, h: .41, d: .04, c: "#cda133", rz: .65 });
    }
    box(top, -1.15, -.16, 0, .72, .58, .67, "#778589");
    box(top, .3, -.3, .45, .68, .56, .65, "#e2b23a");
    box(top, .3, -.27, .786, .54, .35, .025, "#5793a1");
    box(top, 0, .72, 0, .13, 1.2, .13, "#dfb635");
    batch(rotating, top);
    const trolley = new THREE.Group(); trolley.position.x = length * .72; rotating.add(trolley);
    const wire = meshBox(trolley, 0, -1, 0, .025, 2, .025, steel);
    const load = new THREE.Group(); trolley.add(load);
    const bundle = [];
    if (offset) {
      for (let i = 0; i < 6; i++) box(bundle, 0, -.07 + (i % 2) * .09, -.2 + Math.floor(i / 2) * .16, 1.4, .065, .065, "#555e61");
    } else {
      box(bundle, 0, -.21, 0, .56, .58, .56, "#d08642");
      box(bundle, 0, .11, 0, .66, .08, .66, "#bdbbab");
    }
    batch(load, bundle);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(.06, 6, 4), luminousMaterial); beacon.position.set(length, .45, 0); rotating.add(beacon);
    const cable = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.28, 0), new THREE.Vector3(length, .32, 0)]), new THREE.LineBasicMaterial({ color: "#acb4a8" })); rotating.add(cable);
    dynamic.push(time => {
      // Each crane stays in its own sweep zone; boom and load elevations never meet.
      const start = offset ? .18 : .28, end = offset ? .7 : .92;
      const activity =
        smooth01((state.buildProgress - start) / .07) *
        (1 - smooth01((state.buildProgress - end) / .05)) *
        resetActivityGate();
      const movingRotation = offset
        ? -.15 + .32 * Math.sin(time * .15 + 2)
        : .5 + .65 * Math.sin(time * .105);
      rotating.rotation.y = THREE.MathUtils.lerp(offset ? -.08 : .35, movingRotation, activity);
      trolley.position.x = THREE.MathUtils.lerp(
        length * .55,
        length * (.68 + .1 * Math.sin(time * .19)),
        activity,
      );
      const movingDrop = offset
        ? 1 + .8 * (.5 + .5 * Math.sin(time * .3))
        : .6 + .7 * (.5 + .5 * Math.sin(time * .25));
      const drop = THREE.MathUtils.lerp(.45, movingDrop, activity);
      wire.scale.y = drop; wire.position.y = -drop / 2;
      load.position.y = -drop;
      load.visible = activity > .08;
      if (activity > .15) metrics.activity.cranes++;
    });
  }
  crane(.2, -.25, 8.3, 5.7, 0);
  crane(-6.2, -4.25, 5.6, 4, 1);

  function truck(color, mixer = false) {
    const vehicle = new THREE.Group();
    contactShadow(vehicle, 1.45, 2.65, .006);
    const parts = [];
    box(parts, 0, .37, 0, 1.12, .22, 2.25, "#424c4f");
    box(parts, 0, .8, .71, 1.05, .84, .87, color);
    box(parts, 0, 1.29, .71, 1.09, .1, .91, "#e3dcc3");
    box(parts, 0, .99, 1.16, .84, .35, .028, "#507a87");
    for (const side of [-1, 1]) {
      box(parts, side * .54, 1, .68, .025, .34, .6, "#466e7e");
      box(parts, side * .4, .57, 1.19, .17, .13, .04, "#ffe0a6");
    }
    box(parts, 0, .37, 1.24, 1.15, .12, .12, "#99a5a5");
    batch(vehicle, parts);
    const wheels = [];
    for (const side of [-1, 1]) for (const z of [-.85, -.33, .85]) wheels.push(wheel(vehicle, side * .6, .3, z, .28));
    let bed, dirt, drum;
    if (!mixer) {
      bed = new THREE.Group(); bed.position.set(0, .54, -.92); vehicle.add(bed);
      const bedParts = [];
      box(bedParts, 0, 0, .44, 1.02, .11, 1.3, "#c18e3d");
      for (const side of [-1, 1]) box(bedParts, side * .52, .25, .44, .09, .51, 1.4, color);
      for (const z of [-.21, 1.05]) box(bedParts, 0, .25, z, 1.09, .5, .08, color);
      for (let i = 0; i < 5; i++) for (const side of [-1, 1]) box(bedParts, side * .576, .23, -.1 + i * .28, .025, .4, .07, "#c39343");
      batch(bed, bedParts);
      dirt = meshBox(bed, 0, .21, .44, .88, .27, 1.1, new THREE.MeshStandardMaterial({ color: "#a17d4d" }));
    } else {
      drum = new THREE.Group(); drum.position.set(0, .89, -.37); drum.rotation.x = .12; vehicle.add(drum);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.35, .46, 1.23, 12), new THREE.MeshStandardMaterial({ color: "#e8e2c9", roughness: .68 }));
      barrel.rotation.x = Math.PI / 2; drum.add(barrel);
      for (const z of [-.28, .28]) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(.421, .042, 4, 12), new THREE.MeshStandardMaterial({ color: "#5e979b" }));
        band.position.z = z; drum.add(band);
      }
      box(parts, 0, .7, -1.23, .22, .15, .5, "#7f8c87");
    }
    scene.add(vehicle);
    return { vehicle, wheels, bed, dirt, drum };
  }
  const trucks = [truck("#d49d3a"), truck("#dfb95a"), truck("#74a6ad", true)];
  const truckHalfWidth = .75, truckHalfLength = 1.3;
  let fleetRouteTime = 0, fleetLastTime = null;
  dynamic.push(time => {
    const elapsed = Math.max(
      0,
      Math.min(
        .1,
        time - (fleetLastTime ?? time),
      ),
    );
    fleetLastTime = time;
    const activities = trucks.map((machine, i) => {
      const earlyHaul = 1 - smooth01((state.buildProgress - .38) / .07);
      const cleanupHaul = i === 1
        ? smooth01((state.buildProgress - .78) / .05) *
          (1 - smooth01((state.buildProgress - .95) / .03))
        : 0;
      const mixerWork =
        smooth01((state.buildProgress - .17) / .06) *
        (1 - smooth01((state.buildProgress - .79) / .06));
      return (
        (
          machine.drum
            ? mixerWork
            : Math.max(earlyHaul, cleanupHaul)
        ) *
        resetActivityGate()
      );
    });
    const fleetActivity = Math.max(...activities);
    const transitSpeed = THREE.MathUtils.lerp(.3, 1, fleetActivity);
    fleetRouteTime += elapsed * transitSpeed;
    trucks.forEach((machine, i) => {
      const activity = activities[i];
      const operational = activity > .15;
      const pose = vehiclePose(fleetRouteTime, i);
      machine.vehicle.position.copy(pose.position); machine.vehicle.position.y = .03; machine.vehicle.rotation.y = pose.angle;
      machine.vehicle.visible = true;
      if (pose.moving) {
        for (const axle of machine.wheels)
          axle.rotation.x -= elapsed * transitSpeed * .6 / axle.userData.radius;
      }
      const mode = operational
        ? "working"
        : pose.moving
          ? "returning"
          : "standby";
      machine.pose = {
        ...pose,
        active: operational,
        visible: true,
        mode,
      };
      if (machine.drum)
        machine.drum.rotation.z +=
          elapsed *
          THREE.MathUtils.lerp(.15, .55, activity);
      if (machine.bed) {
        machine.bed.rotation.x = -pose.tip * activity;
        machine.dirt.visible = operational && pose.loaded;
      }
      if (operational)
        metrics.activity[machine.drum ? "mixerTrucks" : "dumpTrucks"]++;
    });
    metrics.vehicles = trucks.map((machine, i) => {
      const angle = machine.pose.angle;
      const extentX = Math.abs(Math.cos(angle)) * truckHalfWidth + Math.abs(Math.sin(angle)) * truckHalfLength;
      const extentZ = Math.abs(Math.sin(angle)) * truckHalfWidth + Math.abs(Math.cos(angle)) * truckHalfLength;
      const lampClearance = Math.min(...lampPositions.map(([lampX, lampZ]) => {
        const gapX = Math.abs(machine.vehicle.position.x - lampX) - extentX - .1;
        const gapZ = Math.abs(machine.vehicle.position.z - lampZ) - extentZ - .1;
        return gapX > 0 || gapZ > 0
          ? Math.hypot(Math.max(0, gapX), Math.max(0, gapZ))
          : Math.max(gapX, gapZ);
      }));
      return {
        id: i,
        x: machine.vehicle.position.x,
        z: machine.vehicle.position.z,
        halfLength: truckHalfLength,
        halfWidth: truckHalfWidth,
        extentX,
        extentZ,
        moving: machine.pose.moving,
        active: machine.pose.active,
        visible: machine.pose.visible,
        mode: machine.pose.mode,
        wheelRoll: machine.wheels[0].rotation.x,
        wheelYaw: machine.wheels[0].rotation.y,
        lampClearance,
        boundaryClearance: Math.min(
          SITE_LAYOUT.fenceHalfX - .2 - Math.abs(machine.vehicle.position.x) - extentX,
          SITE_LAYOUT.fenceHalfZ - .1 - Math.abs(machine.vehicle.position.z) - extentZ,
        ),
      };
    });
    metrics.minimumBoundaryClearance = Math.min(
      ...metrics.vehicles.map(vehicle => vehicle.boundaryClearance),
    );
    metrics.minimumLampClearance = Math.min(
      ...metrics.vehicles.map(vehicle => vehicle.lampClearance),
    );
    metrics.clearanceViolations = metrics.vehicles.filter(
      vehicle => vehicle.boundaryClearance < .05,
    ).length;
    metrics.clearanceViolations += metrics.vehicles.filter(
      vehicle => vehicle.lampClearance < .05,
    ).length;
    for (let i = 0; i < trucks.length; i++) for (let j = i + 1; j < trucks.length; j++) {
      if (trucks[i].vehicle.position.distanceTo(trucks[j].vehicle.position) < 3)
        metrics.clearanceViolations++;
    }
    metrics.transport = {
      visibleVehicles: metrics.vehicles.filter(vehicle => vehicle.visible).length,
      workingVehicles: metrics.vehicles.filter(vehicle => vehicle.mode === "working").length,
      returningVehicles: metrics.vehicles.filter(vehicle => vehicle.mode === "returning").length,
      standbyVehicles: metrics.vehicles.filter(vehicle => vehicle.mode === "standby").length,
      transitSpeed: Number(transitSpeed.toFixed(3)),
    };
  });
  const loader = new THREE.Group();
  loader.position.set(7.2, .04, .7);
  scene.add(loader);
  contactShadow(loader, 1.45, 1.8, -.015);
  const loaderParts = [], loaderWheels = [];
  box(loaderParts, 0, .5, 0, .7, .44, 1.05, "#e6b544"); box(loaderParts, 0, .88, -.1, .55, .55, .56, "#d5ab49");
  box(loaderParts, 0, .94, .192, .42, .3, .025, "#50747e");
  box(loaderParts, 0, 1.2, -.1, .62, .07, .65, "#f0ca63");
  for (const x of [-.32, .32]) {
    box(loaderParts, x, .4, .59, .07, .09, .69, "#c89538");
    loaderWheels.push(wheel(loader, x * 1.4, .23, -.4, .22));
    loaderWheels.push(wheel(loader, x * 1.4, .23, .4, .22));
  }
  batch(loader, loaderParts);
  const loaderBucket = new THREE.Group();
  loaderBucket.position.set(0, .32, .74);
  loader.add(loaderBucket);
  const loaderBucketParts = [];
  box(loaderBucketParts, 0, -.05, .22, 1.05, .17, .4, "#555e5b");
  box(loaderBucketParts, -.5, .06, .22, .07, .32, .42, "#6f756e");
  box(loaderBucketParts, .5, .06, .22, .07, .32, .42, "#6f756e");
  batch(loaderBucket, loaderBucketParts);
  const loaderSoil = meshBox(
    loaderBucket,
    0,
    .05,
    .22,
    .83,
    .13,
    .29,
    new THREE.MeshStandardMaterial({ color: "#9c7950", roughness: .96 }),
  );
  loader.scale.setScalar(.55);
  let loaderLastZ = loader.position.z;
  let loaderActivity = 0, loaderLastTime = null;
  dynamic.push(time => {
    const grading =
      1 -
      smooth01(
        (state.buildProgress - .31) / .08,
      );
    const cleanup =
      smooth01(
        (state.buildProgress - .78) / .05,
      ) *
      (
        1 -
        smooth01(
          (state.buildProgress - .95) / .03,
        )
      );
    const targetActivity =
      Math.max(grading, cleanup) *
      resetActivityGate();
    const elapsed = Math.max(
      0,
      Math.min(
        .1,
        time - (loaderLastTime ?? time),
      ),
    );
    loaderLastTime = time;
    loaderActivity = THREE.MathUtils.damp(
      loaderActivity,
      targetActivity,
      3.5,
      elapsed,
    );
    const activity = loaderActivity;
    const operational = targetActivity > .15;
    const isCleanup = cleanup > grading;
    const cycle = shuttleCycle(time, isCleanup ? 14 : 16, isCleanup ? 3.5 : 0);
    const path = isCleanup ? loaderPaths.cleanup : loaderPaths.grading;
    const workX = path.x;
    const fromZ = path.fromZ;
    const toZ = path.toZ;
    const workZ = THREE.MathUtils.lerp(fromZ, toZ, cycle.position);
    loader.position.x = THREE.MathUtils.lerp(7.2, workX, activity);
    loader.position.z = THREE.MathUtils.lerp(.7, workZ, activity);
    loader.visible = true;
    loader.rotation.y =
      (cycle.direction > 0 ? 0 : Math.PI) *
      activity;
    loaderBucket.rotation.x = THREE.MathUtils.lerp(
      .08,
      cycle.atTarget ? -.28 : -.06,
      activity,
    );
    loaderSoil.visible =
      operational &&
      grading > .2 &&
      cycle.position > .12 &&
      cycle.direction > 0;
    const travelled = loader.position.z - loaderLastZ;
    const moving = Math.abs(travelled) > .0005;
    if (moving && Math.abs(travelled) < .35) {
      for (const axle of loaderWheels)
        axle.rotation.x -= travelled / (axle.userData.radius * loader.scale.z);
    }
    loaderLastZ = loader.position.z;
    const halfX = .42, halfZ = .66;
    const spoilClearance = 2.4 - (loader.position.z + halfZ);
    const boundaryClearance = Math.min(
      SITE_LAYOUT.fenceHalfX - .2 - Math.abs(loader.position.x) - halfX,
      SITE_LAYOUT.fenceHalfZ - .1 - Math.abs(loader.position.z) - halfZ,
    );
    const visibleVehicles = metrics.vehicles.filter(vehicle => vehicle.visible);
    const truckClearance = visibleVehicles.length
      ? Math.min(...visibleVehicles.map(vehicle => {
          const gapX =
            Math.abs(loader.position.x - vehicle.x) -
            (halfX + vehicle.extentX);
          const gapZ =
            Math.abs(loader.position.z - vehicle.z) -
            (halfZ + vehicle.extentZ);
          return gapX > 0 || gapZ > 0
            ? Math.hypot(Math.max(0, gapX), Math.max(0, gapZ))
            : Math.max(gapX, gapZ);
        }))
      : null;
    if (
      boundaryClearance < .05 ||
      (truckClearance !== null && truckClearance < .05) ||
      spoilClearance < .005
    )
      metrics.clearanceViolations++;
    metrics.minimumBoundaryClearance = Math.min(
      metrics.minimumBoundaryClearance,
      boundaryClearance,
    );
    metrics.activity.loader = operational ? 1 : 0;
    const mode = operational
      ? isCleanup
        ? "cleanup"
        : "grading"
      : activity > .02
        ? "returning"
        : "parked";
    metrics.loader = {
      active: operational,
      visible: true,
      moving,
      task: mode,
      wheelRoll: loaderWheels[0].rotation.x,
      wheelYaw: loaderWheels[0].rotation.y,
      boundaryClearance,
      truckClearance,
      spoilClearance,
    };
    metrics.transport.loaderMode = mode;
  });

  // Workers have assigned bays or reserved walkways, never sharing the vehicle lane.
  const workerParts = [];
  const workerModel = [
    [0, .42, 0, .17, .25, .13, "#e79d3b"],
    [0, .62, 0, .14, .14, .13, "#d5a377"],
    [0, .72, 0, .2, .06, .18, "#f2ce56"],
    [-.046, .22, 0, .065, .2, .085, "#45677c"],
    [.046, .22, 0, .065, .2, .085, "#45677c"],
    [-.046, .105, .02, .085, .04, .13, "#3a4346"],
    [.046, .105, .02, .085, .04, .13, "#3a4346"],
    [-.115, .43, .015, .055, .18, .06, "#d6a27b"],
    [.115, .43, .015, .055, .18, .06, "#d6a27b"],
    [0, .445, .071, .17, .037, .009, "#eee1a0"],
  ];
  const workers = [];
  const workerBays = [[-5.9, 2.68], [-4.4, 2.68], [-3.1, 4.18], [-1, 2.2], [1.5, 2.2], [3.45, 4.05], [5.2, 1.4], [6.6, 1.3], [-7.65, 1.8], [-8, 7.1], [-5.7, 7.1], [2.3, -3.05], [4.4, -3.9], [-.5, -3.2]];
  const taskAssignments = [
    "rebar-tying",
    "tool-operation",
    "lift-signalling",
    "safety-patrol",
    "material-carrying",
  ];
  workerBays.forEach(([x, z], i) => {
    const task = i % 5;
    workers.push({
      x,
      z,
      y: .04,
      task,
      assignment: taskAssignments[task],
      routeAxis: task === 3 && i === 3 ? "z" : "x",
      routeDistance: task === 3 ? .9 : .7,
      zone: "work-bay",
    });
  });
  for (const y of [1.98, 3.63])
    for (const [x, z] of [[3.2, -2.5], [5.8, -.6], [4.6, -.15]])
      workers.push({
        x,
        z,
        y,
        task: 1,
        assignment: "floor-installation",
        routeAxis: "x",
        routeDistance: .5,
        zone: "building",
      });
  const perimeterCrew = [
    { x: -7.7, z: 9.08, task: 3, assignment: "gate-patrol", routeAxis: "x", routeDistance: .72 },
    { x: -6, z: 9.04, task: 2, assignment: "gate-banksman", routeAxis: "x", routeDistance: .4 },
    { x: -12.45, z: 2.8, task: 1, assignment: "fence-maintenance", routeAxis: "z", routeDistance: .55 },
    { x: -12.45, z: -3.45, task: 2, assignment: "west-traffic-control", routeAxis: "z", routeDistance: .45 },
    { x: -4.8, z: -9.05, task: 1, assignment: "utilities-inspection", routeAxis: "x", routeDistance: .55 },
    { x: 1.2, z: -9.05, task: 4, assignment: "south-supply-runner", routeAxis: "x", routeDistance: .7 },
    { x: 12.45, z: 1.8, task: 3, assignment: "east-road-inspection", routeAxis: "z", routeDistance: .72 },
    { x: 12.45, z: 4.35, task: 2, assignment: "east-traffic-control", routeAxis: "z", routeDistance: .45 },
  ];
  perimeterCrew.forEach(worker => workers.push({
    ...worker,
    y: .04,
    zone: "perimeter",
    perimeter: true,
  }));
  workers.forEach((worker, index) => {
    worker.role = index % 6 === 0 ? "supervisor" : "worker";
    if (worker.role === "supervisor") {
      worker.task = index % 12 === 0 ? 3 : 2;
      worker.assignment = index % 12 === 0
        ? "quality-inspection"
        : "lift-supervision";
    }
    const taskStart = [ .18, .34, .1, -.04, .22 ][worker.task];
    const taskEnd = [ .5, .94, .96, .97, .9 ][worker.task];
    const floorStart = worker.y > 3 ? .62 : worker.y > 1 ? .45 : -.04;
    worker.activeFrom = Math.max(taskStart, floorStart);
    worker.activeUntil = worker.role === "supervisor" ? .98 : taskEnd;
  });
  const helmetColors = {
    worker: "#f2ce56",
    supervisor: "#f3f4ed",
  };
  workers.forEach((worker) => workerModel.forEach(([x, y, z, w, h, d, color], part) => {
    const helmet = helmetColors[worker.role];
    box(workerParts, worker.x + x, worker.y + y, worker.z + z, w, h, d, part === 2 ? helmet : color);
  }));
  const workerMesh = batch(scene, workerParts);
  const toolSpecs = workers.map(worker =>
    worker.role === "supervisor"
      ? { w: .18, h: .22, d: .025, color: "#dce8eb" }
      : worker.task === 0
      ? { w: .34, h: .025, d: .025, color: "#525b5d" }
      : worker.task === 1
        ? { w: .04, h: .3, d: .04, color: "#d7a346" }
        : worker.task === 2
          ? { w: .18, h: .18, d: .025, color: "#e66b52" }
          : worker.task === 3
            ? { w: .05, h: .05, d: .16, color: "#d9e0d2" }
            : { w: .32, h: .18, d: .24, color: "#af8555" },
  );
  const workerTools = toolSpecs.map((tool, index) => ({
    x: workers[index].x,
    y: workers[index].y + .5,
    z: workers[index].z,
    w: tool.w,
    h: tool.h,
    d: tool.d,
    c: tool.color,
  }));
  const workerToolMesh = batch(scene, workerTools);
  const officeFootprints = [
    { x: -1.8, z: -4.25, halfX: 1.55, halfZ: .725 },
    { x: 1.8, z: -4.25, halfX: 1.55, halfZ: .725 },
  ];
  metrics.workers = {
    count: workers.length,
    roles: {
      workers: workers.filter(worker => worker.role === "worker").length,
      supervisors: workers.filter(worker => worker.role === "supervisor").length,
    },
    helmetColors,
    tasks: {
      rebar: workers.filter(worker => worker.task === 0).length,
      tools: workers.filter(worker => worker.task === 1).length,
      signalling: workers.filter(worker => worker.task === 2).length,
      patrol: workers.filter(worker => worker.task === 3).length,
      carrying: workers.filter(worker => worker.task === 4).length,
    },
    posture: {
      legSwingAxis: "x",
      lateralLegSwing: false,
      stopsAtRouteEnds: true,
    },
    perimeter: {
      count: workers.filter(worker => worker.perimeter).length,
      assignments: workers
        .filter(worker => worker.perimeter)
        .map(worker => worker.assignment),
      positions: workers
        .filter(worker => worker.perimeter)
        .map(worker => ({ x: worker.x, z: worker.z })),
    },
  };
  dynamic.push(time => {
    let motionChecksum = 0, activeWorkers = 0;
    let activePerimeter = 0;
    let officeIntrusions = 0;
    let maxForwardLegSwing = 0, maxLateralLegSwing = 0;
    const activeByRole = { workers: 0, supervisors: 0 };
    const activeByTask = {
      rebar: 0,
      tools: 0,
      signalling: 0,
      patrol: 0,
      carrying: 0,
    };
    const taskKeys = ["rebar", "tools", "signalling", "patrol", "carrying"];
    workers.forEach((worker, index) => {
      const active =
        smooth01((state.buildProgress - worker.activeFrom) / .04) *
        (1 - smooth01((state.buildProgress - worker.activeUntil) / .035)) *
        resetActivityGate();
      const walking = worker.task === 3 || worker.task === 4;
      const routeCycle = shuttleCycle(
        time,
        worker.task === 3 ? 11 : 9,
        index * 1.37,
      );
      if (active > .5) {
        activeWorkers++;
        if (worker.perimeter) activePerimeter++;
        activeByRole[worker.role === "supervisor" ? "supervisors" : "workers"]++;
        activeByTask[taskKeys[worker.task]]++;
      }
      const routeOffset = walking
        ? (routeCycle.position - .5) * worker.routeDistance
        : 0;
      const routeX = worker.routeAxis === "z" ? 0 : routeOffset;
      const routeZ = worker.routeAxis === "z" ? routeOffset : 0;
      if (
        active > .5 &&
        worker.y < 1 &&
        officeFootprints.some(office =>
          Math.abs(worker.x + routeX - office.x) < office.halfX + .11 &&
          Math.abs(worker.z + routeZ - office.z) < office.halfZ + .11
        )
      )
        officeIntrusions++;
      const heading = walking
        ? worker.routeAxis === "z"
          ? routeCycle.direction > 0 ? 0 : Math.PI
          : routeCycle.direction > 0 ? Math.PI / 2 : -Math.PI / 2
        : 0;
      const gestureRate =
        walking && routeCycle.moving
          ? 6.2
          : worker.role === "supervisor"
            ? 1.35
            : 2.4;
      const gesture = Math.sin(time * gestureRate + index);
      const gait = walking && routeCycle.moving ? gesture : 0;
      const handling =
        worker.task === 4 && routeCycle.atTarget
          ? .5 + .5 * Math.sin(time * 3.1 + index)
          : 0;
      const crouch = worker.task === 0 ? (.5 + .5 * gesture) * .08 : 0;
      const cosHeading = Math.cos(heading), sinHeading = Math.sin(heading);
      workerModel.forEach(([x, y, z, w, h, d], part) => {
        const movingPart = part <= 2 || part === 9;
        let localY = y, localZ = z;
        let rx = 0, rz = 0;
        if (walking && part >= 3 && part <= 6) {
          const left = part === 3 || part === 5;
          const legSwing = gait * (left ? .34 : -.34);
          const hipY = .32;
          const hipDistance = part <= 4 ? .1 : .215;
          localY = hipY - Math.cos(legSwing) * hipDistance;
          localZ += -Math.sin(legSwing) * hipDistance;
          rx = legSwing;
        }
        if (part === 7 || part === 8) {
          if (worker.task === 0) rz = part === 7 ? -.7 : .7;
          if (worker.task === 1 && part === 8) rz = -.7 - gesture * .72;
          if (worker.task === 2) rz = (part === 7 ? .95 : -.95) + gesture * .2;
          if (worker.task === 3) {
            const armSwing = gait * (part === 7 ? -.42 : .42);
            localY = .52 - Math.cos(armSwing) * .09;
            localZ += -Math.sin(armSwing) * .09;
            rx = armSwing;
          }
          if (worker.task === 4) {
            rz = part === 7 ? -.55 : .55;
            localZ += .12;
          }
        }
        if (worker.task === 1 && movingPart) rx = gesture * .035;
        if (part >= 3 && part <= 6) {
          maxForwardLegSwing = Math.max(maxForwardLegSwing, Math.abs(rx));
          maxLateralLegSwing = Math.max(maxLateralLegSwing, Math.abs(rz));
        }
        const rotatedX = x * cosHeading + localZ * sinHeading;
        const rotatedZ = -x * sinHeading + localZ * cosHeading;
        let px = worker.x + routeX + rotatedX;
        let py = worker.y + localY - (movingPart ? crouch : 0);
        const pz = worker.z + routeZ + rotatedZ;
        if ((part === 7 || part === 8) && worker.task === 0)
          py -= crouch;
        const visibleScale = Math.max(.001, active);
        cubeMatrix.position.set(px, py - h * (1 - visibleScale) / 2, pz);
        cubeMatrix.scale.set(w * visibleScale, h * visibleScale, d * visibleScale);
        cubeMatrix.rotation.set(rx, heading, rz); cubeMatrix.updateMatrix();
        workerMesh.setMatrixAt(index * workerModel.length + part, cubeMatrix.matrix);
      });
      const tool = toolSpecs[index];
      let localToolX = 0, toolY = worker.y + .5, localToolZ = .13, toolRz = 0;
      if (worker.role === "supervisor") {
        localToolX += .18;
        toolY += .12 + Math.abs(gesture) * .025;
        toolRz = -.18;
      } else {
        if (worker.task === 0) { toolY = worker.y + .25 - crouch; localToolZ += .08; }
        if (worker.task === 1) { localToolX += .17; toolY += .05 + gesture * .07; toolRz = -.7 - gesture * .72; }
        if (worker.task === 2) { localToolX += .23; toolY += .24 + gesture * .04; toolRz = -.95 - gesture * .2; }
        if (worker.task === 3) { localToolX += .15; toolY += Math.abs(gesture) * .04; }
        if (worker.task === 4) toolY += Math.abs(gesture) * .025 - handling * .12;
      }
      const toolX = worker.x + routeX + localToolX * cosHeading + localToolZ * sinHeading;
      const toolZ = worker.z + routeZ - localToolX * sinHeading + localToolZ * cosHeading;
      motionChecksum += active * (
        routeX +
        routeZ +
        crouch +
        gait +
        handling +
        toolY +
        toolRz
      );
      cubeMatrix.position.set(toolX, toolY, toolZ);
      const toolScale = Math.max(.001, active);
      cubeMatrix.scale.set(tool.w * toolScale, tool.h * toolScale, tool.d * toolScale);
      cubeMatrix.rotation.set(0, heading, toolRz);
      cubeMatrix.updateMatrix();
      workerToolMesh.setMatrixAt(index, cubeMatrix.matrix);
    });
    workerMesh.instanceMatrix.needsUpdate = true;
    workerToolMesh.instanceMatrix.needsUpdate = true;
    metrics.workers.motionChecksum = Number(motionChecksum.toFixed(4));
    metrics.workers.active = activeWorkers;
    metrics.workers.activeByRole = activeByRole;
    metrics.workers.activeByTask = activeByTask;
    metrics.workers.posture.maxForwardLegSwing = Number(maxForwardLegSwing.toFixed(4));
    metrics.workers.posture.maxLateralLegSwing = Number(maxLateralLegSwing.toFixed(4));
    metrics.workers.perimeter.active = activePerimeter;
    metrics.workers.officeIntrusions = officeIntrusions;
    metrics.activity.workers = activeWorkers;
  });

  // Procedural tabletop props: blueprint, tape measure, helmet and spirit level.
  const blueprint = document.createElement("canvas"); blueprint.width = 512; blueprint.height = 384;
  const bp = blueprint.getContext("2d"); bp.fillStyle = "#245370"; bp.fillRect(0, 0, 512, 384);
  bp.strokeStyle = "#759bb162"; bp.lineWidth = 1;
  for (let i = 0; i < 512; i += 16) { bp.beginPath(); bp.moveTo(i, 0); bp.lineTo(i, 384); bp.stroke(); }
  for (let i = 0; i < 384; i += 16) { bp.beginPath(); bp.moveTo(0, i); bp.lineTo(512, i); bp.stroke(); }
  bp.strokeStyle = "#d5e5df"; bp.lineWidth = 3; bp.strokeRect(62, 55, 365, 245);
  for (let i = 0; i < 4; i++) { bp.strokeRect(80 + i * 80, 75, 55, 195); }
  bp.fillStyle = "#b9d6e1"; bp.font = "14px monospace"; bp.fillText("SITE 001 / FOUNDATION PLAN", 60, 336); bp.fillText("1:48", 400, 336);
  const bpTex = new THREE.CanvasTexture(blueprint); bpTex.colorSpace = THREE.SRGBColorSpace;
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 3.5), new THREE.MeshStandardMaterial({ map: bpTex, roughness: .95 }));
  paper.rotation.set(-Math.PI / 2, 0, -.2); paper.position.set(-15.2, -.887, 7.4); scene.add(paper);
  const props = [];
  box(props, 15.2, -.49, 9.8, 1, .72, .85, "#e4b544"); box(props, 15.2, -.09, 9.8, .77, .08, .7, "#464e50");
  for (let j = 0; j < 25; j++) { box(props, 13.7 + j * .14, -.84, 11.3, .15, .025, .22, "#d3cec0"); if (j % 2 === 0) box(props, 13.7 + j * .14, -.821, 11.33, .018, .009, .11, "#424948"); }
  box(props, -15, -.64, -10.3, 3.3, .3, .5, "#879390"); box(props, -15, -.44, -10.3, .66, .08, .31, "#b7d678"); box(props, -15, -.391, -10.3, .045, .012, .27, "#475b41");
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(.65, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#ebaf37", roughness: .45 }));
  helmet.position.set(15.2, -.78, -10.8); scene.add(helmet);
  box(props, 15.2, -.79, -10.8, 1.55, .07, 1.4, "#daa234"); box(props, 15.2, -.26, -10.8, .09, .18, 1, "#e7b846");
  batch(scene, props);

  // Physical knobs are raycastable; all their effects are also keyboard accessible.
  const knobGroup = new THREE.Group(); knobGroup.position.set(.5, -.64, 11.6); scene.add(knobGroup);
  const panelMat = new THREE.MeshStandardMaterial({ color: "#35434b", metalness: .5, roughness: .4 });
  meshBox(knobGroup, 0, 0, 0, 7, .28, 1.45, panelMat);
  const knobs = [];
  for (let i = 0; i < 3; i++) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(.37, .4, .26, 20), steel);
    knob.position.set(-2.2 + i * 2.2, .25, -.1); knob.userData.control = i; knobGroup.add(knob); knobs.push(knob);
    const pointer = meshBox(knob, 0, .14, .2, .065, .035, .17, new THREE.MeshBasicMaterial({ color: "#efbc55" }));
    pointer.castShadow = false;
    const caption = label(["SPEED", "DAY / NIGHT", "DUST"][i], 1.6, .26, { background: "#35434b", color: "#d8dcda", font: "36px monospace", border: false });
    caption.rotation.x = -Math.PI / 2; caption.position.set(knob.position.x, .153, .5); knobGroup.add(caption);
  }
  const raycaster = new THREE.Raycaster(), pointerPosition = new THREE.Vector2();
  let downPoint = null;
  canvas.addEventListener("pointerdown", e => { downPoint = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener("pointerup", e => {
    if (!downPoint || Math.hypot(e.clientX - downPoint.x, e.clientY - downPoint.y) > 5) return;
    const rect = canvas.getBoundingClientRect(); pointerPosition.set((e.clientX - rect.left) / rect.width * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointerPosition, camera);
    const hit = raycaster.intersectObjects(knobs)[0];
    if (!hit) return;
    const control = hit.object.userData.control;
    if (control === 0) state.speed = state.speed >= 2 ? .25 : state.speed + .25;
    if (control === 1) state.cycle = !state.cycle;
    if (control === 2) state.dust = state.dust >= 1 ? 0 : state.dust + .5;
    syncControls();
  });

  // All dust, rain and lamp haloes are generated in shaders or typed buffers.
  const particleCount = 650, positions = new Float32Array(particleCount * 3), seeds = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i++) { positions.set([-11 + random() * 22, .3 + random() * 3, -8.7 + random() * 17.4], i * 3); seeds[i] = random(); }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3)); dustGeo.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));
  const dustMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, intensity: { value: .5 }, ratio: { value: renderer.getPixelRatio() } },
    vertexShader: `attribute float seed; uniform float time; uniform float ratio; varying float alpha; void main(){ vec3 p=position; p.x+=sin(time*.22+seed*16.)*.4; p.z+=cos(time*.15+seed*12.)*.25; p.y=.15+mod(position.y+time*.07+seed,3.); vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=min(20.,(8.+seed*12.)*ratio/max(1.,-mv.z)*6.); alpha=(1.-p.y/3.)*.27; }`,
    fragmentShader: `uniform float intensity; varying float alpha; void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.05,d)*alpha*intensity; gl_FragColor=vec4(.8,.71,.56,a);}`,
    transparent: true, depthWrite: false,
  });
  const dust = new THREE.Points(dustGeo, dustMaterial); scene.add(dust);
  const rainPositions = new Float32Array(1400 * 6);
  const rainSeeds = Array.from({ length: 1400 }, () => ({ x: -13 + random() * 26, z: -9.4 + random() * 18.8, y: random() * 11 }));
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: "#abc3d1", transparent: true, opacity: .48, depthWrite: false })); rain.visible = false; scene.add(rain);
  const glowMaterial = new THREE.ShaderMaterial({
    uniforms: { strength: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;vec4 c=modelViewMatrix*vec4(0.,0.,0.,1.);c.xy+=position.xy;gl_Position=projectionMatrix*c;}`,
    fragmentShader: `varying vec2 vUv;uniform float strength;void main(){float a=pow(max(0.,1.-length(vUv-.5)*2.),2.5)*strength;gl_FragColor=vec4(1.,.73,.34,a);}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  for (const lamp of lamps) { const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), glowMaterial); glow.position.copy(lamp.light.position); scene.add(glow); }
  const wetMaterial = new THREE.MeshPhysicalMaterial({ color: "#577184", roughness: .15, metalness: .42, transparent: true, opacity: 0, clearcoat: 1 });
  const wet = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 1.2), wetMaterial); wet.rotation.x = -Math.PI / 2; wet.position.set(5, .043, 5.7); scene.add(wet);

  const speedInput = document.querySelector("#speed"), dayInput = document.querySelector("#cycle"), timeInput = document.querySelector("#time"), buildInput = document.querySelector("#build-stage"), cameraInput = document.querySelector("#camera-view"), dustInput = document.querySelector("#dust");
  function syncControls() {
    speedInput.value = state.speed; dayInput.checked = state.cycle; buildInput.value = state.buildMode === "auto" ? "auto" : String(state.manualBuild); cameraInput.value = state.camera; dustInput.value = state.dust;
    document.querySelector("#speed-label").textContent = `${state.speed}×`;
    document.querySelector("#pause").textContent = state.paused ? "继续" : "暂停";
    document.querySelector("#pause").setAttribute("aria-label", state.paused ? "继续机械" : "暂停机械");
    document.querySelector("#rain").setAttribute("aria-pressed", state.rain);
    document.querySelector("#weather-label").textContent = state.rain ? "暴雨" : "晴朗";
    document.querySelector("#activity-label").textContent = state.paused ? "设备已暂停" : "设备运行中";
  }
  speedInput.addEventListener("input", e => { state.speed = Number(e.target.value); syncControls(); });
  dayInput.addEventListener("change", e => { state.cycle = e.target.checked; syncControls(); });
  timeInput.addEventListener("change", e => { state.time = Number(e.target.value); state.cycle = false; syncControls(); });
  buildInput.addEventListener("change", e => {
    state.buildMode = e.target.value === "auto" ? "auto" : "manual";
    if (state.buildMode === "manual") state.manualBuild = Number(e.target.value);
    syncControls();
  });
  cameraInput.addEventListener("change", e => { setCameraPreset(e.target.value); syncControls(); });
  dustInput.addEventListener("change", e => { state.dust = Number(e.target.value); syncControls(); });
  document.querySelector("#pause").addEventListener("click", () => { state.paused = !state.paused; syncControls(); });
  document.querySelector("#rain").addEventListener("click", () => { state.rain = !state.rain; syncControls(); });
  document.querySelector("#reset-camera").addEventListener("click", () => { setCameraPreset("overview"); lastInteraction = performance.now(); });
  window.addEventListener("keydown", e => {
    if (e.code === "Space" && !["INPUT", "SELECT", "BUTTON"].includes(document.activeElement?.tagName)) { e.preventDefault(); state.rain = !state.rain; syncControls(); }
  });
  window.addEventListener("message", e => {
    if (e.source !== parent || e.data?.type !== "little-works-visibility") return;
    state.externalPause = !e.data.active;
  });
  const initialBuildTime = Number(query.get("buildTime"));
  let last = 0, time = Number.isFinite(initialBuildTime) ? initialBuildTime : 0, weatherTime = 0, sampleTime = 0, sampleFrames = 0, budgetSamples = 0;
  const buildCycleSeconds = 210;
  const buildPhases = [
    { end: .18, name: "基坑与测量" },
    { end: .38, name: "基础与钢筋" },
    { end: .78, name: "主体结构" },
    { end: .92, name: "安装与收尾" },
    { end: .97, name: "完工验收" },
    { end: 1, name: "新工期转场" },
  ];
  const manualBuildPhases = [
    { end: .18, name: "基坑与测量" },
    { end: .38, name: "基础与钢筋" },
    { end: .78, name: "主体结构" },
    { end: .92, name: "安装与收尾" },
    { end: 1.01, name: "完工验收" },
  ];
  const districtPhases = [
    { id: "earthworks", name: "基坑区", start: 0, end: .34 },
    { id: "west-logistics", name: "西侧后勤区", start: .1, end: .58 },
    { id: "structure", name: "主体结构区", start: .14, end: .92 },
    { id: "north-utilities", name: "北侧管线区", start: .28, end: .82 },
    { id: "east-precast", name: "东侧预制区", start: .44, end: .97 },
  ];
  function updateConstruction(simulationTime) {
    const cycle = ((simulationTime % buildCycleSeconds) + buildCycleSeconds) % buildCycleSeconds;
    const cyclePosition = cycle / buildCycleSeconds;
    const autoProgress = cyclePosition < .92
      ? cyclePosition / .92
      : cyclePosition < .97
        ? 1
        : 1 - smooth01((cyclePosition - .97) / .03);
    state.buildProgress = state.buildMode === "manual"
      ? state.manualBuild
      : autoProgress;
    state.resetTransition = state.buildMode === "auto" && cyclePosition >= .97
      ? smooth01((cyclePosition - .97) / .03)
      : 0;
    const phases = state.buildMode === "manual"
      ? manualBuildPhases
      : buildPhases;
    const phasePosition = state.buildMode === "manual"
      ? state.buildProgress
      : cyclePosition;
    state.buildPhase = phases.find(phase => phasePosition < phase.end)?.name ?? phases[0].name;
    metrics.construction = {
      cycleSeconds: buildCycleSeconds,
      cyclePosition,
      progress: state.buildProgress,
      phase: state.buildPhase,
      mode: state.buildMode,
      resetTransition: state.resetTransition,
    };
    metrics.districts = districtPhases.map(district => {
      const progress = smooth01(
        (state.buildProgress - district.start) /
        (district.end - district.start),
      );
      const status = state.resetTransition > 0
        ? "resetting"
        : state.buildProgress < district.start
          ? "queued"
          : state.buildProgress < district.end
            ? "active"
            : "complete";
      return {
        ...district,
        progress: Number(progress.toFixed(3)),
        status,
      };
    });
  }
  const projection = new THREE.Vector3();
  function render(now) {
    requestAnimationFrame(render);
    const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
    if (document.hidden || state.externalPause) return;
    if (!state.paused) time += dt * state.speed;
    weatherTime += dt;
    if (state.cycle && !state.paused) state.time = (state.time + dt / 150) % 1;
    updateConstruction(time);
    const lighting = sampleLighting(state.time);
    const { from, to, mix } = lighting;
    lightingSky.copy(from.sky).lerp(to.sky, mix);
    lightingFog.copy(from.fog).lerp(to.fog, mix);
    lightingSun.copy(from.sun).lerp(to.sun, mix);
    scene.background.copy(lightingSky);
    if (state.rain) scene.background.multiplyScalar(.66);
    scene.fog.color.copy(state.rain ? scene.background : lightingFog);
    const sunPower = THREE.MathUtils.lerp(from.sunPower, to.sunPower, mix);
    const lampFactor = THREE.MathUtils.lerp(from.lamps, to.lamps, mix);
    const solarHeight = Math.max(0, Math.sin((state.time - .25) * Math.PI * 2));
    sun.intensity = (state.rain ? sunPower * .35 : sunPower);
    sun.position.set(Math.cos((state.time - .25) * Math.PI * 2) * 20, 2 + solarHeight * 23, Math.sin((state.time - .25) * Math.PI * 2) * 15);
    sun.color.copy(lightingSun);
    hemi.intensity = THREE.MathUtils.lerp(from.hemi, to.hemi, mix);
    fill.intensity = THREE.MathUtils.lerp(from.fill, to.fill, mix);
    moon.intensity = THREE.MathUtils.lerp(from.moon, to.moon, mix);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(from.exposure, to.exposure, mix);
    warmMaterial.emissiveIntensity = lampFactor * 1.75 + (state.rain ? .55 : 0);
    glowMaterial.uniforms.strength.value = lampFactor * .75 + (state.rain ? .4 : 0);
    for (const lamp of lamps) lamp.light.intensity = lampFactor * 14 + (state.rain ? 8 : 0);
    luminousMaterial.color.setRGB(1, .72 + solarHeight * .18, .38 + solarHeight * .36);
    roadMaterial.roughness = state.rain ? .23 : .95; roadMaterial.metalness = state.rain ? .3 : .03;
    wetMaterial.opacity = state.rain ? .45 : 0;
    metrics.activity = {
      excavators: 0,
      cranes: 0,
      dumpTrucks: 0,
      mixerTrucks: 0,
      loader: 0,
      workers: 0,
    };
    metrics.lod = {
      highDetailZones: 0,
      lowDetailZones: 0,
      hiddenZones: 0,
      renderedInstances: 0,
      zones: [],
    };
    for (const fn of dynamic) fn(time);
    const phaseLabel = state.time < .125 || state.time >= .875
      ? "夜晚"
      : state.time < .375
        ? "黎明"
        : state.time < .625
          ? "正午"
          : "黄昏";
    const activeMachines =
      metrics.activity.excavators +
      metrics.activity.cranes +
      metrics.activity.dumpTrucks +
      metrics.activity.mixerTrucks +
      metrics.activity.loader;
    document.querySelector("#phase-label").textContent = phaseLabel;
    document.querySelector("#build-label").textContent = `${state.buildPhase} · ${Math.round(state.buildProgress * 100)}%`;
    const activeDistricts = metrics.districts.filter(
      district => district.status === "active",
    ).length;
    document.querySelector("#activity-label").textContent = state.paused
      ? "设备已暂停"
      : `${activeDistricts} 区 · ${metrics.activity.workers} 人 / ${activeMachines} 台`;
    dustMaterial.uniforms.time.value = time; dustMaterial.uniforms.intensity.value = state.rain ? .03 : Math.max(state.dust, state.resetTransition * 1.25);
    rain.visible = state.rain;
    if (state.rain) {
      for (let i = 0; i < rainSeeds.length; i++) {
        const drop = rainSeeds[i];
        const roof = drop.x > 2.05 && drop.x < 6.95 && drop.z > -3.8 && drop.z < .7 ? 5.6 :
          drop.x > -6.7 && drop.x < -2.3 && drop.z > 2.2 && drop.z < 4.6 ? 2.08 :
          drop.x > -3.4 && drop.x < 3.4 && drop.z > -5.05 && drop.z < -3.45 ? 1.7 : .04;
        const y = roof + (11 - roof) - ((drop.y + weatherTime * 9) % (11 - roof));
        rainPositions.set([drop.x, y, drop.z, drop.x - .09, y + .35, drop.z + .045], i * 6);
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    knobs[0].rotation.y = -state.speed * 2.1; knobs[1].rotation.y = state.cycle ? -.7 : .7; knobs[2].rotation.y = -state.dust * 2.4;
    if (cameraTransition) {
      const progress = Math.min(1, (now - cameraTransition.started) / 900);
      const eased = progress * progress * (3 - 2 * progress);
      camera.position.lerpVectors(cameraTransition.fromPosition, cameraTransition.toPosition, eased);
      controls.target.lerpVectors(cameraTransition.fromTarget, cameraTransition.toTarget, eased);
      if (progress === 1) cameraTransition = null;
    }
    controls.autoRotate = !cameraTransition && performance.now() - lastInteraction > 8000 && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    controls.update();
    renderer.render(scene, camera);
    metrics.frame++; metrics.calls = renderer.info.render.calls; metrics.triangles = renderer.info.render.triangles;
    sampleFrames++; sampleTime += dt;
    if (sampleTime > 1.5) {
      metrics.fps = Math.round(sampleFrames / sampleTime);
      document.querySelector("#fps-label").textContent = `${metrics.fps} FPS`;
      metrics.lighting = {
        phase: phaseLabel,
        sky: `#${scene.background.getHexString()}`,
        sunIntensity: sun.intensity,
        hemiIntensity: hemi.intensity,
        lampFactor,
        exposure: renderer.toneMappingExposure,
      };
      metrics.knobs = knobs.map((knob, i) => { knob.getWorldPosition(projection); projection.project(camera); return { id: i, x: (projection.x + 1) / 2 * innerWidth, y: (1 - projection.y) / 2 * innerHeight }; });
      if (++budgetSamples > 2 && metrics.fps < 45 && renderer.getPixelRatio() > 1) renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() - .2));
      sampleTime = 0; sampleFrames = 0;
    }
  }
  window.addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
    resetCamera();
    lastInteraction = performance.now();
  });
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); errorBox.hidden = false; errorBox.textContent = "WebGL 上下文已丢失，请刷新沙盘恢复。"; });
  syncControls();
  requestAnimationFrame(render);
}
