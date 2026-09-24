import { describe, expect, it } from "vitest";
import { Box3, Euler, Matrix4, Quaternion, Vector3 } from "three-r160";
import { createOfficeBuilding } from "../../sandbox/office-building.js";
import { vehiclePose } from "../../sandbox/traffic.js";

type BuildingEntry = {
  x: number; y: number; z: number;
  w: number; h: number; d: number;
  c: string; kind: string; stage: number;
  removeAt?: number; duration?: number;
  rx?: number; ry?: number; rz?: number;
  paintFrom?: number; paintTo?: number; paintColor?: string;
};
type Roof = { x: number; z: number; w: number; d: number; y: number; stage: number };
const GROUP_NAMES = ["structure", "facade", "glazing", "details", "nightWindows"] as const;
type GroupName = typeof GROUP_NAMES[number];
type OfficeBuilding = Record<GroupName, BuildingEntry[]> & { roofs: Roof[] };
const building = createOfficeBuilding() as OfficeBuilding;
const entries = GROUP_NAMES.flatMap(group => building[group].map((entry, index) => ({ ...entry, group, index })));
const permanent = entries.filter(entry => (entry.removeAt ?? 2) >= 2);
const temporary = entries.filter(entry => (entry.removeAt ?? 2) < 2);
const EPSILON = 1e-9;
const label = (entry: BuildingEntry & { group?: string; index?: number }) => `${entry.group ?? "entry"}[${entry.index ?? "?"}]:${entry.kind}`;

function smooth(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

// Independent reconstruction of the documented reveal contract. The controller
// suite separately checks the actual scene's instance matrices and cache updates.
function revealAt(entry: BuildingEntry, progress: number) {
  const reveal = smooth((progress - entry.stage) / (entry.duration ?? .055));
  return (entry.removeAt ?? 2) < 2
    ? reveal * (1 - smooth((progress - entry.removeAt!) / .045))
    : reveal;
}

function boundsFor(entry: BuildingEntry, world = false) {
  const matrix = new Matrix4().compose(
    new Vector3(entry.x + (world ? 4.5 : 0), entry.y, entry.z - (world ? 1.55 : 0)),
    new Quaternion().setFromEuler(new Euler(entry.rx ?? 0, entry.ry ?? 0, entry.rz ?? 0)),
    new Vector3(entry.w, entry.h, entry.d),
  );
  return new Box3(new Vector3(-.5, -.5, -.5), new Vector3(.5, .5, .5)).applyMatrix4(matrix);
}

function vehicleSeparation(box: Box3, vehicle: { x: number; z: number; sin: number; cos: number; halfLength: number }) {
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
  const halfX = (box.max.x - box.min.x) / 2, halfZ = (box.max.z - box.min.z) / 2;
  // SAT uses the vehicle's actual yaw. Its axis-aligned envelope spuriously
  // clips the existing foundation corner while turning on the southeast lane.
  return Math.max(...[[1, 0], [0, 1], [vehicle.cos, -vehicle.sin], [vehicle.sin, vehicle.cos]].map(([ax, az]) =>
    Math.abs((cx - vehicle.x) * ax + (cz - vehicle.z) * az) -
    halfX * Math.abs(ax) - halfZ * Math.abs(az) -
    .75 * Math.abs(vehicle.cos * ax - vehicle.sin * az) -
    vehicle.halfLength * Math.abs(vehicle.sin * ax + vehicle.cos * az),
  ));
}

describe("Little Works office construction data", () => {
  it("is a deterministic, bounded model with explicit render groups and semantic parts", () => {
    expect(createOfficeBuilding()).toEqual(building);
    for (const group of GROUP_NAMES) expect(building[group].length, group).toBeGreaterThan(0);
    expect(building.roofs.length).toBeGreaterThan(0);
    // These are geometric budgets, not FPS assertions or mocked GPU readings.
    expect(entries.length).toBeLessThanOrEqual(750);
    expect(permanent.length).toBeLessThanOrEqual(400);
    expect(building.details.length).toBeLessThanOrEqual(140);
    expect(building.nightWindows.length).toBeLessThanOrEqual(48);
    expect(entries.length - building.details.length).toBeLessThan(entries.length);
  });

  it("contains finite positive geometry and valid, fully reachable installation times", () => {
    for (const entry of entries) {
      const description = label(entry);
      expect([entry.x, entry.y, entry.z, entry.w, entry.h, entry.d, entry.rx ?? 0, entry.ry ?? 0, entry.rz ?? 0, entry.stage, entry.duration ?? .055, entry.removeAt ?? 2].every(Number.isFinite), description).toBe(true);
      expect(Math.min(entry.w, entry.h, entry.d), description).toBeGreaterThan(0);
      expect(entry.kind.trim().length, description).toBeGreaterThan(0);
      expect(entry.c, description).toMatch(/^#[0-9a-f]{6}$/i);
      expect(entry.stage, description).toBeGreaterThanOrEqual(0);
      expect(entry.duration ?? .055, description).toBeGreaterThan(0);
      expect(entry.stage + (entry.duration ?? .055), description).toBeLessThanOrEqual(1 + EPSILON);
      expect(entry.removeAt ?? 2, description).toBeGreaterThan(entry.stage);
    }
  });

  it("removes roof rebar and scaffold while completing every permanent part at handover", () => {
    expect(temporary.some(entry => entry.kind === "rebar")).toBe(true);
    expect(temporary.some(entry => entry.kind === "scaffold")).toBe(true);
    for (const entry of temporary) {
      expect(entry.removeAt! + .045, label(entry)).toBeLessThanOrEqual(1 + EPSILON);
      expect(revealAt(entry, 1), label(entry)).toBe(0);
    }
    for (const entry of permanent) {
      expect(revealAt(entry, 0), label(entry)).toBe(0);
      expect(revealAt(entry, 1), label(entry)).toBeCloseTo(1, 12);
    }
    for (const entry of entries.filter(entry => entry.kind === "rebar" && entry.y > 5))
      expect((entry.removeAt ?? 2) + .045, label(entry)).toBeLessThanOrEqual(.82);
  });

  it("keeps permanent structure ahead of retirement-ordered temporary work for bounded draw counts", () => {
    const firstTemporary = building.structure.findIndex(entry => (entry.removeAt ?? 2) < 2);
    expect(firstTemporary).toBe(60);
    expect(building.structure.slice(0, firstTemporary).every(entry => (entry.removeAt ?? 2) >= 2)).toBe(true);
    const retirement = building.structure.slice(firstTemporary).map(entry => entry.removeAt ?? 2);
    expect(retirement.every(value => value < 2)).toBe(true);
    expect(retirement).toEqual([...retirement].sort((a, b) => a - b));
    for (const group of ["facade", "glazing", "details", "nightWindows"] as const)
      expect(building[group].every(entry => (entry.removeAt ?? 2) >= 2), group).toBe(true);
  });

  it("paints real wall panels after they exist and finishes before handover", () => {
    const painted = entries.filter(entry => entry.paintFrom !== undefined || entry.paintTo !== undefined || entry.paintColor !== undefined);
    expect(painted.length).toBeGreaterThan(0);
    for (const entry of painted) {
      const description = label(entry);
      expect([entry.paintFrom, entry.paintTo].every(Number.isFinite), description).toBe(true);
      expect(entry.paintFrom!, description).toBeGreaterThanOrEqual(entry.stage + (entry.duration ?? .055) - EPSILON);
      expect(entry.paintTo!, description).toBeGreaterThan(entry.paintFrom!);
      expect(entry.paintTo!, description).toBeLessThanOrEqual(1);
      expect(entry.paintColor, description).toMatch(/^#[0-9a-f]{6}$/i);
      expect(entry.paintColor, description).not.toBe(entry.c);
      expect(entry.group, description).toBe("facade");
    }
    expect(Math.min(...building.glazing.map(entry => entry.stage))).toBeGreaterThan(Math.min(...building.facade.map(entry => entry.stage)));
    expect(Math.min(...building.nightWindows.map(entry => entry.stage))).toBeGreaterThanOrEqual(Math.min(...building.glazing.map(entry => entry.stage)));
  });

  it("keeps permanent structures within the reserved building and entrance footprint", () => {
    for (const entry of permanent) {
      const bounds = boundsFor(entry);
      expect(bounds.min.x, label(entry)).toBeGreaterThanOrEqual(-2.5 - EPSILON);
      expect(bounds.max.x, label(entry)).toBeLessThanOrEqual(2.5 + EPSILON);
      expect(bounds.min.z, label(entry)).toBeGreaterThanOrEqual(-2.4 - EPSILON);
      expect(bounds.max.z, label(entry)).toBeLessThanOrEqual(3.15 + EPSILON);
      // The ramp's low top edge meets the .04 ground plane; the thickness
      // beneath that edge is deliberately embedded, not an unsupported gap.
      expect(bounds.min.y, label(entry)).toBeGreaterThanOrEqual(entry.kind === "ramp" ? -.04 : -EPSILON);
      expect(bounds.max.y, label(entry)).toBeLessThanOrEqual(6.8 + EPSILON);
    }
    const groundGlass = building.glazing.filter(entry => boundsFor(entry).min.y < 1);
    expect(groundGlass.length).toBeGreaterThan(0);
    expect(groundGlass.some(entry => entry.h >= 1.1)).toBe(true);
    for (const ramp of permanent.filter(entry => entry.kind === "ramp")) {
      const lowerTop = ramp.y - ramp.w / 2 * Math.abs(Math.sin(ramp.rz ?? 0)) + ramp.h / 2 * Math.cos(ramp.rz ?? 0);
      expect(lowerTop).toBeCloseTo(.04, 2);
    }
  });

  it("defines local rain roofs at actual visible roof heights, without premature shelter", () => {
    for (const roof of building.roofs) {
      expect([roof.x, roof.z, roof.w, roof.d, roof.y, roof.stage].every(Number.isFinite)).toBe(true);
      expect(Math.min(roof.w, roof.d)).toBeGreaterThan(0);
      expect(roof.y).toBeGreaterThan(0);
      expect(roof.y).toBeLessThanOrEqual(6.8);
      expect(roof.stage).toBeGreaterThanOrEqual(0);
      expect(roof.stage).toBeLessThanOrEqual(1);
      const supporting = permanent.filter(entry => {
        const box = boundsFor(entry);
        return box.min.x <= roof.x - roof.w / 2 + EPSILON && box.max.x >= roof.x + roof.w / 2 - EPSILON &&
          box.min.z <= roof.z - roof.d / 2 + EPSILON && box.max.z >= roof.z + roof.d / 2 - EPSILON &&
          box.min.y > .04 && box.max.y <= roof.y + EPSILON;
      });
      expect(supporting.length, `roof ${JSON.stringify(roof)}`).toBeGreaterThan(0);
      expect(supporting.some(entry => entry.stage + (entry.duration ?? .055) <= roof.stage + EPSILON), `roof shown before supporting construction: ${JSON.stringify(roof)}`).toBe(true);
      // A single rain envelope may include an equipment box and its smaller
      // cap, just as the existing district roofs include their corrugations.
      const completedOverlaps = permanent.filter(entry => entry.stage + (entry.duration ?? .055) <= roof.stage + EPSILON).map(entry => boundsFor(entry)).filter(box =>
        box.max.x > roof.x - roof.w / 2 && box.min.x < roof.x + roof.w / 2 &&
        box.max.z > roof.z - roof.d / 2 && box.min.z < roof.z + roof.d / 2 &&
        box.min.y <= roof.y + EPSILON,
      );
      expect(completedOverlaps.some(box => Math.abs(box.max.y - roof.y) <= EPSILON), `roof has no completed top surface: ${JSON.stringify(roof)}`).toBe(true);
    }
  });

  it("preserves truck clearance for 9,003 actual route poses including tipped beds", () => {
    const solids = permanent.filter(entry => entry.group !== "nightWindows" && boundsFor(entry).max.y > .04 + EPSILON).map(entry => ({ entry, bounds: boundsFor(entry, true) }));
    let closest = { distance: Infinity, entry: "", vehicle: -1, time: 0 };
    for (let tick = 0; tick <= 3000; tick++) for (let vehicle = 0; vehicle < 3; vehicle++) {
      const time = tick * .04, pose = vehiclePose(time, vehicle);
      const rear = vehicle < 2 ? Math.min(-1.3, -.92 - .26 * Math.cos(pose.tip) - .505 * Math.sin(pose.tip)) : -1.3;
      const centerZ = (1.3 + rear) / 2, halfLength = (1.3 - rear) / 2;
      const sin = Math.sin(pose.angle), cos = Math.cos(pose.angle);
      const x = pose.position.x + centerZ * sin, z = pose.position.z + centerZ * cos;
      for (const solid of solids) {
        const distance = vehicleSeparation(solid.bounds, { x, z, sin, cos, halfLength });
        if (distance < closest.distance) closest = { distance, entry: label(solid.entry), vehicle, time };
      }
    }
    expect(closest.distance, JSON.stringify(closest)).toBeGreaterThanOrEqual(.05 - EPSILON);
  });
});
