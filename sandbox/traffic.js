import { Vector3 } from "three-r160";

export const lampPositions = [
  [-7, 2.3],
  [-5, -4.2],
  [2.6, 4.3],
  [7.35, -2],
];

export const loaderPaths = {
  grading: { x: 7.05, fromZ: .72, toZ: 1.72 },
  cleanup: { x: 7.12, fromZ: .82, toZ: 1.7 },
};

// Each truck follows the same bounded lane, with independent loading/unloading dwells.
export const route = [
  [-8.85, -.7], [-8.85, -4.2], [-7.4, -5.9], [7.4, -5.9],
  [8.85, -4.2], [8.85, 2.9], [8.85, 4], [7.4, 5.7],
  [-7.4, 5.7], [-8.85, 4],
].map(([x, z]) => new Vector3(x, 0, z));
const lengths = route.map((p, i) => p.distanceTo(route[(i + 1) % route.length]));
export const routeLength = lengths.reduce((a, b) => a + b, 0);
const unloadDistance = lengths.slice(0, 5).reduce((a, b) => a + b, 0);
const travelSeconds = 98;
const unloadAt = 12 + unloadDistance / routeLength * travelSeconds;
const smooth = t => t * t * (3 - 2 * t);
export const modulo = (value, length) => (value % length + length) % length;

function pointOnRoute(distance) {
  let rest = modulo(distance, routeLength);
  for (let i = 0; i < route.length; i++) {
    if (rest <= lengths[i]) return route[i].clone().lerp(route[(i + 1) % route.length], rest / lengths[i]);
    rest -= lengths[i];
  }
  return route[0].clone();
}

export function vehiclePose(time, index) {
  const phase = modulo(time + index * 40, 120);
  const loading = phase < 12;
  const unloading = phase >= unloadAt && phase < unloadAt + 10;
  const elapsed = Math.max(0, phase - 12) - Math.max(0, Math.min(10, phase - unloadAt));
  const distance = elapsed / travelSeconds * routeLength;
  const position = pointOnRoute(distance);
  const direction = pointOnRoute(distance + .35).sub(pointOnRoute(distance - .35));
  const unloadProgress = (phase - unloadAt) / 10;
  const tip = unloading ? Math.sin(Math.PI * smooth(unloadProgress)) * .65 : 0;
  return {
    position, angle: Math.atan2(direction.x, direction.z), loading, unloading, tip,
    moving: !loading && !unloading,
    loaded: phase >= 8 && phase < unloadAt + 5,
  };
}
