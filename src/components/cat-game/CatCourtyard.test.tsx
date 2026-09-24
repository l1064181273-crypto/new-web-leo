import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CatCourtyard from "./CatCourtyard";
import { GARDEN_LEVELS, GARDEN_STORAGE_KEY, PERSONALITIES, advanceGarden, createGarden, freshProgress, recordCompletion } from "./engine";

const stepTimers = (steps: number, milliseconds = 200) => {
  for (let step = 0; step < steps; step += 1) act(() => { vi.advanceTimersByTime(milliseconds); });
};

function ScrollableCourtyard({ active = true }: { active?: boolean }) {
  // Two matching ancestors make a global/outer scroll reset observable; the
  // component must affect only the closest app scrollport, not its surroundings.
  return <div className="herding-cats" data-testid="outer-scrollport">
    <section className="herding-cats" data-testid="game-scrollport">
      <div className="cat-studio-view"><CatCourtyard active={active} /></div>
    </section>
  </div>;
}

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

describe("courtyard controls and lifecycle", () => {
  it("returns only the game scrollport to the top when opening menus and resuming the board", () => {
    render(<ScrollableCourtyard />);
    const scrollport = screen.getByTestId("game-scrollport");
    const outer = screen.getByTestId("outer-scrollport");
    outer.scrollTop = 73;
    for (const name of ["开始新一局", "暂停", "继续散步", "查看游戏玩法", "知道了", "继续散步"]) {
      scrollport.scrollTop = 240;
      fireEvent.click(screen.getByRole("button", { name }));
      expect(scrollport.scrollTop).toBe(0);
      expect(outer.scrollTop).toBe(73);
    }
    expect(document.activeElement).toBe(screen.getByTestId("cat-garden-stage"));
  });

  it("returns to the top when continuing a saved garden and starting another selected garden", () => {
    window.localStorage.setItem(GARDEN_STORAGE_KEY, JSON.stringify({ ...freshProgress(), unlocked: 3, session: createGarden("hydrangea-path") }));
    render(<ScrollableCourtyard />);
    const scrollport = screen.getByTestId("game-scrollport");
    scrollport.scrollTop = 190;
    fireEvent.click(screen.getByRole("button", { name: "继续上次 · 绣球小径" }));
    expect(scrollport.scrollTop).toBe(0);
    scrollport.scrollTop = 170;
    fireEvent.click(screen.getByRole("button", { name: "庭院" }));
    expect(scrollport.scrollTop).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: /^03 雨后花园 / }));
    scrollport.scrollTop = 150;
    fireEvent.click(screen.getByRole("button", { name: "开始 · 雨后花园" }));
    expect(scrollport.scrollTop).toBe(0);
    expect(screen.getByRole("img", { name: /雨后花园/ })).toBeInTheDocument();
    expect(screen.getByTestId("cat-garden-stage")).toHaveAttribute("data-player", "1,7");
  });

  it("resets scroll for the completed result and next garden without requiring a different menu screen", () => {
    const start = createGarden(undefined, "challenge");
    const lastStep = { ...start, player: { x: 8, y: 1 }, moves: 41, cats: start.cats.map((cat, index) => ({ ...cat, x: 6 - index, y: 1, status: "following" as const })) };
    window.localStorage.setItem(GARDEN_STORAGE_KEY, JSON.stringify({ ...freshProgress(), session: lastStep }));
    render(<ScrollableCourtyard />);
    fireEvent.click(screen.getByRole("button", { name: "继续上次 · 阳光门廊" }));
    const scrollport = screen.getByTestId("game-scrollport");
    scrollport.scrollTop = 210;
    fireEvent.click(screen.getByRole("button", { name: "向右走一步" }));
    expect(scrollport.scrollTop).toBe(210);
    stepTimers(12);
    expect(screen.getByRole("region", { name: "关卡完成" })).toBeInTheDocument();
    expect(scrollport.scrollTop).toBe(0);
    scrollport.scrollTop = 180;
    fireEvent.click(screen.getByRole("button", { name: "去下一座庭院" }));
    expect(scrollport.scrollTop).toBe(0);
    expect(screen.getByRole("img", { name: /绣球小径/ })).toBeInTheDocument();
  });

  it("does not steal a user's scroll position during ordinary movement, route steps or clock updates", () => {
    render(<ScrollableCourtyard />);
    fireEvent.click(screen.getByRole("button", { name: "开始新一局" }));
    const scrollport = screen.getByTestId("game-scrollport");
    scrollport.scrollTop = 225;
    fireEvent.click(screen.getByRole("button", { name: "向右走一步" }));
    expect(scrollport.scrollTop).toBe(225);
    fireEvent.keyDown(screen.getByTestId("cat-garden-stage"), { key: "ArrowLeft" });
    expect(scrollport.scrollTop).toBe(225);
    fireEvent.click(screen.getByRole("button", { name: "去找橘子，亲人" }));
    stepTimers(8);
    expect(scrollport.scrollTop).toBe(225);
    expect(screen.getByTestId("cat-garden-stage")).not.toHaveAttribute("data-player", "2,7");
    expect(document.querySelector(".cat-time-stat")).toHaveTextContent("0:01");
  });

  it("keeps the inactive application's scroll untouched and resets it only after reactivation", () => {
    const view = render(<ScrollableCourtyard />);
    fireEvent.click(screen.getByRole("button", { name: "开始新一局" }));
    const scrollport = screen.getByTestId("game-scrollport");
    scrollport.scrollTop = 240;
    view.rerender(<ScrollableCourtyard active={false} />);
    expect(scrollport.scrollTop).toBe(240);
    stepTimers(8);
    expect(scrollport.scrollTop).toBe(240);
    scrollport.scrollTop = 175;
    view.rerender(<ScrollableCourtyard active={false} />);
    expect(scrollport.scrollTop).toBe(175);
    view.rerender(<ScrollableCourtyard />);
    expect(scrollport.scrollTop).toBe(0);
    expect(screen.getByRole("button", { name: "继续散步" })).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole("region", { name: "庭院菜单" }));
    scrollport.scrollTop = 95;
    fireEvent.click(screen.getByRole("button", { name: "继续散步" }));
    expect(scrollport.scrollTop).toBe(0);
    expect(document.activeElement).toBe(screen.getByTestId("cat-garden-stage"));
  });

  it("handles movement only in the garden and requires a manual resume after losing activity", () => {
    const view = render(<CatCourtyard active />);
    fireEvent.click(screen.getByRole("button", { name: "开始新一局" }));
    const board = screen.getByTestId("cat-garden-stage");
    expect(board).toHaveAttribute("data-player", "2,7");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(board).toHaveAttribute("data-player", "2,7");
    fireEvent.keyDown(board, { key: "ArrowRight" });
    expect(board).toHaveAttribute("data-player", "3,7");
    view.rerender(<CatCourtyard active={false} />);
    expect(screen.getByText(/你离开了庭院，已经帮你暂停/)).toBeInTheDocument();
    stepTimers(10);
    expect(board).toHaveAttribute("data-player", "3,7");
    view.rerender(<CatCourtyard active />);
    expect(screen.getByRole("button", { name: "继续散步" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "继续散步" }));
    fireEvent.click(screen.getByRole("button", { name: "向左走一步" }));
    expect(board).toHaveAttribute("data-player", "2,7");
  });

  it("supports an entire first level via pointer-friendly controls and unlocks the second", () => {
    render(<CatCourtyard active />);
    fireEvent.click(screen.getByRole("button", { name: "开始新一局" }));
    fireEvent.click(screen.getByRole("button", { name: "去找橘子，亲人" }));
    stepTimers(8);
    fireEvent.click(screen.getByRole("button", { name: /回家啦/ }));
    expect(screen.getByText("橘子跟上来了。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "去找豆包，亲人" }));
    stepTimers(15);
    fireEvent.click(screen.getByRole("button", { name: /回家啦/ }));
    fireEvent.click(screen.getByRole("button", { name: "走回门廊" }));
    stepTimers(55);
    expect(screen.getByText("大家都到家啦。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "去下一座庭院" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "去下一座庭院" }));
    expect(screen.getByRole("img", { name: /绣球小径/ })).toBeInTheDocument();
  });

  it("completes three challenges consecutively and preserves every result through menus and reloads", () => {
    const view = render(<CatCourtyard active />);
    fireEvent.click(screen.getByRole("button", { name: "步数挑战" }));
    fireEvent.click(screen.getByRole("button", { name: "开始新一局" }));
    const recorded: Record<string, string> = {};
    for (const level of GARDEN_LEVELS) {
      if (level.key) {
        fireEvent.click(screen.getByRole("button", { name: "去捡钥匙" }));
        stepTimers(20);
      }
      for (const cat of level.cats) {
        const shortcut = screen.queryByRole("button", { name: `去找${cat.name}，${PERSONALITIES[cat.personality].label}` });
        if (!shortcut) continue;
        fireEvent.click(shortcut);
        stepTimers(24);
        fireEvent.click(screen.getByRole("button", { name: /回家啦/ }));
        if (cat.personality === "sleepy") fireEvent.click(screen.getByRole("button", { name: /回家啦/ }));
      }
      fireEvent.click(screen.getByRole("button", { name: "走回门廊" }));
      stepTimers(55);
      expect(screen.getByRole("region", { name: "关卡完成" })).toBe(document.activeElement);
      const saved = JSON.parse(window.localStorage.getItem(GARDEN_STORAGE_KEY)!);
      const key = `${level.id}:challenge`;
      expect(saved.session).toMatchObject({ status: "won", mode: "challenge", moves: [23, 32, 39][level.number - 1] });
      expect(saved.unlocked).toBe(Math.min(level.number + 1, 3));
      for (const [previousKey, record] of Object.entries(recorded)) expect(JSON.stringify(saved.records[previousKey])).toBe(record);
      recorded[key] = JSON.stringify(saved.records[key]);
      if (level.number < 3) fireEvent.click(screen.getByRole("button", { name: "去下一座庭院" }));
    }
    fireEvent.click(screen.getByRole("button", { name: "查看庭院纪录" }));
    fireEvent.keyDown(screen.getByRole("region", { name: "选择庭院" }), { key: "Escape" });
    expect(screen.getByRole("region", { name: "关卡完成" })).toHaveTextContent("今天的猫，接齐了。");
    view.unmount();
    render(<CatCourtyard active />);
    expect(screen.getByRole("region", { name: "关卡完成" })).toHaveTextContent("今天的猫，接齐了。");
    stepTimers(3);
    const reloaded = JSON.parse(window.localStorage.getItem(GARDEN_STORAGE_KEY)!);
    expect(Object.keys(reloaded.records)).toHaveLength(3);
    for (const [key, record] of Object.entries(recorded)) expect(JSON.stringify(reloaded.records[key])).toBe(record);
  });

  it("describes route arrival and sleepy-cat status without announcing every step", () => {
    window.localStorage.setItem(GARDEN_STORAGE_KEY, JSON.stringify({ ...freshProgress(), unlocked: 2, session: createGarden("hydrangea-path") }));
    render(<CatCourtyard active />);
    fireEvent.click(screen.getByRole("button", { name: "继续上次 · 绣球小径" }));
    const sleepy = screen.getByRole("button", { name: "去找芝麻，贪睡" });
    expect(sleepy).toHaveAccessibleDescription("还在打盹");
    fireEvent.click(sleepy);
    const feedback = screen.getByRole("status");
    const routeMessage = feedback.textContent;
    expect(feedback).toHaveAttribute("aria-atomic", "true");
    expect(routeMessage).toContain("正在走向芝麻身边");
    stepTimers(2);
    expect(feedback.textContent).toBe(routeMessage);
    stepTimers(24);
    expect(feedback).toHaveTextContent("已经到芝麻身边。它还在打盹，呼唤两次就会跟上。");
    expect(screen.getByTestId("cat-garden-stage")).toHaveAccessibleDescription(/绣球小径.*第 6 列、第 3 行/);
    fireEvent.click(screen.getByRole("button", { name: /回家啦/ }));
    expect(sleepy).toHaveAccessibleDescription("醒了，再叫一次");
    fireEvent.click(screen.getByRole("button", { name: /回家啦/ }));
    expect(screen.getByRole("button", { name: "芝麻，跟着你呢" })).toHaveAccessibleDescription("跟着你呢");
  });

  it("has a real failure state and can continue the same session in cozy mode", () => {
    render(<CatCourtyard active />);
    fireEvent.click(screen.getByRole("button", { name: "步数挑战" }));
    fireEvent.click(screen.getByRole("button", { name: "开始新一局" }));
    for (let call = 0; call < 42; call += 1) fireEvent.click(screen.getByRole("button", { name: /回家啦/ }));
    expect(screen.getByText("这次的步数用完了。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "改为慢慢逛，继续这一局" }));
    expect(screen.getByRole("button", { name: /回家啦/ })).toBeEnabled();
    expect(screen.getByTestId("cat-garden-stage")).toHaveAttribute("data-player", "2,7");
  });

  it("restores a failed challenge's result and restarts without carrying over its spent budget", () => {
    const lost = advanceGarden({ ...createGarden(undefined, "challenge"), moves: 41 }, { type: "call" });
    window.localStorage.setItem(GARDEN_STORAGE_KEY, JSON.stringify({ ...freshProgress(), mode: "challenge", session: lost }));
    render(<CatCourtyard active />);
    const result = screen.getByRole("region", { name: "挑战结束" });
    expect(document.activeElement).toBe(result);
    expect(result).toHaveAccessibleDescription(/42 步.*0.*2/);
    expect(screen.getByRole("button", { name: "改为慢慢逛，继续这一局" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新挑战" }));
    expect(screen.getByTestId("cat-garden-stage")).toHaveAttribute("data-player", "2,7");
    stepTimers(3);
    expect(JSON.parse(window.localStorage.getItem(GARDEN_STORAGE_KEY)!).session).toMatchObject({ mode: "challenge", moves: 0, status: "playing" });
    expect(screen.getByRole("button", { name: /回家啦/ })).toBeEnabled();
  });

  it("offers a native focusable key shortcut that opens the third garden without changing its route cost", () => {
    window.localStorage.setItem(GARDEN_STORAGE_KEY, JSON.stringify({ ...freshProgress(), unlocked: 3, session: createGarden("after-the-rain") }));
    render(<CatCourtyard active />);
    const shortcut = screen.getByRole("button", { name: "去捡钥匙" });
    expect(shortcut).toHaveAttribute("type", "button");
    expect(shortcut).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "继续上次 · 雨后花园" }));
    shortcut.focus();
    expect(document.activeElement).toBe(shortcut);
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    shortcut.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(false);
    // jsdom does not synthesize native button activation from keydown.
    fireEvent.click(shortcut, { detail: 0 });
    expect(document.activeElement).toBe(screen.getByTestId("cat-garden-stage"));
    stepTimers(12);
    expect(screen.getByTestId("cat-garden-stage")).toHaveAttribute("data-player", "4,2");
    expect(screen.getByText("钥匙已找到 · 花园门已开")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "去捡钥匙" })).not.toBeInTheDocument();
    stepTimers(3);
    const saved = JSON.parse(window.localStorage.getItem(GARDEN_STORAGE_KEY)!);
    expect(saved.session).toMatchObject({ moves: 8, keyCollected: true });
  });

  it("ignores the key shortcut while paused and accepts a resumed pointer activation", () => {
    window.localStorage.setItem(GARDEN_STORAGE_KEY, JSON.stringify({ ...freshProgress(), unlocked: 3, session: createGarden("after-the-rain") }));
    render(<CatCourtyard active />);
    fireEvent.click(screen.getByRole("button", { name: "继续上次 · 雨后花园" }));
    fireEvent.click(screen.getByRole("button", { name: "暂停" }));
    const shortcut = screen.getByRole("button", { name: "去捡钥匙" });
    expect(shortcut).toBeDisabled();
    fireEvent.click(shortcut);
    stepTimers(12);
    expect(screen.getByTestId("cat-garden-stage")).toHaveAttribute("data-player", "1,7");
    fireEvent.click(screen.getByRole("button", { name: "继续散步" }));
    fireEvent.pointerDown(shortcut, { pointerType: "touch", isPrimary: true });
    fireEvent.pointerUp(shortcut, { pointerType: "touch", isPrimary: true });
    fireEvent.click(shortcut, { detail: 1 });
    stepTimers(12);
    expect(screen.getByText("钥匙已找到 · 花园门已开")).toBeInTheDocument();
  });

  it("restores a saved position after unmount without silently starting the clock", () => {
    const first = render(<CatCourtyard active />);
    fireEvent.click(screen.getByRole("button", { name: "开始新一局" }));
    fireEvent.click(screen.getByRole("button", { name: "向右走一步" }));
    stepTimers(3);
    expect(window.localStorage.getItem(GARDEN_STORAGE_KEY)).toContain('"moves":1');
    first.unmount();
    render(<CatCourtyard active />);
    expect(screen.getByRole("button", { name: "继续上次 · 阳光门廊" })).toBeInTheDocument();
    stepTimers(5);
    fireEvent.click(screen.getByRole("button", { name: "继续上次 · 阳光门廊" }));
    expect(screen.getByTestId("cat-garden-stage")).toHaveAttribute("data-player", "3,7");
  });

  it("keeps play available when the browser refuses local storage writes", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota unavailable"); });
    render(<CatCourtyard active />);
    fireEvent.click(screen.getByRole("button", { name: "开始新一局" }));
    stepTimers(3);
    expect(screen.getByText("浏览器未开放存储，本次仍可正常玩")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "向右走一步" }));
    expect(screen.getByTestId("cat-garden-stage")).toHaveAttribute("data-player", "3,7");
  });

  it("moves focus between the board and local menus without intercepting Tab", () => {
    render(<CatCourtyard active />);
    fireEvent.click(screen.getByRole("button", { name: "开始新一局" }));
    const board = screen.getByTestId("cat-garden-stage");
    expect(document.activeElement).toBe(board);
    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    board.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "查看游戏玩法" }));
    const help = screen.getByRole("region", { name: "玩法说明" });
    expect(document.activeElement).toBe(help);
    fireEvent.keyDown(help, { key: "Escape" });
    expect(screen.getByRole("button", { name: "继续散步" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("region", { name: "庭院菜单" }), { key: "p" });
    expect(document.activeElement).toBe(board);
    fireEvent.keyDown(board, { key: "p" });
    fireEvent.keyDown(screen.getByRole("region", { name: "庭院菜单" }), { key: "p", repeat: true });
    expect(screen.getByRole("button", { name: "继续散步" })).toBeInTheDocument();
  });

  it("keeps the help return destination when its header button is clicked repeatedly", () => {
    render(<CatCourtyard active />);
    fireEvent.click(screen.getByRole("button", { name: "开始新一局" }));
    const helpButton = screen.getByRole("button", { name: "查看游戏玩法" });
    fireEvent.click(helpButton);
    fireEvent.click(helpButton);
    fireEvent.click(screen.getByRole("button", { name: "知道了" }));
    expect(screen.getByRole("button", { name: "继续散步" })).toBeInTheDocument();
    fireEvent.click(helpButton);
    fireEvent.click(helpButton);
    fireEvent.keyDown(screen.getByRole("region", { name: "玩法说明" }), { key: "Escape" });
    expect(screen.getByRole("button", { name: "继续散步" })).toBeInTheDocument();
  });

  it("stops routes, clocks and repeated saves in the background and resumes without a time jump", () => {
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const view = render(<CatCourtyard active />);
    fireEvent.click(screen.getByRole("button", { name: "开始新一局" }));
    fireEvent.click(screen.getByRole("button", { name: "去找橘子，亲人" }));
    stepTimers(1);
    view.rerender(<CatCourtyard active={false} />);
    const position = screen.getByTestId("cat-garden-stage").getAttribute("data-player");
    stepTimers(3);
    const writes = storage.mock.calls.length;
    const saved = window.localStorage.getItem(GARDEN_STORAGE_KEY);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(storage.mock.calls.length).toBe(writes);
    expect(window.localStorage.getItem(GARDEN_STORAGE_KEY)).toBe(saved);
    expect(screen.getByTestId("cat-garden-stage")).toHaveAttribute("data-player", position);
    view.rerender(<CatCourtyard active />);
    fireEvent.click(screen.getByRole("button", { name: "继续散步" }));
    stepTimers(5);
    expect(screen.getByTestId("cat-garden-stage")).toHaveAttribute("data-player", position);
    expect(screen.queryByText("1:01")).not.toBeInTheDocument();
  });

  it("cancels a pending route before quickly starting the same garden again", () => {
    render(<CatCourtyard active />);
    fireEvent.click(screen.getByRole("button", { name: "开始新一局" }));
    fireEvent.click(screen.getByRole("button", { name: "去找橘子，亲人" }));
    stepTimers(1);
    fireEvent.click(screen.getByRole("button", { name: "庭院" }));
    fireEvent.click(screen.getByRole("button", { name: "开始 · 阳光门廊" }));
    stepTimers(12);
    expect(screen.getByTestId("cat-garden-stage")).toHaveAttribute("data-player", "2,7");
  });

  it("preserves foreign-version save data even when a temporary new game is played", () => {
    const foreign = JSON.stringify({ version: 99, session: { futureFormat: "keep this exact value" } });
    window.localStorage.setItem(GARDEN_STORAGE_KEY, foreign);
    const view = render(<CatCourtyard active />);
    expect(screen.getByText(/这份存档来自其他版本，本次不会覆盖它/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "开始新一局" }));
    fireEvent.click(screen.getByRole("button", { name: "向右走一步" }));
    stepTimers(25);
    view.unmount();
    expect(window.localStorage.getItem(GARDEN_STORAGE_KEY)).toBe(foreign);
  });

  it("protects a foreign-version save that appears after this game has already started", () => {
    const view = render(<CatCourtyard active />);
    fireEvent.click(screen.getByRole("button", { name: "开始新一局" }));
    stepTimers(3);
    const foreign = JSON.stringify({ version: 2, newFormat: { preserve: "another tab's data" } });
    window.localStorage.setItem(GARDEN_STORAGE_KEY, foreign);
    fireEvent.click(screen.getByRole("button", { name: "向右走一步" }));
    stepTimers(16);
    expect(screen.getByText(/这份存档来自其他版本，本次不会覆盖它/)).toBeInTheDocument();
    expect(window.localStorage.getItem(GARDEN_STORAGE_KEY)).toBe(foreign);
    view.unmount();
    expect(window.localStorage.getItem(GARDEN_STORAGE_KEY)).toBe(foreign);
  });

  it("checks for a foreign version before flushing a dirty session on immediate unmount", () => {
    const view = render(<CatCourtyard active />);
    fireEvent.click(screen.getByRole("button", { name: "开始新一局" }));
    stepTimers(3);
    fireEvent.click(screen.getByRole("button", { name: "向右走一步" }));
    const foreign = JSON.stringify({ version: 7, futureSave: "do not replace" });
    window.localStorage.setItem(GARDEN_STORAGE_KEY, foreign);
    view.unmount();
    expect(window.localStorage.getItem(GARDEN_STORAGE_KEY)).toBe(foreign);
  });

  it("does not rewrite an ended game's record or keep a background save timer alive", () => {
    const start = createGarden();
    const won = { ...start, status: "won" as const, player: { x: 9, y: 1 }, moves: 23, elapsed: 12, cats: start.cats.map((cat) => ({ ...cat, x: 9, y: 1, status: "home" as const })) };
    const saved = recordCompletion(freshProgress(), won, "2026-09-12T10:00:00Z");
    window.localStorage.setItem(GARDEN_STORAGE_KEY, JSON.stringify(saved));
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const view = render(<CatCourtyard active />);
    expect(screen.getByRole("region", { name: "关卡完成" })).toHaveTextContent("大家都到家啦。");
    stepTimers(3);
    const writes = storage.mock.calls.length;
    view.rerender(<CatCourtyard active={false} />);
    view.rerender(<CatCourtyard active />);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(storage.mock.calls.length).toBe(writes);
    expect(JSON.parse(window.localStorage.getItem(GARDEN_STORAGE_KEY)!).records["sunny-porch:cozy"].completedAt).toBe("2026-09-12T10:00:00Z");
  });

  it("disables movement and calls while the last-budget home queue finishes", () => {
    const start = createGarden(undefined, "challenge");
    const lastStep = { ...start, player: { x: 8, y: 1 }, moves: 41, cats: start.cats.map((cat, index) => ({ ...cat, x: 6 - index, y: 1, status: "following" as const })) };
    window.localStorage.setItem(GARDEN_STORAGE_KEY, JSON.stringify({ ...freshProgress(), session: lastStep }));
    render(<CatCourtyard active />);
    fireEvent.click(screen.getByRole("button", { name: "继续上次 · 阳光门廊" }));
    fireEvent.click(screen.getByRole("button", { name: "向右走一步" }));
    expect(screen.getByRole("button", { name: /回家啦/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "向左走一步" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "暂停" })).toBeEnabled();
    stepTimers(12);
    expect(screen.getByText("大家都到家啦。")).toBeInTheDocument();
  });

  it.each(["Escape", "p"])("does not immediately re-pause when %s repeats after resuming from its menu", (key) => {
    render(<CatCourtyard active />);
    fireEvent.click(screen.getByRole("button", { name: "开始新一局" }));
    fireEvent.click(screen.getByRole("button", { name: "暂停" }));
    fireEvent.keyDown(screen.getByRole("region", { name: "庭院菜单" }), { key });
    const board = screen.getByTestId("cat-garden-stage");
    expect(document.activeElement).toBe(board);
    fireEvent.keyDown(board, { key, repeat: true });
    expect(screen.queryByRole("button", { name: "继续散步" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "暂停" })).toBeEnabled();
  });

  it("ignores IME candidate keys rather than moving, calling or pausing the courtyard", () => {
    render(<CatCourtyard active />);
    fireEvent.click(screen.getByRole("button", { name: "开始新一局" }));
    const board = screen.getByTestId("cat-garden-stage");
    for (const event of [{ key: "ArrowRight" }, { key: " ", code: "Space" }, { key: "p" }, { key: "Escape" }]) {
      fireEvent.keyDown(board, { ...event, isComposing: true, keyCode: 229 });
    }
    expect(board).toHaveAttribute("data-player", "2,7");
    expect(screen.getByRole("button", { name: "暂停" })).toBeEnabled();
    stepTimers(3);
    expect(JSON.parse(window.localStorage.getItem(GARDEN_STORAGE_KEY)!).session.moves).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "暂停" }));
    fireEvent.keyDown(screen.getByRole("region", { name: "庭院菜单" }), { key: "Escape", isComposing: true, keyCode: 229 });
    expect(screen.getByRole("button", { name: "继续散步" })).toBeInTheDocument();
  });

  it("paces held direction keys to the path-step interval and requires a fresh press after keyup", () => {
    render(<CatCourtyard active />);
    fireEvent.click(screen.getByRole("button", { name: "开始新一局" }));
    const board = screen.getByTestId("cat-garden-stage");
    fireEvent.keyDown(board, { key: "ArrowRight" });
    expect(board).toHaveAttribute("data-player", "3,7");
    for (let repeat = 0; repeat < 8; repeat += 1) fireEvent.keyDown(board, { key: "ArrowRight", repeat: true });
    expect(board).toHaveAttribute("data-player", "3,7");
    act(() => vi.advanceTimersByTime(164));
    fireEvent.keyDown(board, { key: "ArrowRight", repeat: true });
    expect(board).toHaveAttribute("data-player", "3,7");
    act(() => vi.advanceTimersByTime(1));
    fireEvent.keyDown(board, { key: "ArrowRight", repeat: true });
    expect(board).toHaveAttribute("data-player", "4,7");
    fireEvent.keyUp(board, { key: "ArrowRight" });
    stepTimers(1);
    fireEvent.keyDown(board, { key: "ArrowRight", repeat: true });
    expect(board).toHaveAttribute("data-player", "4,7");
    fireEvent.keyDown(board, { key: "ArrowRight" });
    expect(board).toHaveAttribute("data-player", "5,7");
  });

  it("clears a held direction after pause or focus loss instead of continuing a stale press", () => {
    render(<CatCourtyard active />);
    fireEvent.click(screen.getByRole("button", { name: "开始新一局" }));
    const board = screen.getByTestId("cat-garden-stage");
    fireEvent.keyDown(board, { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: "暂停" }));
    fireEvent.click(screen.getByRole("button", { name: "继续散步" }));
    stepTimers(1);
    fireEvent.keyDown(board, { key: "ArrowRight", repeat: true });
    expect(board).toHaveAttribute("data-player", "3,7");
    fireEvent.keyDown(board, { key: "ArrowRight" });
    expect(board).toHaveAttribute("data-player", "4,7");
    fireEvent.blur(board);
    stepTimers(1);
    fireEvent.keyDown(board, { key: "ArrowRight", repeat: true });
    expect(board).toHaveAttribute("data-player", "4,7");
  });

  it("exposes a described keyboard group plus native alternatives without inventing an inaccessible grid", () => {
    render(<CatCourtyard active />);
    const board = screen.getByTestId("cat-garden-stage");
    expect(board).toHaveAttribute("role", "group");
    expect(board).toHaveAttribute("tabindex", "-1");
    expect(screen.queryByRole("application")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "开始新一局" }));
    expect(board).toHaveAttribute("tabindex", "0");
    expect(board).toHaveAccessibleName(/方向键或 WASD.*空格.*暂停/);
    expect(board).toHaveAccessibleDescription(/阳光门廊.*0.*2.*已回家/);
    for (const name of ["向上走一步", "向下走一步", "向左走一步", "向右走一步", "去找橘子，亲人", "去找豆包，亲人", "走回门廊"]) {
      const control = screen.getByRole("button", { name });
      expect(control).toHaveAttribute("type", "button");
      expect(control).toBeEnabled();
      expect(fireEvent.keyDown(control, { key: "Enter" })).toBe(true);
    }
    fireEvent.click(screen.getByRole("button", { name: "查看游戏玩法" }));
    expect(board).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("button", { name: "走回门廊" })).toBeDisabled();
  });

  it.each(["暂停", "查看游戏玩法"])("cancels a route and freezes time when %s interrupts it", (control) => {
    render(<CatCourtyard active />);
    fireEvent.click(screen.getByRole("button", { name: "开始新一局" }));
    fireEvent.click(screen.getByRole("button", { name: "去找橘子，亲人" }));
    stepTimers(1);
    const board = screen.getByTestId("cat-garden-stage");
    const position = board.getAttribute("data-player");
    fireEvent.click(screen.getByRole("button", { name: control }));
    stepTimers(3);
    const saved = JSON.parse(window.localStorage.getItem(GARDEN_STORAGE_KEY)!).session;
    act(() => vi.advanceTimersByTime(60_000));
    expect(board).toHaveAttribute("data-player", position);
    expect(JSON.parse(window.localStorage.getItem(GARDEN_STORAGE_KEY)!).session).toEqual(saved);
    if (control === "查看游戏玩法") fireEvent.click(screen.getByRole("button", { name: "知道了" }));
    fireEvent.click(screen.getByRole("button", { name: "继续散步" }));
    stepTimers(2);
    expect(board).toHaveAttribute("data-player", position);
  });

  it("starts a different garden with a fresh single clock and no previous route", () => {
    window.localStorage.setItem(GARDEN_STORAGE_KEY, JSON.stringify({ ...freshProgress(), unlocked: 3, session: { ...createGarden(), elapsed: 9 } }));
    render(<CatCourtyard active />);
    fireEvent.click(screen.getByRole("button", { name: "继续上次 · 阳光门廊" }));
    fireEvent.click(screen.getByRole("button", { name: "去找橘子，亲人" }));
    stepTimers(1);
    fireEvent.click(screen.getByRole("button", { name: "庭院" }));
    stepTimers(3);
    const paused = JSON.parse(window.localStorage.getItem(GARDEN_STORAGE_KEY)!).session;
    act(() => vi.advanceTimersByTime(60_000));
    expect(JSON.parse(window.localStorage.getItem(GARDEN_STORAGE_KEY)!).session).toEqual(paused);
    fireEvent.click(screen.getByRole("button", { name: /绣球小径.*每只猫都有自己的脾气/ }));
    fireEvent.click(screen.getByRole("button", { name: "开始 · 绣球小径" }));
    const board = screen.getByTestId("cat-garden-stage");
    expect(board).toHaveAttribute("data-player", "1,7");
    stepTimers(3);
    expect(JSON.parse(window.localStorage.getItem(GARDEN_STORAGE_KEY)!).session).toMatchObject({ levelId: "hydrangea-path", elapsed: 0, moves: 0 });
    stepTimers(2);
    stepTimers(3);
    expect(JSON.parse(window.localStorage.getItem(GARDEN_STORAGE_KEY)!).session).toMatchObject({ levelId: "hydrangea-path", elapsed: 1, moves: 0 });
    expect(board).toHaveAttribute("data-player", "1,7");
  });
});
