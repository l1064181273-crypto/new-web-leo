// Static BoxGeometry instance data. Entry positions are local to each district;
// observation markers, signs and rain-contact roofs use world coordinates.
// The existing fleet, workers, lights and particle systems are not extended here.
const COLOR = {
  steel: "#496d80",
  concrete: "#a8aca4",
  yellow: "#e6b747",
  green: "#66887f",
  orange: "#d47e45",
  gravel: "#b5a080",
  pale: "#e2e3d8",
  dark: "#354b54",
  glass: "#7aa0a5",
  timber: "#97744f",
  timberEnd: "#c6a87b",
  water: "#6b8780",
};

function district(id, position, zone, sign, switchDistance = 31) {
  return {
    id,
    position,
    start: -1,
    persistent: true,
    switchDistance,
    highEntries: [],
    lowEntries: [],
    zone,
    sign,
    roofs: [],
  };
}

function box(site, detail, x, y, z, w, h, d, c, rotation) {
  const entry = {
    x: Number((x - site.position[0]).toFixed(5)),
    y,
    z: Number((z - site.position[1]).toFixed(5)),
    w,
    h,
    d,
    c,
    ...rotation,
  };
  if (detail !== "low") site.highEntries.push({ ...entry });
  if (detail !== "high") site.lowEntries.push({ ...entry });
}

function roof(site, detail, x, y, z, w, h, d, color) {
  box(site, detail, x, y, z, w, h, d, color);
  site.roofs.push({
    minX: x - w / 2,
    maxX: x + w / 2,
    minZ: z - d / 2,
    maxZ: z + d / 2,
    y: y + h / 2,
  });
}

function buildEntrance() {
  const site = district(
    "entrance",
    [-8.05, 9.6],
    {
      id: "entrance",
      code: "I",
      name: "门岗与洗车回收",
      camera: "entrance",
      position: [-8.05, 1.35, 10.6],
      stage: 0.08,
      description: "门岗守着入口，齐平格栅旁是分格沉淀回收池。铺装接回原有环路；现有车队仍沿内环运行，不会自动进出大门。",
      observe: "看入口西侧：值班窗口、冲洗格栅与回收池各有位置，原来两名门口工作人员的通道仍然留着。",
    },
    { text: "SITE ENTRY / RECOVERY", x: -10, y: 1.44, z: 11.272, width: 1.25, height: 0.19 },
    29,
  );
  const add = (detail, ...values) => box(site, detail, ...values);

  // All paving, stripes and grate bars finish at or below y=.04. The main
  // scene continues this unobstructed strip from z=7.7 to the original loop.
  add("both", -6.95, 0.026, 9.6, 2.7, 0.012, 3.8, COLOR.concrete);
  for (const x of [-8.24, -5.66])
    add("high", x, 0.035, 9.6, 0.045, 0.006, 3.68, COLOR.yellow);
  add("both", -6.95, 0.034, 10.42, 2.35, 0.008, 1.72, COLOR.dark);
  add("low", -6.95, 0.038, 10.42, 2.11, 0.004, 1.46, COLOR.steel);
  for (let i = 0; i < 13; i++)
    add("high", -6.95, 0.038, 9.72 + i * 0.116, 2.13, 0.004, 0.035, COLOR.steel);
  for (const x of [-7.99, -5.91])
    add("high", x, 0.038, 10.42, 0.03, 0.004, 1.49, COLOR.pale);

  // The booth stays west of the lane. No barrier arm crosses the workers.
  add("high", -10, 0.028, 10.625, 1.6, 0.016, 1.55, COLOR.concrete);
  add("both", -10, 0.8, 10.6, 1.35, 1.52, 1.31, COLOR.steel);
  roof(site, "both", -10, 1.63, 10.6, 1.55, 0.12, 1.53, COLOR.pale);
  add("both", -9.82, 1.035, 11.263, 0.79, 0.43, 0.016, COLOR.glass);
  add("high", -10.679, 1.04, 10.6, 0.012, 0.47, 0.77, COLOR.glass);
  add("high", -9.321, 1.04, 10.6, 0.012, 0.47, 0.77, COLOR.glass);
  add("high", -10.43, 0.62, 11.266, 0.36, 1.12, 0.022, COLOR.dark);
  add("high", -10.3, 0.65, 11.286, 0.045, 0.09, 0.024, COLOR.yellow);
  for (const x of [-10.08, -9.83, -9.57])
    add("high", x, 1.035, 11.276, 0.025, 0.46, 0.016, COLOR.pale);
  add("high", -9.82, 0.795, 11.292, 0.89, 0.055, 0.11, COLOR.pale);
  for (const x of [-10.73, -9.27])
    add("high", x, 1.56, 10.6, 0.045, 0.055, 1.46, COLOR.yellow);
  add("high", -10.43, 0.061, 11.328, 0.45, 0.054, 0.12, COLOR.concrete);

  // A static three-cell settling tank, not a particle or flowing-water effect.
  // It is beside the lane rather than underneath the two existing staff.
  add("both", -10, 0.095, 8.525, 1.55, 0.15, 1.43, COLOR.concrete);
  add("both", -10, 0.179, 8.525, 1.28, 0.016, 1.16, COLOR.water);
  add("low", -10, 0.24, 8.525, 1.36, 0.16, 0.07, COLOR.pale);
  for (const x of [-10.72, -9.28])
    add("high", x, 0.26, 8.525, 0.085, 0.33, 1.37, COLOR.concrete);
  for (const z of [7.87, 9.18])
    add("high", -10, 0.26, z, 1.43, 0.33, 0.085, COLOR.concrete);
  for (const z of [8.29, 8.76])
    add("high", -10, 0.25, z, 1.35, 0.3, 0.06, COLOR.pale);
  add("high", -10.54, 0.43, 8.995, 0.26, 0.34, 0.27, COLOR.green);
  add("high", -10.36, 0.29, 8.94, 0.17, 0.07, 0.055, COLOR.dark);
  for (let i = 0; i < 5; i++)
    add("high", -9.52 + i * 0.075, 0.435, 8.985, 0.035, 0.025, 0.33, COLOR.steel);
  // Flush return channel links the wash grate to the recovery side, without
  // adding a trip-height pipe across the existing gate crew's walking area.
  add("high", -8.72, 0.036, 9.47, 0.11, 0.006, 1.97, COLOR.dark);
  add("high", -8.45, 0.036, 10.42, 0.63, 0.006, 0.11, COLOR.dark);
  add("high", -8.985, 0.036, 8.54, 0.63, 0.006, 0.11, COLOR.dark);
  return site;
}

function buildMaterialYard() {
  const site = district(
    "material-yard",
    [-9.675, -9.55],
    {
      id: "material-yard",
      code: "J",
      name: "材料周转场",
      camera: "materials",
      position: [-9.35, 1.65, -9.6],
      stage: 0.3,
      description: "模板、木方和长料分开放在垫木上。棚下留出加工台与成品位，余料再进入分类箱，后场有了从储放到周转的顺序。",
      observe: "从左往右找：带木方端面的长堆、叠放的模板、架上的钢材和棚前的成品束。靠近时再看垫木、扎带与分类箱。",
    },
    { text: "MATERIALS / REUSE", x: -11.0, y: 0.93, z: -7.92, width: 2.18, height: 0.23 },
    32,
  );
  const add = (detail, ...values) => box(site, detail, ...values);
  add("both", -9.675, 0.027, -9.55, 8.1, 0.014, 3.25, COLOR.gravel);
  for (const z of [-11.12, -7.99])
    add("high", -9.675, 0.036, z, 7.95, 0.006, 0.035, COLOR.pale);

  // The existing west power pole at (-12.85,-8.8) remains outside all stock.
  add("low", -11.85, 0.4, -10.69, 3.26, 0.66, 0.66, COLOR.timberEnd);
  for (const x of [-13.12, -11.84, -10.56])
    add("high", x, 0.12, -10.69, 0.16, 0.15, 0.69, COLOR.timber);
  for (let layer = 0; layer < 3; layer++) {
    for (let row = 0; row < 4; row++) {
      const z = -10.945 + row * 0.17;
      add("high", -11.85, 0.245 + layer * 0.155, z, 3.2, 0.135, 0.145, COLOR.timber);
      add("high", -10.238, 0.245 + layer * 0.155, z, 0.018, 0.135, 0.145, COLOR.timberEnd);
    }
  }
  for (const x of [-12.75, -10.95])
    add("high", x, 0.64, -10.69, 0.045, 0.028, 0.65, COLOR.steel);

  add("low", -11.85, 0.3, -9.65, 3.22, 0.45, 0.55, COLOR.concrete);
  for (const x of [-13.1, -11.85, -10.6])
    add("high", x, 0.105, -9.65, 0.2, 0.14, 0.54, COLOR.timber);
  for (let layer = 0; layer < 5; layer++) {
    add("high", -11.85, 0.205 + layer * 0.077, -9.65, 3.14, 0.052, 0.51, layer % 2 ? COLOR.concrete : COLOR.timber);
    add("high", -11.85, 0.211 + layer * 0.077, -9.388, 3.12, 0.025, 0.012, COLOR.timberEnd);
  }

  // Open steel shelter: one low-detail roof plus posts, not an opaque shed.
  for (const x of [-9.08, -5.83]) {
    for (const z of [-10.36, -8.13]) {
      add("both", x, 1.02, z, 0.09, 1.96, 0.09, COLOR.steel);
      add("high", x, 0.085, z, 0.22, 0.11, 0.22, COLOR.concrete);
    }
  }
  roof(site, "both", -7.455, 2.045, -9.245, 3.51, 0.09, 2.5, COLOR.steel);
  for (const z of [-10.42, -8.07])
    add("high", -7.455, 1.975, z, 3.4, 0.095, 0.075, COLOR.yellow);
  for (let i = 0; i < 12; i++)
    add("high", -9.04 + i * 0.29, 2.101, -9.245, 0.035, 0.022, 2.43, COLOR.glass);
  site.roofs[0].y = 2.112;
  for (const x of [-9.08, -5.83])
    add("high", x, 1.84, -9.245, 0.065, 0.11, 2.35, COLOR.steel);

  // Long stock rack sits behind the workbench, aligned across the yard.
  add("low", -7.48, 0.32, -10.79, 3.13, 0.55, 0.61, COLOR.steel);
  add("low", -7.48, 0.65, -10.79, 3.09, 0.16, 0.42, COLOR.concrete);
  for (const x of [-8.84, -7.48, -6.12]) {
    add("high", x, 0.32, -10.79, 0.075, 0.55, 0.65, COLOR.steel);
    add("high", x, 0.47, -10.79, 0.32, 0.06, 0.56, COLOR.yellow);
  }
  for (let row = 0; row < 5; row++)
    add("high", -7.48, 0.54 + row % 2 * 0.07, -10.99 + row * 0.1, 3.05, 0.052, 0.052, COLOR.dark);

  add("low", -7.88, 0.43, -9.52, 1.79, 0.64, 0.66, COLOR.concrete);
  add("high", -7.88, 0.65, -9.52, 1.83, 0.1, 0.7, COLOR.concrete);
  add("high", -7.88, 0.26, -9.52, 1.7, 0.055, 0.59, COLOR.steel);
  for (const x of [-8.63, -7.13])
    for (const z of [-9.76, -9.28])
      add("high", x, 0.345, z, 0.07, 0.59, 0.07, COLOR.steel);
  for (let i = 0; i < 4; i++)
    add("high", -7.9, 0.72, -9.71 + i * 0.12, 1.65, 0.04, 0.035, COLOR.dark);
  add("both", -6.38, 0.38, -9.52, 0.66, 0.68, 0.63, COLOR.orange);
  add("high", -6.38, 0.75, -9.52, 0.69, 0.07, 0.65, COLOR.steel);
  for (const x of [-6.56, -6.2])
    add("high", x, 0.82, -9.52, 0.08, 0.075, 0.08, COLOR.pale);
  add("high", -6.38, 0.62, -9.189, 0.29, 0.16, 0.018, COLOR.dark);

  // Finished bundles rest on separate sleepers, leaving the aisle legible.
  for (const x of [-8.12, -6.57])
    add("both", x, 0.12, -8.57, 0.17, 0.16, 0.62, COLOR.timber);
  add("low", -7.35, 0.3, -8.57, 2.27, 0.2, 0.45, COLOR.dark);
  for (let row = 0; row < 5; row++) {
    for (let layer = 0; layer < 2; layer++)
      add("high", -7.35, 0.24 + layer * 0.075, -8.79 + row * 0.11, 2.26, 0.05, 0.045, COLOR.dark);
  }
  for (const x of [-8, -6.7])
    add("high", x, 0.36, -8.57, 0.045, 0.026, 0.5, COLOR.yellow);

  for (const [index, x] of [-11.7, -10.99, -10.28].entries()) {
    const color = [COLOR.green, COLOR.orange, COLOR.steel][index];
    add("low", x, 0.32, -8.36, 0.55, 0.56, 0.65, color);
    add("high", x, 0.085, -8.36, 0.55, 0.09, 0.65, color);
    for (const side of [-1, 1]) {
      add("high", x + side * 0.25, 0.35, -8.36, 0.045, 0.49, 0.65, color);
      add("high", x, 0.35, -8.36 + side * 0.3, 0.55, 0.49, 0.045, color);
    }
    add("high", x, 0.29, -8.36, 0.42, 0.16, 0.49, index === 1 ? COLOR.timberEnd : COLOR.concrete);
    add("high", x, 0.41, -8.023, 0.21, 0.14, 0.022, COLOR.pale);
  }
  for (const x of [-11.95, -10.05])
    add("high", x, 0.54, -7.97, 0.055, 1.02, 0.055, COLOR.steel);
  return site;
}

function buildWelfare() {
  const site = district(
    "welfare",
    [8.15, -9.55],
    {
      id: "welfare",
      code: "K",
      name: "生活与安全驿站",
      camera: "welfare",
      position: [7.9, 1.8, -9.85],
      stage: 0.48,
      description: "后场的休息急救室、卫生间和饮水消防点朝向同一条通道。它们是开工前就准备好的临时设施，不随主楼楼层一起长出来。",
      observe: "找一找遮雨檐下的长凳、急救十字、双门卫生间和橙色消防柜。它们共享后勤带，却有各自不同的轮廓。",
    },
    { text: "WELFARE / SAFETY", x: 5.0, y: 1.5, z: -8.602, width: 2.35, height: 0.18 },
    33,
  );
  const add = (detail, ...values) => box(site, detail, ...values);
  add("high", 8.15, 0.027, -9.59, 11, 0.014, 3.22, COLOR.concrete);
  // Leave the approach at x=8.1 open through the boundary marking.
  add("high", 5.2025, 0.037, -8.01, 4.875, 0.006, 0.05, COLOR.yellow);
  add("high", 11.0475, 0.037, -8.01, 4.975, 0.006, 0.05, COLOR.yellow);

  add("both", 5, 0.8, -10.35, 4.25, 1.52, 1.55, COLOR.pale);
  roof(site, "both", 5, 1.65, -10.35, 4.58, 0.12, 1.78, COLOR.steel);
  add("high", 5.05, 1.035, -9.565, 2.03, 0.46, 0.018, COLOR.glass);
  // The wider distant glazing keeps the white first-aid cross legible without
  // adding another low-detail panel or changing the cabin's overall silhouette.
  add("low", 5.55, 1.035, -9.565, 2.64, 0.46, 0.018, COLOR.glass);
  add("high", 3.39, 0.62, -9.562, 0.55, 1.12, 0.024, COLOR.steel);
  add("high", 3.57, 0.66, -9.541, 0.038, 0.1, 0.024, COLOR.yellow);
  for (const x of [4.2, 4.65, 5.1, 5.55, 6])
    add("high", x, 1.035, -9.55, 0.035, 0.48, 0.016, COLOR.pale);
  add("high", 6.6, 1.03, -9.552, 0.57, 0.56, 0.024, COLOR.green);
  add("both", 6.6, 1.03, -9.532, 0.33, 0.105, 0.018, COLOR.pale);
  add("both", 6.6, 1.03, -9.531, 0.105, 0.33, 0.02, COLOR.pale);
  for (let i = 0; i < 17; i++)
    add("high", 2.96 + i * 0.25, 0.43, -9.561, 0.028, 0.65, 0.022, COLOR.concrete);

  roof(site, "both", 5, 1.5, -9.03, 4.47, 0.075, 0.84, COLOR.green);
  for (const x of [2.94, 7.06]) {
    add("high", x, 0.755, -8.73, 0.065, 1.43, 0.065, COLOR.steel);
    add("high", x, 0.075, -8.73, 0.2, 0.08, 0.2, COLOR.concrete);
  }
  add("high", 5.2, 0.42, -8.83, 2.34, 0.08, 0.33, COLOR.timberEnd);
  add("high", 5.2, 0.66, -9.008, 2.34, 0.34, 0.07, COLOR.timber);
  for (const x of [4.25, 6.15])
    add("high", x, 0.24, -8.83, 0.12, 0.31, 0.3, COLOR.steel);

  // The green twin-door washroom is lower and narrower than the rest cabin.
  add("both", 9.04, 0.75, -10.35, 2.54, 1.42, 1.48, COLOR.green);
  roof(site, "both", 9.04, 1.545, -10.35, 2.74, 0.105, 1.72, COLOR.pale);
  add("low", 9.04, 0.69, -9.6, 1.85, 1.13, 0.018, COLOR.steel);
  for (const x of [8.45, 9.61]) {
    add("high", x, 0.67, -9.598, 0.71, 1.13, 0.024, COLOR.steel);
    add("high", x + 0.22, 0.66, -9.576, 0.035, 0.08, 0.026, COLOR.pale);
    add("high", x, 1.305, -9.598, 0.5, 0.12, 0.024, COLOR.dark);
    for (let slat = 0; slat < 4; slat++)
      add("high", x - 0.18 + slat * 0.12, 1.305, -9.58, 0.04, 0.13, 0.016, COLOR.pale);
    add("high", x, 0.095, -9.495, 0.79, 0.11, 0.21, COLOR.concrete);
  }

  // Open drinking point and orange fire cabinet. The existing pole at
  // (12.85,-8.8) stays in the clear aisle in front of this shelter.
  roof(site, "both", 12.13, 1.54, -10.24, 2.37, 0.075, 1.36, COLOR.steel);
  add("low", 12.13, 0.78, -10.858, 2.15, 1.43, 0.055, COLOR.green);
  for (const x of [11.08, 13.18])
    for (const z of [-10.8, -9.7])
      add("high", x, 0.78, z, 0.065, 1.43, 0.065, COLOR.steel);
  add("high", 11.65, 0.74, -10.56, 1.05, 1.36, 0.06, COLOR.green);
  add("both", 11.63, 0.47, -10.1, 0.85, 0.85, 0.57, COLOR.pale);
  add("high", 11.63, 0.89, -10.07, 0.71, 0.025, 0.45, COLOR.dark);
  add("high", 11.63, 1.07, -10.23, 0.06, 0.36, 0.06, COLOR.steel);
  add("high", 11.63, 1.23, -10.13, 0.06, 0.06, 0.22, COLOR.steel);
  add("high", 11.92, 0.93, -10.04, 0.1, 0.065, 0.12, COLOR.glass);
  add("both", 12.76, 0.55, -10.13, 0.59, 1.02, 0.51, COLOR.orange);
  add("both", 12.76, 0.7, -9.862, 0.095, 0.42, 0.018, COLOR.pale);
  add("high", 12.76, 0.88, -9.859, 0.35, 0.06, 0.024, COLOR.pale);
  add("high", 12.965, 0.59, -9.851, 0.035, 0.1, 0.025, COLOR.dark);
  return site;
}

export const EXPANSION_DISTRICTS = [
  buildEntrance(),
  buildMaterialYard(),
  buildWelfare(),
];
