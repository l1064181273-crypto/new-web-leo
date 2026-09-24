import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CSSProperties, MouseEventHandler, ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import Desktop from "./Desktop";
import Index from "@/pages/Index";

// Keep the real desktop state, focus handling, routing and Radix dialogs.
// App internals and native window drag geometry are separate suites; these stand-ins avoid
// loading audio, WebGL and unrelated lazy app content in a shell regression.
vi.mock("./CompanionCat", () => ({ default: () => null }));
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  MotionConfig: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      className,
    }: {
      children: ReactNode;
      className: string;
    }) => <div className={className}>{children}</div>,
  },
}));
vi.mock("react-rnd", () => ({
  Rnd: ({
    children,
    className,
    style,
    size,
    position,
    onMouseDown,
  }: {
    children: ReactNode;
    className: string;
    style: CSSProperties;
    size: { width: number; height: number };
    position: { x: number; y: number };
    onMouseDown: MouseEventHandler<HTMLDivElement>;
  }) => (
    <div
      className={className}
      style={style}
      data-size={JSON.stringify(size)}
      data-position={JSON.stringify(position)}
      onMouseDown={onMouseDown}
    >
      {children}
    </div>
  ),
}));
vi.mock("./StudioProfile", () => ({
  default: () => <button>Profile content action</button>,
}));
vi.mock("./StudioAbout", () => ({
  BiographyApp: () => <p>Biography content</p>,
  StudioContact: () => <p>Contact content</p>,
  StudioSource: () => <p>Source content</p>,
}));
vi.mock("./WorkshopApp", () => ({ default: () => <p>Workshop content</p> }));
vi.mock("./GalleryApp", () => ({
  default: ({
    initial,
    favoritesRecovery,
  }: {
    initial: string;
    favoritesRecovery?: { conflict?: boolean };
  }) => (
    <p
      data-testid="atlas-collection"
      data-storage-conflict={Boolean(favoritesRecovery?.conflict)}
    >
      {initial}
    </p>
  ),
}));
vi.mock("./MusicApp", () => ({ default: () => <p>Music content</p> }));
vi.mock("./SandboxApp", () => ({
  default: ({ active }: { active: boolean }) => (
    <p data-testid="sandbox-active">{String(active)}</p>
  ),
}));
vi.mock("./HerdingCatsApp", () => ({
  default: ({ active }: { active: boolean }) => (
    <p data-testid="games-active">{String(active)}</p>
  ),
}));
vi.mock("./StudioNotes", () => ({
  default: () => (
    <input aria-label="Test note body" defaultValue="saved note" />
  ),
}));
vi.mock("./CollectionApps", () => ({
  PhotographyApp: ({
    favoritesRecovery,
  }: {
    favoritesRecovery?: { conflict?: boolean };
  }) => (
    <p
      data-testid="photo-storage"
      data-storage-conflict={Boolean(favoritesRecovery?.conflict)}
    >
      Photography content
    </p>
  ),
  DaybookApp: () => <p>Daybook content</p>,
  CinemaApp: () => <p>Cinema content</p>,
  TableStoriesApp: () => <p>Table stories content</p>,
}));

const initialViewport = {
  width: window.innerWidth,
  height: window.innerHeight,
};
const settle = async () => {
  await act(async () => {
    await Promise.resolve();
    vi.advanceTimersByTime(30);
  });
};
const startDesktop = async (props: Parameters<typeof Desktop>[0] = {}) => {
  const view = render(<Desktop {...props} />);
  await settle();
  return view;
};
const shortcut = (id: string) => {
  const button = document.querySelector<HTMLButtonElement>(
    `.desktop-shortcut.shortcut-${id}`,
  );
  if (!button) throw new Error("Missing desktop shortcut: " + id);
  return button;
};
const searchInput = () =>
  screen.getByLabelText("搜索桌面应用", { selector: "input" });

class IconPointerEvent extends MouseEvent {
  readonly pointerId: number;

  constructor(type: string, options: PointerEventInit = {}) {
    super(type, options);
    this.pointerId = options.pointerId ?? 1;
  }
}

function mockIconGeometry(button: HTMLButtonElement) {
  const bounds = (left: number, top: number, width: number, height: number): DOMRect => ({
    x: left, y: top, left, top, width, height,
    right: left + width, bottom: top + height,
    toJSON: () => ({}),
  });
  const container = document.querySelector<HTMLElement>(".desktop-shortcuts")!;
  vi.spyOn(container, "getBoundingClientRect").mockReturnValue(bounds(40, 80, 1000, 600));
  vi.spyOn(button, "getBoundingClientRect").mockReturnValue(bounds(140, 140, 100, 100));
  const captured = new Set<number>();
  const capture = vi.fn((id: number) => { captured.add(id); });
  const release = vi.fn((id: number) => { captured.delete(id); });
  Object.defineProperties(button, {
    offsetWidth: { configurable: true, value: 100 },
    offsetHeight: { configurable: true, value: 100 },
    setPointerCapture: { configurable: true, value: capture },
    hasPointerCapture: { configurable: true, value: (id: number) => captured.has(id) },
    releasePointerCapture: { configurable: true, value: release },
  });
  return { capture, release };
}

function dragIcon(button: HTMLButtonElement) {
  fireEvent.pointerDown(button, { button: 0, pointerId: 7, clientX: 180, clientY: 180 });
  fireEvent.pointerMove(button, { pointerId: 7, clientX: 320, clientY: 270 });
  fireEvent.pointerUp(button, { button: 0, pointerId: 7, clientX: 320, clientY: 270 });
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.sessionStorage.setItem("leo-studio-boot-v2", "seen");
  window.history.replaceState(null, "", "/");
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: 1280,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: 900,
  });
  vi.useFakeTimers();
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) =>
    window.setTimeout(() => callback(performance.now()), 0),
  );
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) =>
    window.clearTimeout(id),
  );
});

afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/");
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: initialViewport.width,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: initialViewport.height,
  });
});

describe("desktop shell lifecycle", () => {
  it.each(["deep link", "shortcut"])("opens a new game maximized from a %s and still supports restoring and enlarging it", async (entry) => {
    await startDesktop(entry === "deep link" ? { initialApp: "games" } : {});
    if (entry === "shortcut") {
      fireEvent.click(shortcut("games"));
      await settle();
    }
    const game = screen.getByRole("dialog", { name: "Herding Cats 窗口" });
    const windowFrame = game.parentElement!;
    const expandedSize = JSON.stringify({ width: 1280, height: 852 });
    expect(windowFrame).toHaveAttribute("data-size", expandedSize);
    expect(windowFrame).toHaveAttribute("data-position", JSON.stringify({ x: 0, y: 0 }));
    expect(screen.getByRole("button", { name: "还原窗口" })).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector(".window-layer")).toHaveClass("is-expanded");

    fireEvent.click(screen.getByRole("button", { name: "还原窗口" }));
    const restoredSize = JSON.stringify({ width: 1000, height: 680 });
    expect(windowFrame).toHaveAttribute("data-size", restoredSize);
    expect(screen.getByRole("button", { name: "放大窗口" })).toHaveAttribute("aria-pressed", "false");
    expect(document.querySelector(".window-layer")).not.toHaveClass("is-expanded");

    // Reopening an existing minimized window retains the user's choice;
    // default maximization applies to a newly created game window.
    fireEvent.click(screen.getByRole("button", { name: "收起窗口" }));
    await settle();
    fireEvent.click(shortcut("games"));
    await settle();
    expect(windowFrame).toHaveAttribute("data-size", restoredSize);
    fireEvent.click(screen.getByRole("button", { name: "放大窗口" }));
    expect(windowFrame).toHaveAttribute("data-size", expandedSize);
    expect(screen.getByRole("button", { name: "还原窗口" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "关闭窗口" }));
    await settle();
    fireEvent.click(shortcut("games"));
    await settle();
    expect(screen.getByRole("button", { name: "还原窗口" })).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelectorAll(".app-games")).toHaveLength(1);
  });

  it("keeps every other application's first window unmaximized", async () => {
    const view = await startDesktop();
    for (const id of ["profile", "resume", "projects", "photos", "daily", "music", "cinema", "food", "atlas", "notes", "source", "connect", "cats"]) {
      view.rerender(<Desktop initialApp={id} />);
      await settle();
      expect(document.querySelector(`.app-${id}`)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "放大窗口" })).toHaveAttribute("aria-pressed", "false");
      expect(screen.queryByRole("button", { name: "还原窗口" })).not.toBeInTheDocument();
      expect(document.querySelector(".window-layer")).not.toHaveClass("is-expanded");
    }
  });

  it("explains external desktop-setting conflicts without overwriting the newer settings", async () => {
    await startDesktop();
    const key = "leo-desktop-settings-v1";
    const latest = JSON.stringify({
      companion: false,
      wallpaper: "sea",
      dim: 0.2,
    });
    act(() => {
      localStorage.setItem(key, latest);
      window.dispatchEvent(
        new StorageEvent("storage", {
          key,
          newValue: latest,
          storageArea: localStorage,
        }),
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "控制中心" }));
    await settle();
    expect(screen.getByRole("status")).toHaveTextContent(
      "其他窗口更改了桌面设置或布局",
    );
    expect(screen.getByRole("status")).toHaveTextContent("导出未保存的便签");
    fireEvent.click(screen.getByRole("button", { name: "暮色苍山" }));
    expect(localStorage.getItem(key)).toBe(latest);
    expect(screen.getByRole("button", { name: "暮色苍山" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("passes the same conflict state to both shared favorite applications", async () => {
    await startDesktop({ initialApp: "atlas" });
    expect(screen.getByTestId("atlas-collection")).toHaveAttribute(
      "data-storage-conflict",
      "false",
    );
    const key = "leo-desktop-favorites-v1";
    const latest = JSON.stringify(["photo-10.jpg"]);
    act(() => {
      localStorage.setItem(key, latest);
      window.dispatchEvent(
        new StorageEvent("storage", {
          key,
          newValue: latest,
          storageArea: localStorage,
        }),
      );
    });
    expect(screen.getByTestId("atlas-collection")).toHaveAttribute(
      "data-storage-conflict",
      "true",
    );
    fireEvent.click(shortcut("photos"));
    await settle();
    expect(screen.getByTestId("photo-storage")).toHaveAttribute(
      "data-storage-conflict",
      "true",
    );
    expect(localStorage.getItem(key)).toBe(latest);
  });

  it("keeps an app's state when minimized, restores a single instance, and resets it on close", async () => {
    await startDesktop({ initialApp: "notes" });
    const input = screen.getByLabelText("Test note body");
    fireEvent.change(input, { target: { value: "in-progress note" } });
    fireEvent.click(screen.getByRole("button", { name: "收起窗口" }));
    await settle();
    expect(
      screen.queryByRole("dialog", { name: "Field Notes 窗口" }),
    ).not.toBeInTheDocument();
    expect(document.activeElement).toBe(shortcut("notes"));
    fireEvent.click(shortcut("notes"));
    await settle();
    expect(screen.getByLabelText("Test note body")).toHaveValue(
      "in-progress note",
    );
    expect(document.querySelectorAll(".app-notes")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "关闭窗口" }));
    await settle();
    expect(document.querySelector(".app-notes")).toBeNull();
    expect(document.activeElement).toBe(shortcut("notes"));
    fireEvent.click(shortcut("notes"));
    await settle();
    expect(screen.getByLabelText("Test note body")).toHaveValue("saved note");
  });

  it("retains restored geometry through maximize and minimize, but not after closing", async () => {
    await startDesktop({ initialApp: "projects" });
    const original = document
      .querySelector(".app-projects")!
      .parentElement!.getAttribute("data-size");
    fireEvent.click(screen.getByRole("button", { name: "放大窗口" }));
    expect(screen.getByRole("button", { name: "还原窗口" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(document.querySelector(".window-layer")).toHaveClass("is-expanded");
    fireEvent.click(screen.getByRole("button", { name: "收起窗口" }));
    await settle();
    fireEvent.click(shortcut("projects"));
    await settle();
    expect(screen.getByRole("button", { name: "还原窗口" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "还原窗口" }));
    expect(
      document.querySelector(".app-projects")!.parentElement,
    ).toHaveAttribute("data-size", original);
    fireEvent.click(screen.getByRole("button", { name: "关闭窗口" }));
    fireEvent.click(shortcut("projects"));
    await settle();
    expect(screen.getByRole("button", { name: "放大窗口" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("ignores an unknown app and responds to valid app changes from the router", async () => {
    const view = await startDesktop({ initialApp: "not-an-app" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    view.rerender(<Desktop initialApp="notes" />);
    await settle();
    expect(
      screen.getByRole("dialog", { name: "Field Notes 窗口" }),
    ).toBeInTheDocument();
    view.rerender(<Desktop initialApp="games" />);
    await settle();
    expect(
      screen.getByRole("dialog", { name: "Herding Cats 窗口" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("games-active")).toHaveTextContent("true");
    expect(
      screen.queryByRole("dialog", { name: "Field Notes 窗口" }),
    ).not.toBeInTheDocument();
  });
});

describe("desktop icon drag breakpoints", () => {
  beforeEach(() => { vi.stubGlobal("PointerEvent", IconPointerEvent); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it.each([768, 1024, 1099])("does not move or persist an icon at %d px, while ordinary clicks still open its app", async (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
    await startDesktop();
    const icon = shortcut("projects");
    const { capture } = mockIconGeometry(icon);
    const key = "leo-desktop-icon-layout-v1";
    const original = localStorage.getItem(key);
    const position = [icon.style.getPropertyValue("--x"), icon.style.getPropertyValue("--y")];
    const writes = vi.spyOn(Storage.prototype, "setItem");

    dragIcon(icon);
    expect(capture).not.toHaveBeenCalled();
    expect(icon).not.toHaveAttribute("data-dragging");
    expect(icon.style.left).toBe("");
    expect(icon.style.top).toBe("");
    expect([icon.style.getPropertyValue("--x"), icon.style.getPropertyValue("--y")]).toEqual(position);
    expect(localStorage.getItem(key)).toBe(original);
    expect(writes.mock.calls.filter(([storageKey]) => storageKey === key)).toHaveLength(0);

    // PointerEvent simulation does not synthesize the browser's native click.
    fireEvent.click(icon);
    await settle();
    expect(screen.getByRole("dialog", { name: "Projects 窗口" })).toBeInTheDocument();
    expect(localStorage.getItem(key)).toBe(original);
  });

  it.each([1100, 1280])("keeps wide-desktop icon dragging and persistence available at %d px", async (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
    await startDesktop();
    const icon = shortcut("projects");
    const { capture, release } = mockIconGeometry(icon);
    const key = "leo-desktop-icon-layout-v1";
    const original = JSON.parse(localStorage.getItem(key)!);
    dragIcon(icon);
    expect(capture).toHaveBeenCalledExactlyOnceWith(7);
    expect(release).toHaveBeenCalledExactlyOnceWith(7);
    expect(icon).not.toHaveAttribute("data-dragging");
    expect(icon.style.left).toBe("");
    expect(icon.style.top).toBe("");
    // Controlled geometry: (100 + 140) / 1000 and (60 + 90) / 600.
    expect(icon.style.getPropertyValue("--x")).toBe("24%");
    expect(icon.style.getPropertyValue("--y")).toBe("25%");
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ ...original, projects: { x: 24, y: 25 } });
    fireEvent.click(icon);
    expect(screen.queryByRole("dialog", { name: "Projects 窗口" })).not.toBeInTheDocument();
    await settle();
    fireEvent.click(icon);
    await settle();
    expect(screen.getByRole("dialog", { name: "Projects 窗口" })).toBeInTheDocument();
  });

  it("preserves saved scatter coordinates across compact breakpoints and a fresh mount", async () => {
    const key = "leo-desktop-icon-layout-v1";
    const saved = JSON.stringify({ projects: { x: 36.5, y: 26.25 }, source: { x: 85, y: 70 } });
    localStorage.setItem(key, saved);
    const view = await startDesktop();
    for (const width of [1024, 768, 1099, 1100, 1280]) {
      Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
      fireEvent.resize(window);
      await settle();
      expect(localStorage.getItem(key)).toBe(saved);
      expect(shortcut("projects").style.getPropertyValue("--x")).toBe("36.5%");
      expect(shortcut("projects").style.getPropertyValue("--y")).toBe("26.25%");
      expect(shortcut("source").style.getPropertyValue("--x")).toBe("85%");
      expect(shortcut("source").style.getPropertyValue("--y")).toBe("70%");
    }
    view.unmount();
    await startDesktop();
    expect(localStorage.getItem(key)).toBe(saved);
    expect(shortcut("projects").style.getPropertyValue("--x")).toBe("36.5%");
    expect(shortcut("projects").style.getPropertyValue("--y")).toBe("26.25%");
    // CSS grid placement, welcome-card clearance and real hit testing remain
    // browser checks; jsdom verifies that responsive state does not erase data.
  });
});

describe("desktop shell accessibility regressions", () => {
  it("removes covered desktop shortcuts from keyboard navigation in the mobile fullscreen app", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 390,
    });
    await startDesktop({ initialApp: "notes" });
    expect(
      screen.queryByRole("button", { name: "放大窗口" }),
    ).not.toBeInTheDocument();
    const background =
      document.querySelector<HTMLElement>(".desktop-shortcuts")!;
    const unavailable =
      background.hidden ||
      background.hasAttribute("inert") ||
      Array.from(background.querySelectorAll("button")).every(
        (button) => button.disabled || button.tabIndex < 0,
      );
    expect(unavailable).toBe(true);
  });

  it("closes only Control Center when Escape is pressed over an active app", async () => {
    await startDesktop({ initialApp: "notes" });
    fireEvent.click(screen.getByRole("button", { name: "控制中心" }));
    fireEvent.keyDown(screen.getByRole("slider", { name: "桌面亮度" }), {
      key: "Escape",
    });
    await settle();
    expect(
      screen.queryByRole("dialog", { name: "控制中心" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "Field Notes 窗口" }),
    ).toBeInTheDocument();
  });

  it("moves focus into the opened Control Center rather than leaving it behind the dialog", async () => {
    await startDesktop();
    const trigger = screen.getByRole("button", { name: "控制中心" });
    trigger.focus();
    fireEvent.click(trigger);
    await settle();
    expect(
      screen
        .getByRole("dialog", { name: "控制中心" })
        .contains(document.activeElement),
    ).toBe(true);
  });

  it("does not minimize a note while Escape is cancelling a Chinese IME composition", async () => {
    await startDesktop({ initialApp: "notes" });
    const input = screen.getByLabelText("Test note body");
    input.focus();
    fireEvent.keyDown(input, {
      key: "Escape",
      keyCode: 229,
      isComposing: true,
    });
    await settle();
    expect(
      screen.getByRole("dialog", { name: "Field Notes 窗口" }),
    ).toBeInTheDocument();
  });

  it("does not launch an app when Enter is confirming a Chinese search composition", async () => {
    await startDesktop();
    fireEvent.click(screen.getByRole("button", { name: "搜索应用" }));
    await settle();
    const input = searchInput();
    fireEvent.change(input, { target: { value: "沙盘" } });
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229, isComposing: true });
    await settle();
    expect(
      screen.getByRole("dialog", { name: "搜索桌面应用" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Little Works 窗口" }),
    ).not.toBeInTheDocument();
  });

  it("returns focus to the search trigger when dismissed on the bare desktop", async () => {
    await startDesktop();
    const trigger = screen.getByRole("button", { name: "搜索应用" });
    trigger.focus();
    fireEvent.click(trigger);
    await settle();
    expect(document.activeElement).toBe(searchInput());
    fireEvent.keyDown(searchInput(), { key: "Escape" });
    await settle();
    expect(document.activeElement).toBe(trigger);
  });

  it("returns to the note input that invoked command search instead of the app container", async () => {
    await startDesktop({ initialApp: "notes" });
    const input = screen.getByLabelText("Test note body");
    input.focus();
    fireEvent.keyDown(input, { key: "k", ctrlKey: true });
    await settle();
    fireEvent.keyDown(searchInput(), { key: "Escape" });
    await settle();
    expect(document.activeElement).toBe(input);
  });

  it("exposes the arrow-key selection through a combobox and selected option", async () => {
    await startDesktop();
    fireEvent.click(screen.getByRole("button", { name: "搜索应用" }));
    await settle();
    const input = searchInput();
    expect(input).toHaveAttribute("role", "combobox");
    const listId = input.getAttribute("aria-controls");
    expect(listId).toBeTruthy();
    expect(document.getElementById(listId!)).toHaveAttribute("role", "listbox");
    const first = input.getAttribute("aria-activedescendant");
    expect(first).toBeTruthy();
    expect(document.getElementById(first!)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const next = input.getAttribute("aria-activedescendant");
    expect(next).toBeTruthy();
    expect(next).not.toBe(first);
    expect(document.getElementById(next!)).toHaveAttribute("role", "option");
    expect(document.getElementById(next!)).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("switches from the guide to command search without leaving two modal surfaces open", async () => {
    await startDesktop();
    fireEvent.click(screen.getByRole("button", { name: "桌面指南" }));
    await settle();
    const guide = screen.getByRole("dialog", { name: "这张桌面，怎么逛？" });
    fireEvent.keyDown(
      within(guide).getByRole("button", { name: "明白了，去逛逛" }),
      { key: "k", ctrlKey: true },
    );
    await settle();
    expect(document.querySelector(".spotlight-panel")).toBeInTheDocument();
    expect(document.querySelector(".desktop-guide")).not.toBeInTheDocument();
  });

  it("keeps command search open when the shortcut repeats during a held key", async () => {
    await startDesktop();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    await settle();
    fireEvent.keyDown(searchInput(), { key: "k", ctrlKey: true, repeat: true });
    await settle();
    expect(
      screen.getByRole("dialog", { name: "搜索桌面应用" }),
    ).toBeInTheDocument();
  });

  it("updates the atlas collection when browser history changes only the collection query", async () => {
    window.history.replaceState(null, "", "/?app=atlas&collection=photos");
    render(
      <BrowserRouter>
        <Index />
      </BrowserRouter>,
    );
    await settle();
    expect(screen.getByTestId("atlas-collection")).toHaveTextContent("photos");
    window.history.pushState(null, "", "/?app=atlas&collection=films");
    fireEvent.popState(window);
    await settle();
    expect(screen.getByTestId("atlas-collection")).toHaveTextContent("films");
  });

  it("keeps desktop windows nonmodal and does not intercept native Tab keys", async () => {
    await startDesktop({ initialApp: "notes" });
    const app = screen.getByRole("dialog", { name: "Field Notes 窗口" });
    expect(app).not.toHaveAttribute("aria-modal", "true");
    for (const selector of [
      ".menubar",
      ".desktop-shortcuts",
      ".desktop-dock",
      ".companion-toggle",
    ]) {
      expect(document.querySelector(selector)).not.toHaveAttribute("inert");
    }
    const input = screen.getByLabelText("Test note body");
    input.focus();
    expect(fireEvent.keyDown(input, { key: "Tab" })).toBe(true);
    expect(fireEvent.keyDown(input, { key: "Tab", shiftKey: true })).toBe(true);
    shortcut("source").focus();
    await settle();
    expect(document.activeElement).toBe(shortcut("source"));
    expect(app).toBeInTheDocument();
    // Native Tab traversal itself remains a real-browser QA item: jsdom does
    // not perform the browser's default keyboard focus-navigation algorithm.
  });

  it("restores mobile background access when the fullscreen app is minimized", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 390,
    });
    await startDesktop({ initialApp: "notes" });
    expect(
      screen.getByRole("dialog", { name: "Field Notes 窗口" }),
    ).toHaveAttribute("aria-modal", "true");
    for (const selector of [
      ".menubar",
      ".desktop-shortcuts",
      ".desktop-dock",
      ".companion-toggle",
    ]) {
      expect(document.querySelector(selector)).toHaveAttribute("inert");
    }
    fireEvent.click(screen.getByRole("button", { name: "回到桌面" }));
    await settle();
    expect(document.querySelector(".desktop-shortcuts")).not.toHaveAttribute(
      "inert",
    );
    expect(document.activeElement).toBe(shortcut("notes"));
  });

  it("dismisses a covered menubar panel when resizing into mobile fullscreen", async () => {
    await startDesktop({ initialApp: "notes" });
    fireEvent.click(screen.getByRole("button", { name: "控制中心" }));
    await settle();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 390,
    });
    fireEvent.resize(window);
    await settle();
    expect(
      screen.queryByRole("dialog", { name: "控制中心" }),
    ).not.toBeInTheDocument();
    const app = screen.getByRole("dialog", { name: "Field Notes 窗口" });
    expect(app.contains(document.activeElement)).toBe(true);
    expect(document.querySelector(".menubar")).toHaveAttribute("inert");
  });

  it.each([
    {
      query: "Profile",
      title: "Profile 窗口",
      id: "profile",
      activation: "Enter",
    },
    {
      query: "Profile",
      title: "Profile 窗口",
      id: "profile",
      activation: "click",
    },
    {
      query: "Field Notes",
      title: "Field Notes 窗口",
      id: "notes",
      activation: "Enter",
    },
  ])(
    "focuses $id after search launches it by $activation, including an already-active app",
    async ({ query, title, id, activation }) => {
      await startDesktop({ initialApp: "notes" });
      const original = screen.getByLabelText("Test note body");
      original.focus();
      fireEvent.keyDown(original, { key: "k", ctrlKey: true });
      await settle();
      fireEvent.change(searchInput(), { target: { value: query } });
      if (activation === "Enter")
        fireEvent.keyDown(searchInput(), { key: "Enter" });
      else
        fireEvent.click(
          screen.getByRole("option", { name: new RegExp(query) }),
        );
      await settle();
      expect(
        screen.queryByRole("dialog", { name: "搜索桌面应用" }),
      ).not.toBeInTheDocument();
      expect(
        screen
          .getByRole("dialog", { name: title })
          .contains(document.activeElement),
      ).toBe(true);
      expect(document.querySelectorAll(`.app-${id}`)).toHaveLength(1);
    },
  );

  it("preserves a connected guide invoker through a guide-to-search replacement", async () => {
    await startDesktop();
    const trigger = screen.getByRole("button", { name: "桌面指南" });
    trigger.focus();
    fireEvent.click(trigger);
    await settle();
    fireEvent.keyDown(document.activeElement!, { key: "k", ctrlKey: true });
    await settle();
    expect(document.activeElement).toBe(searchInput());
    fireEvent.keyDown(searchInput(), { key: "Escape" });
    await settle();
    expect(document.activeElement).toBe(trigger);
  });

  it("switches a nonmodal panel to search without its old outside-focus listener closing search", async () => {
    await startDesktop({ initialApp: "notes" });
    const trigger = screen.getByRole("button", { name: "控制中心" });
    trigger.focus();
    fireEvent.click(trigger);
    await settle();
    fireEvent.keyDown(screen.getByRole("slider", { name: "桌面亮度" }), {
      key: "k",
      ctrlKey: true,
    });
    await settle();
    expect(
      screen.queryByRole("dialog", { name: "控制中心" }),
    ).not.toBeInTheDocument();
    expect(document.activeElement).toBe(searchInput());
    fireEvent.keyDown(searchInput(), { key: "Escape" });
    await settle();
    expect(document.activeElement).toBe(trigger);
    expect(
      screen.getByRole("dialog", { name: "Field Notes 窗口" }),
    ).toBeInTheDocument();
  });

  it("focuses the calendar and restores its trigger without closing the underlying app", async () => {
    await startDesktop({ initialApp: "notes" });
    const trigger = screen.getByRole("button", { name: "日历" });
    trigger.focus();
    fireEvent.click(trigger);
    await settle();
    expect(document.activeElement).toBe(
      screen.getByRole("dialog", { name: "日历" }),
    );
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await settle();
    expect(
      screen.queryByRole("dialog", { name: "日历" }),
    ).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
    expect(
      screen.getByRole("dialog", { name: "Field Notes 窗口" }),
    ).toBeInTheDocument();
  });

  it("dismisses a panel on outside focus without stealing the user's destination", async () => {
    await startDesktop({ initialApp: "notes" });
    fireEvent.click(screen.getByRole("button", { name: "控制中心" }));
    await settle();
    const note = screen.getByLabelText("Test note body");
    act(() => note.focus());
    await settle();
    expect(
      screen.queryByRole("dialog", { name: "控制中心" }),
    ).not.toBeInTheDocument();
    expect(document.activeElement).toBe(note);
  });

  it("keeps Radix search modal focus contained until dismissal", async () => {
    await startDesktop({ initialApp: "notes" });
    const note = screen.getByLabelText("Test note body");
    fireEvent.click(screen.getByRole("button", { name: "搜索应用" }));
    await settle();
    const dialog = screen.getByRole("dialog", { name: "搜索桌面应用" });
    act(() => note.focus());
    await settle();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("clears accessible selection for empty results and safely restores the first option", async () => {
    await startDesktop();
    fireEvent.click(screen.getByRole("button", { name: "搜索应用" }));
    await settle();
    const input = searchInput();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.change(input, { target: { value: "not a matching app" } });
    expect(input).not.toHaveAttribute("aria-activedescendant");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    for (const key of ["ArrowUp", "ArrowDown", "Enter"])
      fireEvent.keyDown(input, { key });
    expect(
      screen.getByRole("dialog", { name: "搜索桌面应用" }),
    ).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getAllByRole("option")[0]).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(input.getAttribute("aria-activedescendant")).toBe(
      screen.getAllByRole("option")[0].id,
    );
  });

  it("scrolls the selected result into view and retains Home/End for text editing", async () => {
    const originalScroll = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollIntoView",
    );
    const scroll = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scroll,
    });
    try {
      await startDesktop();
      fireEvent.click(screen.getByRole("button", { name: "搜索应用" }));
      await settle();
      const input = searchInput();
      fireEvent.keyDown(input, { key: "ArrowUp" });
      const options = screen.getAllByRole("option");
      expect(options.at(-1)).toHaveAttribute("aria-selected", "true");
      expect(scroll).toHaveBeenLastCalledWith({
        block: "nearest",
        inline: "nearest",
      });
      expect(scroll.mock.contexts.at(-1)).toBe(options.at(-1));
      expect(fireEvent.keyDown(input, { key: "Home" })).toBe(true);
      expect(fireEvent.keyDown(input, { key: "End" })).toBe(true);
      expect(options.at(-1)).toHaveAttribute("aria-selected", "true");
      fireEvent.keyDown(input, { key: "ArrowDown" });
      expect(options[0]).toHaveAttribute("aria-selected", "true");
    } finally {
      if (originalScroll)
        Object.defineProperty(
          HTMLElement.prototype,
          "scrollIntoView",
          originalScroll,
        );
      else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }
  });

  it("ignores composing or repeating Escape on the modal and preserves the app after a normal dismissal", async () => {
    await startDesktop({ initialApp: "notes" });
    const note = screen.getByLabelText("Test note body");
    note.focus();
    fireEvent.keyDown(note, {
      key: "k",
      ctrlKey: true,
      isComposing: true,
      keyCode: 229,
    });
    expect(
      screen.queryByRole("dialog", { name: "搜索桌面应用" }),
    ).not.toBeInTheDocument();
    fireEvent.keyDown(note, { key: "k", ctrlKey: true });
    await settle();
    fireEvent.keyDown(searchInput(), {
      key: "Escape",
      isComposing: true,
      keyCode: 229,
    });
    fireEvent.keyDown(searchInput(), { key: "Escape", repeat: true });
    expect(
      screen.getByRole("dialog", { name: "搜索桌面应用" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(searchInput(), { key: "Escape" });
    await settle();
    expect(
      screen.getByRole("dialog", { name: "Field Notes 窗口" }),
    ).toBeInTheDocument();
    expect(document.activeElement).toBe(note);
    fireEvent.keyDown(note, { key: "Escape", repeat: true });
    expect(
      screen.getByRole("dialog", { name: "Field Notes 窗口" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(note, { key: "Escape" });
    await settle();
    expect(
      screen.queryByRole("dialog", { name: "Field Notes 窗口" }),
    ).not.toBeInTheDocument();
  });

  it("keeps Little Companion searchable while displaying Little Works at the unchanged cats entry", async () => {
    await startDesktop();
    expect(shortcut("cats")).toHaveAccessibleName("打开 Little Works");
    fireEvent.click(screen.getByRole("button", { name: "搜索应用" }));
    await settle();
    fireEvent.change(searchInput(), { target: { value: "Little Companion" } });
    const option = screen.getByRole("option");
    expect(option).toHaveTextContent("Little Works");
    fireEvent.keyDown(searchInput(), { key: "Enter", repeat: true });
    expect(
      screen.getByRole("dialog", { name: "搜索桌面应用" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(searchInput(), { key: "Enter" });
    await settle();
    expect(
      screen.getByRole("dialog", { name: "Little Works 窗口" }),
    ).toHaveClass("app-cats");
  });

  it("validates changed atlas collections and still accepts the old cats deep link", async () => {
    const view = await startDesktop({
      initialApp: "atlas",
      initialCollection: "photos",
    });
    view.rerender(
      <Desktop initialApp="atlas" initialCollection="not-a-collection" />,
    );
    await settle();
    expect(screen.getByTestId("atlas-collection")).toHaveTextContent("all");
    view.rerender(<Desktop initialApp="cats" />);
    await settle();
    expect(
      screen.getByRole("dialog", { name: "Little Works 窗口" }),
    ).toHaveClass("app-cats");
  });
});
