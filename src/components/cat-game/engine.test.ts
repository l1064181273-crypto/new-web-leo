import { describe, expect, it } from "vitest";
import { GARDEN_LEVELS, GardenState, Point, advanceGarden, createGarden, findPath, freshProgress, isWalkable, levelFor, recordCompletion, restoreProgress, samePoint, starsFor } from "./engine";

function walkTo(initial: GardenState, destination: Point): GardenState {
  let state = initial;
  const path = findPath(levelFor(state.levelId), state.player, destination, state.keyCollected);
  expect(path.length, "destination must be reachable").toBeGreaterThan(0);
  for (const point of path.slice(1)) {
    state = advanceGarden(state, { type: "move", dx: point.x - state.player.x, dy: point.y - state.player.y });
    state = advanceGarden(state, { type: "tick" });
  }
  return state;
}

function finishGarden(levelId: string, mode: "cozy" | "challenge" = "cozy") {
  const level = levelFor(levelId);
  let state = createGarden(levelId, mode);
  if (level.key) state = walkTo(state, level.key);
  for (const definition of level.cats) {
    if (state.cats.find((cat) => cat.id === definition.id)?.status !== "waiting") continue;
    state = walkTo(state, definition);
    state = advanceGarden(state, { type: "call" });
    if (definition.personality === "sleepy") state = advanceGarden(state, { type: "call" });
  }
  state = walkTo(state, level.home);
  for (let tick = 0; tick < 100 && state.status === "playing"; tick += 1) state = advanceGarden(state, { type: "tick" });
  return state;
}

describe("garden navigation", () => {
  it("uses cardinal walkable steps and finds a route around water", () => {
    const level = GARDEN_LEVELS[0];
    const path = findPath(level, { x: 4, y: 5 }, { x: 7, y: 5 });
    expect(path.length).toBeGreaterThan(4);
    for (const [index, point] of path.entries()) {
      expect(isWalkable(level, point)).toBe(true);
      if (index) expect(Math.abs(point.x - path[index - 1].x) + Math.abs(point.y - path[index - 1].y)).toBe(1);
    }
  });

  it("does not consume a step for a blocked move or mutate the previous state", () => {
    const initial = createGarden();
    const next = advanceGarden(initial, { type: "move", dx: 0, dy: 1 });
    expect(next.player).toEqual(initial.player);
    expect(next.moves).toBe(0);
    expect(next.feedbackKind).toBe("blocked");
    expect(initial.feedbackKind).toBe("info");
  });

  it("keeps the gate impassable until the actual key tile is reached", () => {
    const level = GARDEN_LEVELS[2];
    const initial = createGarden(level.id);
    expect(findPath(level, initial.player, level.home, false)).toEqual([]);
    const withKey = walkTo(initial, level.key!);
    expect(withKey.keyCollected).toBe(true);
    expect(isWalkable(level, level.gate!, true)).toBe(true);
    expect(findPath(level, withKey.player, level.home, true).length).toBeGreaterThan(0);
  });
});

describe("cat behavior and progression", () => {
  it("calls are limited by route distance, including hedge detours", () => {
    let state = createGarden(GARDEN_LEVELS[1].id);
    state = { ...state, player: { x: 3, y: 3 } };
    state = advanceGarden(state, { type: "call" });
    expect(state.cats.find((cat) => cat.id === "cream")?.status).toBe("following");
    expect(state.cats.find((cat) => cat.id === "sesame")?.awake).toBe(false);
  });

  it("wakes a sleepy cat first, then recruits it with a second call", () => {
    let state = createGarden(GARDEN_LEVELS[1].id);
    state = { ...state, player: { x: 6, y: 4 } };
    state = advanceGarden(state, { type: "call" });
    expect(state.cats.find((cat) => cat.id === "sesame")).toMatchObject({ awake: true, status: "waiting" });
    state = advanceGarden(state, { type: "call" });
    expect(state.cats.find((cat) => cat.id === "sesame")?.status).toBe("following");
    expect(state.moves).toBe(2);
  });

  it("following cats remain walkable and finish entering even when the player waits", () => {
    let state = createGarden();
    state = { ...state, player: { x: 2, y: 3 } };
    state = advanceGarden(state, { type: "call" });
    state = walkTo(state, GARDEN_LEVELS[0].home);
    for (let index = 0; index < 30; index += 1) {
      state = advanceGarden(state, { type: "tick" });
      for (const cat of state.cats) expect(isWalkable(GARDEN_LEVELS[0], cat, false)).toBe(true);
    }
    const orange = state.cats.find((cat) => cat.id === "orange")!;
    expect(orange.status).toBe("home");
    expect(samePoint(orange, GARDEN_LEVELS[0].home)).toBe(true);
    expect(state.status).toBe("playing");
  });

  for (const level of GARDEN_LEVELS) {
    it("can complete " + level.title + " within its challenge budget", () => {
      const complete = finishGarden(level.id, "challenge");
      expect(complete.status).toBe("won");
      expect(complete.cats.every((cat) => cat.status === "home")).toBe(true);
      expect(complete.moves).toBeLessThanOrEqual(level.budget);
      expect(starsFor(complete)).toBeGreaterThanOrEqual(1);
    });
  }

  it.each([
    { levelId: "sunny-porch", expectedMoves: 15, stops: [{ point: { x: 2, y: 4 }, calls: 1 }, { point: { x: 9, y: 4 }, calls: 1 }] },
    { levelId: "hydrangea-path", expectedMoves: 24, stops: [{ point: { x: 2, y: 4 }, calls: 1 }, { point: { x: 7, y: 2 }, calls: 2 }, { point: { x: 9, y: 4 }, calls: 1 }] },
    { levelId: "after-the-rain", expectedMoves: 25, stops: [{ point: { x: 4, y: 2 }, calls: 2 }, { point: { x: 5, y: 5 }, calls: 1 }, { point: { x: 7, y: 4 }, calls: 1 }, { point: { x: 7, y: 3 }, calls: 1 }] },
  ])("makes three stars attainable in $levelId with the documented calling ranges", ({ levelId, stops, expectedMoves }) => {
    const level = levelFor(levelId);
    let state = createGarden(levelId, "challenge");
    const checkSave = () => expect(restoreProgress(JSON.stringify({ ...freshProgress(), unlocked: 3, session: state })).session).toMatchObject({ status: state.status, moves: state.moves, player: state.player, cats: state.cats });
    for (const stop of stops) {
      state = walkTo(state, stop.point);
      checkSave();
      for (let call = 0; call < stop.calls; call += 1) {
        state = advanceGarden(state, { type: "call" });
        checkSave();
      }
    }
    state = walkTo(state, level.home);
    checkSave();
    for (let tick = 0; tick < 100 && state.status === "playing"; tick += 1) {
      state = advanceGarden(state, { type: "tick" });
      checkSave();
    }
    expect(state.status).toBe("won");
    expect(state.moves).toBeLessThanOrEqual(level.par);
    expect(state.moves).toBe(expectedMoves);
    expect(starsFor(state)).toBe(3);
    expect(restoreProgress(JSON.stringify({ ...freshProgress(), unlocked: 3, session: state })).session?.status).toBe("won");
  });

  it("loses only in challenge mode and prevents input after a result", () => {
    const cozy = { ...createGarden(), moves: 41 };
    expect(advanceGarden(cozy, { type: "call" }).status).toBe("playing");
    const lost = advanceGarden({ ...cozy, mode: "challenge" }, { type: "call" });
    expect(lost.status).toBe("lost");
    expect(advanceGarden(lost, { type: "move", dx: 1, dy: 0 })).toBe(lost);
  });

  it("allows the final budget step to reach the porch and finish the queue", () => {
    let state = createGarden(undefined, "challenge");
    state = { ...state, moves: 41, player: { x: 8, y: 1 }, cats: state.cats.map((cat, index) => ({ ...cat, x: 7 - index, y: 1, status: "following" as const })) };
    state = advanceGarden(state, { type: "move", dx: 1, dy: 0 });
    expect(state.status).toBe("playing");
    expect(advanceGarden(state, { type: "call" })).toBe(state);
    expect(advanceGarden(state, { type: "move", dx: -1, dy: 0 })).toBe(state);
    for (let index = 0; index < 10; index += 1) state = advanceGarden(state, { type: "tick" });
    expect(state.status).toBe("won");
    expect(state.moves).toBe(42);
  });
});

describe("save validation and honest records", () => {
  it("restores a valid session without changing the underlying position or progress", () => {
    const session = advanceGarden(createGarden(), { type: "move", dx: 1, dy: 0 });
    const restored = restoreProgress(JSON.stringify({ ...freshProgress(), session }));
    expect(restored.session).toMatchObject({ moves: 1, player: { x: 3, y: 7 }, status: "playing" });
    expect(restored.unlocked).toBe(1);
  });

  it("rejects malformed, blocked-position, duplicate-cat and foreign-version saves", () => {
    expect(restoreProgress("{broken").session).toBeNull();
    expect(restoreProgress(JSON.stringify({ version: 99, unlocked: 3 })).unlocked).toBe(1);
    const session = createGarden();
    expect(restoreProgress(JSON.stringify({ ...freshProgress(), session: { ...session, player: { x: 0, y: 0 } } })).session).toBeNull();
    expect(restoreProgress(JSON.stringify({ ...freshProgress(), session: { ...session, cats: [session.cats[0], session.cats[0]] } })).session).toBeNull();
  });

  it("separates mode records, unlocks the next level, and retains the best real result", () => {
    const first = finishGarden(GARDEN_LEVELS[0].id);
    let progress = recordCompletion(freshProgress(), first, "2026-09-12T10:00:00Z");
    expect(progress.unlocked).toBe(2);
    expect(progress.records["sunny-porch:cozy"].moves).toBe(first.moves);
    progress = recordCompletion(progress, { ...first, moves: first.moves + 8 }, "2026-09-12T11:00:00Z");
    expect(progress.records["sunny-porch:cozy"].moves).toBe(first.moves);
    progress = recordCompletion(progress, { ...first, mode: "challenge" }, "2026-09-12T12:00:00Z");
    expect(Object.keys(progress.records)).toHaveLength(2);
  });

  it("completing the same game again is idempotent and keeps its first completion time", () => {
    const won = finishGarden(GARDEN_LEVELS[0].id);
    const progress = recordCompletion(freshProgress(), won, "2026-09-12T10:00:00Z");
    const repeated = recordCompletion(progress, won, "2026-09-12T11:00:00Z");
    expect(repeated).toBe(progress);
    expect(repeated.records["sunny-porch:cozy"].completedAt).toBe("2026-09-12T10:00:00Z");
  });

  it("rejects contradictory terminal states, moving sleepers, and moved waiting cats", () => {
    const session = createGarden();
    const invalid = [
      { ...session, status: "lost" },
      { ...session, mode: "challenge", moves: 42 },
      { ...session, cats: session.cats.map((cat) => ({ ...cat, status: "following", awake: false })) },
      { ...session, cats: session.cats.map((cat) => ({ ...cat, x: 3, y: 7 })) },
      { ...session, keyCollected: true },
      { ...session, status: "playing", cats: session.cats.map((cat) => ({ ...cat, ...GARDEN_LEVELS[0].home, status: "home" })) },
      { ...session, player: { x: 3, y: 7 }, moves: 0 },
      { ...session, status: "won", player: GARDEN_LEVELS[0].home, cats: session.cats.map((cat) => ({ ...cat, ...GARDEN_LEVELS[0].home, status: "home" })) },
    ];
    for (const candidate of invalid) expect(restoreProgress(JSON.stringify({ ...freshProgress(), session: candidate })).session).toBeNull();
  });

  it("retains valid records when only the current session is broken", () => {
    const won = finishGarden(GARDEN_LEVELS[0].id);
    const progress = recordCompletion(freshProgress(), won, "2026-09-12T10:00:00Z");
    const restored = restoreProgress(JSON.stringify({ ...progress, session: { ...won, player: { x: 500, y: 500 } } }));
    expect(restored.session).toBeNull();
    expect(restored.records["sunny-porch:cozy"].moves).toBe(won.moves);
    expect(restored.unlocked).toBe(2);
  });

  it("restores honest terminal feedback and skips inconsistent or corrupted records individually", () => {
    const won = finishGarden(GARDEN_LEVELS[0].id, "challenge");
    const progress = recordCompletion(freshProgress(), won, "2026-09-12T10:00:00Z");
    expect(restoreProgress(JSON.stringify(progress)).session).toMatchObject({ status: "won", feedbackKind: "win" });
    const good = progress.records["sunny-porch:challenge"];
    const variants = [
      { ...good, moves: 0 },
      { ...good, moves: 43, stars: 1 },
      { ...good, stars: 3 },
      { ...good, elapsed: 10_000_001 },
      { ...good, completedAt: "not a date" },
      { ...good, completedAt: "2026-02-31T10:00:00Z" },
    ];
    for (const broken of variants) {
      const restored = restoreProgress(JSON.stringify({ ...progress, records: { "sunny-porch:challenge": broken, "sunny-porch:cozy": good } }));
      expect(restored.records["sunny-porch:challenge"]).toBeUndefined();
      expect(restored.records["sunny-porch:cozy"]).toEqual(good);
    }
    const lost = advanceGarden({ ...createGarden(undefined, "challenge"), moves: 41 }, { type: "call" });
    expect(restoreProgress(JSON.stringify({ ...freshProgress(), session: lost })).session).toMatchObject({ status: "lost", feedbackKind: "lose" });
  });

  it("restores the valid last-step home queue but rejects an impossible closed-gate position", () => {
    const first = GARDEN_LEVELS[0];
    const homeQueue = { ...createGarden(first.id, "challenge"), player: first.home, moves: first.budget, cats: createGarden().cats.map((cat) => ({ ...cat, x: 8, y: 1, status: "homebound" })) };
    expect(restoreProgress(JSON.stringify({ ...freshProgress(), session: homeQueue })).session?.status).toBe("playing");
    const third = createGarden(GARDEN_LEVELS[2].id);
    expect(restoreProgress(JSON.stringify({ ...freshProgress(), unlocked: 3, session: { ...third, player: { x: 8, y: 3 } } })).session).toBeNull();
    expect(restoreProgress(JSON.stringify({ ...freshProgress(), unlocked: 3, session: { ...third, moves: 8, player: GARDEN_LEVELS[2].key } })).session).toBeNull();
  });
});
