import * as THREE from "three-r160";
import { OrbitControls } from "three-r160/examples/jsm/controls/OrbitControls.js";
import { lampPositions, loaderPaths, vehiclePose } from "./traffic.js";
import { createFrameSampler } from "./performance.js";
import { EXPANSION_DISTRICTS } from "./site-expansion.js";
import { createOfficeBuilding } from "./office-building.js";
import { BUILD_CHAPTERS, BUILD_CYCLE_SECONDS, BUILD_GROW_END, BUILD_RESET_START, CAMERA_NAMES, DEFAULT_SETTINGS, EQUIPMENT, OBSERVATION_KEY, OBSERVATION_TIMELINE, OBSERVATION_VERSION, SITE_ZONES, constructionAt, formatSceneTime, getChapter, getQualityProfile, getSceneFov, getSceneMinute, normalizeSettings, readObservation } from "./studio-state.js";

const canvas = document.querySelector("#scene");
const errorBox = document.querySelector("#scene-error");
const query = new URLSearchParams(location.search);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const $ = selector => document.querySelector(selector);
let sceneStatus = "loading";
function reportToDesktop(type) {
  if (type === "little-works-ready") sceneStatus = "ready";
  if (type === "little-works-error") sceneStatus = "error";
  if (parent !== window) parent.postMessage({ type }, location.origin === "null" ? "*" : location.origin);
}
window.addEventListener("message", event => {
  if (event.source !== parent || (location.origin !== "null" && event.origin !== location.origin) || event.data?.type !== "little-works-status-request") return;
  if (sceneStatus !== "loading") reportToDesktop(`little-works-${sceneStatus}`);
});
function showSceneError(message) {
  const restoreFocus = errorBox.contains(document.activeElement);
  errorBox.hidden = false;
  errorBox.replaceChildren(document.createTextNode(message));
  const retry = document.createElement("button");
  retry.textContent = "重新载入沙盘";
  retry.addEventListener("click", () => location.reload());
  errorBox.append(retry);
  if (restoreFocus) retry.focus({ preventScroll: true });
  reportToDesktop("little-works-error");
}
function showSceneReady() {
  if (sceneStatus === "ready") return;
  const restoreFocus = errorBox.contains(document.activeElement);
  errorBox.hidden = true;
  if (restoreFocus) canvas.focus({ preventScroll: true });
  reportToDesktop("little-works-ready");
}
const SITE_LAYOUT = {
  previousWidth: 27.5,
  previousDepth: 20.25,
  width: 31.5,
  depth: 24.25,
  fenceHalfX: 15.45,
  fenceHalfZ: 11.75,
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
  ...DEFAULT_SETTINGS,
  paused: reducedMotion.matches,
  cycle: !reducedMotion.matches,
  buildProgress: 0,
  buildPhase: "基坑与测量",
  resetTransition: 0,
  externalPause: false,
  contextLost: false,
  renderFailed: false,
};
if (query.has("build") && Number.isFinite(Number(query.get("build")))) {
  state.buildMode = "manual";
  state.manualBuild = Math.max(0, Math.min(1, Number(query.get("build"))));
}
if (query.has("time") && Number.isFinite(Number(query.get("time")))) {
  state.time = normalizeSettings({ time: Number(query.get("time")) }).time;
  state.cycle = false;
}
if (CAMERA_NAMES.includes(query.get("view")) && query.get("view") !== "custom") state.camera = query.get("view");
if (["auto", "high", "low"].includes(query.get("quality"))) state.quality = query.get("quality");
if (query.get("rain") === "1") state.rain = true;
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
  showSceneError("这台设备暂时无法启动三维场景。可以开启浏览器硬件加速后重试，或换用支持 WebGL 的浏览器。");
}
if (renderer) {
  try { initialize(); } catch (error) {
    showSceneError("沙盘未能完成载入。请重新载入；如果持续出现，可以从桌面右上角独立打开沙盘再试。");
    console.error("Little Works initialization failed:", error);
  }
}

function initialize() {
  const initialQuality = getQualityProfile(state.quality, innerWidth, devicePixelRatio);
  renderer.setPixelRatio(initialQuality.ratio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = initialQuality.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  // r160 normally clears render.info after the shadow pass. Reset explicitly
  // before the whole frame so the visible diagnostics include that cost too.
  renderer.info.autoReset = false;
  const frameSampler = createFrameSampler();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#2c3541");
  scene.fog = new THREE.FogExp2("#2c3541", innerWidth / innerHeight < .75 ? .009 : .012);
  const camera = new THREE.PerspectiveCamera(getSceneFov(innerWidth, innerHeight), innerWidth / innerHeight, .1, 160);
  const desktopPosition = new THREE.Vector3(34, 16, 39);
  const compactPosition = new THREE.Vector3(27, 14, 32);
  const mobilePosition = new THREE.Vector3(38, 46, 44);
  const overviewPosition = () => innerWidth / innerHeight < .75 ? mobilePosition : innerHeight < 560 && innerWidth / innerHeight > 1.45 ? compactPosition : desktopPosition;
  const resetCamera = () => {
    camera.position.copy(overviewPosition());
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
  controls.minPolarAngle = .12;
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
    excavation: { position: new THREE.Vector3(-14, 13, -10), mobilePosition: new THREE.Vector3(-19, 18, -15), target: new THREE.Vector3(-4.5, .25, -.8) },
    structure: { position: new THREE.Vector3(17, 9.5, 14), mobilePosition: new THREE.Vector3(22, 14, 22), target: new THREE.Vector3(4.5, 2, -1.55) },
    finished: { position: new THREE.Vector3(13.8, 8.7, 11.4), mobilePosition: new THREE.Vector3(11.2, 8.6, 9.8), target: new THREE.Vector3(4.5, 2.8, -.95) },
    rebar: { position: new THREE.Vector3(-11, 6.2, 12), mobilePosition: new THREE.Vector3(-14, 9, 17), target: new THREE.Vector3(-4.5, .65, 3.4) },
    office: { position: new THREE.Vector3(-8, 5.5, 7), mobilePosition: new THREE.Vector3(-9, 9, 15), target: new THREE.Vector3(0, .9, -4.25) },
    logistics: { position: new THREE.Vector3(-22, 7, 10), mobilePosition: new THREE.Vector3(-25, 11, 15), target: new THREE.Vector3(-11.75, .6, -.25) },
    utilities: { position: new THREE.Vector3(9, 10, 22), mobilePosition: new THREE.Vector3(12, 15, 26), target: new THREE.Vector3(0, .4, 8.72) },
    precast: { position: new THREE.Vector3(23, 8, 13), mobilePosition: new THREE.Vector3(28, 13, 20), target: new THREE.Vector3(11.75, .9, .35) },
    loader: { position: new THREE.Vector3(15, 7, 9), mobilePosition: new THREE.Vector3(19, 10, 14), target: new THREE.Vector3(7.12, .45, 1.1) },
    entrance: { position: new THREE.Vector3(-15, 8, 21), mobilePosition: new THREE.Vector3(-19, 12, 26), target: new THREE.Vector3(-8.4, .6, 9.5) },
    materials: { position: new THREE.Vector3(-16, 8, 2), mobilePosition: new THREE.Vector3(-21, 12, 8), target: new THREE.Vector3(-9.6, .6, -9.5) },
    welfare: { position: new THREE.Vector3(10, 6, 2), mobilePosition: new THREE.Vector3(15, 10, 9), target: new THREE.Vector3(8.1, .9, -9.8) },
    plan: { position: new THREE.Vector3(0, 40, 5), mobilePosition: new THREE.Vector3(0, 56, 7), target: new THREE.Vector3(0, .5, 0) },
  };
  let cameraTransition = null;
  function clearCameraInertia() {
    // OrbitControls retains drag deltas even after assigning a saved pose. Drain
    // them without rendering the intermediate position, then restore this pose.
    const position = camera.position.clone(), target = controls.target.clone();
    const damping = controls.enableDamping;
    controls.autoRotate = false;
    controls.enableDamping = false;
    controls.update();
    camera.position.copy(position); controls.target.copy(target);
    controls.update();
    controls.enableDamping = damping;
  }
  function setCameraPreset(name) {
    if (name !== "overview" && !cameraViews[name]) return;
    clearCameraInertia();
    state.camera = name;
    $("#camera-view").value = name;
    const view = name === "overview"
      ? {
          position: overviewPosition(),
          target: new THREE.Vector3(0, 1.1, 0),
        }
      : cameraViews[name];
    const position =
      innerWidth / innerHeight < .75 && view.mobilePosition
        ? view.mobilePosition
      : view.position;
    lastInteraction = performance.now();
    if (reducedMotion.matches) {
      camera.position.copy(position);
      controls.target.copy(view.target);
      cameraTransition = null;
      controls.update();
      return;
    }
    cameraTransition = {
      fromPosition: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPosition: position.clone(),
      toTarget: view.target.clone(),
      started: performance.now(),
    };
  }
  let lastInteraction = performance.now();
  controls.addEventListener("start", () => {
    lastInteraction = performance.now();
    cameraTransition = null;
    controls.autoRotate = false;
    state.camera = "custom";
    $("#camera-view").value = "custom";
  });
  controls.addEventListener("end", () => { lastInteraction = performance.now(); });

  const hemi = new THREE.HemisphereLight("#d5edff", "#6b4935", 2.3);
  const sun = new THREE.DirectionalLight("#fff3d6", 3.7);
  sun.position.set(-10, 23, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(initialQuality.shadowSize, initialQuality.shadowSize);
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
    { at: 0, name: "夜晚", sky: "#081326", fog: "#0d1a2e", sun: "#7f9fd0", sunPower: .04, hemi: .48, fill: .26, moon: 1.15, lamps: 1, exposure: .97 },
    { at: .25, name: "黎明", sky: "#b36a73", fog: "#8a6470", sun: "#ffad6f", sunPower: 2.15, hemi: 1.05, fill: .42, moon: .15, lamps: .42, exposure: 1.04 },
    { at: .5, name: "正午", sky: "#6f9fbd", fog: "#7798a8", sun: "#fff0d0", sunPower: 4.15, hemi: 2.35, fill: 1.1, moon: 0, lamps: 0, exposure: 1.18 },
    { at: .75, name: "黄昏", sky: "#884b61", fog: "#69465b", sun: "#ff8552", sunPower: 1.7, hemi: 1.02, fill: .5, moon: .32, lamps: .72, exposure: 1.07 },
    { at: 1, name: "夜晚", sky: "#081326", fog: "#0d1a2e", sun: "#7f9fd0", sunPower: .04, hemi: .48, fill: .26, moon: 1.15, lamps: 1, exposure: .97 },
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
    // Bounds must describe the complete model before stage animations shrink it.
    // Otherwise r160 can cache a tiny first-frame bound and cull later floors.
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
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
  meshBox(scene, 0, -1.28, 0, 40.5, .75, 33, woodMat);
  meshBox(scene, 0, -1.72, 0, 39.6, .14, 32.1, new THREE.MeshStandardMaterial({ color: "#201c1a", roughness: .6 }));
  const room = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: "#262a32", roughness: .9 }));
  room.rotation.x = -Math.PI / 2; room.position.y = -6; room.receiveShadow = true; scene.add(room);
  box(terrain, 0, -.68, 0, SITE_LAYOUT.width, .38, SITE_LAYOUT.depth, "#47515b");
  box(terrain, 0, -.46, 0, SITE_LAYOUT.width - .4, .15, SITE_LAYOUT.depth - .4, "#b09b69");
  // Four slabs leave a real opening for the excavation; no painted hole or overlapping ground.
  box(terrain, -9.1, -.18, 0, 3.8, .4, 16, "#b8a477");
  box(terrain, 4.6, -.18, 0, 12.8, .4, 16, "#b5a078");
  box(terrain, -4.5, -.18, -5.5, 5.4, .4, 5, "#bba67b");
  box(terrain, -4.5, -.18, 4.7, 5.4, .4, 6.6, "#b09b6e");
  box(terrain, 0, -.18, 9.9625, 31.1, .4, 3.925, "#ad9c75");
  box(terrain, 0, -.18, -9.9625, 31.1, .4, 3.925, "#b6a37c");
  box(terrain, -13.275, -.18, 0, 4.55, .4, 16, "#ae9a70");
  box(terrain, 13.275, -.18, 0, 4.55, .4, 16, "#b7a77f");
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
  const roads = [];
  box(roads, 0, .012, -5.9, 19.5, .025, 2, "#ffffff");
  box(roads, 0, .012, 5.7, 19.5, .025, 2, "#ffffff");
  box(roads, -8.85, .012, -.1, 2.05, .025, 10.2, "#ffffff");
  box(roads, 8.85, .012, -.1, 2.05, .025, 10.2, "#ffffff");
  // A flush entrance apron visibly joins the loop. The existing fleet stays on
  // its established circuit; these facilities do not imply a new driving route.
  box(roads, -6.95, .012, 9.225, 2.8, .025, 5.05, "#ffffff");
  batch(scene, roads, roadMaterial).name = "site-roads";
  for (let i = -8; i <= 8; i += 1.2) for (const z of [-5.9, 5.7]) box(terrain, i, .031, z, .55, .009, .055, "#e4d4a8");
  for (let i = -4.8; i < 5; i += 1.2) for (const x of [-8.85, 8.85]) box(terrain, x, .031, i, .055, .009, .55, "#e4d4a8");
  groundSign("SERVICE LOOP  /  KEEP CLEAR", 3.6, 5.7, 4.2);

  // A continuous green pedestrian route uses the newly gained outer shoulder.
  // Paint is flush; nothing is placed in the vehicle swept envelope.
  box(terrain, -14.2, .026, 2.05, .78, .009, 19.4, "#66887f");
  box(terrain, -.13, .026, -7.6, 27.36, .009, .65, "#66887f");
  box(terrain, 8.1, .037, -8.34, .85, .004, 1.18, "#66887f");
  for (let z = -6.8; z < 11; z += 1.4)
    box(terrain, -14.2, .033, z, .085, .004, .38, "#e6e7d7");
  for (const x of [-8.26, -5.64]) box(terrain, x, .03, 9.24, .055, .008, 4.92, "#e6b747");
  for (let i = 0; i < 7; i++) box(terrain, -8.08 + i * .37, .034, 7.4, .19, .008, .6, "#e3dfc9");
  // Two shallow drainage runs, independent of the active excavation.
  for (const x of [-15.1, 15.1]) box(terrain, x, .023, 0, .13, .006, 22.4, "#526668");

  const fenceColors = ["#80a8a8", "#e8dbb8", "#8fa1a7"];
  for (let i = 0; i < 62; i++) {
    const x = -15.25 + i * .5;
    for (const z of [-SITE_LAYOUT.fenceHalfZ, SITE_LAYOUT.fenceHalfZ]) {
      if (z > 0 && x > -8.5 && x < -5.5) continue;
      if (z > 0 && x >= -14.75 && x <= -13.75) continue;
      box(terrain, x, .48, z, .47, .94, .09, fenceColors[Math.floor(i / 8) % 3]);
      box(terrain, x, .97, z, .5, .055, .12, "#dfded1");
    }
  }
  for (let i = 0; i < 47; i++) for (const x of [-SITE_LAYOUT.fenceHalfX, SITE_LAYOUT.fenceHalfX]) {
    box(terrain, x, .48, -11.5 + i * .5, .09, .94, .47, fenceColors[Math.floor(i / 8) % 3]);
  }
  for (const x of [-14.95, -13.55]) box(terrain, x, .79, 11.75, .12, 1.58, .12, "#496d80");
  box(terrain, -14.25, 1.57, 11.75, 1.52, .15, .17, "#e6b747");
  for (const x of [-8.6, -5.3]) { box(terrain, x, 1.1, SITE_LAYOUT.fenceHalfZ, .2, 2.2, .2, "#344b57"); }
  box(terrain, -6.95, 2.15, SITE_LAYOUT.fenceHalfZ, 3.5, .42, .22, "#385766");
  sign("LITTLE WORKS  /  SITE 001", -6.95, 2.17, SITE_LAYOUT.fenceHalfZ + .14, 3.2, .31, 0, "#e9c15b");
  sign("HARD HAT AREA", 7.4, .66, SITE_LAYOUT.fenceHalfZ + .07, 2.5, .5, 0, "#e5cb70");

  // One building grows from a frame into a finished office. Each material is one
  // shared-geometry batch; small interior/roof details are omitted in distant views.
  const building = new THREE.Group(); building.position.set(4.5, 0, -1.55); scene.add(building);
  const officeModel = createOfficeBuilding();
  const officeGlassMaterial = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: .26, metalness: .32 });
  const officeNightMaterial = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
  const officeBatches = [
    ["structure", roughMaterial, true],
    ["facade", roughMaterial, true],
    ["glazing", officeGlassMaterial, false],
    ["details", roughMaterial, false],
    ["nightWindows", officeNightMaterial, false],
  ].map(([key, material, shadows]) => {
    const entries = officeModel[key];
    const mesh = batch(building, entries, material, shadows);
    mesh.name = `building-${key === "nightWindows" ? "night-windows" : key}`;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const paint = entries.map(entry => entry.paintColor ? {
      from: new THREE.Color(entry.c), to: new THREE.Color(entry.paintColor),
    } : null);
    return { key, entries, mesh, paint, visible: 0 };
  });
  const officeDetails = officeBatches.find(group => group.key === "details");
  const officeNight = officeBatches.find(group => group.key === "nightWindows");
  const officeNameplate = officeModel.facade.find(entry => entry.id === "entry-nameplate");
  const officeSign = label("LITTLE WORKS", officeNameplate.w * .94, officeNameplate.h * .85, {
    background: "#354b56", color: "#d9dfdb", border: false, font: "bold 40px monospace",
  });
  officeSign.name = "office-nameplate";
  officeSign.position.set(officeNameplate.x, officeNameplate.y, officeNameplate.z + officeNameplate.d / 2 + .003);
  building.add(officeSign);
  const allOfficeEntries = officeBatches.flatMap(group => group.entries);
  const permanentStructureCount = allOfficeEntries.filter(entry => (entry.removeAt ?? 2) >= 2).length;
  const officeCenter = new THREE.Vector3(4.5, 2.8, -1.55);
  let officeFineDetail = true;
  let lastBuildingProgress = NaN;
  dynamic.push(() => {
    const distance = camera.position.distanceTo(officeCenter);
    if (state.quality === "low" || distance > 28) officeFineDetail = false;
    else if (distance < 25) officeFineDetail = true;
    officeDetails.mesh.visible = officeFineDetail && officeDetails.visible > 0;
    if (metrics.building) metrics.building.finishDetail = officeFineDetail;
    if (state.buildProgress === lastBuildingProgress) return;
    lastBuildingProgress = state.buildProgress;
    officeSign.visible = state.buildProgress >= officeNameplate.stage + officeNameplate.duration;
    let visible = 0, permanentVisible = 0, paintedPanels = 0;
    for (const group of officeBatches) {
      let batchVisible = 0, drawCount = 0, paintChanged = false;
      group.entries.forEach((entry, index) => {
        let reveal = smooth01((state.buildProgress - entry.stage) / (entry.duration ?? .055));
        if ((entry.removeAt ?? 2) < 2)
          reveal *= 1 - smooth01((state.buildProgress - entry.removeAt) / .045);
        const scale = Math.max(.001, reveal);
        const lateralScale = Math.max(.001, smooth01(reveal * 4));
        cubeMatrix.position.set(entry.x, entry.y - entry.h * (1 - scale) / 2, entry.z);
        cubeMatrix.scale.set(entry.w * lateralScale, entry.h * scale, entry.d * lateralScale);
        cubeMatrix.rotation.set(entry.rx || 0, entry.ry || 0, entry.rz || 0);
        cubeMatrix.updateMatrix();
        group.mesh.setMatrixAt(index, cubeMatrix.matrix);
        const paint = group.paint[index];
        if (paint) {
          const amount = smooth01((state.buildProgress - entry.paintFrom) / (entry.paintTo - entry.paintFrom));
          group.mesh.setColorAt(index, tmpColor.lerpColors(paint.from, paint.to, amount));
          paintChanged = true;
          if (amount >= .999) paintedPanels++;
        }
        if (reveal > .001) { batchVisible++; drawCount = index + 1; }
        if (reveal > .5) visible++;
        if ((entry.removeAt ?? 2) >= 2 && reveal > .5) permanentVisible++;
      });
      group.visible = batchVisible;
      // Permanent structural entries precede temporary scaffolding/rebar.
      // Trim the invisible tail without repacking source indices or allocating
      // a new GPU buffer, and restore it naturally when scrubbing backwards.
      group.mesh.count = drawCount;
      group.mesh.visible = batchVisible > 0 && (group.key !== "details" || officeFineDetail);
      group.mesh.instanceMatrix.needsUpdate = true;
      if (paintChanged) group.mesh.instanceColor.needsUpdate = true;
    }
    metrics.building = {
      total: allOfficeEntries.length,
      visible,
      progress: state.buildProgress,
      completion: visible / allOfficeEntries.length,
      permanentVisible,
      permanentTotal: permanentStructureCount,
      permanentCompletion: permanentVisible / permanentStructureCount,
      paintedPanels,
      finishDetail: officeFineDetail,
      batches: officeBatches.map(group => ({ name: group.mesh.name, total: group.entries.length, visible: group.visible })),
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
  const officeWindows = [];
  for (let office = 0; office < 2; office++) {
    const x = -1.8 + office * 3.6, z = -4.25;
    box(terrain, x, .77, z, 3.1, 1.48, 1.45, office ? "#dce0d7" : "#86b2ba");
    box(terrain, x, 1.59, z, 3.24, .15, 1.58, "#477083");
    for (let i = 0; i < 20; i++) box(terrain, x - 1.45 + i * .15, .8, z + .735, .028, 1.32, .025, "#b7cccc");
    box(terrain, x - .95, .6, z + .757, .5, 1.1, .035, "#4d6877");
    for (const offset of [.0, .9]) box(officeWindows, x + offset, 1, z + .758, .66, .48, .03, "#ffffff");
    box(terrain, x - .95, .06, z + 1, .72, .1, .4, "#9a9d95");
  }
  batch(scene, officeWindows, warmMaterial);
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
  const lampHeads = [];
  for (const [x, z] of lampPositions) {
    box(terrain, x, 1.5, z, .065, 3, .065, "#647d89");
    box(terrain, x + .17, 3, z, .4, .07, .08, "#697b7d");
    box(lampHeads, x + .35, 2.95, z, .36, .14, .29, "#ffffff");
    const light = new THREE.PointLight("#ffce7d", 0, 6, 2);
    light.position.set(x + .35, 2.8, z); scene.add(light);
    lamps.push({ light });
  }
  batch(scene, lampHeads, luminousMaterial);
  for (let i = 0; i < 44; i++) {
    const x = -12.9 + i * .6;
    box(terrain, x, 1.18 + .07 * Math.sin(i), -11.65, .18, .2, .04, ["#dd704b", "#ecd054", "#6cb5ba"][i % 3]);
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
    persistent = false,
  }) {
    const root = new THREE.Group();
    root.name = `district:${id}`;
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
      const reveal = persistent ? 1 :
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
  for (const district of EXPANSION_DISTRICTS) {
    addLodDistrict(district);
    const plate = district.sign;
    sign(plate.text, plate.x, plate.y, plate.z, plate.width, plate.height, plate.ry || 0, "#e5d5a6");
  }
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
  const wheelGeometry = new Map();
  function wheel(parent, x, y, z, radius = .3) {
    const axle = new THREE.Group();
    axle.position.set(x, y, z);
    axle.userData.radius = radius;
    parent.add(axle);
    if (!wheelGeometry.has(radius)) wheelGeometry.set(radius, {
      tire: new THREE.CylinderGeometry(radius, radius, .22, 12),
      hub: new THREE.CylinderGeometry(radius * .42, radius * .42, .24, 8),
    });
    const geometry = wheelGeometry.get(radius);
    const mesh = new THREE.Mesh(geometry.tire, rubber);
    mesh.rotation.z = Math.PI / 2; mesh.castShadow = true; axle.add(mesh);
    const hub = new THREE.Mesh(geometry.hub, steel);
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
  loader.name = "site-loader";
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
  workerMesh.name = "site-workers";
  workerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
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
  workerToolMesh.name = "worker-tools";
  workerToolMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
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
  let lastWorkerTime = NaN, lastWorkerProgress = NaN, lastWorkerReset = NaN;
  dynamic.push(time => {
    if (time === lastWorkerTime && state.buildProgress === lastWorkerProgress && state.resetTransition === lastWorkerReset) {
      metrics.activity.workers = metrics.workers.active;
      return;
    }
    lastWorkerTime = time;
    lastWorkerProgress = state.buildProgress;
    lastWorkerReset = state.resetTransition;
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
  paper.rotation.set(-Math.PI / 2, 0, Math.PI / 2 - .08); paper.position.set(-18, -.887, 7.4); scene.add(paper);
  const props = [];
  box(props, 17.3, -.49, 11.2, 1, .72, .85, "#e4b544"); box(props, 17.3, -.09, 11.2, .77, .08, .7, "#464e50");
  for (let j = 0; j < 25; j++) { box(props, 15.8 + j * .14, -.84, 13.3, .15, .025, .22, "#d3cec0"); if (j % 2 === 0) box(props, 15.8 + j * .14, -.821, 13.33, .018, .009, .11, "#424948"); }
  box(props, -17.5, -.64, -12.7, 3.3, .3, .5, "#879390"); box(props, -17.5, -.44, -12.7, .66, .08, .31, "#b7d678"); box(props, -17.5, -.391, -12.7, .045, .012, .27, "#475b41");
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(.65, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#ebaf37", roughness: .45 }));
  helmet.position.set(17.3, -.78, -12.8); scene.add(helmet);
  box(props, 17.3, -.79, -12.8, 1.55, .07, 1.4, "#daa234"); box(props, 17.3, -.26, -12.8, .09, .18, 1, "#e7b846");
  batch(scene, props);

  // Physical knobs are raycastable; all their effects are also keyboard accessible.
  const knobGroup = new THREE.Group(); knobGroup.position.set(.5, -.64, 13.7); scene.add(knobGroup);
  const panelMat = new THREE.MeshStandardMaterial({ color: "#35434b", metalness: .5, roughness: .4 });
  meshBox(knobGroup, 0, 0, 0, 7, .28, 1.45, panelMat);
  const knobs = [];
  const knobGeometry = new THREE.CylinderGeometry(.37, .4, .26, 20);
  const knobPointerMaterial = new THREE.MeshBasicMaterial({ color: "#efbc55" });
  for (let i = 0; i < 3; i++) {
    const knob = new THREE.Mesh(knobGeometry, steel);
    knob.position.set(-2.2 + i * 2.2, .25, -.1); knob.userData.control = i; knobGroup.add(knob); knobs.push(knob);
    const pointer = meshBox(knob, 0, .14, .2, .065, .035, .17, knobPointerMaterial);
    pointer.castShadow = false;
    const caption = label(["SPEED", "DAY / NIGHT", "DUST"][i], 1.6, .26, { background: "#35434b", color: "#d8dcda", font: "36px monospace", border: false });
    caption.rotation.x = -Math.PI / 2; caption.position.set(knob.position.x, .153, .5); knobGroup.add(caption);
  }
  const raycaster = new THREE.Raycaster(), pointerPosition = new THREE.Vector2();
  let downPoint = null;
  canvas.addEventListener("pointerdown", e => { downPoint = { x: e.clientX, y: e.clientY }; canvas.focus({ preventScroll: true }); });
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
  const expansionRoofs = EXPANSION_DISTRICTS.flatMap(district => district.roofs);
  const officeRainRoofs = officeModel.roofs.map(roof => ({
    ...roof,
    minX: building.position.x + roof.x - roof.w / 2,
    maxX: building.position.x + roof.x + roof.w / 2,
    minZ: building.position.z + roof.z - roof.d / 2,
    maxZ: building.position.z + roof.z + roof.d / 2,
  }));
  const rainSeeds = Array.from({ length: 1400 }, () => {
    const x = -15 + random() * 30, z = -11.4 + random() * 22.8, y = random() * 11;
    let roof = x > -6.7 && x < -2.3 && z > 2.2 && z < 4.6 ? 2.08 :
      x > -3.4 && x < 3.4 && z > -5.05 && z < -3.45 ? 1.7 : .04;
    for (const bounds of expansionRoofs) {
      if (x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ) roof = Math.max(roof, bounds.y);
    }
    // X/Z membership never changes: only the few roof stages are checked later.
    const officeRoofs = officeRainRoofs.filter(bounds => x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ);
    return { x, y, z, roof, officeRoofs, building: x > 2.05 && x < 6.95 && z > -3.8 && z < .7 };
  });
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
  rainGeo.attributes.position.setUsage(THREE.DynamicDrawUsage);
  rainGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 5.5, 0), 20.5);
  let lastRainTime = NaN, lastRainProgress = NaN, lastRainCount = 0;
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: "#abc3d1", transparent: true, opacity: .48, depthWrite: false })); rain.visible = false; scene.add(rain);
  rain.name = "site-rain";
  const glowMaterial = new THREE.ShaderMaterial({
    uniforms: { strength: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;vec4 c=modelViewMatrix*vec4(0.,0.,0.,1.);c.xy+=position.xy;gl_Position=projectionMatrix*c;}`,
    fragmentShader: `varying vec2 vUv;uniform float strength;void main(){float a=pow(max(0.,1.-length(vUv-.5)*2.),2.5)*strength;gl_FragColor=vec4(1.,.73,.34,a);}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const glowGeometry = new THREE.PlaneGeometry(1.6, 1.6);
  for (const lamp of lamps) { const glow = new THREE.Mesh(glowGeometry, glowMaterial); glow.position.copy(lamp.light.position); scene.add(glow); }
  const wetMaterial = new THREE.MeshPhysicalMaterial({ color: "#577184", roughness: .15, metalness: .42, transparent: true, opacity: 0, clearcoat: 1 });
  const wet = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 1.2), wetMaterial); wet.rotation.x = -Math.PI / 2; wet.position.set(5, .043, 5.7); scene.add(wet);

  const speedInput = $("#speed"), dayInput = $("#cycle"), timeInput = $("#time"), buildInput = $("#build-stage"), cameraInput = $("#camera-view"), dustInput = $("#dust");
  const fieldbook = $("#fieldbook"), settingsDialog = $("#scene-settings"), resetDialog = $("#reset-confirm");
  const buildRange = $("#build-progress"), dayRange = $("#day-progress"), markersContainer = $("#site-markers");
  const tabButtons = [...document.querySelectorAll("[data-tab]")];
  const zoneButtons = new Map(), chapterButtons = new Map(), compactChapterButtons = new Map();
  const markerButtons = [];
  let selectedZone = SITE_ZONES[0], currentChapterId = null, activeTab = "story", tourIndex = -1, toastTimer;
  let qualityProfile = initialQuality, fpsThrottle = 0, lastUiTime = -Infinity, lastSamplePaused = state.paused;
  const setText = (selector, value) => { const element = $(selector); if (element.textContent !== value) element.textContent = value; };
  const labelButton = (button, text, arrow = "↗") => {
    const symbol = document.createElement("span");
    symbol.setAttribute("aria-hidden", "true");
    symbol.textContent = arrow;
    button.replaceChildren(document.createTextNode(text), symbol);
  };
  function toast(message) {
    clearTimeout(toastTimer);
    setText("#scene-toast", message);
    $("#scene-toast").hidden = false;
    toastTimer = setTimeout(() => { $("#scene-toast").hidden = true; }, 4200);
  }
  function revealActiveChapter() {
    const shortcut = compactChapterButtons.get(currentChapterId);
    if (shortcut?.getClientRects().length) shortcut.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
  }
  function setBook(open, focus = false) {
    const hidesFocusedControl = !open && fieldbook.contains(document.activeElement);
    fieldbook.hidden = !open;
    $("#fieldbook-toggle").setAttribute("aria-expanded", String(open));
    frameAroundFieldbook();
    if (open) revealActiveChapter();
    if (focus) (open ? $("#fieldbook-close") : $("#fieldbook-toggle")).focus({ preventScroll: true });
    else if (hidesFocusedControl) canvas.focus({ preventScroll: true });
  }
  function frameAroundFieldbook() {
    // A lens shift keeps the chosen subject in the center of the unobscured
    // viewport. Changing the OrbitControls target instead would orbit the wrong
    // point and let the subject drift under the notebook again.
    const panelRight = !fieldbook.hidden && innerWidth > 650 ? fieldbook.getBoundingClientRect().right : 0;
    const inset = panelRight > 0 ? Math.min(innerWidth * .4, panelRight + 20) : 0;
    if (inset) camera.setViewOffset(innerWidth, innerHeight, -inset / 2, 0, innerWidth, innerHeight);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  function setTab(name, focus = false) {
    if (!["story", "zones", "guide"].includes(name)) return;
    activeTab = name;
    for (const tab of tabButtons) {
      const selected = tab.dataset.tab === name;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      $(`#panel-${tab.dataset.tab}`).hidden = !selected;
      if (selected && focus) tab.focus();
    }
    $(".fieldbook-scroll").scrollTop = 0;
  }
  function endTour(announce = true) {
    if (tourIndex < 0) return;
    tourIndex = -1;
    $("#tour-progress").hidden = true;
    $("#tour-card").hidden = false;
    $("#quick-tour").hidden = false;
    if (announce) toast("导览结束。镜头和工序留在这里，继续随意看看。");
  }
  function chooseStage(progress, { focusCamera = false, fromTour = false, announce = false } = {}) {
    if (!fromTour) endTour(false);
    state.buildMode = "manual";
    state.manualBuild = clamp01(progress);
    state.buildProgress = state.manualBuild;
    state.resetTransition = 0;
    const chapter = getChapter(state.manualBuild);
    if (focusCamera) setCameraPreset(chapter.camera);
    syncControls();
    updateFieldbook();
    if (announce) toast(state.paused ? `已切到「${chapter.short}」。世界仍暂停，点击继续观察它的动作。` : `已切到「${chapter.short}」。工序停在这里，设备按自己的节奏运转。`);
  }
  function resumeConstruction() {
    endTour(false);
    constructionTime = Math.floor(constructionTime / BUILD_CYCLE_SECONDS) * BUILD_CYCLE_SECONDS + state.buildProgress * BUILD_CYCLE_SECONDS * BUILD_GROW_END;
    state.buildMode = "auto";
    syncControls();
    toast(state.paused ? "已接上自动工序。点击继续，让工地运行。" : "从当前进度，继续自动施工。");
  }
  function updateFieldbook() {
    const chapter = getChapter(state.buildProgress);
    if (chapter.id !== currentChapterId) {
      currentChapterId = chapter.id;
      setText("#chapter-number", chapter.number);
      setText("#chapter-eyebrow", chapter.label);
      setText("#chapter-title", chapter.title);
      setText("#chapter-story", chapter.story);
      setText("#chapter-detail", chapter.detail);
      labelButton($("#chapter-focus"), chapter.focus);
      for (const [id, button] of chapterButtons) {
        if (id === chapter.id) button.setAttribute("aria-current", "step");
        else button.removeAttribute("aria-current");
      }
      for (const [id, button] of compactChapterButtons) {
        if (id === chapter.id) button.setAttribute("aria-current", "step");
        else button.removeAttribute("aria-current");
      }
      revealActiveChapter();
    }
    const mode = state.paused ? "时间停在这里" : state.buildMode === "auto" ? "现场正在生长" : "手动工序 · 设备运行中";
    setText("#book-status", state.resetTransition > 0 ? "准备下一轮小工地" : mode);
    updateScrollHint();
  }
  function updateScrollHint() {
    const scroller = $("#fieldbook-scroll");
    const overflow = scroller.scrollHeight > scroller.clientHeight + 8;
    const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 12;
    $("#book-scroll-hint").hidden = !overflow;
    setText("#book-scroll-hint", atBottom ? "回到页首 ↑" : "向下看更多 ↓");
    $("#book-scroll-hint").dataset.direction = atBottom ? "up" : "down";
    scroller.classList.toggle("can-scroll-down", overflow && !atBottom);
  }
  function selectZone(id, moveCamera = true) {
    const zone = SITE_ZONES.find(item => item.id === id);
    if (!zone) return;
    selectedZone = zone;
    setText("#zone-code", `ZONE ${zone.code}`);
    setText("#zone-title", zone.name);
    setText("#zone-description", zone.description);
    setText("#zone-observe", zone.observe);
    labelButton($("#zone-stage"), `看看${getChapter(zone.stage).short}阶段`);
    for (const [id, button] of zoneButtons) button.setAttribute("aria-pressed", String(id === zone.id));
    for (const marker of markerButtons) marker.button.setAttribute("aria-pressed", String(marker.zone.id === zone.id));
    if (moveCamera) {
      setCameraPreset(zone.camera);
      if (innerWidth <= 650) { setBook(false); toast(`已走近${zone.name}。再次打开手札，可以继续读这里的记录。`); }
    }
    syncControls();
  }
  $("#site-plan").addEventListener("click", () => {
    setCameraPreset("plan");
    if (innerWidth <= 650) setBook(false);
    toast("绿色步行带沿外围通向后场；灰色环路留给原有车队。");
  });
  for (const chapter of BUILD_CHAPTERS) {
    const button = document.createElement("button");
    const number = document.createElement("span");
    number.textContent = chapter.number;
    button.append(number, document.createTextNode(chapter.short));
    button.setAttribute("aria-label", `第 ${Number(chapter.number)} 阶段：${chapter.label}`);
    button.addEventListener("click", () => chooseStage(chapter.progress, { announce: true }));
    $("#build-chapters").append(button);
    chapterButtons.set(chapter.id, button);
    const shortcut = document.createElement("button");
    shortcut.textContent = chapter.short;
    shortcut.title = `第 ${Number(chapter.number)} 阶段：${chapter.label}`;
    shortcut.addEventListener("click", () => chooseStage(chapter.progress, { announce: true }));
    $("#compact-chapters").append(shortcut);
    compactChapterButtons.set(chapter.id, shortcut);
  }
  for (const zone of SITE_ZONES) {
    const button = document.createElement("button"), code = document.createElement("span");
    code.textContent = zone.code;
    button.append(code, document.createTextNode(zone.name));
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => { endTour(false); selectZone(zone.id); });
    $("#zone-list").append(button);
    zoneButtons.set(zone.id, button);
    const marker = button.cloneNode(true);
    marker.className = "site-marker";
    marker.setAttribute("aria-label", `走近${zone.name}`);
    marker.addEventListener("click", () => { endTour(false); setBook(true); setTab("zones"); selectZone(zone.id); });
    markersContainer.append(marker);
    markerButtons.push({ zone, button: marker, point: new THREE.Vector3(...zone.position) });
  }
  for (const equipment of EQUIPMENT) {
    const details = document.createElement("details"), summary = document.createElement("summary");
    const count = document.createElement("span"), name = document.createElement("span"), family = document.createElement("small");
    count.textContent = equipment.number; name.textContent = equipment.name; family.textContent = equipment.family;
    summary.append(count, name, family);
    const note = document.createElement("p"), detail = document.createElement("p"), button = document.createElement("button");
    note.textContent = equipment.note; detail.textContent = equipment.detail; detail.className = "equipment-detail";
    button.className = "fieldbook-link"; labelButton(button, "看看它工作");
    button.addEventListener("click", () => {
      chooseStage(equipment.stage);
      setCameraPreset(equipment.camera);
      if (innerWidth <= 650) setBook(false);
      toast(`已走近${equipment.name}，工序切到${getChapter(equipment.stage).short}${state.paused ? "；点击继续观察动作" : ""}。`);
    });
    details.append(summary, note, detail, button);
    $("#equipment-list").append(details);
  }
  for (const tab of tabButtons) {
    tab.addEventListener("click", () => setTab(tab.dataset.tab));
    tab.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const index = tabButtons.indexOf(tab);
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabButtons.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabButtons.length) % tabButtons.length;
      setTab(tabButtons[next].dataset.tab, true);
    });
  }
  function showTourStop(index) {
    if (index >= BUILD_CHAPTERS.length) { endTour(); $("#fieldbook-toggle").focus(); return; }
    tourIndex = Math.max(0, index);
    const chapter = BUILD_CHAPTERS[tourIndex];
    chooseStage(chapter.progress, { focusCamera: true, fromTour: true });
    state.time = chapter.time; state.cycle = false; state.rain = false; state.orbit = false;
    setTab("story");
    setBook(innerWidth > 650);
    $("#tour-progress").hidden = false;
    $("#tour-card").hidden = true;
    $("#quick-tour").hidden = true;
    $("#tour-previous").disabled = tourIndex === 0;
    setText("#tour-step", `第 ${tourIndex + 1} / ${BUILD_CHAPTERS.length} 站`);
    setText("#tour-title", chapter.label);
    setText("#tour-next", tourIndex === BUILD_CHAPTERS.length - 1 ? "完成导览 ✓" : "下一站 →");
    syncControls();
    if (state.paused) toast(`${chapter.label}已就位。世界仍暂停，点击继续观察动作。`);
    else if (innerWidth <= 650) toast(`${chapter.label} · 点“手札”读这一站的观察记录。`);
  }
  function applyQuality() {
    qualityProfile = getQualityProfile(state.quality, innerWidth, devicePixelRatio);
    renderer.setPixelRatio(qualityProfile.ratio);
    renderer.shadowMap.enabled = qualityProfile.shadows;
    if (sun.shadow.mapSize.x !== qualityProfile.shadowSize) {
      sun.shadow.map?.dispose(); sun.shadow.map = null;
      sun.shadow.mapSize.set(qualityProfile.shadowSize, qualityProfile.shadowSize);
    }
    dustGeo.setDrawRange(0, qualityProfile.dustCount);
    rainGeo.setDrawRange(0, qualityProfile.rainCount * 2);
    dustMaterial.uniforms.ratio.value = renderer.getPixelRatio();
    fpsThrottle = 0;
    budgetSamples = 0; frameSampler.reset();
    const descriptions = { auto: "自动适配屏幕，运行吃力时降低分辨率。", high: "更清晰的边缘与阴影，适合性能充足的设备。", low: "减少粒子与阴影，限制为 30 帧，适合手机或省电观察。" };
    setText("#quality-description", descriptions[state.quality]);
    metrics.quality = { mode: state.quality, pixelRatio: renderer.getPixelRatio(), shadowSize: qualityProfile.shadowSize, rainCount: qualityProfile.rainCount };
  }
  function syncControls() {
    speedInput.value = state.speed; dayInput.checked = state.cycle;
    $("#speed-preset").value = String(state.speed);
    const exactChapter = BUILD_CHAPTERS.find(chapter => Math.abs(chapter.progress - state.manualBuild) < .0001);
    buildInput.value = state.buildMode === "auto" ? "auto" : exactChapter ? String(exactChapter.progress) : "custom";
    const exactTime = [0, .25, .5, .75].find(value => Math.abs(value - state.time) < .0001);
    timeInput.value = exactTime === undefined ? "custom" : String(exactTime);
    cameraInput.value = state.camera; dustInput.value = state.dust;
    $("#orbit").checked = state.orbit; $("#labels").checked = state.labels; $("#quality").value = state.quality;
    $("#orbit").disabled = reducedMotion.matches;
    setText("#speed-label", `${state.speed}×`);
    speedInput.setAttribute("aria-valuetext", `${state.speed} 倍时间流速`);
    setText("#pause-text", state.paused ? "继续" : "暂停");
    setText("#pause-symbol", state.paused ? "▶" : "Ⅱ");
    $("#pause").setAttribute("aria-label", state.paused ? "继续整个小世界" : "暂停整个小世界");
    $("#pause").setAttribute("aria-pressed", String(state.paused));
    $("#run-light").classList.toggle("is-paused", state.paused);
    $("#rain").setAttribute("aria-pressed", String(state.rain));
    setText("#rain", state.rain ? "雨天 · 切回晴朗" : "晴朗 · 下点雨");
    setText("#weather-label", state.rain ? "雨天" : "晴朗");
    setText("#timeline-mode", state.buildMode === "auto" ? "自动" : "手动");
    $("#auto-build").setAttribute("aria-pressed", String(state.buildMode === "auto"));
    $("#auto-build").title = state.buildMode === "auto" ? "把工序留在当前进度，机械继续运行" : "从当前进度接回自动施工";
    $("#auto-build").setAttribute("aria-label", state.buildMode === "auto" ? "暂停工序生长，机械继续活动" : "从当前阶段继续自动施工");
    setText("#auto-build", state.buildMode === "auto" ? "自动施工中" : "跟随自动施工");
    $("#marker-toggle").setAttribute("aria-pressed", String(state.labels));
    setText("#marker-toggle", state.labels ? "收起场地标牌" : "显示场地标牌");
    markersContainer.hidden = !state.labels;
    dayRange.value = getSceneMinute(state.time);
    setText("#day-progress-label", formatSceneTime(state.time));
    lastUiTime = -Infinity;
  }
  speedInput.addEventListener("input", e => { state.speed = Number(e.target.value); syncControls(); });
  $("#speed-preset").addEventListener("change", e => { state.speed = Number(e.target.value); syncControls(); });
  dayInput.addEventListener("change", e => { state.cycle = e.target.checked; syncControls(); });
  timeInput.addEventListener("change", e => { state.time = Number(e.target.value); state.cycle = false; syncControls(); });
  dayRange.addEventListener("input", e => { state.time = Number(e.target.value) / 1440; state.cycle = false; syncControls(); });
  buildRange.addEventListener("input", e => chooseStage(Number(e.target.value) / 100));
  buildInput.addEventListener("change", e => {
    if (e.target.value === "auto") resumeConstruction();
    else chooseStage(Number(e.target.value));
  });
  cameraInput.addEventListener("change", e => { setCameraPreset(e.target.value); syncControls(); });
  dustInput.addEventListener("change", e => { state.dust = Number(e.target.value); syncControls(); });
  $("#pause").addEventListener("click", () => { state.paused = !state.paused; syncControls(); });
  $("#rain").addEventListener("click", () => { state.rain = !state.rain; syncControls(); });
  $("#reset-camera").addEventListener("click", () => { setCameraPreset("overview"); syncControls(); });
  $("#orbit").addEventListener("change", event => { state.orbit = event.target.checked; lastInteraction = performance.now(); syncControls(); });
  $("#labels").addEventListener("change", event => { state.labels = event.target.checked; syncControls(); });
  $("#marker-toggle").addEventListener("click", () => { state.labels = !state.labels; syncControls(); });
  $("#quality").addEventListener("change", event => { state.quality = event.target.value; applyQuality(); syncControls(); });
  $("#fieldbook-toggle").addEventListener("click", () => setBook(fieldbook.hidden));
  $("#fieldbook-close").addEventListener("click", () => setBook(false, true));
  $("#chapter-focus").addEventListener("click", () => { setCameraPreset(getChapter(state.buildProgress).camera); if (innerWidth <= 650) setBook(false); syncControls(); });
  $("#auto-build").addEventListener("click", () => { if (state.buildMode !== "auto") resumeConstruction(); else { chooseStage(state.buildProgress); toast("工序留在当前进度，仍可观察机械的动作。"); } });
  $("#zone-stage").addEventListener("click", () => { chooseStage(selectedZone.stage); setCameraPreset(selectedZone.camera); if (innerWidth <= 650) setBook(false); });
  $("#start-tour").addEventListener("click", () => { showTourStop(0); $("#tour-next").focus({ preventScroll: true }); });
  $("#quick-tour").addEventListener("click", () => { showTourStop(0); $("#tour-next").focus({ preventScroll: true }); });
  $("#fieldbook-scroll").addEventListener("scroll", updateScrollHint, { passive: true });
  $("#book-scroll-hint").addEventListener("click", () => {
    const scroller = $("#fieldbook-scroll");
    scroller.scrollTo({ top: $("#book-scroll-hint").dataset.direction === "up" ? 0 : scroller.scrollTop + scroller.clientHeight * .75, behavior: reducedMotion.matches ? "auto" : "smooth" });
  });
  $("#tour-next").addEventListener("click", () => showTourStop(tourIndex + 1));
  $("#tour-previous").addEventListener("click", () => showTourStop(tourIndex - 1));
  $("#tour-exit").addEventListener("click", () => { endTour(); $("#fieldbook-toggle").focus(); });
  $("#settings-toggle").addEventListener("click", () => { refreshStorageStatus(); syncControls(); settingsDialog.showModal(); });
  $("#settings-close").addEventListener("click", () => settingsDialog.close());
  for (const dialog of [settingsDialog, resetDialog]) dialog.addEventListener("click", event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } });
  function moveCamera(zoom, horizontal = 0, vertical = 0) {
    cameraTransition = null; controls.autoRotate = false;
    clearCameraInertia();
    lastInteraction = performance.now(); state.camera = "custom";
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.radius = THREE.MathUtils.clamp(spherical.radius * zoom, controls.minDistance, controls.maxDistance);
    spherical.theta += horizontal;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi + vertical, controls.minPolarAngle, controls.maxPolarAngle);
    camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
    controls.update(); syncControls();
  }
  $("#zoom-in").addEventListener("click", () => moveCamera(.86));
  $("#zoom-out").addEventListener("click", () => moveCamera(1.16));
  window.addEventListener("keydown", e => {
    if (settingsDialog.open || resetDialog.open || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") { e.preventDefault(); if (tourIndex >= 0) { endTour(); $("#fieldbook-toggle").focus(); } else setBook(false, true); return; }
    if (["INPUT", "SELECT", "BUTTON", "TEXTAREA", "SUMMARY"].includes(document.activeElement?.tagName)) return;
    if (e.code === "Space") { e.preventDefault(); state.paused = !state.paused; syncControls(); }
    else if (e.key.toLowerCase() === "r") { state.rain = !state.rain; syncControls(); }
    else if (e.key.toLowerCase() === "h") setBook(fieldbook.hidden);
    else if (e.key === "0") { setCameraPreset("overview"); syncControls(); }
    else if (/^[1-9]$/.test(e.key)) chooseStage(BUILD_CHAPTERS[Number(e.key) - 1].progress, { announce: true });
    else if (e.key === "+" || e.key === "=") { e.preventDefault(); moveCamera(.9); }
    else if (e.key === "-") { e.preventDefault(); moveCamera(1.1); }
    else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) { e.preventDefault(); moveCamera(1, e.key === "ArrowLeft" ? -.12 : e.key === "ArrowRight" ? .12 : 0, e.key === "ArrowUp" ? -.08 : e.key === "ArrowDown" ? .08 : 0); }
  });
  window.addEventListener("message", e => {
    if (e.source !== parent || (location.origin !== "null" && e.origin !== location.origin)) return;
    if (e.data?.type !== "little-works-visibility" || typeof e.data.active !== "boolean") return;
    if (state.externalPause !== !e.data.active) {
      // A hidden iframe may receive no animation callbacks at all. Reset on the
      // visibility message itself so its first visible frame never catches up.
      last = performance.now(); fpsThrottle = 0; frameSampler.reset();
    }
    state.externalPause = !e.data.active;
  });
  reducedMotion.addEventListener("change", event => { if (event.matches) { state.orbit = false; state.paused = true; state.cycle = false; cameraTransition = null; clearCameraInertia(); } syncControls(); });

  function refreshStorageStatus(message) {
    try {
      const serialized = localStorage.getItem(OBSERVATION_KEY);
      const saved = readObservation(serialized);
      $("#restore-view").disabled = !saved;
      $("#forget-view").hidden = !serialized;
      const when = saved?.savedAt ? new Date(saved.savedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "";
      setText("#storage-status", message || (saved ? `已有观察${when ? ` · ${when}` : ""}。只保存在这台设备。` : serialized ? "这份观察无法读取，可以移除后重新保存。" : "只保存在这台设备，不会上传。"));
      return saved;
    } catch {
      $("#restore-view").disabled = true;
      $("#forget-view").hidden = true;
      setText("#storage-status", "浏览器没有开放本地存储。仍可自由观察和保存照片。");
      return null;
    }
  }
  $("#save-view").addEventListener("click", () => {
    const observation = {
      version: OBSERVATION_VERSION, settings: normalizeSettings(state), savedAt: new Date().toISOString(),
      simulationTime: time, constructionTime, constructionTimeline: OBSERVATION_TIMELINE, fleetTime: fleetRouteTime, weatherTime, loaderActivity,
      cameraPosition: camera.position.toArray(), cameraTarget: controls.target.toArray(),
    };
    try { localStorage.setItem(OBSERVATION_KEY, JSON.stringify(observation)); refreshStorageStatus("此刻已保存。恢复时会先暂停，等你继续。"); }
    catch { setText("#storage-status", "这次没有存下：浏览器本地存储不可用或已满。可以先用“留影”保存照片。"); }
  });
  $("#restore-view").addEventListener("click", () => {
    const saved = refreshStorageStatus();
    if (!saved) return;
    endTour(false);
    Object.assign(state, saved.settings, { paused: true, resetTransition: 0 });
    if (reducedMotion.matches) state.orbit = false;
    time = saved.simulationTime; constructionTime = saved.constructionTime; weatherTime = saved.weatherTime;
    fleetRouteTime = saved.fleetTime; fleetLastTime = time; loaderLastTime = time; loaderActivity = saved.loaderActivity;
    clearCameraInertia();
    camera.position.fromArray(saved.cameraPosition); controls.target.fromArray(saved.cameraTarget); cameraTransition = null; controls.update();
    updateConstruction(constructionTime); applyQuality(); syncControls(); updateFieldbook();
    settingsDialog.close(); canvas.focus({ preventScroll: true });
    toast("已恢复保存的观察。点击继续，让这个瞬间重新动起来。");
  });
  $("#forget-view").addEventListener("click", () => {
    try { localStorage.removeItem(OBSERVATION_KEY); refreshStorageStatus("已移除保存的观察，当前场景不受影响。"); }
    catch { setText("#storage-status", "浏览器没有允许修改本地存储，观察仍保留。"); }
  });
  $("#reset-scene").addEventListener("click", () => { settingsDialog.close(); resetDialog.showModal(); });
  $("#reset-cancel").addEventListener("click", () => resetDialog.close());
  $("#reset-confirm-button").addEventListener("click", () => {
    endTour(false);
    Object.assign(state, DEFAULT_SETTINGS, { paused: reducedMotion.matches, cycle: !reducedMotion.matches, resetTransition: 0 });
    time = 0; constructionTime = 0; weatherTime = 0; fleetRouteTime = 0; fleetLastTime = null; loaderLastTime = null; loaderActivity = 0;
    for (const machine of trucks) for (const axle of machine.wheels) axle.rotation.x = 0;
    for (const axle of loaderWheels) axle.rotation.x = 0;
    updateConstruction(0); applyQuality(); setCameraPreset("overview"); syncControls(); updateFieldbook();
    resetDialog.close(); canvas.focus({ preventScroll: true }); toast("新一轮小工地开始了。保存的观察还在。");
  });
  $("#capture").addEventListener("click", () => {
    const button = $("#capture");
    if (state.contextLost || state.renderFailed) { toast(state.contextLost ? "三维画面正在恢复，暂时无法留影。恢复后再试一次。" : "当前三维画面无法绘制，请重新载入后再留影。"); return; }
    button.disabled = true;
    try {
      camera.clearViewOffset();
      renderer.render(scene, camera);
      const photograph = document.createElement("canvas");
      const scale = Math.min(1, 2400 / canvas.width);
      photograph.width = Math.round(canvas.width * scale);
      const imageHeight = Math.round(canvas.height * scale), compactCaption = photograph.width < 550;
      const footerHeight = compactCaption ? 70 : Math.max(62, Math.round(photograph.width * .048));
      photograph.height = imageHeight + footerHeight;
      const context = photograph.getContext("2d");
      if (!context) throw new Error("The photo canvas is unavailable.");
      context.drawImage(canvas, 0, 0, photograph.width, imageHeight);
      context.fillStyle = "#202a31"; context.fillRect(0, imageHeight, photograph.width, footerHeight);
      const pad = Math.max(18, photograph.width * .022), fontSize = Math.max(11, Math.round(photograph.width * .012));
      context.fillStyle = "#d9b86d"; context.font = `500 ${fontSize}px monospace`; context.textBaseline = "middle";
      context.fillText("LITTLE WORKS / SITE 001", pad, imageHeight + footerHeight * (compactCaption ? .33 : .5));
      const caption = `${getChapter(state.buildProgress).short} · ${Math.round(state.buildProgress * 100)}% · ${formatSceneTime(state.time)} · ${state.rain ? "雨天" : "晴朗"}`;
      context.fillStyle = "#bccdd5"; context.textAlign = compactCaption ? "left" : "right"; context.font = `${fontSize}px sans-serif`;
      context.fillText(caption, compactCaption ? pad : photograph.width - pad, imageHeight + footerHeight * (compactCaption ? .72 : .5));
      const filename = `little-works-${getChapter(state.buildProgress).id}-${formatSceneTime(state.time).replace(":", "")}.png`;
      photograph.toBlob(blob => {
        let url, link;
        try {
          if (!blob) { toast("这次照片没有生成，请再留影一次。"); return; }
          url = URL.createObjectURL(blob); link = document.createElement("a");
          link.href = url; link.download = filename; link.hidden = true;
          document.body.append(link);
          link.click();
          toast("照片已生成。看看浏览器的下载记录。");
        } catch { toast("无法下载照片，可以独立打开沙盘后再留影一次。"); }
        finally {
          button.disabled = false;
          link?.remove();
          // Download handling is asynchronous, especially in Safari. Keep the
          // object URL alive long enough for the browser to consume the image.
          if (url) setTimeout(() => URL.revokeObjectURL(url), 60000);
        }
      }, "image/png");
    } catch { button.disabled = false; toast("无法生成照片，请重新载入场景后再试。"); }
    finally { frameAroundFieldbook(); }
  });
  $("#fullscreen").disabled = !document.fullscreenEnabled;
  if (!document.fullscreenEnabled) $("#fullscreen").title = "此浏览器不支持内嵌全屏，可从桌面独立打开沙盘";
  $("#fullscreen").addEventListener("click", async () => {
    const exiting = !!document.fullscreenElement;
    try { if (exiting) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { toast(exiting ? "暂时无法退出全屏，可以按 Esc 退出。" : "浏览器没有开启全屏，可以从桌面独立打开沙盘。"); }
  });
  document.addEventListener("fullscreenchange", () => {
    const active = !!document.fullscreenElement;
    $("#fullscreen").setAttribute("aria-pressed", String(active));
    $("#fullscreen").title = active ? "退出全屏" : "全屏观察";
    $("#fullscreen span").textContent = active ? "退出" : "全屏";
  });
  const initialBuildTime = Number(query.get("buildTime"));
  let last = 0, time = Number.isFinite(initialBuildTime) ? Math.max(0, initialBuildTime) : 0, constructionTime = time, weatherTime = 0, budgetSamples = 0;
  const buildCycleSeconds = BUILD_CYCLE_SECONDS;
  const manualBuildPhases = [
    { end: .18, name: "基坑与测量" },
    { end: .38, name: "基础与钢筋" },
    { end: .78, name: "主体结构" },
    { end: .82, name: "主体封顶" },
    { end: .88, name: "外墙与粉刷" },
    { end: .925, name: "门窗安装" },
    { end: .975, name: "装修与设备" },
    { end: 1.01, name: "竣工交付" },
  ];
  const districtPhases = [
    { id: "earthworks", name: "基坑区", start: 0, end: .34 },
    { id: "west-logistics", name: "西侧后勤区", start: .1, end: .58 },
    { id: "structure", name: "主体与装修区", start: .14, end: .975 },
    { id: "north-utilities", name: "北侧管线区", start: .28, end: .82 },
    { id: "east-precast", name: "东侧预制区", start: .44, end: .97 },
  ];
  function updateConstruction(simulationTime) {
    const { cyclePosition, progress, resetTransition } = constructionAt(simulationTime, state.buildMode, state.manualBuild);
    state.buildProgress = progress;
    state.resetTransition = resetTransition;
    state.buildPhase = state.buildMode === "auto" && cyclePosition >= BUILD_RESET_START
      ? "新工期转场"
      : manualBuildPhases.find(phase => progress < phase.end)?.name ?? "竣工交付";
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
    if (document.hidden || state.externalPause || state.contextLost || state.renderFailed) { last = now; frameSampler.reset(); return; }
    if (qualityProfile.fps === 30) {
      const interval = 1000 / 30, elapsed = now - fpsThrottle;
      if (elapsed < interval - .5) return;
      // Carry the remainder: small rAF jitter must not repeatedly turn two
      // display frames into three and drag the lightweight mode below 30 fps.
      fpsThrottle += Math.max(1, Math.floor((elapsed + .5) / interval)) * interval;
    } else fpsThrottle = now;
    if (state.paused !== lastSamplePaused) { frameSampler.reset(); lastSamplePaused = state.paused; }
    const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
    if (!state.paused) {
      time += dt * state.speed;
      weatherTime += dt * state.speed;
      if (state.buildMode === "auto") constructionTime += dt * state.speed;
      if (state.cycle) state.time = (state.time + dt * state.speed / 150) % 1;
    }
    updateConstruction(constructionTime);
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
    officeNight.mesh.visible = officeNight.visible > 0 && lampFactor > .12;
    officeNightMaterial.color.setScalar(.32 + lampFactor * .68);
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
    const activeDistricts = metrics.districts.filter(
      district => district.status === "active",
    ).length;
    if (now - lastUiTime > 120) {
      setText("#phase-label", phaseLabel);
      setText("#clock-label", formatSceneTime(state.time));
      setText("#build-label", `${state.buildPhase} · ${Math.round(state.buildProgress * 100)}%`);
      setText("#activity-label", state.paused ? "世界已暂停 · 镜头可自由移动" : `${activeDistricts} 区作业 · ${metrics.activity.workers} 人 / ${activeMachines} 台`);
      setText("#build-progress-label", `${Math.round(state.buildProgress * 100)}%`);
      buildRange.setAttribute("aria-valuetext", `${getChapter(state.buildProgress).short}，施工进度 ${Math.round(state.buildProgress * 100)}%`);
      if (document.activeElement !== buildRange) buildRange.value = Math.round(state.buildProgress * 100);
      if (document.activeElement !== dayRange) dayRange.value = getSceneMinute(state.time);
      setText("#day-progress-label", formatSceneTime(state.time));
      dayRange.setAttribute("aria-valuetext", formatSceneTime(state.time));
      if (state.cycle) timeInput.value = "custom";
      updateFieldbook();
      lastUiTime = now;
    }
    dustMaterial.uniforms.time.value = time; dustMaterial.uniforms.intensity.value = state.rain ? .03 : Math.max(state.dust, state.resetTransition * 1.25);
    rain.visible = state.rain;
    if (state.rain && (weatherTime !== lastRainTime || state.buildProgress !== lastRainProgress || qualityProfile.rainCount !== lastRainCount)) {
      // Rain only meets a roof once the corresponding slab exists. Early stages
      // must not show droplets stopping above an otherwise empty construction bay.
      const buildingRoof = state.buildProgress > .74 ? 5.215 : state.buildProgress > .57 ? 3.565 : state.buildProgress > .4 ? 1.915 : state.buildProgress > .195 ? .24 : .04;
      for (let i = 0; i < qualityProfile.rainCount; i++) {
        const drop = rainSeeds[i];
        let roof = drop.building ? Math.max(buildingRoof, drop.roof) : drop.roof;
        for (const roofPart of drop.officeRoofs) {
          if (state.buildProgress >= roofPart.stage) roof = Math.max(roof, roofPart.y);
        }
        const y = roof + (11 - roof) - ((drop.y + weatherTime * 9) % (11 - roof));
        const offset = i * 6;
        rainPositions[offset] = drop.x; rainPositions[offset + 1] = y; rainPositions[offset + 2] = drop.z;
        rainPositions[offset + 3] = drop.x - .09; rainPositions[offset + 4] = y + .35; rainPositions[offset + 5] = drop.z + .045;
      }
      rainGeo.attributes.position.clearUpdateRanges();
      rainGeo.attributes.position.addUpdateRange(0, qualityProfile.rainCount * 6);
      rainGeo.attributes.position.needsUpdate = true;
      lastRainTime = weatherTime; lastRainProgress = state.buildProgress; lastRainCount = qualityProfile.rainCount;
    }
    knobs[0].rotation.y = -state.speed * 2.1; knobs[1].rotation.y = state.cycle ? -.7 : .7; knobs[2].rotation.y = -state.dust * 2.4;
    if (cameraTransition) {
      const progress = Math.min(1, (now - cameraTransition.started) / 900);
      const eased = progress * progress * (3 - 2 * progress);
      camera.position.lerpVectors(cameraTransition.fromPosition, cameraTransition.toPosition, eased);
      controls.target.lerpVectors(cameraTransition.fromTarget, cameraTransition.toTarget, eased);
      if (progress === 1) cameraTransition = null;
    }
    controls.autoRotate = state.orbit && !state.paused && !cameraTransition && !settingsDialog.open && !resetDialog.open && performance.now() - lastInteraction > 5000 && !reducedMotion.matches;
    controls.update(dt);
    try { renderer.info.reset(); renderer.render(scene, camera); }
    catch (error) {
      state.renderFailed = true;
      showSceneError("三维画面暂时无法绘制。请重新载入沙盘；已经保存的观察仍保留在这台设备。");
      console.error("Little Works rendering failed:", error);
      return;
    }
    // Creating or restoring a WebGL context does not prove it can draw. Only
    // clear the fallback and tell the desktop it is ready after a real frame.
    showSceneReady();
    if (state.labels) {
      for (const marker of markerButtons) {
        projection.copy(marker.point).project(camera);
        const x = (projection.x + 1) / 2 * innerWidth, y = (1 - projection.y) / 2 * innerHeight;
        marker.button.hidden = projection.z > 1 || projection.z < -1 || x < 20 || x > innerWidth - 65 || y < 104 || y > innerHeight - 110;
        if (!marker.button.hidden) marker.button.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px) translate(-50%,-50%)`;
      }
    }
    metrics.frame++; metrics.calls = renderer.info.render.calls; metrics.triangles = renderer.info.render.triangles;
    metrics.clocks = { simulation: time, construction: constructionTime, fleet: fleetRouteTime, weather: weatherTime };
    projection.copy(controls.target).project(camera);
    metrics.camera = { position: camera.position.toArray(), target: controls.target.toArray(), preset: state.camera, horizontalOffset: camera.view?.enabled ? camera.view.offsetX : 0, focusScreen: { x: (projection.x + 1) / 2 * innerWidth, y: (1 - projection.y) / 2 * innerHeight } };
    metrics.observation = { activeTab, tourIndex, zone: selectedZone.id, fieldbookOpen: !fieldbook.hidden, paused: state.paused };
    const frameSample = frameSampler.sample(now);
    if (frameSample) {
      metrics.fps = Math.round(frameSample.fps);
      metrics.performance = { ...frameSample, ...renderer.info.memory, includesShadows: true };
      setText("#fps-label", `${metrics.fps} FPS · ${renderer.getPixelRatio().toFixed(1)}× 分辨率 · ${metrics.calls} 次绘制（含阴影）`);
      setText("#frame-time-label", `帧间隔 ${frameSample.averageFrameMs.toFixed(1)} ms · P95 ${frameSample.p95FrameMs.toFixed(1)} ms`);
      setText("#render-budget-label", `${metrics.triangles.toLocaleString("en-US")} 三角形 · ${renderer.info.memory.geometries} 几何资源 · ${renderer.info.memory.textures} 纹理`);
      metrics.lighting = {
        phase: phaseLabel,
        sky: `#${scene.background.getHexString()}`,
        sunIntensity: sun.intensity,
        hemiIntensity: hemi.intensity,
        lampFactor,
        exposure: renderer.toneMappingExposure,
      };
      metrics.knobs = knobs.map((knob, i) => { knob.getWorldPosition(projection); projection.project(camera); return { id: i, x: (projection.x + 1) / 2 * innerWidth, y: (1 - projection.y) / 2 * innerHeight }; });
      if (state.quality === "auto" && ++budgetSamples > 2 && metrics.fps < 42 && renderer.getPixelRatio() > 1) {
        renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() - .15));
        dustMaterial.uniforms.ratio.value = renderer.getPixelRatio();
        metrics.quality.pixelRatio = renderer.getPixelRatio();
      }
    }
  }
  window.addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight; camera.fov = getSceneFov(innerWidth, innerHeight); camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
    scene.fog.density = camera.aspect < .75 ? .009 : .012;
    if (state.camera !== "custom") setCameraPreset(state.camera);
    if (innerWidth <= 650) setBook(false);
    frameAroundFieldbook();
    applyQuality();
    revealActiveChapter();
    lastInteraction = performance.now();
  });
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); state.contextLost = true; showSceneError("三维画面暂时中断了。重新载入可以恢复；已保存的观察仍保留在这台设备。"); });
  canvas.addEventListener("webglcontextrestored", () => { state.contextLost = false; state.renderFailed = false; last = performance.now(); fpsThrottle = 0; frameSampler.reset(); });
  document.addEventListener("visibilitychange", () => { last = performance.now(); frameSampler.reset(); });
  selectZone(SITE_ZONES[0].id, false);
  setBook(innerWidth >= 850 && query.get("book") !== "0");
  updateConstruction(constructionTime);
  applyQuality();
  refreshStorageStatus();
  syncControls();
  updateFieldbook();
  if (state.camera !== "overview") setCameraPreset(state.camera);
  if (query.get("tour") === "1") showTourStop(0);
  requestAnimationFrame(render);
}
