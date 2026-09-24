import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAssetDownload } from "@/hooks/use-asset-download";
import { filterMedia } from "@/data/media";
import { AssetDownloadFeedback } from "./AssetDownloadFeedback";
import { PhotographyApp } from "./CollectionApps";
import { CollectionViewer } from "./GalleryApp";
import SandboxApp from "./SandboxApp";

const NativeURL = URL;
const href = "/assets/photo-1.jpg";
const filename = "photo-1.jpg";
const privateFailure = () => { throw new Error("Private native failure details"); };
let clicked: { href: string; filename: string; connected: boolean; hidden: boolean }[];

function photoBlob() { return new Blob([new Uint8Array([255, 216, 0, 16, 255, 217])], { type: "image/jpeg" }); }
function response(blob = photoBlob(), ok = true) { return { ok, blob: vi.fn().mockResolvedValue(blob) } as unknown as Response; }
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function Harness({ source = href, name = filename, kind = "image", target, observed }: {
  source?: string; name?: string; kind?: "image" | "html"; target?: string; observed?: (prevented: boolean) => void;
}) {
  const download = useAssetDownload(source, name, kind);
  return <section onClick={event => {
    observed?.(event.defaultPrevented);
    // Observe the hook's decision, then suppress jsdom's native navigation.
    event.preventDefault();
  }} onAuxClick={event => { observed?.(event.defaultPrevented); event.preventDefault(); }}>
    <a ref={download.linkRef} href={source} download={name} target={target} aria-label="下载测试文件" aria-busy={download.status === "preparing"} aria-describedby={download.status === "idle" ? undefined : download.statusId} onClick={download.onClick}>下载</a>
    <AssetDownloadFeedback download={download} />
  </section>;
}
function start() { fireEvent.click(screen.getByRole("link", { name: "下载测试文件" })); }

beforeEach(() => {
  localStorage.clear();
  clicked = [];
  let nextUrl = 0;
  class DownloadURL extends NativeURL {
    static createObjectURL = vi.fn(() => `blob:asset-test-${++nextUrl}`);
    static revokeObjectURL = vi.fn();
  }
  vi.stubGlobal("URL", DownloadURL);
  vi.stubGlobal("fetch", vi.fn());
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push({ href: this.href, filename: this.download, connected: this.isConnected, hidden: this.hidden });
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("asset download link contract", () => {
  it.each([1, 0])("fetches original bytes for an unmodified click (detail=%s), preserving link semantics and filename", async detail => {
    const request = deferred<Response>();
    const original = photoBlob();
    const observed = vi.fn();
    vi.mocked(fetch).mockReturnValueOnce(request.promise);
    render(<Harness observed={observed} />);
    const link = screen.getByRole("link", { name: "下载测试文件" });
    expect(link).toHaveAttribute("href", href);
    expect(link).toHaveAttribute("download", filename);
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(link, { button: 0, detail });
    expect(observed).toHaveBeenLastCalledWith(true);
    expect(link).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("正在准备原图下载");
    expect(link).toHaveAttribute("aria-describedby", screen.getByRole("status").id);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(new NativeURL(href, window.location.href).href, {
      signal: expect.any(AbortSignal), mode: "same-origin", credentials: "same-origin", redirect: "error",
    });
    await act(async () => request.resolve(response(original)));
    expect(URL.createObjectURL).toHaveBeenCalledExactlyOnceWith(original);
    expect(clicked).toEqual([{ href: "blob:asset-test-1", filename, connected: true, hidden: true }]);
    expect(document.querySelector('a[href="blob:asset-test-1"]')).not.toBeInTheDocument();
    expect(link).toHaveAttribute("aria-busy", "false");
    expect(screen.getByRole("status")).toHaveTextContent("已发起下载，请查看浏览器下载记录");
    expect(screen.getByRole("status")).not.toHaveTextContent("下载完成");
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    const fallback = screen.getByRole("link", { name: "打开原图" });
    expect(fallback).toHaveAttribute("href", href);
    expect(fallback).toHaveAttribute("target", "_blank");
    expect(fallback).toHaveAttribute("rel", "noopener noreferrer");
    fireEvent.click(fallback);
    expect(observed).toHaveBeenLastCalledWith(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { button: 2 },
  ])("preserves the native action for modified/non-left clicks: %j", async options => {
    const observed = vi.fn();
    render(<Harness observed={observed} />);
    const link = screen.getByRole("link", { name: "下载测试文件" });
    if ("button" in options) fireEvent(link, new MouseEvent("auxclick", { ...options, bubbles: true, cancelable: true }));
    else fireEvent.click(link, options);
    expect(fetch).not.toHaveBeenCalled();
    if (observed.mock.calls.length) expect(observed).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each([
    { target: "_blank", source: href },
    { target: undefined, source: "https://external.example/photo.jpg" },
  ])("leaves explicit new tabs and nonlocal assets to the browser: %j", props => {
    const observed = vi.fn();
    render(<Harness {...props} observed={observed} />);
    start();
    expect(observed).toHaveBeenLastCalledWith(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not start a second request while preparation is pending", () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    render(<Harness />);
    start(); start();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "取消准备" })).toBeInTheDocument();
  });
});

describe("asset download cancellation and cleanup", () => {
  it.each(["cancel", "finish", "fail"])("restores the download link when its focused cancel control disappears on %s", async outcome => {
    const request = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(request.promise);
    render(<Harness />);
    start();
    const cancel = screen.getByRole("button", { name: "取消准备" });
    cancel.focus();
    if (outcome === "cancel") fireEvent.click(cancel);
    else await act(async () => { if (outcome === "finish") request.resolve(response()); else request.reject(new Error("network failure")); });
    expect(cancel).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "下载测试文件" })).toHaveFocus();
  });

  it("does not steal focus when preparation ends after the visitor has moved to the fallback link", async () => {
    const request = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(request.promise);
    render(<Harness />);
    start();
    screen.getByRole("button", { name: "取消准备" }).focus();
    const fallback = screen.getByRole("link", { name: "打开原图" });
    fallback.focus();
    await act(async () => request.resolve(response()));
    expect(fallback).toHaveFocus();
  });

  it.each(["resolve", "reject", "HTTP error"])("ignores a cancelled request's late %s while a new request is pending", async outcome => {
    const older = deferred<Response>(), current = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(older.promise).mockReturnValueOnce(current.promise);
    render(<Harness />);
    start();
    const oldSignal = vi.mocked(fetch).mock.calls[0][1]!.signal!;
    fireEvent.click(screen.getByRole("button", { name: "取消准备" }));
    expect(oldSignal.aborted).toBe(true);
    expect(screen.getByRole("status")).toHaveTextContent("已取消下载准备");
    start();
    const newSignal = vi.mocked(fetch).mock.calls[1][1]!.signal!;
    expect(newSignal.aborted).toBe(false);
    await act(async () => {
      if (outcome === "reject") older.reject(new Error("late abort"));
      else older.resolve(response(photoBlob(), outcome !== "HTTP error"));
    });
    expect(newSignal.aborted).toBe(false);
    expect(screen.getByRole("status")).toHaveTextContent("正在准备原图下载");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    await act(async () => current.resolve(response()));
    expect(clicked).toHaveLength(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each(["source", "filename"])("aborts an in-flight blob reader when the %s changes", async changed => {
    const body = deferred<Blob>();
    const pendingResponse = response();
    vi.mocked(pendingResponse.blob).mockReturnValueOnce(body.promise);
    vi.mocked(fetch).mockResolvedValueOnce(pendingResponse).mockResolvedValueOnce(response());
    const view = render(<Harness />);
    start();
    await waitFor(() => expect(pendingResponse.blob).toHaveBeenCalledOnce());
    const oldSignal = vi.mocked(fetch).mock.calls[0][1]!.signal!;
    view.rerender(<Harness source={changed === "source" ? "/assets/photo-2.jpg" : href} name="photo-2.jpg" />);
    expect(oldSignal.aborted).toBe(true);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await act(async () => body.resolve(photoBlob()));
    expect(clicked).toHaveLength(0);
    start();
    await waitFor(() => expect(clicked).toHaveLength(1));
    expect(clicked[0].filename).toBe("photo-2.jpg");
  });

  it.each(["response", "blob"])("aborts on unmount and discards a late %s without allocating an object URL", async stage => {
    const request = deferred<Response>(), body = deferred<Blob>();
    const pendingResponse = response();
    vi.mocked(pendingResponse.blob).mockReturnValueOnce(body.promise);
    vi.mocked(fetch).mockReturnValueOnce(stage === "response" ? request.promise : Promise.resolve(pendingResponse));
    const view = render(<Harness />);
    start();
    if (stage === "blob") await waitFor(() => expect(pendingResponse.blob).toHaveBeenCalledOnce());
    const signal = vi.mocked(fetch).mock.calls[0][1]!.signal!;
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { request.resolve(response()); body.resolve(photoBlob()); });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(clicked).toHaveLength(0);
  });

  it("retains an initiated URL through unmount, then revokes it once after 60 seconds", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue(response());
    const view = render(<Harness />);
    await act(async () => start());
    expect(clicked).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1200));
    view.unmount();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(58_800));
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:asset-test-1");
  });

  it("reclaims consecutive downloads on their own deadlines and tolerates document teardown", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue(response());
    render(<Harness />);
    await act(async () => start());
    act(() => vi.advanceTimersByTime(20_000));
    await act(async () => start());
    act(() => vi.advanceTimersByTime(40_000));
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:asset-test-1");
    vi.mocked(URL.revokeObjectURL).mockImplementationOnce(privateFailure);
    expect(() => act(() => vi.advanceTimersByTime(20_000))).not.toThrow();
    expect(URL.revokeObjectURL).toHaveBeenLastCalledWith("blob:asset-test-2");
  });
});

describe("asset download failures", () => {
  it.each(["network", "HTTP", "blob reader", "empty blob", "HTML fallback", "object URL", "DOM creation", "DOM attachment", "click"])("reports a %s failure, preserves the original link, cleans up and permits retry", async failure => {
    const request = deferred<Response>();
    const original = photoBlob();
    const result = response(original, failure !== "HTTP");
    vi.mocked(fetch).mockReturnValueOnce(request.promise).mockResolvedValueOnce(response(original));
    render(<Harness />);
    start();
    const signal = vi.mocked(fetch).mock.calls[0][1]!.signal!;
    if (failure === "blob reader") vi.mocked(result.blob).mockRejectedValueOnce(new Error("private body error"));
    if (failure === "empty blob") vi.mocked(result.blob).mockResolvedValueOnce(new Blob([], { type: "image/jpeg" }));
    if (failure === "HTML fallback") vi.mocked(result.blob).mockResolvedValueOnce(new Blob(["<html>not the original</html>"], { type: "text/html" }));
    if (failure === "object URL") vi.mocked(URL.createObjectURL).mockImplementationOnce(privateFailure);
    if (failure === "DOM creation") vi.spyOn(document, "createElement").mockImplementationOnce(privateFailure);
    if (failure === "DOM attachment") vi.spyOn(document.body, "appendChild").mockImplementationOnce(privateFailure);
    if (failure === "click") vi.mocked(HTMLAnchorElement.prototype.click).mockImplementationOnce(privateFailure);
    await act(async () => { if (failure === "network") request.reject(new Error("private request error")); else request.resolve(result); });
    expect(signal.aborted).toBe(true);
    if (failure === "HTTP") expect(result.blob).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("下载未能发起");
    expect(screen.getByRole("alert")).not.toHaveTextContent(/private/i);
    expect(screen.queryByText(/已发起下载/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "下载测试文件" })).toHaveAttribute("href", href);
    expect(screen.getByRole("link", { name: "打开原图" })).toHaveAttribute("href", href);
    expect(document.querySelector('a[href^="blob:"]')).not.toBeInTheDocument();
    if (["DOM creation", "DOM attachment", "click"].includes(failure)) expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:asset-test-1");
    else expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    start();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("已发起下载"));
    expect(URL.createObjectURL).toHaveBeenLastCalledWith(original);
    expect(clicked).toHaveLength(1);
  });
});

describe("original asset integrations", () => {
  it("enhances the Photography link without changing its aria-label, filename or original source", async () => {
    const item = filterMedia("photos")[0], original = photoBlob();
    vi.mocked(fetch).mockResolvedValueOnce(response(original));
    render(<PhotographyApp favorites={[]} toggleFavorite={vi.fn()} />);
    const link = screen.getByRole("link", { name: "下载照片" });
    expect(link).toHaveAttribute("href", item.image);
    expect(link).toHaveAttribute("download", item.file);
    fireEvent.click(link);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("已发起下载"));
    expect(clicked[0].filename).toBe(item.file);
    expect(URL.createObjectURL).toHaveBeenCalledExactlyOnceWith(original);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(new NativeURL(item.image, window.location.href).href);
  });

  it("enhances the viewer link while keeping the original image and basename", async () => {
    const item = filterMedia("films")[0], original = photoBlob();
    vi.mocked(fetch).mockResolvedValueOnce(response(original));
    render(<CollectionViewer selected={item} items={[item]} onSelect={vi.fn()} onClose={vi.fn()} />);
    const dialog = within(screen.getByRole("dialog"));
    const link = dialog.getByRole("link", { name: "保存图片" });
    expect(link).toHaveAttribute("href", item.image);
    expect(link).toHaveAttribute("download", item.file.split("/").pop());
    fireEvent.click(link);
    await waitFor(() => expect(dialog.getByRole("status")).toHaveTextContent("已发起下载"));
    expect(clicked[0].filename).toBe(item.file.split("/").pop());
    expect(URL.createObjectURL).toHaveBeenCalledExactlyOnceWith(original);
  });

  it("downloads the sandbox HTML verbatim with BASE_URL, query and independent opening preserved", async () => {
    vi.stubEnv("BASE_URL", "/studio/");
    const source = "/studio/construction-sandbox.html?v=studio-v2";
    const request = deferred<Response>();
    const original = new Blob(['<!doctype html><meta charset="utf-8"><script>const scene = "unchanged";</script>'], { type: "text/html;charset=utf-8" });
    vi.mocked(fetch).mockReturnValueOnce(request.promise);
    render(<SandboxApp active />);
    const frame = screen.getByTitle("Little Works 建筑工地沙盘");
    const link = screen.getByRole("link", { name: "离线版" });
    expect(link).toHaveAttribute("href", source);
    expect(link).toHaveAttribute("download", "little-works-studio-v2.html");
    expect(screen.getByRole("link", { name: "独立打开" })).toHaveAttribute("href", source);
    expect(screen.getByRole("link", { name: "独立打开" })).toHaveAttribute("target", "_blank");
    fireEvent.click(link);
    expect(screen.getByText("正在准备离线版下载…")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开离线版" })).toHaveAttribute("href", source);
    await act(async () => request.resolve(response(original)));
    expect(URL.createObjectURL).toHaveBeenCalledExactlyOnceWith(original);
    expect(clicked[0].filename).toBe("little-works-studio-v2.html");
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(new NativeURL(source, window.location.href).href);
    expect(screen.getByTitle("Little Works 建筑工地沙盘")).toBe(frame);
    expect(frame).toHaveAttribute("src", `${source}&load=0`);
    expect(screen.getByText(/已发起下载，请查看浏览器下载记录/)).toBeInTheDocument();
  });
});
