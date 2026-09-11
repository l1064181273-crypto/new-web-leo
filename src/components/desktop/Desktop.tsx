import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { Rnd } from "react-rnd";
import * as Dialog from "@radix-ui/react-dialog";
import {
  CalendarDays,
  Check,
  Github,
  Home,
  Minus,
  NotebookPen,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { z } from "zod";
import {
  ContactContent,
  GithubContent,
  ProjectHub,
  ResumeContent,
} from "@/components/PortfolioDesk";
import { media, type CollectionId } from "@/data/media";
import { useLocalState } from "@/hooks/use-local-state";
import githubIcon from "@/assets/macos-icons/github.png";
import daybookIcon from "@/assets/macos-icons/local.png";
import photographyIcon from "@/assets/macos-icons/life.png";
import projectsIcon from "@/assets/macos-icons/ai.png";
import foodIcon from "@/assets/macos-icons/agriculture.png";
import constructionIcon from "@/assets/macos-icons/build.png";
import ProfileApp from "./ProfileApp";
import GalleryApp from "./GalleryApp";
import MusicApp from "./MusicApp";
import CompanionCat from "./CompanionCat";
import SandboxApp from "./SandboxApp";
import HerdingCatsApp from "./HerdingCatsApp";
import { PhotographyApp, DaybookApp, CinemaApp, TableStoriesApp } from "./CollectionApps";
import NotesApp from "./NotesApp";
import { fitWindow, windowReducer, type AppId } from "./window-state";
import "@/styles/reference-v4.css";

const desktopAsset = (name: string) =>
  `${import.meta.env.BASE_URL}desktop/${name}.png`;
const photo = (file: string) => media.find((item) => item.id === file)!.image;
type DesktopApp = {
  id: AppId;
  name: string;
  icon?: string;
  glyph?: "notes";
  scale?: number;
  x: number;
  y: number;
  collection?: CollectionId;
};
const applications: DesktopApp[] = [
  { id: "source", name: "GitHub", icon: githubIcon, scale: 1.22, x: 1.7, y: 5.7 },
  {
    id: "profile",
    name: "Profile",
    icon: desktopAsset("about"),
    x: 2.4,
    y: 81.5,
  },
  {
    id: "daily",
    name: "Daybook",
    icon: daybookIcon,
    scale: 1.21,
    x: 8.9,
    y: 40.6,
    collection: "daily",
  },
  {
    id: "photos",
    name: "Photography",
    icon: photographyIcon,
    scale: 1.22,
    x: 23.5,
    y: 72.3,
    collection: "photos",
  },
  {
    id: "projects",
    name: "Projects",
    icon: projectsIcon,
    scale: 1.22,
    x: 46.6,
    y: 36.1,
  },
  {
    id: "food",
    name: "Table Stories",
    icon: foodIcon,
    scale: 1.21,
    x: 61.9,
    y: 61.6,
    collection: "food",
  },
  {
    id: "notes",
    name: "Field Notes",
    glyph: "notes",
    x: 70.9,
    y: 17.3,
  },
  {
    id: "cats",
    name: "Little Companion",
    icon: constructionIcon,
    scale: 1.17,
    x: 86.9,
    y: 42.6,
  },
  {
    id: "cinema",
    name: "Cinema",
    icon: desktopAsset("dockFinalCut"),
    x: 45.1,
    y: 82,
    collection: "films",
  },
  {
    id: "atlas",
    name: "Personal Atlas",
    icon: desktopAsset("life"),
    x: 91.3,
    y: 85.4,
  },
  { id: "music", name: "Music", icon: desktopAsset("music"), x: 29.1, y: 17.3 },
  {
    id: "connect",
    name: "Connect",
    icon: desktopAsset("dockMail"),
    x: 91.7,
    y: 5.7,
  },
  {
    id: "resume",
    name: "Resume",
    icon: desktopAsset("resume"),
    x: 46.5,
    y: 6.9,
  },
  {
    id: "games",
    name: "Herding Cats",
    icon: desktopAsset("cats"),
    x: 77.9,
    y: 74.8,
    collection: "games",
  },
];
const appById = Object.fromEntries(
  applications.map((app) => [app.id, app]),
) as Record<AppId, (typeof applications)[number]>;
const dock: { id: AppId; icon: string }[] = [
  { id: "resume", icon: desktopAsset("resume") },
  { id: "profile", icon: desktopAsset("dockFinder") },
  { id: "atlas", icon: desktopAsset("dockPhotos") },
  { id: "projects", icon: desktopAsset("dockFinalCut") },
  { id: "connect", icon: desktopAsset("dockMail") },
];
const settingsSchema = z.object({
  companion: z.boolean(),
  wallpaper: z.enum(["blue", "mountain", "sea"]),
  dim: z.number().min(0).max(0.55),
});
const favoritesSchema = z.array(z.string()).max(1000);
const iconLayoutSchema = z.record(
  z.string(),
  z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
  }),
).transform(
  (value) => value as Record<string, { x: number; y: number }>,
);
const defaultIconLayout = Object.fromEntries(
  applications.map(({ id, x, y }) => [id, { x, y }]),
) as Record<AppId, { x: number; y: number }>;
const wallpaperMap = {
  blue: `${import.meta.env.BASE_URL}desktop/wallpaper.jpg`,
  mountain: photo("photo-1.jpg"),
  sea: photo("photo-10.jpg"),
};

export default function Desktop({
  initialApp,
  initialCollection,
}: {
  initialApp?: string;
  initialCollection?: string;
}) {
  const [windows, dispatch] = useReducer(windowReducer, []);
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [booting, setBooting] = useState(true);
  const [time, setTime] = useState(new Date());
  const [spotlight, setSpotlight] = useState(false);
  const [search, setSearch] = useState("");
  const [panel, setPanel] = useState<"settings" | "calendar" | null>(null);
  const [projectTitle, setProjectTitle] = useState("Signal Lab");
  const [atlasCollection] = useState<CollectionId | "all">(
    initialCollection &&
      ["daily", "photos", "artists", "films", "games", "food"].includes(
        initialCollection,
      )
      ? (initialCollection as CollectionId)
      : "all",
  );
  const [settings, setSettings] = useLocalState(
    "leo-desktop-settings-v1",
    {
      companion: true,
      wallpaper: "blue" as "blue" | "mountain" | "sea",
      dim: 0,
    },
    settingsSchema,
  );
  const [favorites, setFavorites] = useLocalState<string[]>(
    "leo-desktop-favorites-v1",
    [],
    favoritesSchema,
  );
  const [iconLayout, setIconLayout] = useLocalState<
    Record<string, { x: number; y: number }>
  >("leo-desktop-icon-layout-v1", defaultIconLayout, iconLayoutSchema);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const shortcutsRef = useRef<HTMLDivElement>(null);
  const iconDrag = useRef<{
    id: AppId;
    pointerId: number;
    node: HTMLButtonElement;
    startX: number;
    startY: number;
    left: number;
    top: number;
    nextLeft: number;
    nextTop: number;
    moved: boolean;
  } | null>(null);
  const suppressIconClick = useRef<AppId | null>(null);
  const small = viewport.width <= 720;
  const layer = {
    width: viewport.width,
    height: Math.max(160, viewport.height - (small ? 0 : 150)),
  };
  const active = [...windows].reverse().find((item) => !item.minimized);
  const open = (id: AppId) => {
    lastTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const isGallery = id === "atlas" || !!appById[id].collection;
    const width =
      id === "music"
        ? Math.min(232, layer.width - 48)
        : Math.min(
            id === "cats" ? 1160 : id === "games" ? 700 : isGallery ? 900 : 792,
            layer.width - 48,
          );
    const height =
      id === "music"
        ? Math.min(433, layer.height - 30)
        : Math.min(id === "cats" ? 720 : id === "games" ? 560 : 630, layer.height - 30);
    dispatch({
      type: "open",
      window: {
        id,
        width,
        height,
        x: Math.max(
          0,
          (layer.width - width) / 2 - (id === "projects" ? 76 : 0),
        ),
        y: Math.max(
          0,
          (viewport.height - height) / 2 -
            (small ? 0 : 40) -
            (id === "projects" ? 65 : 0),
        ),
        minimized: false,
        maximized: false,
      },
    });
    setPanel(null);
    setSpotlight(false);
  };
  const close = (id: AppId) => {
    dispatch({ type: "close", id });
    lastTrigger.current?.focus();
  };
  const dismiss = () => {
    if (active) dispatch({ type: "minimize", id: active.id });
    lastTrigger.current?.focus();
  };
  useEffect(() => {
    if (!active || spotlight) return;
    const escape = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !document.querySelector(".photo-viewer,[role=alertdialog]")
      ) {
        dispatch({ type: "minimize", id: active.id });
        lastTrigger.current?.focus();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [active, spotlight]);
  useEffect(() => {
    const boot = window.setTimeout(() => setBooting(false), 1100);
    const clock = window.setInterval(() => setTime(new Date()), 30000);
    const resize = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    const keyboard = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSpotlight((value) => !value);
      }
      if (event.key === "Escape") setPanel(null);
    };
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", keyboard);
    return () => {
      clearTimeout(boot);
      clearInterval(clock);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keyboard);
    };
  }, []);
  useEffect(() => {
    if (applications.some((app) => app.id === initialApp))
      open(initialApp as AppId);
    // Initial deep link is resolved once; desktop windows keep their own state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialApp]);
  useEffect(() => {
    document.title = active
      ? `${appById[active.id].name} · Haonan Li`
      : "Haonan Li · Personal Desktop";
  }, [active]);
  const toggleFavorite = (id: string) =>
    setFavorites((previous) =>
      previous.includes(id)
        ? previous.filter((value) => value !== id)
        : [...previous, id],
    );
  const beginIconDrag = (
    id: AppId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (small || event.button !== 0 || !shortcutsRef.current) return;
    const container = shortcutsRef.current.getBoundingClientRect();
    const rect = event.currentTarget.getBoundingClientRect();
    iconDrag.current = {
      id,
      pointerId: event.pointerId,
      node: event.currentTarget,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left - container.left,
      top: rect.top - container.top,
      nextLeft: rect.left - container.left,
      nextTop: rect.top - container.top,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveIcon = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = iconDrag.current;
    const container = shortcutsRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !container) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    event.preventDefault();
    const bounds = container.getBoundingClientRect();
    drag.nextLeft = Math.max(
      0,
      Math.min(bounds.width - drag.node.offsetWidth, drag.left + dx),
    );
    drag.nextTop = Math.max(
      0,
      Math.min(bounds.height - drag.node.offsetHeight, drag.top + dy),
    );
    drag.node.dataset.dragging = "true";
    drag.node.style.left = `${drag.nextLeft}px`;
    drag.node.style.top = `${drag.nextTop}px`;
  };
  const finishIconDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    cancelled = false,
  ) => {
    const drag = iconDrag.current;
    const container = shortcutsRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !container) return;
    if (drag.node.hasPointerCapture(event.pointerId))
      drag.node.releasePointerCapture(event.pointerId);
    delete drag.node.dataset.dragging;
    if (drag.moved && !cancelled) {
      const bounds = container.getBoundingClientRect();
      const next = {
        x: (drag.nextLeft / bounds.width) * 100,
        y: (drag.nextTop / bounds.height) * 100,
      };
      drag.node.style.setProperty("--x", `${next.x}%`);
      drag.node.style.setProperty("--y", `${next.y}%`);
      drag.node.style.removeProperty("left");
      drag.node.style.removeProperty("top");
      setIconLayout((previous) => ({
        ...previous,
        [drag.id]: next,
      }));
      suppressIconClick.current = drag.id;
      window.setTimeout(() => {
        if (suppressIconClick.current === drag.id)
          suppressIconClick.current = null;
      }, 0);
    } else {
      const position = iconLayout[drag.id] ?? defaultIconLayout[drag.id];
      drag.node.style.setProperty("--x", `${position.x}%`);
      drag.node.style.setProperty("--y", `${position.y}%`);
      drag.node.style.removeProperty("left");
      drag.node.style.removeProperty("top");
    }
    iconDrag.current = null;
  };
  const renderApp = (id: AppId): ReactNode => {
    const gallery = (collection: CollectionId | "all") => (
      <GalleryApp
        initial={collection}
        favorites={favorites}
        toggleFavorite={toggleFavorite}
      />
    );
    switch (id) {
      case "profile":
        return <ProfileApp connect={() => open("connect")} />;
      case "resume":
        return <ResumeContent />;
      case "projects":
        return <ProjectHub initialId="ai" onSectionChange={setProjectTitle} />;
      case "games":
        return <HerdingCatsApp active={active?.id === "games"} />;
      case "source":
        return <GithubContent />;
      case "connect":
        return <ContactContent />;
      case "notes":
        return <NotesApp />;
      case "photos":
        return <PhotographyApp favorites={favorites} toggleFavorite={toggleFavorite} />;
      case "daily":
        return <DaybookApp />;
      case "cinema":
        return <CinemaApp />;
      case "food":
        return <TableStoriesApp />;
      case "music":
        return <MusicApp />;
      case "atlas":
        return (
          <GalleryApp
            key={atlasCollection}
            initial={atlasCollection}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
          />
        );
      case "cats":
        return <SandboxApp active={active?.id === "cats"} />;
      default:
        return null;
    }
  };
  const dateText = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(time);
  const weekStart = new Date(time.getFullYear(), time.getMonth(), 1).getDay();
  const monthDays = new Date(
    time.getFullYear(),
    time.getMonth() + 1,
    0,
  ).getDate();
  return (
    <MotionConfig reducedMotion="user">
      <main
        className={`leo-desktop ${active ? "has-open-app" : ""}`}
        style={
          {
            "--wallpaper": `url("${wallpaperMap[settings.wallpaper]}")`,
            "--dim": settings.dim,
          } as CSSProperties
        }
        aria-label="Haonan Li 的个人桌面"
      >
        <div className="desktop-wallpaper" />
        <h1 className="sr-only">Haonan Li · Personal Desktop</h1>
        <header className="menubar">
          <button className="menu-brand" onClick={() => open("profile")}>
            Haonan Li
          </button>
          <div className="menubar-right">
            <a
              href="https://github.com/l1064181273-crypto/new-web-leo"
              target="_blank"
              rel="noreferrer"
              title="GitHub"
              aria-label="GitHub 仓库"
            >
              <Github size={16} />
            </a>
            <button
              title="搜索应用"
              aria-label="搜索应用"
              onClick={() => setSpotlight(true)}
            >
              <Search size={16} />
            </button>
            <button
              title="控制中心"
              aria-label="控制中心"
              aria-expanded={panel === "settings"}
              onClick={() => setPanel(panel === "settings" ? null : "settings")}
            >
              <SlidersHorizontal size={16} />
            </button>
            <button
              className="menu-clock"
              aria-label="日历"
              aria-expanded={panel === "calendar"}
              onClick={() => setPanel(panel === "calendar" ? null : "calendar")}
            >
              <span>{dateText}</span>
              <time>
                {time.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </button>
          </div>
        </header>
        <div
          ref={shortcutsRef}
          className="desktop-shortcuts"
          aria-label="桌面应用"
          onPointerDown={() => setPanel(null)}
        >
          {applications.map((app) => {
            const position = iconLayout[app.id] ?? defaultIconLayout[app.id];
            return (
              <button
                key={app.id}
                type="button"
                className={`desktop-shortcut shortcut-${app.id}`}
                style={
                  {
                    "--x": `${position.x}%`,
                    "--y": `${position.y}%`,
                  } as CSSProperties
                }
                onPointerDown={(event) => beginIconDrag(app.id, event)}
                onPointerMove={moveIcon}
                onPointerUp={(event) => finishIconDrag(event)}
                onPointerCancel={(event) => finishIconDrag(event, true)}
                onClick={() => {
                  if (suppressIconClick.current === app.id) {
                    suppressIconClick.current = null;
                    return;
                  }
                  if (active?.id === app.id) dismiss();
                  else open(app.id);
                }}
                aria-label={`打开 ${app.name}`}
              >
                <i
                  className={`desktop-icon-frame desktop-icon-frame-${app.id}`}
                  style={
                    { "--icon-scale": app.scale ?? 1 } as CSSProperties
                  }
                >
                  {app.glyph === "notes" ? (
                    <NotebookPen
                      size={43}
                      strokeWidth={1.35}
                      aria-hidden="true"
                    />
                  ) : (
                    <img src={app.icon} alt="" draggable={false} />
                  )}
                </i>
                <span>{app.name}</span>
              </button>
            );
          })}
        </div>
        {settings.companion && <CompanionCat awake={!active} />}
        {active && (
          <button
            className="desktop-dismiss"
            tabIndex={-1}
            aria-label="返回桌面空白区域"
            onClick={dismiss}
          />
        )}
        <div className="window-layer" ref={layerRef}>
          {windows.map((windowState, index) => {
            const { id, minimized, maximized } = windowState;
            const isMusic = id === "music";
            const rect =
              small || maximized
                ? { x: 0, y: 0, width: layer.width, height: layer.height }
                : fitWindow(windowState, layer.width, layer.height);
            return (
              <Rnd
                key={id}
                className={`desktop-window ${active?.id === id ? "is-focused" : ""} ${isMusic ? "music-window" : ""} ${id === "games" ? "game-window" : ""}`}
                size={{ width: rect.width, height: rect.height }}
                position={{ x: rect.x, y: rect.y }}
                bounds="parent"
                disableDragging={small || id === "games"}
                enableResizing={false}
                minWidth={isMusic ? 200 : Math.min(540, layer.width)}
                minHeight={Math.min(340, layer.height)}
                dragHandleClassName={
                  isMusic ? "ipod-screen" : "window-titlebar"
                }
                cancel="button,input,a"
                style={{
                  zIndex: 20 + index,
                  display: minimized ? "none" : undefined,
                }}
                onMouseDown={() => dispatch({ type: "focus", id })}
                onDragStop={(_, data) =>
                  dispatch({
                    type: "geometry",
                    id,
                    rect: { ...rect, x: data.x, y: data.y },
                  })
                }
                onResizeStop={(_, __, element, ___, position) =>
                  dispatch({
                    type: "geometry",
                    id,
                    rect: {
                      ...position,
                      width: element.offsetWidth,
                      height: element.offsetHeight,
                    },
                  })
                }
              >
                <section
                  className={`window-inner app-${id} ${id === "projects" || id === "atlas" || appById[id].collection ? "browser-window" : ""}`}
                  role="dialog"
                  aria-label={`${appById[id].name} 窗口`}
                  onFocusCapture={() => {
                    if (active?.id !== id) dispatch({ type: "focus", id });
                  }}
                >
                  <header className="window-titlebar">
                    <div className="traffic-lights">
                      <button
                        className="traffic-close"
                        title="关闭窗口"
                        aria-label="关闭窗口"
                        onClick={() => close(id)}
                      >
                        <X size={9} />
                      </button>
                      <button
                        className="traffic-minimize"
                        title="收起窗口"
                        aria-label="收起窗口"
                        onClick={() => dispatch({ type: "minimize", id })}
                      >
                        <Minus size={9} />
                      </button>
                      {!isMusic && (
                        <button
                          className="traffic-maximize"
                          title="返回桌面"
                          aria-label="返回桌面"
                          onClick={() => dispatch({ type: "minimize", id })}
                        >
                          <X size={8} />
                        </button>
                      )}
                    </div>
                    <div className="window-path">
                      <span>Haonan</span>
                      <i>/</i>
                      <strong>{appById[id].name}</strong>
                      {id === "projects" && (
                        <>
                          <i>/</i>
                          <span className="current-section">
                            {projectTitle}
                          </span>
                        </>
                      )}
                    </div>
                    <button
                      className="window-home icon-button"
                      title="回到桌面"
                      aria-label="回到桌面"
                      onClick={dismiss}
                    >
                      <Home size={17} />
                    </button>
                  </header>
                  <div
                    className={`window-content ${["profile", "resume", "source", "connect", "cats"].includes(id) ? "padded" : ""}`}
                  >
                    {renderApp(id)}
                  </div>
                </section>
              </Rnd>
            );
          })}
        </div>
        <button
          className="companion-toggle"
          role="switch"
          aria-checked={settings.companion}
          onClick={() =>
            setSettings({ ...settings, companion: !settings.companion })
          }
        >
          <span>You like cats?</span>
          <i data-on={settings.companion}>
            <b />
          </i>
        </button>
        <nav className="desktop-dock" aria-label="应用程序坞">
          {dock.map((item) => (
            <button
              key={item.id}
              aria-label={`打开 ${appById[item.id].name}`}
              onClick={() =>
                active?.id === item.id ? dismiss() : open(item.id)
              }
            >
              <img src={item.icon} alt="" draggable={false} />
              <span className="dock-tooltip">{appById[item.id].name}</span>
              {windows.some((window) => window.id === item.id) && (
                <i className="dock-dot" />
              )}
            </button>
          ))}
        </nav>
        {panel && (
          <div
            className="desktop-popover"
            role="dialog"
            aria-label={panel === "settings" ? "控制中心" : "日历"}
          >
            {panel === "settings" ? (
              <>
                <h2>控制中心</h2>
                <label className="dim-control">
                  桌面亮度
                  <input
                    aria-label="桌面亮度"
                    type="range"
                    min={0}
                    max={0.55}
                    step={0.01}
                    value={0.55 - settings.dim}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        dim: 0.55 - Number(event.target.value),
                      })
                    }
                  />
                </label>
                <h3>桌面背景</h3>
                <div className="wallpaper-options">
                  {(
                    Object.keys(wallpaperMap) as (keyof typeof wallpaperMap)[]
                  ).map((key, index) => (
                    <button
                      key={key}
                      aria-label={
                        ["Macxfolio 蓝色", "暮色苍山", "海边路灯"][index]
                      }
                      aria-pressed={settings.wallpaper === key}
                      onClick={() =>
                        setSettings({ ...settings, wallpaper: key })
                      }
                    >
                      <img src={wallpaperMap[key]} alt="" />
                      {settings.wallpaper === key && <Check size={16} />}
                    </button>
                  ))}
                </div>
                <button
                  className="reset-icon-layout"
                  onClick={() => setIconLayout({ ...defaultIconLayout })}
                >
                  <RotateCcw size={14} />
                  重置图标布局
                </button>
              </>
            ) : (
              <>
                <h2>
                  <CalendarDays size={17} />
                  {time.toLocaleDateString("zh-CN", {
                    year: "numeric",
                    month: "long",
                  })}
                </h2>
                <div className="calendar-grid">
                  {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
                    <strong key={day}>{day}</strong>
                  ))}
                  {Array.from({ length: weekStart }, (_, i) => (
                    <span key={`empty${i}`} />
                  ))}
                  {Array.from({ length: monthDays }, (_, i) => (
                    <span
                      key={i}
                      className={i + 1 === time.getDate() ? "today" : ""}
                    >
                      {i + 1}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <AnimatePresence>
          {booting && (
            <motion.div
              className="desktop-boot"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              <span>hello</span>
            </motion.div>
          )}
        </AnimatePresence>
        <Dialog.Root open={spotlight} onOpenChange={setSpotlight}>
          <Dialog.Portal>
            <Dialog.Overlay className="spotlight-overlay" />
            <Dialog.Content
              className="spotlight-panel"
              aria-describedby={undefined}
            >
              <Dialog.Title className="sr-only">搜索桌面应用</Dialog.Title>
              <label>
                <Search size={23} />
                <input
                  aria-label="搜索桌面应用"
                  placeholder="搜索桌面应用..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <div>
                {applications
                  .filter((app) =>
                    `${app.name} ${app.id}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((app) => (
                    <button key={app.id} onClick={() => open(app.id)}>
                      {app.glyph === "notes" ? (
                        <NotebookPen
                          className="spotlight-notes-icon"
                          aria-hidden="true"
                        />
                      ) : (
                        <img src={app.icon} alt="" />
                      )}
                      <strong>{app.name}</strong>
                      <span>应用程序</span>
                    </button>
                  ))}
              </div>
              <Dialog.Close className="sr-only">关闭搜索</Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </main>
    </MotionConfig>
  );
}
