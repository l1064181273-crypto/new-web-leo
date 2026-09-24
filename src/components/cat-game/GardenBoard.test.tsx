import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import GardenBoard from "./GardenBoard";
import { createGarden } from "./engine";

class TestPointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;
  isPrimary: boolean;
  constructor(type: string, options: PointerEventInit) {
    super(type, options);
    this.pointerId = options.pointerId ?? 1;
    this.pointerType = options.pointerType ?? "touch";
    this.isPrimary = options.isPrimary ?? true;
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("PointerEvent", TestPointerEvent);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function setup() {
  const onTile = vi.fn();
  const view = render(<GardenBoard state={createGarden()} route={[]} callPulse={0} interactive onTile={onTile} />);
  const board = screen.getByRole("img", { name: /阳光门廊/ });
  vi.spyOn(board, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, left: 0, top: 0, width: 528, height: 432, right: 528, bottom: 432, toJSON: () => ({}) });
  return { onTile, board, view };
}

describe("garden touch intention", () => {
  it("plans a tile only on a completed tap, not on touch down", () => {
    const { onTile, board } = setup();
    fireEvent.pointerDown(board, { button: 0, clientX: 120, clientY: 168, pointerId: 1, pointerType: "touch" });
    expect(onTile).not.toHaveBeenCalled();
    fireEvent.pointerUp(board, { button: 0, clientX: 120, clientY: 168, pointerId: 1, pointerType: "touch" });
    expect(onTile).toHaveBeenCalledExactlyOnceWith({ x: 2, y: 3 });
  });

  it("does not turn a scroll, cancelled gesture or long touch into a route", () => {
    const { onTile, board } = setup();
    fireEvent.pointerDown(board, { button: 0, clientX: 120, clientY: 168, pointerId: 1 });
    fireEvent.pointerUp(board, { button: 0, clientX: 120, clientY: 210, pointerId: 1 });
    fireEvent.pointerDown(board, { button: 0, clientX: 120, clientY: 168, pointerId: 2 });
    fireEvent.pointerCancel(board, { pointerId: 2 });
    fireEvent.pointerUp(board, { button: 0, clientX: 120, clientY: 168, pointerId: 2 });
    fireEvent.pointerDown(board, { button: 0, clientX: 120, clientY: 168, pointerId: 3 });
    vi.advanceTimersByTime(700);
    fireEvent.pointerUp(board, { button: 0, clientX: 120, clientY: 168, pointerId: 3 });
    expect(onTile).not.toHaveBeenCalled();
  });

  it("ignores a tap completed after the game becomes inactive", () => {
    const { onTile, board, view } = setup();
    fireEvent.pointerDown(board, { button: 0, clientX: 120, clientY: 168, pointerId: 1 });
    view.rerender(<GardenBoard state={createGarden()} route={[]} callPulse={0} interactive={false} onTile={onTile} />);
    fireEvent.pointerUp(board, { button: 0, clientX: 120, clientY: 168, pointerId: 1 });
    expect(onTile).not.toHaveBeenCalled();
  });

  it("cancels a drag even if the finger returns to its starting point before release", () => {
    const { onTile, board } = setup();
    fireEvent.pointerDown(board, { button: 0, clientX: 120, clientY: 168, pointerId: 1 });
    fireEvent.pointerMove(board, { clientX: 120, clientY: 220, pointerId: 1 });
    fireEvent.pointerMove(board, { clientX: 120, clientY: 168, pointerId: 1 });
    fireEvent.pointerUp(board, { button: 0, clientX: 120, clientY: 168, pointerId: 1 });
    expect(onTile).not.toHaveBeenCalled();
  });

  it("does not replace a primary tap with a second finger during a pinch", () => {
    const { onTile, board } = setup();
    fireEvent.pointerDown(board, { button: 0, clientX: 120, clientY: 168, pointerId: 1, isPrimary: true });
    fireEvent.pointerDown(board, { button: 0, clientX: 168, clientY: 168, pointerId: 2, isPrimary: false });
    fireEvent.pointerUp(board, { button: 0, clientX: 168, clientY: 168, pointerId: 2, isPrimary: false });
    fireEvent.pointerUp(board, { button: 0, clientX: 120, clientY: 168, pointerId: 1, isPrimary: true });
    expect(onTile).not.toHaveBeenCalled();
  });

  it("forgets the old touch when pause and resume happen before pointer release", () => {
    const { onTile, board, view } = setup();
    fireEvent.pointerDown(board, { button: 0, clientX: 120, clientY: 168, pointerId: 1 });
    view.rerender(<GardenBoard state={createGarden()} route={[]} callPulse={0} interactive={false} onTile={onTile} />);
    view.rerender(<GardenBoard state={createGarden()} route={[]} callPulse={0} interactive onTile={onTile} />);
    fireEvent.pointerUp(board, { button: 0, clientX: 120, clientY: 168, pointerId: 1 });
    expect(onTile).not.toHaveBeenCalled();
  });

  it("forgets a pending touch when a different garden replaces the scene", () => {
    const { onTile, board, view } = setup();
    fireEvent.pointerDown(board, { button: 0, clientX: 120, clientY: 168, pointerId: 1 });
    view.rerender(<GardenBoard state={createGarden("hydrangea-path")} route={[]} callPulse={0} interactive onTile={onTile} />);
    fireEvent.pointerUp(board, { button: 0, clientX: 120, clientY: 168, pointerId: 1 });
    expect(onTile).not.toHaveBeenCalled();
  });

  it("ignores releases outside the board instead of sending invalid tile coordinates", () => {
    const { onTile, board } = setup();
    fireEvent.pointerDown(board, { button: 0, clientX: 523, clientY: 168, pointerId: 1 });
    fireEvent.pointerUp(board, { button: 0, clientX: 530, clientY: 168, pointerId: 1 });
    expect(onTile).not.toHaveBeenCalled();
  });

  it.each([294, 326, 341])("maps a %d px mobile board accurately without changing its logical grid", (width) => {
    const { onTile, board } = setup();
    const left = 13;
    const top = 190;
    const height = width * 9 / 11;
    vi.mocked(board.getBoundingClientRect).mockReturnValue({ x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({}) });
    for (const point of [{ x: 1, y: 1 }, { x: 2, y: 7 }, { x: 9, y: 1 }, { x: 8, y: 6 }]) {
      const event = { button: 0, pointerId: 1, pointerType: "touch", clientX: left + (point.x + .5) * width / 11, clientY: top + (point.y + .5) * height / 9 };
      fireEvent.pointerDown(board, event);
      fireEvent.pointerUp(board, event);
      expect(onTile).toHaveBeenLastCalledWith(point);
    }
  });

  it("produces single-text SVG titles without warnings in server-rendered preview artwork", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const html = renderToStaticMarkup(<GardenBoard state={createGarden()} route={[]} callPulse={0} interactive={false} onTile={() => undefined} />);
    expect(errors).not.toHaveBeenCalled();
    expect(html).toContain("<title>橘子 · 等待呼唤</title>");
  });
});
