import {
  useEffect,
  useCallback,
  useId,
  useReducer,
  useRef,
  useState,
  lazy,
  Suspense,
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
  Maximize2,
  Minimize2,
  NotebookPen,
  RotateCcw,
  Search,
  SlidersHorizontal,
  ArrowUpRight,
  Compass,
  Copy,
  X,
} from "lucide-react";
import { z } from "zod";
import { media, type CollectionId } from "@/data/media";
import { useLocalState } from "@/hooks/use-local-state";
import githubIcon from "@/assets/optimized/github-192.png";
import daybookIcon from "@/assets/optimized/local-192.png";
import photographyIcon from "@/assets/optimized/life-192.png";
import projectsIcon from "@/assets/optimized/ai-192.png";
import foodIcon from "@/assets/optimized/agriculture-192.png";
import CompanionCat from "./CompanionCat";
import { fitWindow, windowReducer, type AppId } from "./window-state";
import AppBoundary from "./AppBoundary";
import "@/styles/reference-v4.css";
import "@/styles/desktop-accessibility.css";

const StudioProfile = lazy(() => import("./StudioProfile"));
const BiographyApp = lazy(() =>
  import("./StudioAbout").then((module) => ({ default: module.BiographyApp })),
);
const StudioContact = lazy(() =>
  import("./StudioAbout").then((module) => ({ default: module.StudioContact })),
);
const StudioSource = lazy(() =>
  import("./StudioAbout").then((module) => ({ default: module.StudioSource })),
);
const WorkshopApp = lazy(() => import("./WorkshopApp"));
const GalleryApp = lazy(() => import("./GalleryApp"));
const MusicApp = lazy(() => import("./MusicApp"));
const SandboxApp = lazy(() => import("./SandboxApp"));
const HerdingCatsApp = lazy(() => import("./HerdingCatsApp"));
const NotesApp = lazy(() => import("./StudioNotes"));
const PhotographyApp = lazy(() =>
  import("./CollectionApps").then((module) => ({
    default: module.PhotographyApp,
  })),
);
const DaybookApp = lazy(() =>
  import("./CollectionApps").then((module) => ({ default: module.DaybookApp })),
);
const CinemaApp = lazy(() =>
  import("./CollectionApps").then((module) => ({ default: module.CinemaApp })),
);
const TableStoriesApp = lazy(() =>
  import("./CollectionApps").then((module) => ({
    default: module.TableStoriesApp,
  })),
);

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
  aliases?: string;
};
const applications: DesktopApp[] = [
  {
    id: "source",
    name: "GitHub",
    icon: githubIcon,
    scale: 1.22,
    x: 1.7,
    y: 5.7,
  },
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
    name: "Little Works",
    aliases: "Little Companion",
    icon: `${import.meta.env.BASE_URL}desktop/studio-little-works.svg`,
    scale: 1.12,
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
    icon: `${import.meta.env.BASE_URL}desktop/studio-cat-garden.svg`,
    scale: 1.12,
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
const iconLayoutSchema = z
  .record(
    z.string(),
    z.object({
      x: z.number().min(0).max(100),
      y: z.number().min(0).max(100),
    }),
  )
  .transform((value) => value as Record<string, { x: number; y: number }>);
const defaultIconLayout = Object.fromEntries(
  applications.map(({ id, x, y }) => [id, { x, y }]),
) as Record<AppId, { x: number; y: number }>;
const wallpaperMap = {
  blue: `${import.meta.env.BASE_URL}desktop/wallpaper.jpg`,
  mountain: photo("photo-1.jpg"),
  sea: photo("photo-10.jpg"),
};

const appDescriptions: Record<AppId, string> = {
  profile: "个人介绍 关于我 欢迎",
  resume: "经历 背景 个人说明",
  projects: "造物间 项目 创作记录 Vibe Coding",
  daily: "日记 生活 手记",
  photos: "摄影 照片 光影",
  food: "美食 风味 菜单 想吃",
  notes: "便签 笔记 备忘录",
  cats: "工地 沙盘 建筑 模型",
  cinema: "电影 片单 待看",
  atlas: "相册 收藏 图片 音乐 歌手 游戏",
  music: "音乐 播放器 iPod 歌单",
  connect: "联系 微信 交朋友",
  source: "源码 GitHub 来源",
  games: "游戏 牧猫 猫咪 庭院",
};
type DesktopSurface = "search" | "guide" | "settings" | "calendar" | null;
const isComposingKey = (event: KeyboardEvent) =>
  event.isComposing || event.keyCode === 229;
const guardDialogEscape = (event: KeyboardEvent) => {
  if (isComposingKey(event) || event.repeat) event.preventDefault();
};
const hasAppModal = () => Boolean(document.querySelector(
  '[role="alertdialog"], [role="dialog"]:not(.window-inner):not(.spotlight-panel):not(.desktop-guide):not(.desktop-popover)',
));

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
  const [surface, setSurface] = useState<DesktopSurface>(null);
  const [search, setSearch] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const [toastMessage, setToastMessage] = useState("");
  const [welcome, setWelcome, welcomeSaved, welcomeRecovery] = useLocalState(
    "leo-studio-welcome-v2",
    true,
    z.boolean(),
  );
  const [projectTitle, setProjectTitle] = useState("小作品");
  const atlasCollection: CollectionId | "all" =
    initialCollection &&
    ["daily", "photos", "artists", "films", "games", "food"].includes(
      initialCollection,
    )
      ? (initialCollection as CollectionId)
      : "all";
  const [settings, setSettings, settingsSaved, settingsRecovery] =
    useLocalState(
      "leo-desktop-settings-v1",
      {
        companion: true,
        wallpaper: "blue" as "blue" | "mountain" | "sea",
        dim: 0,
      },
      settingsSchema,
    );
  const [favorites, setFavorites, favoritesSaved, favoritesRecovery] =
    useLocalState<string[]>("leo-desktop-favorites-v1", [], favoritesSchema);
  const [iconLayout, setIconLayout, layoutSaved, layoutRecovery] =
    useLocalState<Record<string, { x: number; y: number }>>(
      "leo-desktop-icon-layout-v1",
      defaultIconLayout,
      iconLayoutSchema,
    );
  const desktopRecovery = [settingsRecovery, layoutRecovery, welcomeRecovery];
  const desktopStorageMessage = desktopRecovery.some((item) => item.conflict)
    ? "其他窗口更改了桌面设置或布局。本次调整仅临时保留，未覆盖外部数据；请先导出未保存的便签、记下当前调整，再刷新整个桌面读取最新设置。"
    : desktopRecovery.some((item) => item.readFailed)
      ? "暂时无法读取原来的桌面设置。本次调整仅临时保留，不会覆盖未知原值；请先导出未保存的便签，再检查存储权限并刷新整个桌面。"
      : "桌面设置暂未保存到本机。请检查浏览器的存储空间或权限；刷新前请先记下本次调整。";
  const layerRef = useRef<HTMLDivElement>(null);
  const shortcutsRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const surfaceRef = useRef<DesktopSurface>(null);
  const surfaceInvokerRef = useRef<HTMLElement | null>(null);
  const launchedAppRef = useRef<AppId | null>(null);
  const searchListId = useId();
  const panelId = useId();
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
  const compactIcons = viewport.width < 1100;
  const active = [...windows].reverse().find((item) => !item.minimized);
  const spotlight = surface === "search";
  const helpOpen = surface === "guide";
  const panel =
    surface === "settings" || surface === "calendar" ? surface : null;
  const mobileAppOpen = small && Boolean(active);
  // React 18 forwards the native inert attribute through this spread.
  // Desktop windows deliberately leave the desktop and Dock available to Tab.
  const backgroundInert = { inert: mobileAppOpen ? "" : undefined };
  const expanded = Boolean(active?.maximized) && !small;
  const layer = {
    width: viewport.width,
    height: Math.max(160, viewport.height - (small ? 0 : expanded ? 48 : 150)),
  };
  const matchingApps = applications.filter((app) =>
    `${app.name} ${app.aliases ?? ""} ${app.id} ${appDescriptions[app.id]}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
  const selectedSearchIndex = Math.min(
    searchIndex,
    Math.max(0, matchingApps.length - 1),
  );
  const selectedSearchApp = matchingApps[selectedSearchIndex];
  const selectedSearchId = selectedSearchApp
    ? `${searchListId}-${selectedSearchApp.id}`
    : undefined;
  const focusWindow = useCallback((id: AppId) => {
    const app = layerRef.current?.querySelector<HTMLElement>(`.app-${id}`);
    if (app && !app.contains(document.activeElement))
      app.focus({ preventScroll: true });
  }, []);
  const changeSurface = useCallback((next: DesktopSurface) => {
    surfaceRef.current = next;
    setSurface(next);
  }, []);
  const showSurface = useCallback(
    (next: Exclude<DesktopSurface, null>, invoker?: HTMLElement) => {
      // A guide → search or panel → search transition retains the original,
      // connected invoker rather than a control about to be unmounted.
      if (invoker) surfaceInvokerRef.current = invoker;
      else if (!surfaceRef.current)
        surfaceInvokerRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
      launchedAppRef.current = null;
      setSearchIndex(0);
      changeSurface(next);
    },
    [changeSurface],
  );
  const restoreSurfaceFocus = useCallback(
    (event?: Event) => {
      event?.preventDefault();
      if (surfaceRef.current) return;
      const invoker = surfaceInvokerRef.current;
      const launchedApp = launchedAppRef.current;
      window.requestAnimationFrame(() => {
        if (surfaceRef.current) return;
        if (launchedApp) {
          focusWindow(launchedApp);
          launchedAppRef.current = null;
        } else if (
          invoker?.isConnected &&
          invoker !== document.body &&
          !invoker.closest("[inert],[hidden]")
        ) {
          invoker.focus({ preventScroll: true });
        } else if (active?.id) {
          focusWindow(active.id);
        } else {
          searchTriggerRef.current?.focus({ preventScroll: true });
        }
      });
    },
    [active?.id, focusWindow],
  );
  const hideSurface = useCallback(
    (restore = true) => {
      const previous = surfaceRef.current;
      changeSurface(null);
      // Radix owns modal dismissal timing. Nonmodal popovers restore explicitly.
      if (restore && (previous === "settings" || previous === "calendar"))
        restoreSurfaceFocus();
    },
    [changeSurface, restoreSurfaceFocus],
  );
  const open = (id: AppId) => {
    const isGallery = id === "atlas" || !!appById[id].collection;
    const width =
      id === "music"
        ? Math.min(760, layer.width - 48)
        : Math.min(
            id === "cats"
              ? 1160
              : id === "games"
                ? 1000
                : id === "projects"
                  ? 1000
                  : isGallery
                    ? 960
                    : 860,
            layer.width - 48,
          );
    const height =
      id === "music"
        ? Math.min(600, layer.height - 30)
        : Math.min(
            id === "cats" ? 760 : id === "games" ? 680 : 680,
            layer.height - 30,
          );
    dispatch({
      type: "open",
      window: {
        id,
        width,
        height,
        x: Math.max(0, (layer.width - width) / 2),
        y: Math.max(0, (viewport.height - height) / 2 - (small ? 0 : 40)),
        minimized: false,
        maximized: id === "games",
      },
    });
    launchedAppRef.current = id;
    changeSurface(null);
    window.requestAnimationFrame(() => {
      if (!surfaceRef.current) focusWindow(id);
    });
  };
  const restoreDesktopFocus = useCallback((id: AppId) => {
    window.requestAnimationFrame(() =>
      shortcutsRef.current
        ?.querySelector<HTMLButtonElement>(`.shortcut-${id}`)
        ?.focus({ preventScroll: true }),
    );
  }, []);
  const close = (id: AppId) => {
    dispatch({ type: "close", id });
    restoreDesktopFocus(id);
  };
  const dismiss = () => {
    if (active) {
      dispatch({ type: "minimize", id: active.id });
      restoreDesktopFocus(active.id);
    }
  };
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isComposingKey(event)) return;
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        // App dialogs may live in a body Portal while their parent window is
        // kept mounted on minimize. Finish that modal before launching another
        // app, otherwise a hidden app can keep its overlay and focus trap alive.
        // Radix dialogs do not all expose aria-modal, so check their dialog role.
        if (hasAppModal()) return;
        if (!event.repeat) {
          if (surfaceRef.current === "search") hideSurface();
          else showSurface("search");
        }
        return;
      }
      if (event.key !== "Escape" || event.repeat) return;
      if (surfaceRef.current) {
        if (
          surfaceRef.current === "settings" ||
          surfaceRef.current === "calendar"
        ) {
          event.preventDefault();
          hideSurface();
        }
        return;
      }
      if (
        active?.id &&
        !document.querySelector(
          ".photo-viewer,[role=alertdialog],[aria-modal=true]:not(.window-inner)",
        )
      ) {
        event.preventDefault();
        dispatch({ type: "minimize", id: active.id });
        restoreDesktopFocus(active.id);
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [active?.id, hideSurface, showSurface, restoreDesktopFocus]);
  useEffect(() => {
    // Menubar panels are background chrome on a mobile fullscreen app. A
    // breakpoint change must not leave one focused underneath that app.
    if (mobileAppOpen && panel) hideSurface();
  }, [mobileAppOpen, panel, hideSurface]);
  useEffect(() => {
    if (!panel) return;
    const frame = window.requestAnimationFrame(() => {
      if (surfaceRef.current !== panel) return;
      const target =
        panel === "settings"
          ? panelRef.current?.querySelector<HTMLElement>("input,button")
          : panelRef.current;
      target?.focus({ preventScroll: true });
    });
    const dismissOutside = (event: Event) => {
      if (surfaceRef.current !== panel) return;
      const target = event.target;
      if (
        target instanceof Node &&
        !panelRef.current?.contains(target) &&
        !surfaceInvokerRef.current?.contains(target)
      )
        hideSurface(false);
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
    };
  }, [panel, hideSurface]);
  useEffect(() => {
    if (spotlight && selectedSearchId)
      document
        .getElementById(selectedSearchId)
        ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [spotlight, selectedSearchId]);
  useEffect(() => {
    let seenBoot = false;
    try {
      seenBoot = sessionStorage.getItem("leo-studio-boot-v2") === "seen";
      sessionStorage.setItem("leo-studio-boot-v2", "seen");
    } catch {
      /* A first visit still works when storage is disabled. */
    }
    const boot = window.setTimeout(() => setBooting(false), seenBoot ? 0 : 650);
    const clock = window.setInterval(() => setTime(new Date()), 30000);
    const resize = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", resize);
    return () => {
      clearTimeout(boot);
      clearInterval(clock);
      window.removeEventListener("resize", resize);
    };
  }, []);
  useEffect(() => {
    if (applications.some((app) => app.id === initialApp))
      open(initialApp as AppId);
    // Open on app-query changes, not on resize; collection-query changes are
    // independently reflected by atlasCollection without reopening the window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialApp]);
  useEffect(() => {
    document.title = active
      ? `${appById[active.id].name} · Haonan Li`
      : "Haonan Li · Personal Desktop";
  }, [active]);
  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);
  const copyAppLink = async (id: AppId) => {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("app", id);
    try {
      await navigator.clipboard.writeText(url.toString());
      setToastMessage("已复制当前 APP 的链接");
    } catch {
      setToastMessage("未能复制，请从地址栏复制网址，并加上 ?app=" + id);
    }
  };
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
    if (compactIcons || event.button !== 0 || !shortcutsRef.current) return;
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
    switch (id) {
      case "profile":
        return <StudioProfile open={open} />;
      case "resume":
        return <BiographyApp open={open} />;
      case "projects":
        return <WorkshopApp open={open} onSectionChange={setProjectTitle} />;
      case "games":
        return <HerdingCatsApp active={active?.id === "games"} />;
      case "source":
        return <StudioSource />;
      case "connect":
        return <StudioContact />;
      case "notes":
        return <NotesApp />;
      case "photos":
        return (
          <PhotographyApp
            favorites={favorites}
            toggleFavorite={toggleFavorite}
            favoritesSaved={favoritesSaved}
            favoritesRecovery={favoritesRecovery}
          />
        );
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
            favoritesSaved={favoritesSaved}
            favoritesRecovery={favoritesRecovery}
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
        className={`leo-desktop studio-v2 ${active ? "has-open-app" : ""} ${expanded ? "has-expanded-app" : ""} ${welcome ? "has-welcome-note" : ""}`}
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
        <header className="menubar" {...backgroundInert}>
          <button className="menu-brand" onClick={() => open("profile")}>
            Haonan Li
          </button>
          <div className="menubar-right">
            <button
              title="桌面指南"
              aria-label="桌面指南"
              aria-haspopup="dialog"
              onClick={(event) => showSurface("guide", event.currentTarget)}
            >
              <Compass size={16} />
            </button>
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
              ref={searchTriggerRef}
              aria-haspopup="dialog"
              onClick={(event) => showSurface("search", event.currentTarget)}
            >
              <Search size={16} />
            </button>
            <button
              title="控制中心"
              aria-label="控制中心"
              aria-expanded={panel === "settings"}
              aria-haspopup="dialog"
              aria-controls={panel === "settings" ? panelId : undefined}
              onClick={(event) =>
                panel === "settings"
                  ? hideSurface()
                  : showSurface("settings", event.currentTarget)
              }
            >
              <SlidersHorizontal size={16} />
            </button>
            <button
              className="menu-clock"
              aria-label="日历"
              aria-expanded={panel === "calendar"}
              aria-haspopup="dialog"
              aria-controls={panel === "calendar" ? panelId : undefined}
              onClick={(event) =>
                panel === "calendar"
                  ? hideSurface()
                  : showSurface("calendar", event.currentTarget)
              }
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
        {welcome && !active && (
          <aside className="desktop-welcome">
            <button
              className="welcome-close"
              aria-label="收起欢迎卡片"
              onClick={() => setWelcome(false)}
            >
              <X size={14} />
            </button>
            <span>HAONAN'S PERSONAL DESKTOP</span>
            <h2>欢迎，随便坐。</h2>
            <p>一些生活收藏，和几个可以玩的小世界。</p>
            <div>
              <button onClick={() => open("profile")}>
                先认识我 <ArrowUpRight size={14} />
              </button>
              <button
                onClick={() => {
                  setWelcome(false);
                  open("cats");
                }}
              >
                看看沙盘 <ArrowUpRight size={14} />
              </button>
            </div>
          </aside>
        )}
        <div
          ref={shortcutsRef}
          className="desktop-shortcuts"
          aria-label="桌面应用"
          {...backgroundInert}
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
                  style={{ "--icon-scale": app.scale ?? 1 } as CSSProperties}
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
            {...backgroundInert}
            onClick={dismiss}
          />
        )}
        <div
          className={`window-layer ${expanded ? "is-expanded" : ""}`}
          ref={layerRef}
        >
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
                disableDragging={small || maximized}
                enableResizing={false}
                minWidth={Math.min(540, layer.width)}
                minHeight={Math.min(340, layer.height)}
                dragHandleClassName={"window-titlebar"}
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
                  aria-modal={
                    mobileAppOpen && active?.id === id ? true : undefined
                  }
                  aria-label={`${appById[id].name} 窗口`}
                  tabIndex={-1}
                  onFocusCapture={() => {
                    if (active?.id !== id) dispatch({ type: "focus", id });
                  }}
                >
                  <header
                    className="window-titlebar"
                    onDoubleClick={(event) => {
                      if (
                        !small &&
                        !(event.target as HTMLElement).closest("button")
                      )
                        dispatch({ type: "maximize", id });
                    }}
                  >
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
                        onClick={dismiss}
                      >
                        <Minus size={9} />
                      </button>
                      {!small && (
                        <button
                          className="traffic-maximize"
                          title={maximized ? "还原窗口" : "放大窗口"}
                          aria-label={maximized ? "还原窗口" : "放大窗口"}
                          aria-pressed={maximized}
                          onClick={() => dispatch({ type: "maximize", id })}
                        >
                          {maximized ? (
                            <Minimize2 size={8} />
                          ) : (
                            <Maximize2 size={8} />
                          )}
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
                    <div className="window-actions">
                      <button
                        className="icon-button window-share"
                        title="复制 APP 链接"
                        aria-label="复制 APP 链接"
                        onClick={() => void copyAppLink(id)}
                      >
                        <Copy size={15} />
                      </button>
                      <button
                        className="window-home icon-button"
                        title="回到桌面"
                        aria-label="回到桌面"
                        onClick={dismiss}
                      >
                        <Home size={17} />
                      </button>
                    </div>
                  </header>
                  <div
                    className={`window-content ${["profile", "resume", "source", "connect"].includes(id) ? "padded" : ""}`}
                  >
                    <AppBoundary name={appById[id].name} onBack={dismiss}>
                      <Suspense
                        fallback={
                          <div className="studio-app-loading" role="status">
                            <span>{appById[id].name}</span>
                            <p>正在打开这个小空间…</p>
                          </div>
                        }
                      >
                        {renderApp(id)}
                      </Suspense>
                    </AppBoundary>
                  </div>
                </section>
              </Rnd>
            );
          })}
        </div>
        <button
          className="companion-toggle"
          {...backgroundInert}
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
        <nav
          className="desktop-dock"
          aria-label="应用程序坞"
          {...backgroundInert}
        >
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
            ref={panelRef}
            id={panelId}
            className="desktop-popover"
            role="dialog"
            tabIndex={-1}
            aria-label={panel === "settings" ? "控制中心" : "日历"}
          >
            {panel === "settings" ? (
              <>
                <h2>控制中心</h2>
                <p className="settings-caption">按你的心情，布置这张桌面。</p>
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
                  onClick={() => {
                    setWelcome(true);
                    hideSurface();
                  }}
                >
                  再次显示欢迎卡片
                </button>
                {(!settingsSaved || !layoutSaved || !welcomeSaved) && (
                  <p className="settings-storage-warning" role="status">
                    {desktopStorageMessage}
                  </p>
                )}
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
            <button
              className="desktop-popover-close"
              aria-label={panel === "settings" ? "关闭控制中心" : "关闭日历"}
              onClick={() => hideSurface()}
            >
              <X size={16} />
            </button>
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
        <Dialog.Root
          open={spotlight}
          onOpenChange={(next) => {
            if (!next && surfaceRef.current === "search") hideSurface();
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="spotlight-overlay" />
            <Dialog.Content
              className="spotlight-panel"
              aria-describedby={undefined}
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                searchInputRef.current?.focus();
              }}
              onCloseAutoFocus={restoreSurfaceFocus}
              onEscapeKeyDown={guardDialogEscape}
            >
              <Dialog.Title className="sr-only">搜索桌面应用</Dialog.Title>
              <label>
                <Search size={23} />
                <input
                  ref={searchInputRef}
                  role="combobox"
                  aria-label="搜索桌面应用"
                  aria-expanded="true"
                  aria-autocomplete="list"
                  aria-controls={searchListId}
                  aria-activedescendant={selectedSearchId}
                  autoComplete="off"
                  placeholder="搜索桌面应用..."
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setSearchIndex(0);
                  }}
                  onKeyDown={(event) => {
                    if (
                      isComposingKey(event.nativeEvent) ||
                      event.altKey ||
                      event.ctrlKey ||
                      event.metaKey ||
                      event.shiftKey
                    )
                      return;
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setSearchIndex((index) =>
                        matchingApps.length
                          ? (index + 1) % matchingApps.length
                          : 0,
                      );
                    }
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setSearchIndex((index) =>
                        matchingApps.length
                          ? (index - 1 + matchingApps.length) %
                            matchingApps.length
                          : 0,
                      );
                    }
                    if (event.key === "Enter" && selectedSearchApp) {
                      event.preventDefault();
                      if (!event.repeat) open(selectedSearchApp.id);
                    }
                  }}
                />
              </label>
              <div
                id={searchListId}
                className="spotlight-results"
                role="listbox"
                aria-label="应用搜索结果"
              >
                {matchingApps.map((app, index) => (
                  <button
                    key={app.id}
                    id={`${searchListId}-${app.id}`}
                    role="option"
                    aria-selected={index === selectedSearchIndex}
                    tabIndex={-1}
                    className={
                      index === selectedSearchIndex ? "search-selected" : ""
                    }
                    onPointerMove={(event) => {
                      if (event.pointerType === "mouse") setSearchIndex(index);
                    }}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => open(app.id)}
                  >
                    {app.glyph === "notes" ? (
                      <NotebookPen
                        className="spotlight-notes-icon"
                        aria-hidden="true"
                      />
                    ) : (
                      <img src={app.icon} alt="" />
                    )}
                    <strong>{app.name}</strong>
                    <span>
                      {appDescriptions[app.id]
                        .split(" ")
                        .slice(0, 2)
                        .join(" · ")}
                    </span>
                  </button>
                ))}
              </div>
              {!matchingApps.length && (
                <p className="spotlight-empty" role="status">
                  没有找到这个 APP。试试“沙盘”“音乐”或“笔记”。
                </p>
              )}
              <footer className="spotlight-hint">
                <span>↑ ↓ 选择 · Enter 打开 · Esc 返回</span>
                <Dialog.Close className="spotlight-close" aria-label="关闭搜索">
                  <X size={16} />
                </Dialog.Close>
              </footer>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <Dialog.Root
          open={helpOpen}
          onOpenChange={(next) => {
            if (!next && surfaceRef.current === "guide") hideSurface();
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="spotlight-overlay" />
            <Dialog.Content
              className="desktop-guide"
              onCloseAutoFocus={restoreSurfaceFocus}
              onEscapeKeyDown={guardDialogEscape}
            >
              <Dialog.Title>这张桌面，怎么逛？</Dialog.Title>
              <Dialog.Description>
                从一个图标开始，也可以按 ⌘ / Ctrl + K 搜索。
              </Dialog.Description>
              <div className="guide-paths">
                <button onClick={() => open("cats")}>
                  <span>想看点有趣的</span>
                  <strong>
                    去工地观察小世界 <ArrowUpRight size={17} />
                  </strong>
                </button>
                <button onClick={() => open("games")}>
                  <span>想动动手</span>
                  <strong>
                    和猫咪玩一会儿 <ArrowUpRight size={17} />
                  </strong>
                </button>
                <button onClick={() => open("atlas")}>
                  <span>想随便翻翻</span>
                  <strong>
                    看看生活收藏 <ArrowUpRight size={17} />
                  </strong>
                </button>
              </div>
              <dl>
                <div>
                  <dt>拖动</dt>
                  <dd>桌面图标可以重新摆放，窗口从标题栏拖动。</dd>
                </div>
                <div>
                  <dt>返回</dt>
                  <dd>右上角小房子回到桌面；红色关闭会结束该 APP。</dd>
                </div>
                <div>
                  <dt>保存</dt>
                  <dd>收藏、便签和设置仅保存在你的浏览器，不会发给作者。</dd>
                </div>
              </dl>
              <Dialog.Close className="guide-close">
                明白了，去逛逛
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        {toastMessage && (
          <div className="desktop-toast" role="status">
            {toastMessage}
          </div>
        )}
      </main>
    </MotionConfig>
  );
}
