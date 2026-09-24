import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { CSSProperties, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Desktop from "./Desktop";

// Keep real Gallery, Notes and Radix portals: shell-only stand-ins cannot expose
// a modal that survives when its parent app is hidden with display:none.
vi.mock("./CompanionCat", () => ({ default: () => null }));
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  MotionConfig: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: { div: ({ children, className }: { children: ReactNode; className: string }) => <div className={className}>{children}</div> },
}));
vi.mock("react-rnd", () => ({
  Rnd: ({ children, className, style }: { children: ReactNode; className: string; style: CSSProperties }) =>
    <div className={className} style={style}>{children}</div>,
}));

const initialViewport = { width: window.innerWidth, height: window.innerHeight };
const searchInput = () => screen.queryByLabelText("搜索桌面应用", { selector: "input" });
beforeEach(async () => {
  // Resolve Vite's lazy module requests; do not replace the actual app code.
  await import("./GalleryApp");
  await import("./StudioNotes");
  await import("./StudioProfile");
});
const settle = async () => {
  await act(async () => {
    await Promise.resolve();
    vi.advanceTimersByTime(30);
  });
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem("leo-studio-boot-v2", "seen");
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1280 });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 900 });
  vi.useFakeTimers();
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => window.setTimeout(() => callback(performance.now()), 0));
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(id => window.clearTimeout(id));
});

afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: initialViewport.width });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: initialViewport.height });
});

describe("desktop shortcuts over app-owned modals", () => {
  it.each([1280, 390])("keeps the real image viewer as the only modal until it is dismissed at %s px", async width => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
    render(<Desktop initialApp="atlas" initialCollection="photos" />);
    await settle();
    const trigger = screen.getAllByRole("button", { name: /^查看 / })[0];
    trigger.focus();
    fireEvent.click(trigger);
    await settle();
    const viewer = screen.getByRole("dialog", { name: trigger.getAttribute("aria-label")!.replace(/^查看 /, "") });
    expect(viewer).toHaveClass("photo-viewer");
    for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
      fireEvent.keyDown(within(viewer).getByRole("button", { name: "关闭大图" }), { key: "k", ...modifier });
      await settle();
      expect(searchInput()).not.toBeInTheDocument();
      expect(document.querySelector(".photo-viewer")).toBe(viewer);
    }
    fireEvent.keyDown(viewer, { key: "Escape" });
    await settle();
    expect(document.querySelector(".photo-viewer")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
    fireEvent.keyDown(trigger, { key: "k", ctrlKey: true });
    await settle();
    expect(searchInput()).toBeInTheDocument();
    fireEvent.change(searchInput()!, { target: { value: "Profile" } });
    fireEvent.keyDown(searchInput()!, { key: "Enter" });
    await settle();
    expect(screen.getByRole("dialog", { name: "Profile 窗口" })).toBeInTheDocument();
    expect(document.querySelector(".photo-viewer")).not.toBeInTheDocument();
  });

  it("does not put search behind the real permanent-delete confirmation or change notes", async () => {
    const notes = [{ id: "protected", title: "需要保留的便签", body: "仍可恢复", updated: "2026-09-01T00:00:00.000Z", deletedAt: "2026-09-02T00:00:00.000Z" }];
    localStorage.setItem("leo-desktop-notes-v1", JSON.stringify(notes));
    render(<Desktop initialApp="notes" />);
    await settle();
    fireEvent.click(screen.getByRole("button", { name: /最近删除 · 1/ }));
    fireEvent.click(screen.getByRole("button", { name: "永久删除这篇便签" }));
    await settle();
    const dialog = screen.getByRole("alertdialog");
    fireEvent.keyDown(within(dialog).getByRole("button", { name: "取消，保留便签" }), { key: "k", ctrlKey: true });
    await settle();
    expect(searchInput()).not.toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBe(dialog);
    expect(JSON.parse(localStorage.getItem("leo-desktop-notes-v1")!)).toEqual(notes);
    fireEvent.keyDown(dialog, { key: "Escape" });
    await settle();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Field Notes 窗口" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "永久删除这篇便签" }), { key: "k", ctrlKey: true });
    await settle();
    expect(searchInput()).toBeInTheDocument();
  });

  it("keeps the mobile Notes drawer active until its own close action", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 390 });
    vi.spyOn(window, "matchMedia").mockImplementation(query => ({
      matches: query === "(max-width: 720px)", media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    }));
    render(<Desktop initialApp="notes" />);
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "打开便签列表" }));
    await settle();
    const drawer = screen.getByRole("dialog", { name: "Field Notes" });
    fireEvent.keyDown(within(drawer).getByRole("button", { name: "关闭便签列表" }), { key: "k", ctrlKey: true });
    await settle();
    expect(searchInput()).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Field Notes" })).toBe(drawer);
    fireEvent.keyDown(drawer, { key: "Escape" });
    await settle();
    expect(screen.queryByRole("dialog", { name: "Field Notes" })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "打开便签列表" }), { key: "k", ctrlKey: true });
    await settle();
    expect(searchInput()).toBeInTheDocument();
  });
});
