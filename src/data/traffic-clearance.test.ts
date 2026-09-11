import { describe, expect, it } from "vitest";
import {
  lampPositions,
  loaderPaths,
  vehiclePose,
} from "../../sandbox/traffic.js";

const truckHalfWidth = 0.75;
const truckHalfLength = 1.3;
const polePadding = 0.1;

function truckToPointClearance(
  pose: ReturnType<typeof vehiclePose>,
  [pointX, pointZ]: number[],
) {
  const extentX =
    Math.abs(Math.cos(pose.angle)) * truckHalfWidth +
    Math.abs(Math.sin(pose.angle)) * truckHalfLength;
  const extentZ =
    Math.abs(Math.sin(pose.angle)) * truckHalfWidth +
    Math.abs(Math.cos(pose.angle)) * truckHalfLength;
  const gapX =
    Math.abs(pose.position.x - pointX) -
    extentX -
    polePadding;
  const gapZ =
    Math.abs(pose.position.z - pointZ) -
    extentZ -
    polePadding;
  return gapX > 0 || gapZ > 0
    ? Math.hypot(Math.max(0, gapX), Math.max(0, gapZ))
    : Math.max(gapX, gapZ);
}

describe("Little Works static obstacle clearance", () => {
  it("keeps the visible fleet separated for a complete traffic loop", () => {
    let minimum = Number.POSITIVE_INFINITY;
    for (let time = 0; time < 120; time += 0.01) {
      const poses = [0, 1, 2].map(index => vehiclePose(time, index));
      for (let first = 0; first < poses.length; first++) {
        for (let second = first + 1; second < poses.length; second++) {
          minimum = Math.min(
            minimum,
            poses[first].position.distanceTo(poses[second].position),
          );
        }
      }
    }
    expect(minimum).toBeGreaterThan(3);
  });

  it("keeps every truck clear of every work light for a complete traffic loop", () => {
    let minimum = Number.POSITIVE_INFINITY;
    for (let time = 0; time < 120; time += 0.01) {
      for (let truck = 0; truck < 3; truck++) {
        const pose = vehiclePose(time, truck);
        for (const lamp of lampPositions)
          minimum = Math.min(minimum, truckToPointClearance(pose, lamp));
      }
    }
    expect(minimum).toBeGreaterThan(0.35);
  });

  it("stops the loader body before the spoil pile edge", () => {
    const loaderHalfLength = 0.66;
    const spoilMinZ = 2.4;
    for (const path of Object.values(loaderPaths) as {
      fromZ: number;
      toZ: number;
    }[]) {
      expect(path.toZ).toBeGreaterThan(path.fromZ);
      expect(spoilMinZ - (path.toZ + loaderHalfLength)).toBeGreaterThan(0.005);
    }
  });
});
