import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HerdingCatsApp from "../desktop/HerdingCatsApp";
import { GARDEN_STORAGE_KEY } from "./engine";

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("local courtyard and preserved original", () => {
  it("only connects to the external game after an explicit load and unloads it when leaving", () => {
    const view = render(<HerdingCatsApp active />);
    expect(screen.queryByTitle("原版 Herding Cats Unity 游戏")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "原版 Herding Cats" }));
    expect(screen.queryByTitle("原版 Herding Cats Unity 游戏")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "载入原版游戏" }));
    expect(screen.getByTitle("原版 Herding Cats Unity 游戏")).toHaveAttribute("src", "https://herding-cats-ten.vercel.app/");
    view.rerender(<HerdingCatsApp active={false} />);
    expect(screen.queryByTitle("原版 Herding Cats Unity 游戏")).not.toBeInTheDocument();
    view.rerender(<HerdingCatsApp active />);
    expect(screen.getByRole("button", { name: "重新载入原版" })).toBeInTheDocument();
  });

  it("offers a retry and source link after a loading error", () => {
    render(<HerdingCatsApp active />);
    fireEvent.click(screen.getByRole("button", { name: "原版 Herding Cats" }));
    fireEvent.click(screen.getByRole("button", { name: "载入原版游戏" }));
    fireEvent.error(screen.getByTitle("原版 Herding Cats Unity 游戏"));
    expect(screen.getByRole("region", { name: "原版 Herding Cats" })).toHaveTextContent("还没有连接上原版");
    expect(screen.getByRole("button", { name: "重新载入原版" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "打开源站" })).toHaveAttribute("href", "https://herding-cats-ten.vercel.app/");
  });

  it("moves keyboard focus into an explicitly loaded frame and back to retry after failure", () => {
    render(<HerdingCatsApp active />);
    fireEvent.click(screen.getByRole("button", { name: "原版 Herding Cats" }));
    fireEvent.click(screen.getByRole("button", { name: "载入原版游戏" }));
    const frame = screen.getByTitle("原版 Herding Cats Unity 游戏");
    expect(document.activeElement).toBe(frame);
    fireEvent.error(frame);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "重新载入原版" }));
    const source = screen.getByRole("region", { name: "原版 Herding Cats" });
    expect(source.querySelector('[role="status"]')).toHaveTextContent("检查网络");
    fireEvent.click(screen.getByRole("button", { name: "重新载入原版" }));
    expect(document.activeElement).toBe(screen.getByTitle("原版 Herding Cats Unity 游戏"));
  });

  it("does not steal focus from the source link if an external error arrives while reading it", () => {
    render(<HerdingCatsApp active />);
    fireEvent.click(screen.getByRole("button", { name: "原版 Herding Cats" }));
    fireEvent.click(screen.getByRole("button", { name: "载入原版游戏" }));
    const link = screen.getAllByRole("link", { name: "打开源站" })[0];
    link.focus();
    fireEvent.error(screen.getByTitle("原版 Herding Cats Unity 游戏"));
    expect(document.activeElement).toBe(link);
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not label an iframe load event as Unity startup completion", () => {
    render(<HerdingCatsApp active />);
    fireEvent.click(screen.getByRole("button", { name: "原版 Herding Cats" }));
    fireEvent.click(screen.getByRole("button", { name: "载入原版游戏" }));
    act(() => { vi.advanceTimersByTime(15001); });
    expect(screen.getByText("连接比预期久。可以再等等，或在源站打开。")).toBeInTheDocument();
    fireEvent.load(screen.getByTitle("原版 Herding Cats Unity 游戏"));
    expect(screen.getByText("已连接外部页面；Unity 启动状态请看游戏画面。")).toBeInTheDocument();
  });

  it("shows the offline fallback immediately instead of mounting a new external frame", () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    render(<HerdingCatsApp active />);
    fireEvent.click(screen.getByRole("button", { name: "原版 Herding Cats" }));
    fireEvent.click(screen.getByRole("button", { name: "载入原版游戏" }));
    expect(screen.queryByTitle("原版 Herding Cats Unity 游戏")).not.toBeInTheDocument();
    expect(screen.getByText("还没有连接上原版")).toBeInTheDocument();
  });

  it("unloads the external game when its browser tab is hidden", () => {
    render(<HerdingCatsApp active />);
    fireEvent.click(screen.getByRole("button", { name: "原版 Herding Cats" }));
    fireEvent.click(screen.getByRole("button", { name: "载入原版游戏" }));
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.queryByTitle("原版 Herding Cats Unity 游戏")).not.toBeInTheDocument();
    expect(screen.getByText("原版已停止运行")).toBeInTheDocument();
  });

  it("freezes the local route and clock on the original tab and on returning to the desktop", () => {
    const view = render(<HerdingCatsApp active />);
    fireEvent.click(screen.getByRole("button", { name: "开始新一局" }));
    fireEvent.click(screen.getByRole("button", { name: "去找橘子，亲人" }));
    act(() => vi.advanceTimersByTime(200));
    const board = screen.getByTestId("cat-garden-stage");
    const position = board.getAttribute("data-player");
    fireEvent.click(screen.getByRole("button", { name: "原版 Herding Cats" }));
    act(() => vi.advanceTimersByTime(600));
    const paused = window.localStorage.getItem(GARDEN_STORAGE_KEY);
    act(() => vi.advanceTimersByTime(60_000));
    expect(window.localStorage.getItem(GARDEN_STORAGE_KEY)).toBe(paused);
    expect(board).toHaveAttribute("data-player", position);
    fireEvent.click(screen.getByRole("button", { name: /牧猫庭院/ }));
    expect(screen.getByRole("button", { name: "继续散步" })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2000));
    expect(window.localStorage.getItem(GARDEN_STORAGE_KEY)).toBe(paused);
    fireEvent.click(screen.getByRole("button", { name: "继续散步" }));
    act(() => vi.advanceTimersByTime(1000));
    act(() => vi.advanceTimersByTime(500));
    expect(JSON.parse(window.localStorage.getItem(GARDEN_STORAGE_KEY)!).session.elapsed).toBe(1);
    expect(board).toHaveAttribute("data-player", position);
    view.rerender(<HerdingCatsApp active={false} />);
    act(() => vi.advanceTimersByTime(600));
    const desktopPause = window.localStorage.getItem(GARDEN_STORAGE_KEY);
    act(() => vi.advanceTimersByTime(60_000));
    expect(window.localStorage.getItem(GARDEN_STORAGE_KEY)).toBe(desktopPause);
    view.rerender(<HerdingCatsApp active />);
    expect(screen.getByRole("button", { name: "继续散步" })).toBeInTheDocument();
    expect(board).toHaveAttribute("data-player", position);
  });
});
