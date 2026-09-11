export type AppId =
  | "profile"
  | "resume"
  | "projects"
  | "photos"
  | "daily"
  | "music"
  | "cinema"
  | "games"
  | "food"
  | "atlas"
  | "notes"
  | "source"
  | "connect"
  | "cats";
export type WindowState = {
  id: AppId;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
};
export type WindowAction =
  | { type: "open"; window: WindowState }
  | { type: "focus" | "close" | "minimize" | "maximize"; id: AppId }
  | {
      type: "geometry";
      id: AppId;
      rect: Pick<WindowState, "x" | "y" | "width" | "height">;
    };

export function windowReducer(
  windows: WindowState[],
  action: WindowAction,
): WindowState[] {
  if (action.type === "open") {
    const previous = windows.find((window) => window.id === action.window.id);
    return [
      ...windows
        .filter((window) => window.id !== action.window.id)
        .map((window) => ({ ...window, minimized: true })),
      previous ? { ...previous, minimized: false } : action.window,
    ];
  }
  const target = windows.find((window) => window.id === action.id);
  if (!target) return windows;
  if (action.type === "close")
    return windows.filter((window) => window.id !== action.id);
  if (action.type === "focus")
    return [
      ...windows
        .filter((window) => window.id !== action.id)
        .map((window) => ({ ...window, minimized: true })),
      { ...target, minimized: false },
    ];
  return windows.map((window) =>
    window.id !== action.id
      ? window
      : action.type === "minimize"
        ? { ...window, minimized: true }
        : action.type === "maximize"
          ? { ...window, maximized: !window.maximized }
          : action.type === "geometry"
            ? { ...window, ...action.rect }
            : window,
  );
}

export function fitWindow(
  rect: Pick<WindowState, "x" | "y" | "width" | "height">,
  width: number,
  height: number,
) {
  const w = Math.min(rect.width, width);
  const h = Math.min(rect.height, height);
  return {
    width: w,
    height: h,
    x: Math.max(0, Math.min(rect.x, width - w)),
    y: Math.max(0, Math.min(rect.y, height - h)),
  };
}
