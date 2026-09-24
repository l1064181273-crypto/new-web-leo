// Data and validation are deliberately independent of the renderer. The standalone
// build inlines this module; an observation never needs a server or remote asset.
import { EXPANSION_DISTRICTS } from "./site-expansion.js";
export const OBSERVATION_KEY = "little-works.observation.v2";
export const OBSERVATION_VERSION = 2;
export const OBSERVATION_TIMELINE = "office-v4";
export const BUILD_CYCLE_SECONDS = 270;
export const BUILD_GROW_END = .88;
export const BUILD_RESET_START = .98;

export const CAMERA_NAMES = ["overview", "street", "workers", "crane", "excavation", "structure", "finished", "rebar", "office", "logistics", "utilities", "precast", "loader", "entrance", "materials", "welfare", "plan", "custom"];
export const DEFAULT_SETTINGS = {
  speed: 1,
  paused: false,
  cycle: true,
  time: .5,
  dust: .5,
  rain: false,
  camera: "overview",
  buildMode: "auto",
  manualBuild: .08,
  orbit: false,
  labels: false,
  quality: "auto",
};

export const BUILD_CHAPTERS = [
  {
    id: "excavation", number: "01", label: "打开地面", short: "基坑", progress: .08, end: .18, camera: "excavation",
    title: "一座建筑，从往下挖开始。",
    story: "西侧的两台挖掘机先松土、回转、卸土。边缘的黄黑护栏圈出基坑，渣土车沿外围车道接走土方。",
    detail: "把镜头靠近基坑，观察挖斗里的土块：它只在挖起和回转的一段时间出现。装载机则在堆土区前短距离往返。",
    focus: "看挖斗与土方转运", time: .5, zone: "earthworks",
  },
  {
    id: "foundation", number: "02", label: "把根扎稳", short: "基础", progress: .3, end: .38, camera: "rebar",
    title: "看不见的部分，撑起以后的高度。",
    story: "基础底板开始显露，钢筋加工棚也忙起来。绑扎、工具操作和材料搬运有各自的动作，西侧后勤区逐渐展开。",
    detail: "加工棚里的橙色工作服不是静止的点缀。有人俯身绑扎，有人操作工具，搬运人员会在路线终点停一下。",
    focus: "走近钢筋加工棚", time: .4, zone: "rebar",
  },
  {
    id: "first-floor", number: "03", label: "第一层轮廓", short: "一层", progress: .48, end: .57, camera: "structure",
    title: "柱、梁、楼板，开始有了秩序。",
    story: "混凝土构件按顺序长出来，脚手架随着施工搭起。搅拌车进入工作期，楼层上的工人也在结构形成后出现。",
    detail: "注意塔吊的吊钩与小车：吊钩改变高度，小车沿吊臂行走，两座塔吊保留了不同的回转范围。",
    focus: "观察首层框架", time: .5, zone: "structure",
  },
  {
    id: "upper-floor", number: "04", label: "向上生长", short: "上层", progress: .65, end: .78, camera: "crane",
    title: "整个小工地，在不同高度同时发生。",
    story: "上层框架继续安装，工人在已经成形的楼层活动。地面车辆仍沿同一条环路流动，机械不会因为换了工序突然消失。",
    detail: "试试黄昏。暖色工地灯、办公室窗户和冷下来的天空，会把模型的不同高度分开。",
    focus: "抬头看塔吊", time: .75, zone: "structure",
  },
  {
    id: "topping-out", number: "05", label: "主体封顶", short: "封顶", progress: .805, end: .82, camera: "structure",
    title: "结构站稳了，建筑还没有结束。",
    story: "三层柱梁与楼板已连成整体，进入主体验收。此时仍是毛坯：外墙、门窗和入口还要继续收尾，封顶不是最后一站。",
    detail: "留意裸露的混凝土边缘。继续拖动进度，接下来会先粉刷墙面，再逐排安装窗框与玻璃。",
    focus: "看看封顶后的毛坯", time: .5, zone: "structure",
  },
  {
    id: "facade", number: "06", label: "外墙粉刷", short: "粉刷", progress: .86, end: .88, camera: "structure",
    title: "让混凝土，换上一层安静的灰白。",
    story: "墙面分区由毛坯灰变为灰白，楼板边缘开始统一收口。实墙与留给玻璃的开口交替，三层小楼有了清楚的立面节奏。",
    detail: "把进度停在这一段的中间，比较已经粉刷与仍未完成的墙面。这里用表面的变化记录工序，没有模拟每一笔涂刷。",
    focus: "靠近看外墙的变化", time: .5, zone: "structure",
  },
  {
    id: "glazing", number: "07", label: "门窗安装", short: "门窗", progress: .915, end: .925, camera: "finished",
    title: "一排窗装上去，楼就有了表情。",
    story: "深灰细窗框与烟蓝玻璃逐排安装，连续落地窗把每层联系起来。实墙、窗带和局部遮阳格栅各有分工，让四个立面有不同的表情。",
    detail: "换个角度，看看窗框的厚度、格栅投下的阴影，以及内凹入口与上层窗带的区别。东侧预制堆场仍保留这一段施工的线索。",
    focus: "看看小楼的新立面", time: .62, zone: "structure",
  },
  {
    id: "fit-out", number: "08", label: "装修与收尾", short: "装修", progress: .96, end: .975, camera: "finished",
    title: "门里门外，开始像有人使用的地方。",
    story: "暖木色入口、雨棚与玻璃门完成收口，临窗补上少量办公桌、窗帘与绿植。屋顶的露台、设备格栅和楼前花池一起落位，脚手架逐段退出。",
    detail: "从窗边看进大厅，再抬头找屋顶设备。室内只呈现临窗能看见的部分，给微型建筑一点生活感，也给运行性能留出余量。",
    focus: "走近入口与临窗空间", time: .75, zone: "structure",
  },
  {
    id: "handover", number: "09", label: "竣工交付", short: "交付", progress: 1, end: 1.01, camera: "finished",
    title: "灯亮了，一座小写字楼完成了。",
    story: "灰白外墙、烟蓝落地窗与暖木入口连成完整的建筑。楼顶收好边缘，楼前留出通行与绿意；入夜后，办公室的灯有疏有密地亮起。外围工地仍保留在这张工作台上。",
    detail: "这一站适合留影。自动施工在 1× 节奏下，会把完整的小楼保留约 27 秒再转入下一轮；也可以切到手动交付，慢慢看，不必等倒计时。",
    focus: "看看完整的小写字楼", time: .79, zone: "structure",
  },
];

export const SITE_ZONES = [
  { id: "earthworks", code: "A", name: "基坑区", camera: "excavation", position: [-4.5, .3, -.8], stage: .08, description: "两台挖掘机分开作业，护栏围住真实下沉的土坑。早期土方结束后，挖臂会收回待命。", observe: "挖斗装土、转身，再卸下；动作是一个连续的循环。" },
  { id: "structure", code: "B", name: "主体结构", camera: "structure", position: [4.5, 4, -1.55], stage: .65, description: "三层小楼先完成基础与柱梁，再经历外墙粉刷、门窗安装和装修交付。永久结构逐步留下，脚手架在后期退出。", observe: "先看框架，再切到第 9 阶段：同一栋楼会变成带落地窗、入口雨棚与屋顶露台的小写字楼。" },
  { id: "rebar", code: "C", name: "钢筋加工棚", camera: "rebar", position: [-4.5, 2.1, 3.4], stage: .3, description: "蓝色棚顶下摆着工作台与钢筋，旁边按种类放好材料。人员动作分别对应绑扎、工具操作与搬运。", observe: "黄色安全帽与白色安全帽有不同任务，搬运人员会在交接处停留。" },
  { id: "office", code: "D", name: "现场办公室", camera: "office", position: [0, 1.8, -4.25], stage: .48, description: "两间活动房位于车道以外的独立区域。夜色降下来时，窗户会逐渐亮起，周边巡视路线也避开室内。", observe: "把时刻拖到傍晚，看窗光与四盏工地灯接替日照。" },
  { id: "transport", code: "E", name: "运输环路", camera: "street", position: [5, .35, 5.7], stage: .3, description: "两辆自卸车和一辆搅拌车共享有间隔的单向环路。装料、行驶、卸料各有停留，不会在切换工序时瞬移。", observe: "货斗只在卸料点抬起；车辆返程时仍保留轮胎转动和完整路径。" },
  { id: "west-logistics", code: "F", name: "西侧后勤", camera: "logistics", position: [-11.75, 1.1, -.25], stage: .3, description: "三组小型储运单元沿围挡布置，补充工地边缘的物料秩序。随着基础阶段推进，这块区域逐步展开。", observe: "镜头靠近后，小尺度棱条与周边木箱会出现；远处保留安静的体块。" },
  { id: "north-utilities", code: "G", name: "管线作业带", camera: "utilities", position: [0, .55, 8.72], stage: .48, description: "平行的管线、支托和标记沿场地边缘排开。它与主楼同时推进，但保留自己的施工进度。", observe: "切到俯视，看管线带、主楼与运输环路如何各留出空间。" },
  { id: "east-precast", code: "H", name: "东侧预制", camera: "precast", position: [11.75, 1.5, .35], stage: .915, description: "成排的支架托住分层预制构件，后期为围护安装服务。近距离可以辨认支架、横撑和交错堆放的构件。", observe: "先把进度拖到门窗阶段，再靠近查看这片小小的堆场。" },
  ...EXPANSION_DISTRICTS.map(district => district.zone),
];

export const EQUIPMENT = [
  { name: "履带挖掘机", number: "02", family: "土方", camera: "excavation", stage: .08, note: "履带保持原位，上部回转，大小臂与挖斗联动。土方工序结束后收臂待命。", detail: "观察点：挖斗里的一小块土并非一直存在。" },
  { name: "塔式起重机", number: "02", family: "吊装", camera: "crane", stage: .65, note: "两座塔吊高度与活动范围不同，回转、小车和吊钩共同完成吊运。吊物在工作期出现。", detail: "观察点：一台吊着料斗，另一台吊着成束材料。" },
  { name: "自卸运输车", number: "02", family: "运输", camera: "street", stage: .3, note: "沿环路装料、行驶与卸料。到了卸料点，货斗再缓缓抬起；非工作期继续返程或等待。", detail: "观察点：车身转弯与轮胎滚动是分开的动作。" },
  { name: "混凝土搅拌车", number: "01", family: "浇筑", camera: "street", stage: .48, note: "主体施工期间参与运输，滚筒持续缓慢转动。与自卸车共用同一条有间距的路线。", detail: "观察点：即使暂时停留，滚筒仍保留自己的节奏。" },
  { name: "小型装载机", number: "01", family: "整理", camera: "loader", stage: .08, note: "在堆土区前方短距离往返，负责早期整平与后期清理。动作退出时先平缓回位。", detail: "观察点：它的铲斗、行走方向和短暂停顿互相配合。" },
  { name: "工人与巡视人员", number: "28", family: "协作", camera: "workers", stage: .48, note: "黄色帽与白色帽区分现场人员和巡视角色。绑扎、工具、指挥、巡查、搬运五种动作分配在工作点与外围通道。", detail: "观察点：走到路线端点时会停步，腿向前后摆动。" },
];

const finite = value => typeof value === "number" && Number.isFinite(value);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const MAX_SCENE_CLOCK = 1e7;
export const getChapter = progress => BUILD_CHAPTERS.find(chapter => progress < chapter.end) ?? BUILD_CHAPTERS.at(-1);
const wrapDay = value => {
  if (!finite(value)) return .5;
  const fraction = value % 1;
  return fraction < 0 ? fraction + 1 : fraction;
};
export const getSceneMinute = value => {
  // A slider minute such as 2 / 1440 can land infinitesimally below its integer
  // after a JSON round trip or modulo. Do not display or resync the prior minute.
  return Math.min(1439, Math.floor(wrapDay(value) * 1440 + 1e-9));
};
export const formatSceneTime = value => {
  const minutes = getSceneMinute(value);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};

export function getQualityProfile(quality, width, deviceRatio = 1) {
  const safeRatio = finite(deviceRatio) ? clamp(deviceRatio, 1, 3) : 1;
  if (quality === "low") return { ratio: 1, shadows: false, shadowSize: 512, dustCount: 260, rainCount: 600, fps: 30 };
  if (quality === "high") return { ratio: Math.min(safeRatio, 2), shadows: true, shadowSize: 1536, dustCount: 650, rainCount: 1400, fps: 60 };
  return { ratio: Math.min(safeRatio, width < 650 ? 1.2 : 1.5), shadows: true, shadowSize: 1024, dustCount: 650, rainCount: 1400, fps: 60 };
}

// Keep a useful horizontal field of view in portrait. A fixed vertical lens
// makes a larger site crop at both sides; zooming farther also increases fog.
export function getSceneFov(width, height) {
  const aspect = finite(width) && finite(height) && width > 0 && height > 0 ? width / height : 1;
  return aspect < .75 ? 2 * Math.atan(Math.tan(21 * Math.PI / 180) / Math.max(.25, aspect)) * 180 / Math.PI : 42;
}

export function normalizeSettings(source = {}) {
  const raw = source && typeof source === "object" ? source : {};
  return {
    ...DEFAULT_SETTINGS,
    speed: finite(raw.speed) ? clamp(Math.round(raw.speed * 4) / 4, .25, 2) : 1,
    paused: typeof raw.paused === "boolean" ? raw.paused : false,
    cycle: typeof raw.cycle === "boolean" ? raw.cycle : true,
    time: wrapDay(raw.time),
    dust: [0, .5, 1].includes(raw.dust) ? raw.dust : .5,
    rain: typeof raw.rain === "boolean" ? raw.rain : false,
    camera: CAMERA_NAMES.includes(raw.camera) ? raw.camera : "overview",
    buildMode: raw.buildMode === "manual" ? "manual" : "auto",
    manualBuild: finite(raw.manualBuild) ? clamp(raw.manualBuild, 0, 1) : .08,
    orbit: typeof raw.orbit === "boolean" ? raw.orbit : false,
    labels: typeof raw.labels === "boolean" ? raw.labels : false,
    quality: ["auto", "low", "high"].includes(raw.quality) ? raw.quality : "auto",
  };
}

function vector(value, range) {
  return Array.isArray(value) && value.length === 3 && value.every(number => finite(number) && Math.abs(number) <= range) ? [...value] : null;
}

function migrateLegacyConstructionTime(time) {
  const legacyCycle = 210, legacyGrowEnd = .92, legacyResetStart = .97;
  const position = (time % legacyCycle) / legacyCycle;
  const mappedPosition = position < legacyGrowEnd
    ? position / legacyGrowEnd * BUILD_GROW_END
    : position < legacyResetStart
      ? BUILD_GROW_END + (position - legacyGrowEnd) / (legacyResetStart - legacyGrowEnd) * (BUILD_RESET_START - BUILD_GROW_END)
      : BUILD_RESET_START + (position - legacyResetStart) / (1 - legacyResetStart) * (1 - BUILD_RESET_START);
  const mappedOffset = mappedPosition * BUILD_CYCLE_SECONDS;
  // Preserve the phase even for a sanitized, extreme clock. Only completed
  // cycle counts may be capped; clamping the final time would change the view.
  const cycles = Math.min(Math.floor(time / legacyCycle), Math.floor((MAX_SCENE_CLOCK - mappedOffset) / BUILD_CYCLE_SECONDS));
  return cycles * BUILD_CYCLE_SECONDS + mappedOffset;
}

export function readObservation(serialized) {
  try {
    const raw = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
    if (!raw || raw.version !== OBSERVATION_VERSION || !raw.settings || typeof raw.settings !== "object") return null;
    if (raw.constructionTimeline !== undefined && raw.constructionTimeline !== OBSERVATION_TIMELINE) return null;
    const cameraPosition = vector(raw.cameraPosition, 150);
    const cameraTarget = vector(raw.cameraTarget, 40);
    if (!cameraPosition || !cameraTarget || cameraPosition.every((number, index) => Math.abs(number - cameraTarget[index]) < .001)) return null;
    const safeClock = value => finite(value) ? clamp(value, 0, MAX_SCENE_CLOCK) : 0;
    const settings = normalizeSettings(raw.settings);
    const constructionTime = safeClock(raw.constructionTime ?? raw.simulationTime);
    const savedAt = typeof raw.savedAt === "string" && Number.isFinite(Date.parse(raw.savedAt)) ? raw.savedAt : null;
    return {
      version: OBSERVATION_VERSION,
      constructionTimeline: OBSERVATION_TIMELINE,
      settings,
      cameraPosition,
      cameraTarget,
      simulationTime: safeClock(raw.simulationTime),
      constructionTime: raw.constructionTimeline === undefined && settings.buildMode === "auto"
        ? migrateLegacyConstructionTime(constructionTime)
        : constructionTime,
      fleetTime: safeClock(raw.fleetTime),
      weatherTime: safeClock(raw.weatherTime),
      loaderActivity: finite(raw.loaderActivity) ? clamp(raw.loaderActivity, 0, 1) : 0,
      savedAt,
    };
  } catch {
    return null;
  }
}

export function constructionAt(simulationTime, mode = "auto", manualBuild = .08) {
  const safeTime = finite(simulationTime) ? simulationTime : 0;
  const cyclePosition = (((safeTime % BUILD_CYCLE_SECONDS) + BUILD_CYCLE_SECONDS) % BUILD_CYCLE_SECONDS) / BUILD_CYCLE_SECONDS;
  const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
  const resetTransition = mode === "auto" && cyclePosition >= BUILD_RESET_START ? smooth((cyclePosition - BUILD_RESET_START) / (1 - BUILD_RESET_START)) : 0;
  const autoProgress = cyclePosition < BUILD_GROW_END ? cyclePosition / BUILD_GROW_END : cyclePosition < BUILD_RESET_START ? 1 : 1 - resetTransition;
  const progress = mode === "manual" ? clamp(finite(manualBuild) ? manualBuild : .08, 0, 1) : autoProgress;
  return { cyclePosition, progress, resetTransition, chapter: getChapter(progress) };
}
