import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLayoutEffect } from "react";
import StudioNotes from "./StudioNotes";
import { MAX_NOTES_BACKUP_BYTES, type Note } from "./notes-model";

const storageKey = "leo-desktop-notes-v1";
const first: Note = { id: "one", title: "窗边", body: "原来的文字", updated: "2026-09-12T08:00:00Z" };
const second: Note = { id: "two", title: "电影", body: "Interstellar", updated: "2026-09-11T08:00:00Z" };

function readNotes(): Note[] { return JSON.parse(localStorage.getItem(storageKey)!); }
function start(notes: Note[] = [first, second], mobile = false) {
  localStorage.setItem(storageKey, JSON.stringify(notes));
  vi.spyOn(window, "matchMedia").mockImplementation(query => ({ matches: mobile, media: query, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() }));
  return render(<StudioNotes />);
}
function backupFile(read: () => Promise<string>, size?: number) {
  const file = new File(["{}"], "notes.json", { type: "application/json" });
  Object.defineProperty(file, "text", { value: read });
  if (size !== undefined) Object.defineProperty(file, "size", { value: size });
  return file;
}
function importFile(file: File) {
  fireEvent.change(screen.getByLabelText("选择便签备份文件"), { target: { files: [file] } });
}
function deferredText() {
  let resolve!: (text: string) => void;
  const promise = new Promise<string>(value => { resolve = value; });
  return { promise, resolve };
}
function readDownload() {
  const calls = vi.mocked(URL.createObjectURL).mock.calls;
  const blob = calls[calls.length - 1][0] as Blob;
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}
const NativeURL = URL;
const NativeBlob = Blob;
beforeEach(() => {
  localStorage.clear();
  class DownloadURL extends NativeURL {
    static createObjectURL = vi.fn(() => "blob:notes-test");
    static revokeObjectURL = vi.fn();
  }
  vi.stubGlobal("URL", DownloadURL);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Field Notes editing and recovery", () => {
  it("keeps existing text under the legacy key and persists edits", () => {
    const view = start();
    expect(screen.getByRole("textbox", { name: "笔记内容" })).toHaveValue("原来的文字");
    fireEvent.change(screen.getByRole("textbox", { name: "笔记标题" }), { target: { value: "新的标题" } });
    fireEvent.change(screen.getByRole("textbox", { name: "笔记内容" }), { target: { value: "我自己的文字\n第二行" } });
    expect(readNotes().find(note => note.id === "one")?.body).toBe("我自己的文字\n第二行");
    view.unmount();
    render(<StudioNotes />);
    expect(screen.getByRole("textbox", { name: "笔记标题" })).toHaveValue("新的标题");
  });

  it("searches body text without case sensitivity and puts pinned notes first", () => {
    start();
    fireEvent.change(screen.getByRole("textbox", { name: "搜索笔记" }), { target: { value: " INTERSTELLAR " } });
    const list = screen.getByRole("navigation", { name: "便签列表" });
    expect(within(list).getAllByRole("button")).toHaveLength(1);
    fireEvent.click(within(list).getByRole("button", { name: /电影/ }));
    fireEvent.click(screen.getByRole("button", { name: "置顶便签" }));
    fireEvent.click(screen.getByRole("button", { name: "清空搜索" }));
    expect(within(list).getAllByRole("button")[0]).toHaveTextContent("电影");
    expect(readNotes().find(note => note.id === "two")?.pinned).toBe(true);
  });

  it("soft-deletes into read-only trash and restores the original text for editing", () => {
    start();
    fireEvent.click(screen.getByRole("button", { name: "移到最近删除" }));
    expect(readNotes()).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "最近删除 · 1" }));
    const body = screen.getByRole("textbox", { name: "笔记内容" });
    expect(body).toHaveValue("原来的文字");
    expect(body).toHaveAttribute("readonly");
    fireEvent.change(body, { target: { value: "不能意外覆盖" } });
    expect(readNotes().find(note => note.id === "one")?.body).toBe("原来的文字");
    fireEvent.click(screen.getByRole("button", { name: "恢复便签" }));
    expect(screen.getByRole("textbox", { name: "笔记内容" })).not.toHaveAttribute("readonly");
    expect(screen.getByRole("textbox", { name: "笔记内容" })).toHaveValue("原来的文字");
    expect(readNotes().find(note => note.id === "one")?.deletedAt).toBeNull();
  });

  it("requires confirmation before a permanent delete and makes cancellation safe", async () => {
    start([first, { ...second, deletedAt: "2026-09-12T09:00:00Z" }]);
    fireEvent.click(screen.getByRole("button", { name: "最近删除 · 1" }));
    const trigger = screen.getByRole("button", { name: "永久删除这篇便签" });
    fireEvent.click(trigger);
    const confirmation = screen.getByRole("alertdialog");
    expect(readNotes()).toHaveLength(2);
    const cancel = within(confirmation).getByRole("button", { name: "取消，保留便签" });
    await waitFor(() => expect(cancel).toHaveFocus());
    fireEvent.click(cancel);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(readNotes()).toHaveLength(2);
    await waitFor(() => expect(trigger).toHaveFocus());
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "确认永久删除 1 篇" }));
    expect(readNotes()).toEqual([first]);
  });

  it("can genuinely free a slot at the 200-note limit without deleting active notes", () => {
    const full = Array.from({ length: 200 }, (_, index) => ({ ...first, id: `note-${index}`, title: `便签 ${index}`, ...(index === 199 ? { deletedAt: "2026-09-12T09:00:00Z" } : {}) }));
    start(full);
    fireEvent.click(screen.getByRole("button", { name: "新建笔记" }));
    expect(readNotes()).toHaveLength(200);
    fireEvent.click(screen.getByRole("button", { name: "整理最近删除" }));
    fireEvent.click(screen.getByRole("button", { name: "清空最近删除" }));
    expect(readNotes()).toHaveLength(200);
    fireEvent.click(screen.getByRole("button", { name: "确认永久删除 1 篇" }));
    expect(readNotes()).toEqual(full.slice(0, 199));
    fireEvent.click(screen.getByRole("button", { name: "新建笔记" }));
    expect(readNotes()).toHaveLength(200);
    expect(screen.getByRole("textbox", { name: "笔记标题" })).toHaveValue("");
  });

  it("keeps malformed original data available for raw recovery export", async () => {
    const raw = "important unfinished {";
    localStorage.setItem(storageKey, raw);
    render(<StudioNotes />);
    expect(screen.getByRole("button", { name: "导出原始数据" })).toBeInTheDocument();
    const recoveryKey = Object.keys(localStorage).find(key => key.startsWith(`${storageKey}:recovery:`));
    expect(localStorage.getItem(recoveryKey!)).toBe(raw);
    fireEvent.click(screen.getByRole("button", { name: "导出原始数据" }));
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(await readDownload()).toBe(raw);
  });

  it("backs up active notes, pins and recoverable trash together", async () => {
    const notes = [first, { ...second, pinned: true, deletedAt: "2026-09-12T09:00:00Z" }];
    start(notes);
    fireEvent.click(screen.getByRole("button", { name: "备份全部" }));
    const backup = JSON.parse(await readDownload());
    expect(backup).toMatchObject({ format: "haonan-notes", version: 1, notes });
    expect(readNotes()).toEqual(notes);
  });

  it("exports current text with the keyboard shortcut without clearing it", async () => {
    start([first]);
    const body = screen.getByRole("textbox", { name: "笔记内容" });
    fireEvent.change(body, { target: { value: "最后一次编辑" } });
    fireEvent.keyDown(body, { key: "s", ctrlKey: true });
    expect(await readDownload()).toBe("窗边\n\n最后一次编辑");
    expect(readNotes()[0].body).toBe("最后一次编辑");
  });

  it("keeps edits available in memory when browser storage is blocked", () => {
    start([first]);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
    fireEvent.change(screen.getByRole("textbox", { name: "笔记内容" }), { target: { value: "仍在本次浏览中" } });
    expect(screen.getByRole("textbox", { name: "笔记内容" })).toHaveValue("仍在本次浏览中");
    expect(screen.getByText("未能保存，请导出备份")).toBeInTheDocument();
    expect(readNotes()[0].body).toBe("原来的文字");
  });

  it("exports a temporary draft without overwriting unreadable original notes and restores them on reopen", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => { throw new Error("Read denied once"); });
    const view = start([first]);
    expect(screen.getByRole("alert")).toHaveTextContent("本次编辑仅保留在内存中");
    fireEvent.change(screen.getByRole("textbox", { name: "笔记内容" }), { target: { value: "先导出这段临时文字" } });
    expect(screen.getByText("未能保存，请导出备份")).toBeInTheDocument();
    expect(readNotes()).toEqual([first]);
    fireEvent.click(screen.getByRole("button", { name: "导出笔记" }));
    expect(await readDownload()).toContain("先导出这段临时文字");
    expect(readNotes()).toEqual([first]);
    view.unmount();
    render(<StudioNotes />);
    expect(screen.getByRole("textbox", { name: "笔记内容" })).toHaveValue("原来的文字");
    expect(screen.getByText("已保存在此浏览器")).toBeInTheDocument();
  });

  it.each([false, true])("exports current temporary notes after an external change without replacing either copy (storage event=%s)", async emitEvent => {
    const view = start([first]);
    const body = screen.getByRole("textbox", { name: "笔记内容" });
    fireEvent.change(body, { target: { value: "本窗口正在写的草稿" } });
    const external = JSON.stringify([{ ...first, body: "另一窗口保存的内容" }]);
    act(() => {
      localStorage.setItem(storageKey, external);
      if (emitEvent) window.dispatchEvent(new StorageEvent("storage", { key: storageKey, newValue: external, storageArea: localStorage }));
    });
    expect(body).toHaveValue("本窗口正在写的草稿");
    fireEvent.change(body, { target: { value: "冲突后继续写的临时草稿" } });
    expect(localStorage.getItem(storageKey)).toBe(external);
    expect(body).toHaveValue("冲突后继续写的临时草稿");
    expect(screen.getByRole("alert")).toHaveTextContent("其他窗口或标签页");
    expect(screen.getByText("未能保存，请导出备份")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "导出笔记" }));
    expect(await readDownload()).toBe("窗边\n\n冲突后继续写的临时草稿");
    expect(screen.getByRole("alert")).toHaveTextContent("先导出备份");
    fireEvent.click(screen.getByRole("button", { name: "备份全部" }));
    expect(JSON.parse(await readDownload()).notes[0].body).toBe("冲突后继续写的临时草稿");
    expect(localStorage.getItem(storageKey)).toBe(external);
    view.unmount();
    render(<StudioNotes />);
    expect(screen.getByRole("textbox", { name: "笔记内容" })).toHaveValue("另一窗口保存的内容");
    expect(screen.getByText("已保存在此浏览器")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("announces a read failure discovered while saving and still exports the current draft", async () => {
    start([first]);
    vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => { throw new Error("Read failed on save"); });
    fireEvent.change(screen.getByRole("textbox", { name: "笔记内容" }), { target: { value: "读取失败后仍可带走" } });
    expect(readNotes()).toEqual([first]);
    expect(screen.getByRole("alert")).toHaveTextContent("未能读取本机便签");
    fireEvent.click(screen.getByRole("button", { name: "导出笔记" }));
    expect(await readDownload()).toBe("窗边\n\n读取失败后仍可带走");
    expect(screen.getByRole("alert")).toHaveTextContent("先导出备份");
  });
  it("exports the originally read malformed text if another window repairs it before recovery writes", async () => {
    const raw = "original unfinished {";
    const external = JSON.stringify([first]);
    localStorage.setItem(storageKey, raw);
    function RepairedBeforeEffects() {
      useLayoutEffect(() => { localStorage.setItem(storageKey, external); }, []);
      return <StudioNotes />;
    }
    render(<RepairedBeforeEffects />);
    expect(localStorage.getItem(storageKey)).toBe(external);
    expect(screen.getByRole("alert")).toHaveTextContent("其他窗口或标签页");
    expect(screen.getByText(/启动时读取的原始内容仍可导出/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "导出原始数据" }));
    expect(await readDownload()).toBe(raw);
    expect(localStorage.getItem(storageKey)).toBe(external);
  });
});

describe("Field Notes download boundaries", () => {
  it("clicks a connected download anchor with a safe filename and removes it afterward", () => {
    start([{ ...first, title: "folder/name" }]);
    let downloadClicked = false;
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(function (this: HTMLAnchorElement) {
      downloadClicked = true;
      expect(this.isConnected).toBe(true);
      expect(this.hidden).toBe(true);
      expect(this.download).toBe("folder-name.txt");
      expect(this.href).toBe("blob:notes-test");
    });
    fireEvent.click(screen.getByRole("button", { name: "导出笔记" }));
    expect(downloadClicked).toBe(true);
    expect(document.querySelector("a[download]")).not.toBeInTheDocument();
    expect(screen.getByText("已开始下载当前便签，请在浏览器下载记录中确认。")).toBeInTheDocument();
  });

  it("cleans controls only in the filename while preserving displayed, stored and exported note text", async () => {
    const original = { ...first, title: "旅行\u0001/\u202e记🐈‍⬛\u2069", body: "正文\u0000\u202d 不改变\n第二行" };
    start([original]);
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("旅行-记🐈‍⬛.txt");
    });
    fireEvent.click(screen.getByRole("button", { name: "导出笔记" }));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    expect(await readDownload()).toBe(`${original.title}\n\n${original.body}`);
    expect(screen.getByRole("textbox", { name: "笔记标题" })).toHaveValue(original.title);
    expect(screen.getByRole("textbox", { name: "笔记内容" })).toHaveValue(original.body);
    expect(readNotes()).toEqual([original]);
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "备份全部" }));
    expect(JSON.parse(await readDownload()).notes).toEqual([original]);
  });

  it("uses the fallback filename for a controls-only title without changing export content", async () => {
    const original = { ...first, title: "\u0000\u001f\u007f\u009f\u061c\u200e\u200f\u202e\u2069" };
    start([original]);
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("未命名便签.txt");
    });
    fireEvent.click(screen.getByRole("button", { name: "导出笔记" }));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    expect(await readDownload()).toBe(`${original.title}\n\n${original.body}`);
    expect(readNotes()).toEqual([original]);
  });

  it.each(["Blob", "object URL", "DOM attachment", "click"])("reports a %s failure without changing text and lets the user retry", kind => {
    start([first]);
    const fail = () => { throw new Error("Native failure details must stay private"); };
    if (kind === "Blob") vi.stubGlobal("Blob", class { constructor() { fail(); } });
    if (kind === "object URL") vi.mocked(URL.createObjectURL).mockImplementationOnce(fail);
    if (kind === "DOM attachment") vi.spyOn(document.body, "appendChild").mockImplementationOnce(fail);
    if (kind === "click") vi.mocked(HTMLAnchorElement.prototype.click).mockImplementationOnce(fail);
    fireEvent.click(screen.getByRole("button", { name: "导出笔记" }));
    expect(screen.getByRole("alert")).toHaveTextContent("下载未能启动");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Native failure details");
    expect(screen.queryByText(/已开始下载当前便签/)).not.toBeInTheDocument();
    expect(readNotes()).toEqual([first]);
    expect(document.querySelector("a[download]")).not.toBeInTheDocument();
    if (kind === "DOM attachment" || kind === "click") expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:notes-test");
    if (kind === "Blob") vi.stubGlobal("Blob", NativeBlob);
    fireEvent.click(screen.getByRole("button", { name: "导出笔记" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText(/已开始下载当前便签/)).toBeInTheDocument();
    expect(readNotes()).toEqual([first]);
  });

  it("handles serialization failure before attempting the all-notes download", () => {
    start([first]);
    vi.spyOn(JSON, "stringify").mockImplementationOnce(() => { throw new Error("Cannot serialize"); });
    fireEvent.click(screen.getByRole("button", { name: "备份全部" }));
    expect(screen.getByRole("alert")).toHaveTextContent("下载未能启动");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(readNotes()).toEqual([first]);
  });

  it("reports raw-recovery download failure and then exports exactly the same original text on retry", async () => {
    const raw = "unfinished source {";
    localStorage.setItem(storageKey, raw);
    render(<StudioNotes />);
    const recoveryKey = Object.keys(localStorage).find(key => key.startsWith(`${storageKey}:recovery:`))!;
    vi.mocked(URL.createObjectURL).mockImplementationOnce(() => { throw new Error("Denied"); });
    fireEvent.click(screen.getByRole("button", { name: "导出原始数据" }));
    expect(screen.getByRole("alert")).toHaveTextContent("下载未能启动");
    expect(localStorage.getItem(recoveryKey)).toBe(raw);
    fireEvent.click(screen.getByRole("button", { name: "导出原始数据" }));
    expect(await readDownload()).toBe(raw);
    expect(screen.getByText(/已开始下载原始数据/)).toBeInTheDocument();
  });

  it("shows backup failure and success inside the delete-confirmation dialog without deleting anything", () => {
    const notes = [first, { ...second, deletedAt: "2026-09-12T09:00:00Z" }];
    start(notes);
    fireEvent.click(screen.getByRole("button", { name: "最近删除 · 1" }));
    fireEvent.click(screen.getByRole("button", { name: "永久删除这篇便签" }));
    const dialog = screen.getByRole("alertdialog");
    vi.mocked(URL.createObjectURL).mockImplementationOnce(() => { throw new Error("Denied"); });
    fireEvent.click(within(dialog).getByRole("button", { name: "先备份全部" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("下载未能启动");
    expect(readNotes()).toEqual(notes);
    fireEvent.click(within(dialog).getByRole("button", { name: "先备份全部" }));
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("status")).toHaveTextContent("已开始下载全部便签");
    expect(readNotes()).toEqual(notes);
  });

  it("keeps a started download URL alive past 1200ms and closing the app, then releases it", () => {
    vi.useFakeTimers();
    const view = start([first]);
    fireEvent.click(screen.getByRole("button", { name: "导出笔记" }));
    act(() => vi.advanceTimersByTime(1200));
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    view.unmount();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(58_800));
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:notes-test");
  });

  it("releases each concurrent export only after its own retention interval", () => {
    vi.useFakeTimers();
    vi.mocked(URL.createObjectURL).mockReturnValueOnce("blob:first-export").mockReturnValueOnce("blob:second-export");
    start([first]);
    fireEvent.click(screen.getByRole("button", { name: "导出笔记" }));
    act(() => vi.advanceTimersByTime(20_000));
    fireEvent.click(screen.getByRole("button", { name: "备份全部" }));
    act(() => vi.advanceTimersByTime(40_000));
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:first-export");
    act(() => vi.advanceTimersByTime(20_000));
    expect(URL.revokeObjectURL).toHaveBeenLastCalledWith("blob:second-export");
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it("does not surface a late cleanup exception as an unhandled download error", () => {
    vi.useFakeTimers();
    start([first]);
    vi.mocked(URL.revokeObjectURL).mockImplementation(() => { throw new Error("Document teardown"); });
    fireEvent.click(screen.getByRole("button", { name: "导出笔记" }));
    expect(() => act(() => vi.advanceTimersByTime(60_000))).not.toThrow();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(readNotes()).toEqual([first]);
  });
});

describe("Field Notes import boundaries", () => {
  it.each([
    ["invalid JSON", () => Promise.resolve('{"broken":'), "文件不是有效的 JSON"],
    ["unsupported data", () => Promise.resolve('{"version":99}'), "受支持的 Field Notes 备份"],
    ["read failure", () => Promise.reject(new Error("raw filesystem error")), "无法读取这个文件"],
  ])("explains %s and leaves existing notes untouched", async (_name, read, message) => {
    start([first]);
    importFile(backupFile(read as () => Promise<string>));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(message as string));
    expect(readNotes()).toEqual([first]);
    expect(screen.getByRole("alert")).not.toHaveTextContent("raw filesystem error");
  });

  it("rejects oversized files before attempting to read them", async () => {
    start([first]);
    const read = vi.fn(() => Promise.resolve("[]"));
    importFile(backupFile(read, MAX_NOTES_BACKUP_BYTES + 1));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("超过 40 MB"));
    expect(read).not.toHaveBeenCalled();
    expect(readNotes()).toEqual([first]);
  });

  it("merges delayed files with edits made while the file was reading", async () => {
    start([first]);
    const deferred = deferredText();
    importFile(backupFile(() => deferred.promise));
    fireEvent.change(screen.getByRole("textbox", { name: "笔记内容" }), { target: { value: "读取期间新写的文字" } });
    await act(async () => deferred.resolve(JSON.stringify([{ ...first, body: "备份里的旧文字" }])));
    expect(screen.getByRole("textbox", { name: "笔记内容" })).toHaveValue("读取期间新写的文字");
    expect(readNotes().find(note => note.id === first.id)?.body).toBe("读取期间新写的文字");
    expect(readNotes().some(note => note.id !== first.id && note.body === "备份里的旧文字")).toBe(true);
  });

  it("does not switch away from a new note created during an import", async () => {
    start([first]);
    const deferred = deferredText();
    importFile(backupFile(() => deferred.promise));
    fireEvent.click(screen.getByRole("button", { name: "新建笔记" }));
    fireEvent.change(screen.getByRole("textbox", { name: "笔记标题" }), { target: { value: "正在写的新便签" } });
    await act(async () => deferred.resolve(JSON.stringify([second])));
    expect(screen.getByRole("textbox", { name: "笔记标题" })).toHaveValue("正在写的新便签");
    expect(readNotes()).toHaveLength(3);
  });

  it("ignores a cancelled reader even when it resolves later", async () => {
    start([first]);
    const deferred = deferredText();
    importFile(backupFile(() => deferred.promise));
    fireEvent.click(screen.getByRole("button", { name: "取消导入" }));
    await act(async () => deferred.resolve(JSON.stringify([second])));
    expect(readNotes()).toEqual([first]);
    expect(screen.getByText("已取消导入，原内容未改变。")).toBeInTheDocument();
  });

  it("does not allow an older reader to overwrite a newer import", async () => {
    start([first]);
    const older = deferredText(), newer = deferredText();
    importFile(backupFile(() => older.promise));
    importFile(backupFile(() => newer.promise));
    await act(async () => newer.resolve(JSON.stringify([second])));
    await act(async () => older.resolve(JSON.stringify([{ ...second, id: "old-file", title: "旧请求" }])));
    expect(readNotes().map(note => note.id)).toEqual(["one", "two"]);
  });

  it("accepts a legitimate backup larger than the previous 2 MB limit", async () => {
    start([first]);
    const notes = Array.from({ length: 80 }, (_, index) => ({ ...second, id: `large-${index}`, title: `长便签 ${index}`, body: "a".repeat(30000) }));
    const text = JSON.stringify(notes);
    expect(new Blob([text]).size).toBeGreaterThan(2 * 1024 * 1024);
    importFile(backupFile(() => Promise.resolve(text), new Blob([text]).size));
    await waitFor(() => expect(screen.getByText(/导入完成，新增 80 篇/)).toBeInTheDocument());
    expect(readNotes()).toHaveLength(81);
  });

  it("ignores an import that completes after the notes app is closed", async () => {
    const view = start([first]);
    const deferred = deferredText();
    importFile(backupFile(() => deferred.promise));
    view.unmount();
    await act(async () => deferred.resolve(JSON.stringify([second])));
    expect(readNotes()).toEqual([first]);
  });
});

describe("Field Notes mobile list", () => {
  it("announces expanded state and returns focus after close or Escape", async () => {
    start(undefined, true);
    const trigger = screen.getByRole("button", { name: "打开便签列表" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    const drawer = screen.getByRole("dialog", { name: "Field Notes" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(drawer.id).toBe(trigger.getAttribute("aria-controls"));
    const close = within(drawer).getByRole("button", { name: "关闭便签列表" });
    await waitFor(() => expect(close).toHaveFocus());
    fireEvent.click(close);
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("closes the drawer and focuses the selected note without losing text", async () => {
    start(undefined, true);
    fireEvent.click(screen.getByRole("button", { name: "打开便签列表" }));
    fireEvent.click(within(screen.getByRole("navigation", { name: "便签列表" })).getByRole("button", { name: /电影/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const title = screen.getByRole("textbox", { name: "笔记标题" });
    expect(title).toHaveValue("电影");
    expect(screen.getByRole("textbox", { name: "笔记内容" })).toHaveValue("Interstellar");
    await waitFor(() => expect(title).toHaveFocus());
  });
});
