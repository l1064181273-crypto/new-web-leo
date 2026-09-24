import { describe, expect, it } from "vitest";
import { Box3, Euler, Matrix4, Quaternion, Vector3 } from "three-r160";
import { EXPANSION_DISTRICTS } from "../../sandbox/site-expansion.js";
import { CAMERA_NAMES, SITE_ZONES } from "../../sandbox/studio-state.js";
import { loaderPaths, vehiclePose } from "../../sandbox/traffic.js";

type Entry = {
  x: number; y: number; z: number;
  w: number; h: number; d: number;
  c: string; rx?: number; ry?: number; rz?: number;
};
type District = {
  id: string;
  position: [number, number];
  start: number;
  persistent: boolean;
  highEntries: Entry[];
  lowEntries: Entry[];
  switchDistance: number;
  zone: { id: string; camera: string; position: [number, number, number] };
  sign: { text: string; x: number; y: number; z: number; width: number; height: number; ry?: number };
  roofs: { minX: number; maxX: number; minZ: number; maxZ: number; y: number }[];
};
type Footprint = { minX: number; maxX: number; minZ: number; maxZ: number; label: string };
type Bounds = Footprint & { minY: number; maxY: number };
type Detail = "highEntries" | "lowEntries";

const districts = EXPANSION_DISTRICTS as District[];
const EPSILON = 1e-9; // Floating-point comparison only, not a collision allowance.
const CLEARANCE = .05;
const GROUND_TOP = .04;
const FENCE_HALF_X = 15.45, FENCE_HALF_Z = 11.75, FENCE_HALF_THICKNESS = .045;
// Round outwards: real 0.04 s samples reach z=-7.156287... and z=6.956287...
const RESERVED_TRAFFIC: Footprint = { minX: -10.048, maxX: 10.048, minZ: -7.157, maxZ: 6.957, label: "reserved traffic envelope" };
// The high-detail pipe supports extend to z=8.11, beyond the base slab at 8.145.
const UTILITIES: Footprint = { minX: -4.2, maxX: 4.2, minZ: 8.11, maxZ: 9.295, label: "existing utilities and supports" };
const GATE_WORKERS: Footprint[] = [
  // (-7.7, 9.08), x route +/- .36, plus the turned body and hand-held torch.
  { minX: -8.28, maxX: -7.12, minZ: 8.90, maxZ: 9.26, label: "gate patrol route and body" },
  // (-6, 9.04), stationary task=2. The flag reaches x=.23+.09*sqrt(2).
  { minX: -6.21, maxX: -5.64, minZ: 8.95, maxZ: 9.19, label: "gate banksman arms and flag" },
];

function worldBounds(district: District, entry: Entry, index = 0): Bounds {
  const matrix = new Matrix4().compose(
    new Vector3(district.position[0] + entry.x, entry.y, district.position[1] + entry.z),
    new Quaternion().setFromEuler(new Euler(entry.rx ?? 0, entry.ry ?? 0, entry.rz ?? 0)),
    new Vector3(entry.w, entry.h, entry.d),
  );
  const box = new Box3(new Vector3(-.5, -.5, -.5), new Vector3(.5, .5, .5)).applyMatrix4(matrix);
  return { minX: box.min.x, maxX: box.max.x, minY: box.min.y, maxY: box.max.y, minZ: box.min.z, maxZ: box.max.z, label: `${district.id}[${index}]` };
}

function entriesFor(detail: Detail): Bounds[] {
  return districts.flatMap(district => district[detail].map((entry, index) => worldBounds(district, entry, index)));
}

function solidsFor(detail: Detail): Bounds[] {
  // Only flush paving, grates and markings are exempt. A tall roof, rail or
  // column remains a solid; no classification depends on whether a test passes.
  return entriesFor(detail).filter(bounds => bounds.maxY > GROUND_TOP + EPSILON);
}

function clearance(a: Footprint, b: Footprint) {
  const gapX = Math.max(a.minX - b.maxX, b.minX - a.maxX);
  const gapZ = Math.max(a.minZ - b.maxZ, b.minZ - a.maxZ);
  return gapX > 0 || gapZ > 0
    ? Math.hypot(Math.max(0, gapX), Math.max(0, gapZ))
    : Math.max(gapX, gapZ);
}

function closestPair(first: Footprint[], second: Footprint[]) {
  let result = { distance: Infinity, first: "", second: "" };
  for (const a of first) for (const b of second) {
    const distance = clearance(a, b);
    if (distance < result.distance) result = { distance, first: a.label, second: b.label };
  }
  return result;
}

function vehicleBounds(time: number, index: number, includeTippingBed = false): Footprint {
  const pose = vehiclePose(time, index);
  // Existing clearance proxy: half-width=.75, half-length=1.3. The two dump
  // trucks' rear upper bed corner extends further while tipping; include it.
  const rearZ = includeTippingBed && index < 2
    ? Math.min(-1.3, -.92 - .26 * Math.cos(pose.tip) - .505 * Math.sin(pose.tip))
    : -1.3;
  const centerZ = (1.3 + rearZ) / 2;
  const halfLength = (1.3 - rearZ) / 2;
  const sin = Math.sin(pose.angle), cos = Math.cos(pose.angle);
  const x = pose.position.x + centerZ * sin, z = pose.position.z + centerZ * cos;
  const extentX = Math.abs(cos) * .75 + Math.abs(sin) * halfLength;
  const extentZ = Math.abs(sin) * .75 + Math.abs(cos) * halfLength;
  return { minX: x - extentX, maxX: x + extentX, minZ: z - extentZ, maxZ: z + extentZ, label: `truck ${index} at ${time.toFixed(2)} s` };
}

function sampleFleet(includeTippingBed = false) {
  const result: Footprint[] = [];
  // Integer ticks include both endpoints without accumulated floating error.
  for (let tick = 0; tick <= 3000; tick++) for (let index = 0; index < 3; index++)
    result.push(vehicleBounds(tick * .04, index, includeTippingBed));
  return result;
}

describe("Little Works expansion data and rendering budget", () => {
  it("provides three persistent districts with bounded near/far instance counts", () => {
    expect(districts.map(district => district.id).sort()).toEqual(["entrance", "material-yard", "welfare"]);
    expect(districts.reduce((total, district) => total + district.highEntries.length, 0)).toBeLessThanOrEqual(435);
    expect(districts.reduce((total, district) => total + district.lowEntries.length, 0)).toBeLessThanOrEqual(41);
    for (const district of districts) {
      expect(district.start).toBe(-1);
      expect(district.persistent).toBe(true);
      expect(Number.isFinite(district.switchDistance)).toBe(true);
      expect(district.switchDistance).toBeGreaterThan(0);
      expect(district.highEntries.length).toBeGreaterThan(district.lowEntries.length);
      expect(district.lowEntries.length).toBeGreaterThan(0);
      for (const detail of ["highEntries", "lowEntries"] as const)
        expect(district[detail].some(entry => worldBounds(district, entry).maxY > GROUND_TOP + EPSILON)).toBe(true);
    }
  });

  it("contains only finite, positive-size geometry in each district's local frame", () => {
    for (const district of districts) {
      expect(district.position).toHaveLength(2);
      expect(district.position.every(Number.isFinite)).toBe(true);
      for (const detail of ["highEntries", "lowEntries"] as const) {
        district[detail].forEach((entry, index) => {
          const label = `${district.id}.${detail}[${index}]`;
          expect([entry.x, entry.y, entry.z, entry.w, entry.h, entry.d, entry.rx ?? 0, entry.ry ?? 0, entry.rz ?? 0].every(Number.isFinite), label).toBe(true);
          expect(Math.min(entry.w, entry.h, entry.d), label).toBeGreaterThan(0);
          expect(typeof entry.c, label).toBe("string");
          expect(entry.c.length, label).toBeGreaterThan(0);
        });
      }
    }
  });

  it("registers each observation zone and camera without losing the existing zones", () => {
    for (const id of ["earthworks", "structure", "rebar", "office", "transport", "west-logistics", "north-utilities", "east-precast"])
      expect(SITE_ZONES.filter(zone => zone.id === id)).toHaveLength(1);
    for (const district of districts) {
      expect(district.zone.id).toBe(district.id);
      expect(SITE_ZONES.filter(zone => zone.id === district.id)).toHaveLength(1);
      expect(CAMERA_NAMES).toContain(district.zone.camera);
      expect(district.zone.position).toHaveLength(3);
      expect(district.zone.position.every(Number.isFinite)).toBe(true);
      const sign = district.sign;
      expect(sign.text.trim().length).toBeGreaterThan(0);
      expect([sign.x, sign.y, sign.z, sign.width, sign.height, sign.ry ?? 0].every(Number.isFinite)).toBe(true);
      expect(Math.min(sign.width, sign.height)).toBeGreaterThan(0);
      expect(Math.abs(sign.x)).toBeLessThan(FENCE_HALF_X);
      expect(Math.abs(sign.z)).toBeLessThan(FENCE_HALF_Z);
    }
  });

  it("describes world-space rain envelopes supported by both LOD roofs and their highest detail", () => {
    let roofCount = 0;
    for (const district of districts) {
      const bounds = district.highEntries.map((entry, index) => worldBounds(district, entry, index));
      for (const roof of district.roofs) {
        roofCount++;
        expect([roof.minX, roof.maxX, roof.minZ, roof.maxZ, roof.y].every(Number.isFinite)).toBe(true);
        expect(roof.maxX).toBeGreaterThan(roof.minX);
        expect(roof.maxZ).toBeGreaterThan(roof.minZ);
        expect(roof.y).toBeGreaterThan(GROUND_TOP);
        // One horizontal rain envelope must cap corrugations as well as the
        // slab. Its height is the exact highest covered solid, not necessarily
        // the top of the single broad slab used by the simplified far LOD.
        const highestTop = Math.max(...bounds.filter(box =>
          Math.min(box.maxX, roof.maxX) - Math.max(box.minX, roof.minX) > EPSILON &&
          Math.min(box.maxZ, roof.maxZ) - Math.max(box.minZ, roof.minZ) > EPSILON,
        ).map(box => box.maxY));
        expect(Math.abs(highestTop - roof.y), `${district.id} rain envelope height`).toBeLessThanOrEqual(EPSILON);
        for (const detail of ["highEntries", "lowEntries"] as const) {
          const supportingRoof = district[detail].map((entry, index) => worldBounds(district, entry, index)).some(box =>
            box.minX <= roof.minX + EPSILON && box.maxX >= roof.maxX - EPSILON &&
            box.minZ <= roof.minZ + EPSILON && box.maxZ >= roof.maxZ - EPSILON &&
            box.minY > GROUND_TOP && box.maxY <= roof.y + EPSILON,
          );
          expect(supportingRoof, `${district.id}.${detail} roof ${JSON.stringify(roof)}`).toBe(true);
        }
      }
    }
    expect(roofCount).toBeGreaterThan(0);
  });
});

describe.each(["highEntries", "lowEntries"] as const)("Little Works expansion clearance: %s", detail => {
  it("keeps even rotated geometry inside the enlarged slab and the inner fence faces", () => {
    const bounds = entriesFor(detail);
    for (const box of bounds) {
      expect(Math.max(Math.abs(box.minX), Math.abs(box.maxX)), box.label).toBeLessThanOrEqual(FENCE_HALF_X - FENCE_HALF_THICKNESS + EPSILON);
      expect(Math.max(Math.abs(box.minZ), Math.abs(box.maxZ)), box.label).toBeLessThanOrEqual(FENCE_HALF_Z - FENCE_HALF_THICKNESS + EPSILON);
      expect(box.minY, box.label).toBeGreaterThanOrEqual(-EPSILON);
    }
    expect(FENCE_HALF_X).toBeLessThan(31.5 / 2);
    expect(FENCE_HALF_Z).toBeLessThan(24.25 / 2);
  });

  it("keeps solid construction out of the entire reserved traffic envelope", () => {
    const nearest = closestPair(solidsFor(detail), [RESERVED_TRAFFIC]);
    expect(nearest.distance, JSON.stringify(nearest)).toBeGreaterThanOrEqual(CLEARANCE - EPSILON);
  });

  it("clears every real vehicle pose, including dump-bed overhang, for a full traffic loop", () => {
    const nearest = closestPair(solidsFor(detail), sampleFleet(true));
    expect(nearest.distance, JSON.stringify(nearest)).toBeGreaterThanOrEqual(CLEARANCE - EPSILON);
  });

  it("preserves the existing pipe supports, gate patrol route and banksman's flag", () => {
    const nearest = closestPair(solidsFor(detail), [UTILITIES, ...GATE_WORKERS]);
    expect(nearest.distance, JSON.stringify(nearest)).toBeGreaterThanOrEqual(CLEARANCE - EPSILON);
  });

  it("preserves both loader routes and its parked position through any body yaw", () => {
    const routes = Object.values(loaderPaths) as { x: number; fromZ: number; toZ: number }[];
    // Covers all intermediate orientations of the existing .42 x .66 proxy,
    // including the eased transition between parked and working positions.
    const radius = Math.hypot(.42, .66);
    const loader: Footprint = {
      minX: Math.min(7.2, ...routes.map(path => path.x)) - radius,
      maxX: Math.max(7.2, ...routes.map(path => path.x)) + radius,
      minZ: Math.min(.7, ...routes.flatMap(path => [path.fromZ, path.toZ])) - radius,
      maxZ: Math.max(.7, ...routes.flatMap(path => [path.fromZ, path.toZ])) + radius,
      label: "loader parked/working/returning sweep",
    };
    const nearest = closestPair(solidsFor(detail), [loader]);
    expect(nearest.distance, JSON.stringify(nearest)).toBeGreaterThanOrEqual(CLEARANCE - EPSILON);
  });

  it("leaves at least 0.4 model units from both existing 0.15-unit service-pole bodies", () => {
    const poles = [-12.85, 12.85].map(x => ({ minX: x - .075, maxX: x + .075, minZ: -8.875, maxZ: -8.725, label: `service pole x=${x}` }));
    const nearest = closestPair(solidsFor(detail), poles);
    expect(nearest.distance, JSON.stringify(nearest)).toBeGreaterThanOrEqual(.4 - EPSILON);
  });

  it("keeps the three districts' solid footprints separate", () => {
    for (let first = 0; first < districts.length; first++) for (let second = first + 1; second < districts.length; second++) {
      const a = districts[first], b = districts[second];
      const nearest = closestPair(
        a[detail].map((entry, index) => worldBounds(a, entry, index)).filter(box => box.maxY > GROUND_TOP + EPSILON),
        b[detail].map((entry, index) => worldBounds(b, entry, index)).filter(box => box.maxY > GROUND_TOP + EPSILON),
      );
      expect(nearest.distance, JSON.stringify(nearest)).toBeGreaterThanOrEqual(CLEARANCE - EPSILON);
    }
  });
});

describe("independent clearance audit arithmetic", () => {
  it("covers the actual sampled traffic bounds without rounding them inwards", () => {
    const fleet = sampleFleet();
    const envelope = fleet.reduce((bounds, pose) => ({
      minX: Math.min(bounds.minX, pose.minX), maxX: Math.max(bounds.maxX, pose.maxX),
      minZ: Math.min(bounds.minZ, pose.minZ), maxZ: Math.max(bounds.maxZ, pose.maxZ),
    }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
    expect(fleet).toHaveLength(9003);
    expect(envelope.minX).toBeGreaterThanOrEqual(RESERVED_TRAFFIC.minX);
    expect(envelope.maxX).toBeLessThanOrEqual(RESERVED_TRAFFIC.maxX);
    expect(envelope.minZ).toBeGreaterThanOrEqual(RESERVED_TRAFFIC.minZ);
    expect(envelope.maxZ).toBeLessThanOrEqual(RESERVED_TRAFFIC.maxZ);
    expect(envelope.minZ).toBeLessThan(-7.156);
    expect(envelope.maxZ).toBeGreaterThan(6.956);
  });

  it("transforms all box extents rather than checking only local centers", () => {
    const district = { position: [10, -8], id: "rotation-check" } as District;
    const entry = { x: 1, y: 2, z: -1, w: 2, h: 2, d: 4, c: "#fff", ry: Math.PI / 2 };
    const bounds = worldBounds(district, entry);
    expect(bounds.minX).toBeCloseTo(9, 12);
    expect(bounds.maxX).toBeCloseTo(13, 12);
    expect(bounds.minZ).toBeCloseTo(-10, 12);
    expect(bounds.maxZ).toBeCloseTo(-8, 12);
    expect(bounds.minY).toBeCloseTo(1, 12);
    expect(bounds.maxY).toBeCloseTo(3, 12);
  });

  it("returns a negative clearance for intersecting solids and exact edge gaps otherwise", () => {
    const a = { minX: 0, maxX: 1, minZ: 0, maxZ: 1, label: "a" };
    expect(clearance(a, { minX: .5, maxX: 1.5, minZ: .5, maxZ: 1.5, label: "overlap" })).toBe(-.5);
    expect(clearance(a, { minX: 1.4, maxX: 2, minZ: 0, maxZ: 1, label: "gap" })).toBeCloseTo(.4, 12);
    expect(clearance(a, { minX: 1.3, maxX: 2, minZ: 1.4, maxZ: 2, label: "diagonal" })).toBeCloseTo(.5, 12);
  });
});
