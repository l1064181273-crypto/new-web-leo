export type Point = { x: number; y: number };
export type CatPersonality = "curious" | "shy" | "sleepy";
export type CatStatus = "waiting" | "following" | "homebound" | "home";
export type GameMode = "cozy" | "challenge";
export type GameStatus = "playing" | "won" | "lost";
export type FeedbackKind = "info" | "move" | "call" | "wake" | "gate" | "home" | "win" | "lose" | "blocked";

export interface CatDefinition extends Point {
  id: string;
  name: string;
  personality: CatPersonality;
  coat: "ginger" | "cream" | "charcoal" | "calico";
}

export interface GardenLevel {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  hint: string;
  width: number;
  height: number;
  start: Point;
  home: Point;
  hedges: Point[];
  water: Point[];
  cats: CatDefinition[];
  gate?: Point;
  key?: Point;
  par: number;
  budget: number;
}

export interface CatState extends Point {
  id: string;
  status: CatStatus;
  awake: boolean;
}

export interface GardenState {
  levelId: string;
  mode: GameMode;
  status: GameStatus;
  player: Point;
  cats: CatState[];
  keyCollected: boolean;
  moves: number;
  elapsed: number;
  feedback: string;
  feedbackKind: FeedbackKind;
}

export type GardenAction =
  | { type: "move"; dx: number; dy: number }
  | { type: "call" }
  | { type: "tick" }
  | { type: "time"; seconds: number };

const points = (coordinates: number[][]): Point[] => coordinates.map(([x, y]) => ({ x, y }));

export const GARDEN_LEVELS: GardenLevel[] = [
  {
    id: "sunny-porch",
    number: 1,
    title: "阳光门廊",
    subtitle: "认识两位新朋友",
    description: "橘子和豆包在晒太阳。走近一点，叫上它们，一起回门廊。",
    hint: "猫咪在 3 格路程内能听见你。叫上两只猫后，走到右上角的小屋。",
    width: 11,
    height: 9,
    start: { x: 2, y: 7 },
    home: { x: 9, y: 1 },
    hedges: points([[4, 2], [4, 3], [7, 2]]),
    water: points([[5, 5], [6, 5], [5, 6], [6, 6]]),
    cats: [
      { id: "orange", name: "橘子", personality: "curious", coat: "ginger", x: 2, y: 2 },
      { id: "bean", name: "豆包", personality: "curious", coat: "cream", x: 8, y: 6 },
    ],
    par: 22,
    budget: 42,
  },
  {
    id: "hydrangea-path",
    number: 2,
    title: "绣球小径",
    subtitle: "每只猫都有自己的脾气",
    description: "奶盖有一点害羞，芝麻还在打盹。别急，换一种打招呼的方式。",
    hint: "奶盖要靠近到 2 格路程内；芝麻需要呼唤两次，第一次把它叫醒。",
    width: 11,
    height: 9,
    start: { x: 1, y: 7 },
    home: { x: 9, y: 1 },
    hedges: points([[4, 2], [4, 3], [4, 4], [4, 5], [5, 2], [6, 2], [2, 5]]),
    water: points([[7, 5], [8, 5], [7, 6], [8, 6]]),
    cats: [
      { id: "cream", name: "奶盖", personality: "shy", coat: "cream", x: 2, y: 2 },
      { id: "sesame", name: "芝麻", personality: "sleepy", coat: "charcoal", x: 6, y: 3 },
      { id: "orange", name: "橘子", personality: "curious", coat: "ginger", x: 9, y: 7 },
    ],
    par: 31,
    budget: 58,
  },
  {
    id: "after-the-rain",
    number: 3,
    title: "雨后花园",
    subtitle: "把另一边的朋友也接回家",
    description: "花园门还关着，钥匙落在左边的小径上。接齐四只猫，就可以开饭了。",
    hint: "先捡左侧金色钥匙，打开中央木门；叫上全部猫咪后走到右上角的小屋。",
    width: 11,
    height: 9,
    start: { x: 1, y: 7 },
    home: { x: 9, y: 1 },
    hedges: points([[6, 1], [6, 2], [6, 3], [6, 5], [6, 6], [6, 7], [2, 6], [4, 4]]),
    water: points([[2, 4], [3, 4], [8, 4]]),
    gate: { x: 6, y: 4 },
    key: { x: 4, y: 2 },
    cats: [
      { id: "sesame", name: "芝麻", personality: "sleepy", coat: "charcoal", x: 2, y: 2 },
      { id: "cream", name: "奶盖", personality: "shy", coat: "cream", x: 4, y: 6 },
      { id: "orange", name: "橘子", personality: "curious", coat: "ginger", x: 8, y: 6 },
      { id: "patch", name: "花卷", personality: "shy", coat: "calico", x: 8, y: 2 },
    ],
    par: 34,
    budget: 66,
  },
];

export const PERSONALITIES: Record<CatPersonality, { label: string; description: string; radius: number }> = {
  curious: { label: "亲人", description: "靠近到 3 格路程内，呼唤一次。", radius: 3 },
  shy: { label: "胆小", description: "靠近到 2 格路程内，再轻轻呼唤。", radius: 2 },
  sleepy: { label: "贪睡", description: "3 格路程内叫两次：先叫醒，再出发。", radius: 3 },
};

export const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const keyOf = (point: Point) => `${point.x},${point.y}`;
const cardinal = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];

export function levelFor(id: string): GardenLevel {
  return GARDEN_LEVELS.find((level) => level.id === id) ?? GARDEN_LEVELS[0];
}

export function isWalkable(level: GardenLevel, point: Point, keyCollected = false): boolean {
  if (!Number.isInteger(point.x) || !Number.isInteger(point.y)) return false;
  if (point.x <= 0 || point.y <= 0 || point.x >= level.width - 1 || point.y >= level.height - 1) return false;
  if (level.hedges.some((hedge) => samePoint(hedge, point)) || level.water.some((water) => samePoint(water, point))) return false;
  return !(level.gate && samePoint(level.gate, point) && !keyCollected);
}

/** Breadth-first search uses the same collision rules as the player and cats. */
export function findPath(level: GardenLevel, from: Point, to: Point, keyCollected = false): Point[] {
  if (!isWalkable(level, from, keyCollected) || !isWalkable(level, to, keyCollected)) return [];
  const queue: Point[] = [{ ...from }];
  const previous = new Map<string, Point | null>([[keyOf(from), null]]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (samePoint(current, to)) {
      const path: Point[] = [];
      let cursor: Point | null = current;
      while (cursor) {
        path.unshift(cursor);
        cursor = previous.get(keyOf(cursor)) ?? null;
      }
      return path;
    }
    for (const direction of cardinal) {
      const next = { x: current.x + direction.x, y: current.y + direction.y };
      if (!isWalkable(level, next, keyCollected) || previous.has(keyOf(next))) continue;
      previous.set(keyOf(next), current);
      queue.push(next);
    }
  }
  return [];
}

export function createGarden(levelId = GARDEN_LEVELS[0].id, mode: GameMode = "cozy"): GardenState {
  const level = levelFor(levelId);
  return {
    levelId: level.id,
    mode,
    status: "playing",
    player: { ...level.start },
    cats: level.cats.map((cat) => ({ id: cat.id, x: cat.x, y: cat.y, status: "waiting", awake: cat.personality !== "sleepy" })),
    keyCollected: false,
    moves: 0,
    elapsed: 0,
    feedback: level.hint,
    feedbackKind: "info",
  };
}

function finishIfNeeded(state: GardenState): GardenState {
  if (state.cats.every((cat) => cat.status === "home")) {
    return { ...state, status: "won", feedback: "大家都到家了。可以开饭啦！", feedbackKind: "win" };
  }
  // A last-budget move onto the porch still allows the queue to finish entering.
  const allOnTheWayHome = state.cats.every((cat) => cat.status === "home" || cat.status === "homebound");
  if (state.mode === "challenge" && state.moves >= levelFor(state.levelId).budget && !allOnTheWayHome) {
    return { ...state, status: "lost", feedback: "这次的步数用完了。记住路线，再试一次吧。", feedbackKind: "lose" };
  }
  return state;
}

export function advanceGarden(state: GardenState, action: GardenAction): GardenState {
  if (state.status !== "playing") return state;
  const level = levelFor(state.levelId);
  if (state.mode === "challenge" && state.moves >= level.budget && (action.type === "move" || action.type === "call")) return state;
  if (action.type === "time") {
    if (!Number.isFinite(action.seconds) || action.seconds <= 0) return state;
    return { ...state, elapsed: state.elapsed + Math.min(action.seconds, 5) };
  }
  if (action.type === "move") {
    if (Math.abs(action.dx) + Math.abs(action.dy) !== 1) return state;
    const player = { x: state.player.x + action.dx, y: state.player.y + action.dy };
    if (!isWalkable(level, player, state.keyCollected)) {
      const atGate = level.gate && samePoint(level.gate, player) && !state.keyCollected;
      return { ...state, feedback: atGate ? "木门还关着。先去左边捡金色钥匙。" : "这里走不过去，换一条小径吧。", feedbackKind: "blocked" };
    }
    const pickedKey = Boolean(level.key && !state.keyCollected && samePoint(player, level.key));
    const atHome = samePoint(player, level.home);
    const cats = state.cats.map((cat) => atHome && cat.status === "following" ? { ...cat, status: "homebound" as const } : cat);
    const missing = cats.filter((cat) => cat.status === "waiting").length;
    return finishIfNeeded({
      ...state,
      player,
      cats,
      keyCollected: state.keyCollected || pickedKey,
      moves: state.moves + 1,
      feedback: pickedKey ? "捡到钥匙了，中央的花园门已经打开。" : atHome ? missing ? `跟来的猫咪会自己进屋，还有 ${missing} 只朋友等着你。` : "到门廊了，等猫咪们排队进屋吧。" : state.feedback,
      feedbackKind: pickedKey ? "gate" : "move",
    });
  }
  if (action.type === "call") {
    const joined: string[] = [];
    const woken: string[] = [];
    const cats = state.cats.map((cat) => {
      if (cat.status !== "waiting") return cat;
      const definition = level.cats.find((item) => item.id === cat.id)!;
      const path = findPath(level, state.player, cat, state.keyCollected);
      if (!path.length || path.length - 1 > PERSONALITIES[definition.personality].radius) return cat;
      if (!cat.awake) {
        woken.push(definition.name);
        return { ...cat, awake: true };
      }
      joined.push(definition.name);
      return { ...cat, status: samePoint(state.player, level.home) ? "homebound" as const : "following" as const };
    });
    const feedback = [joined.length ? `${joined.join("、")}跟上来了。` : "", woken.length ? `${woken.join("、")}醒了，再叫一次就出发。` : ""].filter(Boolean).join(" ");
    return finishIfNeeded({
      ...state,
      cats,
      moves: state.moves + 1,
      feedback: feedback || (cats.some((cat) => cat.status === "following") ? "已经跟上的猫咪不会走丢。带它们去右上角的小屋吧。" : "附近没有回应。靠近还在等待的猫咪，再叫一声。"),
      feedbackKind: woken.length ? "wake" : "call",
    });
  }
  let changed = false;
  const arrivals: string[] = [];
  const cats = state.cats.map((cat) => {
    if (cat.status === "waiting" || cat.status === "home") return cat;
    const destination = cat.status === "homebound" ? level.home : state.player;
    const path = findPath(level, cat, destination, state.keyCollected);
    if (cat.status === "homebound" && samePoint(cat, level.home)) {
      changed = true;
      arrivals.push(level.cats.find((item) => item.id === cat.id)!.name);
      return { ...cat, status: "home" as const };
    }
    if (path.length <= (cat.status === "following" ? 2 : 1)) return cat;
    const next = path[1];
    const home = cat.status === "homebound" && samePoint(next, level.home);
    changed = true;
    if (home) arrivals.push(level.cats.find((item) => item.id === cat.id)!.name);
    return { ...cat, ...next, status: home ? "home" as const : cat.status };
  });
  if (!changed) return state;
  return finishIfNeeded({ ...state, cats, feedback: arrivals.length ? `${arrivals.join("、")}到家了！` : state.feedback, feedbackKind: arrivals.length ? "home" : state.feedbackKind });
}

const starsAt = (level: GardenLevel, moves: number) => moves <= level.par ? 3 : moves <= level.par + 14 ? 2 : 1;

export function starsFor(state: GardenState): number {
  return state.status === "won" ? starsAt(levelFor(state.levelId), state.moves) : 0;
}

export interface GardenRecord {
  moves: number;
  elapsed: number;
  stars: number;
  completedAt: string;
}

export interface GardenProgress {
  version: 1;
  unlocked: number;
  sound: boolean;
  mode: GameMode;
  records: Record<string, GardenRecord>;
  session: GardenState | null;
}

export const GARDEN_STORAGE_KEY = "leo-cat-courtyard-v1";
export const freshProgress = (): GardenProgress => ({ version: 1, unlocked: 1, sound: false, mode: "cozy", records: {}, session: null });

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const whole = (value: unknown, max = 1_000_000): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max;
const isCompletionDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === (value.length === 20 ? value.slice(0, -1) + ".000Z" : value);
};

function restoreState(value: unknown): GardenState | null {
  if (!isObject(value) || typeof value.levelId !== "string" || !GARDEN_LEVELS.some((level) => level.id === value.levelId)) return null;
  const level = levelFor(value.levelId);
  if (value.mode !== "cozy" && value.mode !== "challenge") return null;
  if (value.status !== "playing" && value.status !== "won" && value.status !== "lost") return null;
  if (typeof value.keyCollected !== "boolean" || !whole(value.moves) || typeof value.elapsed !== "number" || !Number.isFinite(value.elapsed) || value.elapsed < 0 || value.elapsed > 10_000_000) return null;
  const keyCollected = value.keyCollected;
  if (keyCollected && !level.key) return null;
  if (!isObject(value.player) || !whole(value.player.x, 50) || !whole(value.player.y, 50)) return null;
  const player = { x: value.player.x, y: value.player.y };
  if (!isWalkable(level, player, keyCollected) || !findPath(level, level.start, player, keyCollected).length) return null;
  if (level.key && samePoint(player, level.key) && !keyCollected) return null;
  if (!Array.isArray(value.cats) || value.cats.length !== level.cats.length) return null;
  const cats: CatState[] = [];
  for (const candidate of value.cats) {
    if (!isObject(candidate) || typeof candidate.id !== "string" || !level.cats.some((cat) => cat.id === candidate.id) || cats.some((cat) => cat.id === candidate.id)) return null;
    if (!whole(candidate.x, 50) || !whole(candidate.y, 50) || typeof candidate.awake !== "boolean") return null;
    if (candidate.status !== "waiting" && candidate.status !== "following" && candidate.status !== "homebound" && candidate.status !== "home") return null;
    const point = { x: candidate.x, y: candidate.y };
    if (!isWalkable(level, point, keyCollected) || (candidate.status === "home" && !samePoint(point, level.home))) return null;
    const definition = level.cats.find((cat) => cat.id === candidate.id)!;
    if (!candidate.awake && (candidate.status !== "waiting" || definition.personality !== "sleepy")) return null;
    if (candidate.status === "waiting" && !samePoint(point, definition)) return null;
    if (candidate.status === "following" && !findPath(level, point, player, keyCollected).length) return null;
    if ((candidate.status === "homebound" || candidate.status === "home") && !findPath(level, point, level.home, keyCollected).length) return null;
    cats.push({ ...point, id: candidate.id, status: candidate.status, awake: candidate.awake });
  }
  // These are conservative lower bounds, not an anti-cheat solver: a save cannot
  // spend fewer moves than the mandatory key / porch visits and required calls.
  let previous = level.start;
  let keyAvailable = false;
  let minimumMoves = 0;
  const visits: Point[] = [];
  if (keyCollected && level.key) visits.push(level.key);
  if (cats.some((cat) => cat.status === "homebound" || cat.status === "home")) visits.push(level.home);
  visits.push(player);
  for (const point of visits) {
    const path = findPath(level, previous, point, keyAvailable);
    if (!path.length) return null;
    minimumMoves += path.length - 1;
    previous = point;
    if (level.key && samePoint(point, level.key)) keyAvailable = true;
  }
  const minimumCalls = Math.max(0, ...cats.map((cat) => {
    const sleepy = level.cats.find((definition) => definition.id === cat.id)!.personality === "sleepy";
    if (!sleepy) return cat.status === "waiting" ? 0 : 1;
    return cat.status !== "waiting" ? 2 : cat.awake ? 1 : 0;
  }));
  if (value.moves < minimumMoves + minimumCalls) return null;
  const allHome = cats.every((cat) => cat.status === "home");
  const allReturning = cats.every((cat) => cat.status === "home" || cat.status === "homebound");
  if ((value.status === "won") !== allHome) return null;
  if (value.status === "lost" && (value.mode !== "challenge" || value.moves !== level.budget || allReturning)) return null;
  if (value.mode === "challenge" && (value.moves > level.budget || (value.status === "playing" && value.moves === level.budget && !allReturning))) return null;
  const wonFeedback = level.number === GARDEN_LEVELS.length ? "三座庭院的猫咪已经全部到家，可以重玩或查看庭院纪录。" : "这座庭院的猫咪已经全部到家，可以重玩或继续逛下一座庭院。";
  const feedback = value.status === "won" ? wonFeedback : value.status === "lost" ? "上次挑战的步数已用完。可以重新挑战，或改为慢慢逛继续。" : "小庭院已经保存好了，继续带猫咪回家吧。";
  return { levelId: level.id, mode: value.mode, status: value.status, player, cats, keyCollected, moves: value.moves, elapsed: value.elapsed, feedback, feedbackKind: value.status === "won" ? "win" : value.status === "lost" ? "lose" : "info" };
}

export function restoreProgress(raw: string | null): GardenProgress {
  if (!raw) return freshProgress();
  try {
    const value: unknown = JSON.parse(raw);
    if (!isObject(value) || value.version !== 1) return freshProgress();
    const progress = freshProgress();
    progress.unlocked = whole(value.unlocked, GARDEN_LEVELS.length) ? Math.max(1, value.unlocked) : 1;
    progress.sound = value.sound === true;
    progress.mode = value.mode === "challenge" ? "challenge" : "cozy";
    progress.session = restoreState(value.session);
    if (progress.session && levelFor(progress.session.levelId).number > progress.unlocked) progress.session = null;
    if (isObject(value.records)) {
      for (const level of GARDEN_LEVELS) {
        for (const mode of ["cozy", "challenge"]) {
          const recordKey = `${level.id}:${mode}`;
          const record = value.records[recordKey];
          if (!isObject(record) || !whole(record.moves) || record.moves < 1 || (mode === "challenge" && record.moves > level.budget) || typeof record.elapsed !== "number" || !Number.isFinite(record.elapsed) || record.elapsed < 0 || record.elapsed > 10_000_000 || !whole(record.stars, 3) || record.stars !== starsAt(level, record.moves) || !isCompletionDate(record.completedAt)) continue;
          progress.records[recordKey] = { moves: record.moves, elapsed: record.elapsed, stars: record.stars, completedAt: record.completedAt };
        }
      }
    }
    return progress;
  } catch {
    return freshProgress();
  }
}

export function recordCompletion(progress: GardenProgress, state: GardenState, completedAt: string): GardenProgress {
  if (state.status !== "won") return progress;
  const recordKey = `${state.levelId}:${state.mode}`;
  const old = progress.records[recordKey];
  const next = { moves: state.moves, elapsed: state.elapsed, stars: starsFor(state), completedAt };
  const improved = !old || next.moves < old.moves || (next.moves === old.moves && next.elapsed < old.elapsed);
  const unlocked = Math.max(progress.unlocked, Math.min(GARDEN_LEVELS.length, levelFor(state.levelId).number + 1));
  if (!improved && unlocked === progress.unlocked && progress.session === state) return progress;
  return {
    ...progress,
    unlocked,
    session: state,
    records: improved ? { ...progress.records, [recordKey]: next } : progress.records,
  };
}
