import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronRight,
  CircleHelp,
  Flag,
  Home,
  KeyRound,
  LockKeyhole,
  Map,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
} from "lucide-react";
import GardenBoard, { PixelCat } from "./GardenBoard";
import {
  GARDEN_LEVELS,
  GARDEN_STORAGE_KEY,
  PERSONALITIES,
  GardenAction,
  GardenProgress,
  GardenState,
  GameMode,
  Point,
  advanceGarden,
  createGarden,
  findPath,
  freshProgress,
  levelFor,
  recordCompletion,
  restoreProgress,
  samePoint,
  starsFor,
} from "./engine";

type Screen = "welcome" | "playing" | "paused" | "levels" | "help";
const PATH_STEP_MS = 165;
const isCompositionKey = (event: KeyboardEvent) =>
  event.isComposing || event.keyCode === 229;

function isForeignSave(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const value: unknown = JSON.parse(raw);
    return Boolean(
      value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        "version" in value &&
        value.version !== 1,
    );
  } catch {
    return false;
  }
}

function initialSave() {
  try {
    const raw = window.localStorage.getItem(GARDEN_STORAGE_KEY);
    const progress = restoreProgress(raw);
    let protectedSave = false;
    let recovered = false;
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed === "object" &&
          !Array.isArray(parsed) &&
          "version" in parsed
        ) {
          protectedSave = parsed.version !== 1;
          recovered =
            !protectedSave &&
            "session" in parsed &&
            Boolean(parsed.session) &&
            !progress.session;
        } else recovered = true;
      } catch {
        recovered = true;
      }
    }
    return { progress, available: true, protectedSave, recovered };
  } catch {
    return {
      progress: freshProgress(),
      available: false,
      protectedSave: false,
      recovered: false,
    };
  }
}

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

function routeDestination(state: GardenState, point: Point) {
  const level = levelFor(state.levelId);
  const cat = state.cats.find(
    (item) => item.status === "waiting" && samePoint(item, point),
  );
  if (cat) {
    const definition = level.cats.find((item) => item.id === cat.id)!;
    return {
      label: `${definition.name}身边`,
      arrival: `已经到${definition.name}身边。${cat.awake ? "按下“回家啦”，叫它一起回家。" : "它还在打盹，呼唤两次就会跟上。"}`,
    };
  }
  if (samePoint(point, level.home))
    return { label: "门廊", arrival: "你已经在门廊，跟来的猫咪会自己进屋。" };
  if (level.key && !state.keyCollected && samePoint(point, level.key))
    return { label: "金色钥匙", arrival: "捡到钥匙了，中央的花园门已经打开。" };
  return {
    label: "选中的小径",
    arrival: "已经走到选中的小径。可以继续散步，或呼唤附近的猫咪。",
  };
}

function Stars({ count, size = 16 }: { count: number; size?: number }) {
  return (
    <span className="cat-rating" aria-label={`${count} 颗星`}>
      {[1, 2, 3].map((star) => (
        <Star
          key={star}
          size={size}
          className={star <= count ? "is-earned" : ""}
          fill={star <= count ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

export default function CatCourtyard({ active }: { active: boolean }) {
  const [initial] = useState(initialSave);
  const [progress, setProgress] = useState<GardenProgress>(initial.progress);
  const [game, setGame] = useState<GardenState>(
    () => initial.progress.session ?? createGarden(),
  );
  const [hasStarted, setHasStarted] = useState(
    Boolean(initial.progress.session),
  );
  const [screen, setScreen] = useState<Screen>(() =>
    initial.progress.session && initial.progress.session.status !== "playing"
      ? "playing"
      : "welcome",
  );
  const [route, setRoute] = useState<Point[]>([]);
  const [callPulse, setCallPulse] = useState(0);
  const [storageAvailable, setStorageAvailable] = useState(initial.available);
  const [protectedSave, setProtectedSave] = useState(initial.protectedSave);
  const [pauseReason, setPauseReason] = useState("猫咪会在这里等你。");
  const [selectedLevel, setSelectedLevel] = useState(
    initial.progress.session?.levelId ?? GARDEN_LEVELS[0].id,
  );
  const [selectedMode, setSelectedMode] = useState<GameMode>(
    initial.progress.mode,
  );
  const boardRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousScreen = useRef<Screen>("welcome");
  const audioRef = useRef<AudioContext | null>(null);
  const lastSaved = useRef<string | null>(null);
  const saveProtection = useRef(initial.protectedSave);
  const heldMove = useRef<{ key: string; time: number } | null>(null);
  const resultSummaryId = useId();
  const boardSummaryId = useId();
  const latest = useRef({ progress, game, hasStarted });
  latest.current = { progress, game, hasStarted };

  const level = levelFor(game.levelId);
  const running = active && screen === "playing" && game.status === "playing";
  const canAct =
    running && !(game.mode === "challenge" && game.moves >= level.budget);
  const overlayVisible = screen !== "playing" || game.status !== "playing";
  const savedCats = game.cats.filter((cat) => cat.status === "home").length;
  const followingCats = game.cats.filter(
    (cat) => cat.status === "following" || cat.status === "homebound",
  ).length;
  const selected = levelFor(selectedLevel);
  const best = progress.records[`${game.levelId}:${game.mode}`];
  const feedbackText =
    running && route.length
      ? `正在走向${routeDestination(game, route[route.length - 1]).label}。按方向键可改走其他小径。`
      : game.feedback;

  useEffect(() => {
    heldMove.current = null;
  }, [running, game.levelId]);

  const saveNow = useCallback((report = true) => {
    const current = latest.current;
    const saved = {
      ...current.progress,
      session: current.hasStarted ? current.game : current.progress.session,
    };
    const serialized = JSON.stringify(saved);
    try {
      // A newer version may have written the shared key in another tab since mount.
      if (
        saveProtection.current ||
        isForeignSave(window.localStorage.getItem(GARDEN_STORAGE_KEY))
      ) {
        saveProtection.current = true;
        if (report) setProtectedSave(true);
        return;
      }
      if (lastSaved.current === serialized) return;
      window.localStorage.setItem(GARDEN_STORAGE_KEY, serialized);
      lastSaved.current = serialized;
      if (report) setStorageAvailable(true);
    } catch {
      if (report) setStorageAvailable(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => saveNow(), 450);
    return () => window.clearTimeout(timer);
  }, [game, progress, hasStarted, saveNow]);

  useEffect(() => {
    const onPageHide = () => saveNow(false);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      saveNow(false);
      audioRef.current?.close().catch(() => undefined);
    };
  }, [saveNow]);

  const pause = useCallback(
    (reason = "猫咪会在这里等你。") => {
      if (latest.current.game.status !== "playing") return;
      setRoute([]);
      setPauseReason(reason);
      setScreen((current) => (current === "playing" ? "paused" : current));
      saveNow();
    },
    [saveNow],
  );

  useEffect(() => {
    if (!active) pause("你离开了庭院，已经帮你暂停。");
  }, [active, pause]);

  useEffect(() => {
    if (!running || !progress.sound)
      audioRef.current?.suspend().catch(() => undefined);
  }, [running, progress.sound]);

  useEffect(() => {
    if (!running) return;
    const onBlur = () => pause("窗口暂时失去焦点，回来后继续就好。");
    const onVisibility = () => {
      if (document.hidden) pause("庭院已在后台暂停。");
    };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [running, pause]);

  useEffect(() => {
    if (!running) return;
    const cats = window.setInterval(
      () => setGame((current) => advanceGarden(current, { type: "tick" })),
      280,
    );
    const clock = window.setInterval(
      () =>
        setGame((current) =>
          advanceGarden(current, { type: "time", seconds: 1 }),
        ),
      1000,
    );
    const checkpoint = window.setInterval(() => saveNow(), 3000);
    return () => {
      window.clearInterval(cats);
      window.clearInterval(clock);
      window.clearInterval(checkpoint);
    };
  }, [running, game.levelId, saveNow]);

  useEffect(() => {
    if (!running || !route.length) return;
    const timer = window.setTimeout(() => {
      const next = route[0];
      setGame((current) => {
        const moved = advanceGarden(current, {
          type: "move",
          dx: next.x - current.player.x,
          dy: next.y - current.player.y,
        });
        if (
          route.length !== 1 ||
          moved.status !== "playing" ||
          !samePoint(moved.player, next) ||
          moved.keyCollected !== current.keyCollected ||
          samePoint(next, levelFor(moved.levelId).home)
        )
          return moved;
        return {
          ...moved,
          feedback: routeDestination(moved, next).arrival,
          feedbackKind: "info",
        };
      });
      setRoute((current) => current.slice(1));
    }, PATH_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [running, route]);

  useEffect(() => {
    if (game.status === "won")
      setProgress((current) =>
        recordCompletion(current, game, new Date().toISOString()),
      );
    if (game.status !== "playing") setRoute([]);
  }, [game]);

  useEffect(() => {
    if (!active) return;
    // Menus and the board have different heights. Keep a new screen visible
    // instead of inheriting the scroll offset of a button near the old bottom.
    const scrollport = boardRef.current?.closest<HTMLElement>(".herding-cats");
    if (scrollport) scrollport.scrollTop = 0;
    if (overlayVisible) overlayRef.current?.focus({ preventScroll: true });
    else boardRef.current?.focus({ preventScroll: true });
  }, [screen, game.status, active, overlayVisible]);

  const chirp = useCallback((kind: "call" | "start" = "call") => {
    if (!latest.current.progress.sound) return;
    try {
      if (!audioRef.current || audioRef.current.state === "closed")
        audioRef.current = new AudioContext();
      const audio = audioRef.current;
      if (audio.state === "suspended")
        void audio.resume().catch(() => undefined);
      const now = audio.currentTime;
      [kind === "start" ? 392 : 587, kind === "start" ? 523 : 784].forEach(
        (frequency, index) => {
          const oscillator = audio.createOscillator();
          const gain = audio.createGain();
          const time = now + index * 0.09;
          oscillator.type = "triangle";
          oscillator.frequency.setValueAtTime(frequency, time);
          oscillator.frequency.exponentialRampToValueAtTime(
            frequency * 0.9,
            time + 0.12,
          );
          gain.gain.setValueAtTime(0, time);
          gain.gain.linearRampToValueAtTime(0.055, time + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.17);
          oscillator.connect(gain);
          gain.connect(audio.destination);
          oscillator.start(time);
          oscillator.stop(time + 0.18);
          oscillator.onended = () => {
            oscillator.disconnect();
            gain.disconnect();
          };
        },
      );
    } catch {
      // Audio is optional; the visual and text feedback still conveys every action.
    }
  }, []);

  const focusBoard = () => boardRef.current?.focus({ preventScroll: true });
  const act = (action: GardenAction) => {
    if (!canAct) return;
    setRoute([]);
    setGame((current) => advanceGarden(current, action));
    if (action.type === "call") {
      setCallPulse((value) => value + 1);
      chirp();
    }
    focusBoard();
  };

  const navigate = (point: Point) => {
    if (!canAct) return;
    const path = findPath(level, game.player, point, game.keyCollected);
    if (!path.length) {
      setRoute([]);
      setGame((current) => ({
        ...current,
        feedback:
          level.gate && !current.keyCollected && point.x > level.gate.x
            ? "先拿到左侧的钥匙，就能穿过花园门。"
            : "那里暂时走不到，试试旁边的小径。",
        feedbackKind: "blocked",
      }));
    } else {
      setRoute(path.slice(1));
      if (path.length === 1)
        setGame((current) => ({
          ...current,
          feedback: routeDestination(current, point).arrival,
          feedbackKind: "info",
        }));
    }
    focusBoard();
  };

  const startLevel = (id: string, mode = selectedMode) => {
    setSelectedLevel(id);
    setSelectedMode(mode);
    setProgress((current) => ({ ...current, mode }));
    setGame(createGarden(id, mode));
    setRoute([]);
    setCallPulse(0);
    setHasStarted(true);
    setScreen("playing");
    chirp("start");
  };

  const openHelp = () => {
    if (screen === "help") {
      overlayRef.current?.focus({ preventScroll: true });
      return;
    }
    previousScreen.current =
      screen === "playing" && game.status === "playing" ? "paused" : screen;
    if (screen === "playing" && game.status === "playing")
      setPauseReason("玩法看完了，再继续散步吧。");
    setRoute([]);
    setScreen("help");
  };

  const openLevels = () => {
    setRoute([]);
    setScreen("levels");
    setSelectedLevel(game.levelId);
  };
  const resume = () => {
    if (active) {
      setRoute([]);
      setScreen("playing");
    }
  };

  return (
    <div
      className="cat-courtyard"
      data-active={active}
      data-running={running}
      onKeyDown={(event) => {
        if (
          !active ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          isCompositionKey(event.nativeEvent)
        )
          return;
        const escape = event.key === "Escape";
        if (!escape && event.key.toLowerCase() !== "p") return;
        if (event.repeat) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (escape && screen === "help") setScreen(previousScreen.current);
        else if (escape && screen === "levels")
          setScreen(
            hasStarted
              ? game.status === "playing"
                ? "paused"
                : "playing"
              : "welcome",
          );
        else if (screen === "paused") resume();
        else if (screen === "playing" && game.status === "playing") pause();
        else return;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <header className="cat-courtyard-heading">
        <div>
          <span className="cat-eyebrow">A LITTLE GARDEN, A FEW FRIENDS</span>
          <h2>
            牧猫庭院 <span>Cat courtyard</span>
          </h2>
          <p>散一会儿步，带猫咪回家。</p>
        </div>
        <div className="cat-heading-actions">
          <button
            type="button"
            className="cat-icon-button"
            onClick={() =>
              setProgress((current) => ({ ...current, sound: !current.sound }))
            }
            aria-label={progress.sound ? "关闭游戏音效" : "开启游戏音效"}
            aria-pressed={progress.sound}
            title={progress.sound ? "关闭音效" : "开启音效"}
          >
            {progress.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            type="button"
            className="cat-icon-button"
            onClick={openHelp}
            aria-label="查看游戏玩法"
            title="怎么玩"
          >
            <CircleHelp size={18} />
          </button>
        </div>
      </header>

      {(protectedSave || initial.recovered) && (
        <p className="cat-storage-note" role="status">
          {protectedSave
            ? "这份存档来自其他版本，本次不会覆盖它。可以临时游玩；旧进度请在原来的版本继续。"
            : "上次的庭院进度没有读回来，已打开新庭院。能够读取的通关纪录会保留。"}
        </p>
      )}

      <div className="cat-game-layout">
        <div className="cat-play-column">
          <div className="cat-game-scorebar" aria-label="当前游戏状态">
            <div className="cat-current-level">
              <span className="cat-level-index">
                {String(level.number).padStart(2, "0")}
              </span>
              <div>
                <strong>{level.title}</strong>
                <span>{game.mode === "cozy" ? "慢慢逛" : "步数挑战"}</span>
              </div>
            </div>
            <div className="cat-stat">
              <span>已回家</span>
              <strong>
                {savedCats}
                <small> / {game.cats.length}</small>
              </strong>
            </div>
            <div className="cat-stat">
              <span>{game.mode === "challenge" ? "剩余步数" : "走过"}</span>
              <strong>
                {game.mode === "challenge"
                  ? Math.max(0, level.budget - game.moves)
                  : game.moves}
                <small> 步</small>
              </strong>
            </div>
            <div className="cat-stat cat-time-stat">
              <span>用时</span>
              <strong>{formatTime(game.elapsed)}</strong>
            </div>
          </div>

          <div
            className={`cat-garden-stage ${overlayVisible ? "has-overlay" : ""}`}
            ref={boardRef}
            tabIndex={running ? 0 : -1}
            role="group"
            aria-label="庭院操作区。方向键或 WASD 移动，空格呼唤，P 或 Escape 暂停。"
            aria-describedby={boardSummaryId}
            data-testid="cat-garden-stage"
            data-player={`${game.player.x},${game.player.y}`}
            onBlur={() => {
              heldMove.current = null;
            }}
            onKeyUp={(event) => {
              if (heldMove.current?.key === event.key) heldMove.current = null;
            }}
            onKeyDown={(event) => {
              if (isCompositionKey(event.nativeEvent)) {
                heldMove.current = null;
                return;
              }
              if (!running || event.altKey || event.ctrlKey || event.metaKey)
                return;
              const moves: Record<string, [number, number]> = {
                ArrowUp: [0, -1],
                w: [0, -1],
                W: [0, -1],
                ArrowDown: [0, 1],
                s: [0, 1],
                S: [0, 1],
                ArrowLeft: [-1, 0],
                a: [-1, 0],
                A: [-1, 0],
                ArrowRight: [1, 0],
                d: [1, 0],
                D: [1, 0],
              };
              const move = moves[event.key];
              if (move) {
                event.preventDefault();
                event.stopPropagation();
                const now = performance.now();
                // OS repeat rates vary dramatically. A held direction follows
                // the same walking cadence as a planned route; fresh presses
                // remain immediate. A stale hold after resume cannot restart.
                if (
                  event.repeat &&
                  (heldMove.current?.key !== event.key ||
                    now - heldMove.current.time < PATH_STEP_MS)
                )
                  return;
                heldMove.current = { key: event.key, time: now };
                act({ type: "move", dx: move[0], dy: move[1] });
              } else if (event.code === "Space") {
                event.preventDefault();
                event.stopPropagation();
                if (!event.repeat) act({ type: "call" });
              } else if (
                event.key === "Escape" ||
                event.key.toLowerCase() === "p"
              ) {
                event.preventDefault();
                event.stopPropagation();
                if (!event.repeat) pause();
              }
            }}
          >
            <GardenBoard
              state={game}
              route={route}
              callPulse={callPulse}
              interactive={canAct}
              onTile={navigate}
            />
            <p id={boardSummaryId} className="sr-only">
              {level.title}，你在第 {game.player.x} 列、第 {game.player.y} 行。
              {savedCats} / {game.cats.length} 只猫已回家，{followingCats}{" "}
              只正在跟随或回家。
              {game.mode === "challenge"
                ? `还剩 ${Math.max(0, level.budget - game.moves)} 步。`
                : `已走 ${game.moves} 步。`}
            </p>
            {overlayVisible && (
              <div className={`cat-scene-overlay cat-overlay-${screen}`}>
                <div
                  ref={overlayRef}
                  tabIndex={-1}
                  className="cat-overlay-content"
                  role="region"
                  aria-label={
                    screen === "help"
                      ? "玩法说明"
                      : screen === "levels"
                        ? "选择庭院"
                        : game.status === "won"
                          ? "关卡完成"
                          : game.status === "lost"
                            ? "挑战结束"
                            : "庭院菜单"
                  }
                  aria-describedby={
                    screen === "playing" && game.status !== "playing"
                      ? resultSummaryId
                      : undefined
                  }
                >
                  {screen === "welcome" && (
                    <>
                      <div className="cat-welcome-story">
                        <div className="cat-welcome-friends">
                          <PixelCat coat="ginger" size={46} />
                          <PixelCat coat="cream" size={46} />
                          <PixelCat coat="charcoal" size={46} />
                        </div>
                        <span className="cat-eyebrow">
                          原创小游戏 · 三座小庭院
                        </span>
                        <h3>
                          叫上猫咪，
                          <br />
                          一起回家。
                        </h3>
                        <p>
                          点一条小路，走到它们身边。
                          <br />
                          按下呼唤，收获一支小小的队伍。
                        </p>
                      </div>
                      <div className="cat-welcome-actions">
                        <div className="cat-mode-switch" aria-label="游戏模式">
                          <button
                            type="button"
                            className={
                              selectedMode === "cozy" ? "is-selected" : ""
                            }
                            aria-pressed={selectedMode === "cozy"}
                            onClick={() => setSelectedMode("cozy")}
                          >
                            慢慢逛
                          </button>
                          <button
                            type="button"
                            className={
                              selectedMode === "challenge" ? "is-selected" : ""
                            }
                            aria-pressed={selectedMode === "challenge"}
                            onClick={() => setSelectedMode("challenge")}
                          >
                            步数挑战
                          </button>
                        </div>
                        <small className="cat-mode-description">
                          {selectedMode === "cozy"
                            ? "没有时间限制，按自己的节奏来。"
                            : "每次移动或呼唤消耗一步，试试更短的路线。"}
                        </small>
                        <button
                          type="button"
                          className="cat-button is-primary"
                          onClick={() => startLevel(GARDEN_LEVELS[0].id)}
                        >
                          <Play size={16} fill="currentColor" />
                          开始新一局
                        </button>
                        {hasStarted && game.status === "playing" && (
                          <button
                            type="button"
                            className="cat-button is-light"
                            onClick={resume}
                          >
                            继续上次 · {level.title}
                            <ChevronRight size={16} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="cat-text-button"
                          onClick={openLevels}
                        >
                          选择庭院与查看纪录
                        </button>
                      </div>
                    </>
                  )}

                  {screen === "paused" && (
                    <>
                      <PixelCat coat="cream" size={64} sleeping />
                      <span className="cat-eyebrow">TAKE YOUR TIME</span>
                      <h3>休息一下。</h3>
                      <p>
                        {pauseReason}
                        <br />
                        步数、用时和猫咪都停在原地。
                      </p>
                      <button
                        type="button"
                        className="cat-button is-primary"
                        onClick={resume}
                        disabled={!active}
                      >
                        <Play size={16} fill="currentColor" />
                        继续散步
                      </button>
                      <div className="cat-overlay-button-row">
                        <button
                          type="button"
                          className="cat-button is-light"
                          onClick={() => startLevel(game.levelId, game.mode)}
                        >
                          <RotateCcw size={15} />
                          重新开始
                        </button>
                        <button
                          type="button"
                          className="cat-button is-light"
                          onClick={openLevels}
                        >
                          <Map size={15} />
                          选择庭院
                        </button>
                      </div>
                      <span className="cat-save-note">
                        {protectedSave
                          ? "正在保护其他版本的存档，本次为临时游玩。"
                          : storageAvailable
                            ? "进度只保存在这台设备的浏览器里。"
                            : "当前浏览器无法保存，请保持页面打开。"}{" "}
                        P / Esc 也可继续。
                      </span>
                    </>
                  )}

                  {screen === "help" && (
                    <>
                      <span className="cat-eyebrow">HOW TO PLAY</span>
                      <h3>慢慢来，猫会跟上。</h3>
                      <ol className="cat-howto-list">
                        <li>
                          <span>1</span>
                          <div>
                            <strong>走近一点</strong>
                            <p>
                              点庭院里的小路自动行走，或用方向键 /
                              WASD。蓝帽子的小人就是你。
                            </p>
                          </div>
                        </li>
                        <li>
                          <span>2</span>
                          <div>
                            <strong>叫一声「回家啦」</strong>
                            <p>
                              按空格或呼唤按钮。亲人的猫在 3
                              格路程内回应，胆小猫要 2 格，贪睡猫要叫两次。
                            </p>
                          </div>
                        </li>
                        <li>
                          <span>3</span>
                          <div>
                            <strong>一起回门廊</strong>
                            <p>
                              带上猫咪走到右上角小屋，它们会自行排队进屋。漏掉的朋友可以再去接。
                            </p>
                          </div>
                        </li>
                      </ol>
                      <p className="cat-howto-note">
                        路线会绕开池塘、树篱和关闭的门。第三关先捡钥匙。P / Esc
                        暂停，离开窗口也会自动暂停。
                      </p>
                      <button
                        type="button"
                        className="cat-button is-primary"
                        onClick={() => setScreen(previousScreen.current)}
                      >
                        知道了
                      </button>
                    </>
                  )}

                  {screen === "levels" && (
                    <>
                      <span className="cat-eyebrow">THREE LITTLE WALKS</span>
                      <h3>今天逛哪座庭院？</h3>
                      <div className="cat-level-list">
                        {GARDEN_LEVELS.map((item) => {
                          const unlocked = item.number <= progress.unlocked;
                          const record =
                            progress.records[`${item.id}:${selectedMode}`];
                          return (
                            <button
                              type="button"
                              key={item.id}
                              className={`cat-level-choice ${selectedLevel === item.id ? "is-selected" : ""}`}
                              disabled={!unlocked}
                              onClick={() => setSelectedLevel(item.id)}
                              aria-pressed={selectedLevel === item.id}
                            >
                              <span className="cat-level-choice-number">
                                {unlocked ? (
                                  String(item.number).padStart(2, "0")
                                ) : (
                                  <LockKeyhole size={17} />
                                )}
                              </span>
                              <span>
                                <strong>{item.title}</strong>
                                <small>
                                  {unlocked
                                    ? record
                                      ? `最佳 ${record.moves} 步 · ${formatTime(record.elapsed)}`
                                      : item.subtitle
                                    : `完成第 ${item.number - 1} 关后解锁`}
                                </small>
                              </span>
                              {record ? (
                                <Stars count={record.stars} size={12} />
                              ) : (
                                <span className="cat-choice-cats">
                                  {item.cats.length} 猫
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <div className="cat-mode-switch" aria-label="关卡模式">
                        <button
                          type="button"
                          className={
                            selectedMode === "cozy" ? "is-selected" : ""
                          }
                          aria-pressed={selectedMode === "cozy"}
                          onClick={() => setSelectedMode("cozy")}
                        >
                          慢慢逛
                        </button>
                        <button
                          type="button"
                          className={
                            selectedMode === "challenge" ? "is-selected" : ""
                          }
                          aria-pressed={selectedMode === "challenge"}
                          onClick={() => setSelectedMode("challenge")}
                        >
                          步数挑战
                        </button>
                      </div>
                      <p className="cat-level-preview">
                        {selected.description}
                      </p>
                      <button
                        type="button"
                        className="cat-button is-primary"
                        onClick={() => startLevel(selectedLevel)}
                      >
                        <Play size={15} fill="currentColor" />
                        开始 · {selected.title}
                      </button>
                      {hasStarted && game.status === "playing" && (
                        <button
                          type="button"
                          className="cat-text-button"
                          onClick={resume}
                        >
                          继续当前庭院
                        </button>
                      )}
                      <small className="cat-save-note">
                        开始新一局会替换当前进度，最佳纪录保留。
                      </small>
                    </>
                  )}

                  {screen === "playing" && game.status === "won" && (
                    <>
                      <p id={resultSummaryId} className="sr-only">
                        用了 {game.moves} 步，{savedCats} 只猫全部回家，获得{" "}
                        {starsFor(game)} 颗星。
                      </p>
                      <div className="cat-win-lineup">
                        {level.cats.map((cat) => (
                          <PixelCat key={cat.id} coat={cat.coat} size={42} />
                        ))}
                      </div>
                      <span className="cat-eyebrow">EVERYONE IS HOME</span>
                      <h3>
                        {level.number === 3
                          ? "今天的猫，接齐了。"
                          : "大家都到家啦。"}
                      </h3>
                      <Stars count={starsFor(game)} size={26} />
                      <p>
                        {level.number === 3
                          ? "三座庭院都留下了你的脚印。想再逛一遍，随时回来。"
                          : "窗里亮起小灯，门廊也安静下来了。"}
                      </p>
                      <div className="cat-result-stats">
                        <div>
                          <strong>{game.moves}</strong>
                          <span>步</span>
                        </div>
                        <div>
                          <strong>{formatTime(game.elapsed)}</strong>
                          <span>用时</span>
                        </div>
                        <div>
                          <strong>{savedCats}</strong>
                          <span>只猫回家</span>
                        </div>
                      </div>
                      <span className="cat-result-best">
                        {protectedSave || !storageAvailable
                          ? "本次成绩仅在当前页面保留，关闭后不会保存。"
                          : best && best.moves < game.moves
                            ? `这关最佳：${best.moves} 步`
                            : "这条路线已记进你的庭院小札。"}
                      </span>
                      {level.number < GARDEN_LEVELS.length ? (
                        <button
                          type="button"
                          className="cat-button is-primary"
                          onClick={() =>
                            startLevel(
                              GARDEN_LEVELS[level.number].id,
                              game.mode,
                            )
                          }
                        >
                          去下一座庭院
                          <ArrowRight size={17} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="cat-button is-primary"
                          onClick={openLevels}
                        >
                          <Map size={16} />
                          查看庭院纪录
                        </button>
                      )}
                      <button
                        type="button"
                        className="cat-text-button"
                        onClick={() => startLevel(game.levelId, game.mode)}
                      >
                        <RotateCcw size={14} />
                        再逛一次
                      </button>
                    </>
                  )}

                  {screen === "playing" && game.status === "lost" && (
                    <>
                      <p id={resultSummaryId} className="sr-only">
                        这次用了 {game.moves} 步，{savedCats} /{" "}
                        {game.cats.length}{" "}
                        只猫已回家。可以重新挑战，或改为慢慢逛继续。
                      </p>
                      <PixelCat coat="ginger" size={64} />
                      <span className="cat-eyebrow">ANOTHER LITTLE TRY</span>
                      <h3>这次的步数用完了。</h3>
                      <p>
                        这次的 {level.budget} 步已经用完。
                        <br />
                        试着少绕一点路，把呼唤留到靠近时。
                      </p>
                      <div className="cat-result-stats">
                        <div>
                          <strong>{savedCats}</strong>
                          <span>已回家</span>
                        </div>
                        <div>
                          <strong>{followingCats}</strong>
                          <span>正跟随</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="cat-button is-primary"
                        onClick={() => startLevel(game.levelId, game.mode)}
                      >
                        <RotateCcw size={16} />
                        重新挑战
                      </button>
                      <button
                        type="button"
                        className="cat-button is-light"
                        onClick={() => {
                          setGame((current) => ({
                            ...current,
                            mode: "cozy",
                            status: "playing",
                            feedback: "换成慢慢逛，继续接朋友回家吧。",
                            feedbackKind: "info",
                          }));
                          setSelectedMode("cozy");
                          setProgress((current) => ({
                            ...current,
                            mode: "cozy",
                          }));
                        }}
                      >
                        改为慢慢逛，继续这一局
                      </button>
                      <button
                        type="button"
                        className="cat-text-button"
                        onClick={openLevels}
                      >
                        选择庭院
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div
            className={`cat-feedback is-${running && route.length ? "info" : game.feedbackKind}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="cat-feedback-dot" />
            <p>{feedbackText}</p>
          </div>

          <div className="cat-game-controls">
            <div className="cat-direction-pad" aria-label="移动方向">
              <button
                type="button"
                className="cat-up"
                aria-label="向上走一步"
                disabled={!canAct}
                onClick={() => act({ type: "move", dx: 0, dy: -1 })}
              >
                <ArrowUp size={18} />
              </button>
              <button
                type="button"
                className="cat-left"
                aria-label="向左走一步"
                disabled={!canAct}
                onClick={() => act({ type: "move", dx: -1, dy: 0 })}
              >
                <ArrowLeft size={18} />
              </button>
              <button
                type="button"
                className="cat-down"
                aria-label="向下走一步"
                disabled={!canAct}
                onClick={() => act({ type: "move", dx: 0, dy: 1 })}
              >
                <ArrowDown size={18} />
              </button>
              <button
                type="button"
                className="cat-right"
                aria-label="向右走一步"
                disabled={!canAct}
                onClick={() => act({ type: "move", dx: 1, dy: 0 })}
              >
                <ArrowRight size={18} />
              </button>
            </div>
            <button
              type="button"
              className="cat-call-button"
              disabled={!canAct}
              onClick={() => act({ type: "call" })}
            >
              <span>
                <Sparkles size={18} />
                回家啦
              </span>
              <small>呼唤 · 空格</small>
            </button>
            <div className="cat-session-controls">
              <button
                type="button"
                className="cat-control-button"
                disabled={!running}
                onClick={() => pause()}
              >
                <Pause size={16} />
                <span>暂停</span>
              </button>
              <button
                type="button"
                className="cat-control-button"
                onClick={openLevels}
              >
                <Map size={16} />
                <span>庭院</span>
              </button>
            </div>
          </div>
          <p className="cat-keyboard-tip">
            点小路自动走 · 方向键 / WASD 移动 · Space 呼唤 · P 暂停
          </p>
        </div>

        <aside className="cat-garden-notes" aria-label="庭院小札">
          <div className="cat-notes-heading">
            <span>庭院小札</span>
            <span className="cat-notes-date">
              {String(level.number).padStart(2, "0")} / 03
            </span>
          </div>
          <h3>今天接谁回家？</h3>
          <div className="cat-roster">
            {game.cats.map((cat) => {
              const definition = level.cats.find((item) => item.id === cat.id)!;
              const statusText =
                cat.status === "home"
                  ? "已经到家"
                  : cat.status === "homebound"
                    ? "走向门廊"
                    : cat.status === "following"
                      ? "跟着你呢"
                      : !cat.awake
                        ? "还在打盹"
                        : definition.personality === "sleepy"
                          ? "醒了，再叫一次"
                          : "等你来接";
              return (
                <button
                  type="button"
                  key={cat.id}
                  className={`cat-roster-cat is-${cat.status}`}
                  disabled={!canAct || cat.status !== "waiting"}
                  onClick={() => navigate(cat)}
                  aria-describedby={`${boardSummaryId}-${cat.id}`}
                  title={
                    cat.status === "waiting"
                      ? `去找${definition.name}。${PERSONALITIES[definition.personality].description}`
                      : statusText
                  }
                  aria-label={
                    cat.status === "waiting"
                      ? `去找${definition.name}，${PERSONALITIES[definition.personality].label}`
                      : `${definition.name}，${statusText}`
                  }
                >
                  <PixelCat
                    coat={definition.coat}
                    size={39}
                    sleeping={!cat.awake}
                  />
                  <span>
                    <strong>
                      {definition.name}
                      <small>
                        {PERSONALITIES[definition.personality].label}
                      </small>
                    </strong>
                    <em id={`${boardSummaryId}-${cat.id}`}>{statusText}</em>
                  </span>
                  {cat.status === "home" ? (
                    <Check size={15} />
                  ) : cat.status === "waiting" ? (
                    <ChevronRight size={14} />
                  ) : (
                    <span className="cat-follow-dot" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="cat-small-objective">
            <Flag size={16} />
            <p>{level.hint}</p>
          </div>
          {level.key &&
            (game.keyCollected ? (
              <div className="cat-key-status is-found" role="status">
                <KeyRound size={16} />
                <span>钥匙已找到 · 花园门已开</span>
              </div>
            ) : (
              <button
                type="button"
                className="cat-key-status cat-key-shortcut"
                disabled={!canAct}
                onClick={() => navigate(level.key!)}
                title="自动走到左侧小径上的金色钥匙"
              >
                <KeyRound size={16} />
                <span>去捡钥匙</span>
                <ArrowRight size={14} />
              </button>
            ))}
          <button
            type="button"
            className="cat-home-shortcut"
            disabled={!canAct}
            onClick={() => navigate(level.home)}
          >
            <Home size={16} />
            走回门廊
            <ArrowRight size={14} />
          </button>
          <div className="cat-notes-rule">
            <Stars count={3} size={12} />
            <span>{level.par} 步以内接齐，留下三颗星。</span>
          </div>
          {best && (
            <div className="cat-local-best">
              <span>这台设备的最佳路线</span>
              <strong>
                {best.moves} 步 <small>· {formatTime(best.elapsed)}</small>
              </strong>
              <Stars count={best.stars} size={12} />
            </div>
          )}
          <div className="cat-notes-foot">
            <span className="cat-stitch" />
            <p>
              跟上的猫不会走丢。
              <br />
              你可以先去接下一位朋友。
            </p>
          </div>
        </aside>
      </div>
      <footer className="cat-courtyard-footer">
        <span>原创小庭院 · 加载后可离线玩</span>
        <span>
          {protectedSave
            ? "临时游玩 · 不覆盖其他版本存档"
            : storageAvailable
              ? "进度自动保存在本机"
              : "浏览器未开放存储，本次仍可正常玩"}
        </span>
      </footer>
    </div>
  );
}
