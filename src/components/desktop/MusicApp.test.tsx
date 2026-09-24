import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MusicApp from "./MusicApp";
import music from "@/data/chart-music.json";

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) { this.dispatchEvent(new Event("pause")); });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event("play"));
    this.dispatchEvent(new Event("playing"));
    return Promise.resolve();
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("music playback controls", () => {
  it("starts silent and changing sources does not start playback", async () => {
    const { container } = render(<MusicApp />);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "播放 Beautiful Things" }));
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "本站背景音" }));
    expect(container.querySelector("audio")?.src).toContain("/audio/lofi-ambient.mp3");
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "循环关闭" }));
    expect(container.querySelector("audio")?.loop).toBe(true);
  });
  it("keeps favorites view usable after saving and removing a song", () => {
    render(<MusicApp />);
    fireEvent.click(screen.getByRole("button", { name: "收藏 Espresso" }));
    fireEvent.click(screen.getByRole("button", { name: "收藏 1" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "取消收藏 Espresso" }));
    expect(screen.getByText("还没有收藏，点歌曲旁的爱心留下它。")).toBeInTheDocument();
  });
  it.each([true, false])("recovers focus after the final saved track is removed only for its focused control (%s)", focused => {
    render(<MusicApp />);
    fireEvent.click(screen.getByRole("button", { name: "收藏 Espresso" }));
    const filter = screen.getByRole("button", { name: "收藏 1" });
    fireEvent.click(filter);
    const remove = screen.getByRole("button", { name: "取消收藏 Espresso" });
    (focused ? remove : filter).focus();
    fireEvent.click(remove);
    expect(remove).not.toBeInTheDocument();
    if (focused) {
      const reset = screen.getByRole("button", { name: "查看全部歌曲" });
      expect(reset).toHaveFocus();
      fireEvent.click(reset);
      expect(filter).toHaveFocus();
    } else expect(filter).toHaveFocus();
  });
  it("resolves the bundled clip under the configured deployment base", () => {
    vi.stubEnv("BASE_URL", "/personal-desktop/");
    const { container } = render(<MusicApp />);
    fireEvent.click(screen.getByRole("button", { name: "本站背景音" }));
    expect(container.querySelector("audio")?.getAttribute("src")).toBe("/personal-desktop/audio/lofi-ambient.mp3");
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });
  it("reports failed playback and offers retry without pretending to play", async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error("network"));
    render(<MusicApp />);
    fireEvent.click(screen.getByRole("button", { name: "播放音乐" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("音频暂时无法播放");
    expect(screen.getByRole("button", { name: "重试播放" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "播放音乐" })).toBeInTheDocument();
  });
  it("ignores a stale playback error after the user cancels loading", async () => {
    let rejectPlayback: (reason: Error) => void = () => {};
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(() => new Promise<void>((_, reject) => { rejectPlayback = reject; }));
    render(<MusicApp />);
    fireEvent.click(screen.getByRole("button", { name: "播放音乐" }));
    fireEvent.click(screen.getByRole("button", { name: "取消加载" }));
    await act(async () => { rejectPlayback(new Error("cancelled")); });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "播放音乐" })).toBeInTheDocument();
  });
  it("shows a storage warning while keeping in-session controls usable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<MusicApp />);
    fireEvent.click(screen.getByRole("button", { name: "收藏 Espresso" }));
    expect(screen.getByRole("button", { name: "取消收藏 Espresso" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/收藏或播放设置暂时只保留在本次浏览中/)).toBeInTheDocument();
  });
  it("releases the old media resource on unmount", async () => {
    const { container, unmount } = render(<MusicApp />);
    const audio = container.querySelector("audio")!;
    fireEvent.click(screen.getByRole("button", { name: "播放音乐" }));
    await act(async () => {});
    vi.mocked(HTMLMediaElement.prototype.pause).mockClear();
    vi.mocked(HTMLMediaElement.prototype.load).mockClear();
    unmount();
    expect(audio).not.toHaveAttribute("src");
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(1);
  });
  it("stays silent after rapid next/next/cancel even when old requests settle out of order", async () => {
    const requests: { resolve: () => void; reject: (reason: Error) => void }[] = [];
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementation(() => new Promise<void>((resolve, reject) => { requests.push({ resolve, reject }); }));
    const { container } = render(<MusicApp />);
    const first = container.querySelector("audio")!;
    fireEvent.click(screen.getByRole("button", { name: "播放音乐" }));
    fireEvent.click(screen.getByRole("button", { name: "下一首" }));
    const second = container.querySelector("audio")!;
    fireEvent.click(screen.getByRole("button", { name: "下一首" }));
    const third = container.querySelector("audio")!;
    expect(requests).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "取消加载" }));
    await act(async () => { requests[1].resolve(); requests[2].reject(new Error("aborted current")); requests[0].reject(new Error("aborted first")); });
    for (const audio of [first, second, third]) {
      expect(audio).not.toHaveAttribute("src");
      fireEvent.playing(audio);
      fireEvent.waiting(audio);
      fireEvent.ended(audio);
      fireEvent.error(audio);
    }
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "播放音乐" })).toBeInTheDocument();
    expect(requests).toHaveLength(3);
  });
  it("does not let a closed player's pending request disturb a silent reopened player", async () => {
    let resolveOld = () => {};
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(() => new Promise<void>(resolve => { resolveOld = resolve; }));
    const first = render(<MusicApp />);
    const oldAudio = first.container.querySelector("audio")!;
    fireEvent.click(screen.getByRole("button", { name: "播放音乐" }));
    first.unmount();
    const reopened = render(<MusicApp />);
    const freshAudio = reopened.container.querySelector("audio")!;
    expect(freshAudio).not.toBe(oldAudio);
    await act(async () => { resolveOld(); });
    fireEvent.playing(oldAudio);
    fireEvent.error(oldAudio);
    expect(oldAudio).not.toHaveAttribute("src");
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "播放音乐" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "播放音乐" }));
    await act(async () => {});
    expect(screen.getByRole("button", { name: "暂停音乐" })).toBeInTheDocument();
  });
  it("protects unreadable preferences for the whole mount and recovers them on reopening", () => {
    const stored = JSON.stringify({ volume: .64, repeat: true });
    localStorage.setItem("leo-music-preferences-v2", stored);
    const getItem = Storage.prototype.getItem;
    const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
      if (key === "leo-music-preferences-v2") throw new Error("temporarily unreadable");
      return getItem.call(this, key);
    });
    const first = render(<MusicApp />);
    read.mockRestore();
    fireEvent.change(screen.getByRole("slider", { name: "音量" }), { target: { value: ".12" } });
    expect(localStorage.getItem("leo-music-preferences-v2")).toBe(stored);
    expect(screen.getByText(/无法读取这台设备中的收藏或播放设置/)).toBeInTheDocument();
    first.unmount();
    const reopened = render(<MusicApp />);
    expect(screen.getByRole("slider", { name: "音量" })).toHaveValue("0.64");
    expect(reopened.container.querySelector("audio")?.volume).toBe(.64);
    expect(screen.getByRole("button", { name: "循环已开" })).toBeInTheDocument();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });
  it("does not replace another tab's music settings or switch the current controls to its values", () => {
    const { container } = render(<MusicApp />);
    const external = JSON.stringify({ volume: .73, repeat: true });
    act(() => {
      localStorage.setItem("leo-music-preferences-v2", external);
      window.dispatchEvent(new StorageEvent("storage", { key: "leo-music-preferences-v2", newValue: external, storageArea: localStorage }));
    });
    expect(screen.getByRole("slider", { name: "音量" })).toHaveValue("0.35");
    expect(screen.getByRole("button", { name: "循环关闭" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: "音量" }), { target: { value: ".2" } });
    expect(container.querySelector("audio")?.volume).toBe(.2);
    expect(localStorage.getItem("leo-music-preferences-v2")).toBe(external);
    expect(screen.getByText(/其他窗口或标签页更改了收藏或播放设置/)).toBeInTheDocument();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });
  it("isolates source events and reapplies the saved volume to the new audio element", async () => {
    localStorage.setItem("leo-music-preferences-v2", JSON.stringify({ volume: .17, repeat: false }));
    const { container } = render(<MusicApp />);
    const oldAudio = container.querySelector("audio")!;
    fireEvent.click(screen.getByRole("button", { name: "播放音乐" }));
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "本站背景音" }));
    const newAudio = container.querySelector("audio")!;
    expect(newAudio).not.toBe(oldAudio);
    expect(oldAudio).not.toHaveAttribute("src");
    expect(newAudio.volume).toBe(.17);
    fireEvent.play(oldAudio);
    fireEvent.playing(oldAudio);
    fireEvent.error(oldAudio);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "播放音乐" })).toBeInTheDocument();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });
  it("keeps the play intent when skipping a still-loading track and ignores its stale rejection", async () => {
    let rejectOld: (reason: Error) => void = () => {};
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(() => new Promise<void>((_, reject) => { rejectOld = reject; }));
    const { container } = render(<MusicApp />);
    const oldAudio = container.querySelector("audio")!;
    fireEvent.click(screen.getByRole("button", { name: "播放音乐" }));
    fireEvent.click(screen.getByRole("button", { name: "下一首" }));
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2));
    expect(oldAudio).not.toHaveAttribute("src");
    expect(container.querySelector("audio")).toHaveAttribute("src", music.tracks[1].previewUrl);
    await act(async () => { rejectOld(new Error("old request failed")); });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "暂停音乐" })).toBeInTheDocument();
  });
  it("ignores late native events after cancellation and restores the URL on retry", async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(() => new Promise<void>(() => {}));
    const { container } = render(<MusicApp />);
    const audio = container.querySelector("audio")!;
    fireEvent.click(screen.getByRole("button", { name: "播放音乐" }));
    fireEvent.click(screen.getByRole("button", { name: "取消加载" }));
    expect(audio).not.toHaveAttribute("src");
    fireEvent.play(audio);
    fireEvent.playing(audio);
    fireEvent.error(audio);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "播放音乐" }));
    await act(async () => {});
    expect(audio).toHaveAttribute("src", music.tracks[0].previewUrl);
    expect(screen.getByRole("button", { name: "暂停音乐" })).toBeInTheDocument();
  });
  it("releases a timed-out request and permits a fresh retry", async () => {
    vi.useFakeTimers();
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(() => new Promise<void>(() => {}));
    const { container } = render(<MusicApp />);
    const audio = container.querySelector("audio")!;
    fireEvent.click(screen.getByRole("button", { name: "播放音乐" }));
    act(() => vi.advanceTimersByTime(14999));
    expect(screen.getByRole("button", { name: "取消加载" })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("alert")).toHaveTextContent("载入时间较长");
    expect(audio).not.toHaveAttribute("src");
    fireEvent.click(screen.getByRole("button", { name: "重试播放" }));
    await act(async () => {});
    expect(audio).toHaveAttribute("src", music.tracks[0].previewUrl);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "暂停音乐" })).toBeInTheDocument();
  });
  it("gives a newly selected loading track its own timeout window", () => {
    vi.useFakeTimers();
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementation(() => new Promise<void>(() => {}));
    render(<MusicApp />);
    fireEvent.click(screen.getByRole("button", { name: "播放音乐" }));
    act(() => vi.advanceTimersByTime(10000));
    fireEvent.click(screen.getByRole("button", { name: "下一首" }));
    act(() => vi.advanceTimersByTime(14999));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消加载" })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("alert")).toHaveTextContent("载入时间较长");
  });
  it("preserves the current source and seek position for an ordinary pause and resume", async () => {
    const { container } = render(<MusicApp />);
    const audio = container.querySelector("audio")!;
    fireEvent.click(screen.getByRole("button", { name: "播放音乐" }));
    await act(async () => {});
    Object.defineProperty(audio, "duration", { configurable: true, value: 30 });
    fireEvent.loadedMetadata(audio);
    audio.currentTime = 7;
    fireEvent.timeUpdate(audio);
    vi.mocked(HTMLMediaElement.prototype.load).mockClear();
    fireEvent.click(screen.getByRole("button", { name: "暂停音乐" }));
    expect(audio).toHaveAttribute("src", music.tracks[0].previewUrl);
    expect(screen.getByRole("slider", { name: "播放进度" })).toHaveValue("7");
    fireEvent.click(screen.getByRole("button", { name: "播放音乐" }));
    await act(async () => {});
    expect(audio.currentTime).toBe(7);
    expect(HTMLMediaElement.prototype.load).not.toHaveBeenCalled();
  });
  it("explains recovered settings and keeps old favorite IDs from filling the list", () => {
    localStorage.setItem("leo-music-favorites-v2", JSON.stringify(Array.from({ length: 100 }, () => -1)));
    localStorage.setItem("leo-music-preferences-v2", '{"volume":"old"}');
    render(<MusicApp />);
    expect(screen.getByText(/已在本机保留备份/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "收藏 Espresso" }));
    expect(JSON.parse(localStorage.getItem("leo-music-favorites-v2")!)).toEqual([music.tracks[6].trackId]);
  });
  it("uses responsive local cover art and isolates all official outbound links", () => {
    render(<MusicApp />);
    expect(screen.getByRole("img", { name: "桌面封面：海边路灯" })).toHaveAttribute("srcset", expect.stringContaining("160w"));
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(new URL(link.getAttribute("href")!).protocol).toBe("https:");
    }
  });
});
