import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppBoundary from "./AppBoundary";

afterEach(() => vi.restoreAllMocks());

describe("individual application recovery", () => {
  it("renders healthy application content without an error notice", () => {
    render(<AppBoundary name="Notes" onBack={() => undefined}><p>A healthy note</p></AppBoundary>);
    expect(screen.getByText("A healthy note")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("contains an app failure and offers a working route back to the desktop", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const onBack = vi.fn();
    const simulated = new Error("Simulated chunk failure");
    const expectedError = (event: ErrorEvent) => { if (event.error === simulated) event.preventDefault(); };
    function BrokenApp(): never { throw simulated; }
    window.addEventListener("error", expectedError);
    try {
      render(<><span>Desktop remains mounted</span><AppBoundary name="Photography" onBack={onBack}><BrokenApp /></AppBoundary></>);
    } finally { window.removeEventListener("error", expectedError); }
    expect(screen.getByRole("alert")).toHaveTextContent("Photography");
    expect(screen.getByText("Desktop remains mounted")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "先回到桌面" }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "重新载入页面" })).toBeEnabled();
  });
});
