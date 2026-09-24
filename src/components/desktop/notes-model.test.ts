import { describe, expect, it } from "vitest";
import { MAX_NOTES_BACKUP_BYTES, mergeNotes, noteExportFilename, NotesBackupError, parseNotesBackup, parseNotesBackupText, permanentlyDeleteNotes, visibleNotes, type Note } from "./notes-model";
const note: Note = { id: "one", title: "光", body: "下午的窗边", updated: "2026-09-12T08:00:00Z" };
describe("personal note export filenames", () => {
  it("removes C0, DEL and C1 controls from the filename", () => {
    const controls = String.fromCodePoint(...Array.from({ length: 32 }, (_, index) => index), ...Array.from({ length: 33 }, (_, index) => 0x7f + index));
    expect(noteExportFilename(`前${controls}后`)).toBe("前后.txt");
  });
  it("removes every Unicode bidi control without discarding normal letters", () => {
    const bidiControls = "\u061c\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069";
    expect(noteExportFilename(`笔记${bidiControls}abc`)).toBe("笔记abc.txt");
  });
  it("preserves Chinese, emoji joiners, modifiers and variation selectors", () => {
    const title = "旅途 🐈‍⬛ 👩🏽‍💻 ☀️ 🇨🇳";
    expect(noteExportFilename(title)).toBe(`${title}.txt`);
  });
  it("keeps the existing path and reserved-character filtering with a fixed text extension", () => {
    const reserved = ["\\", "/", ":", "*", "?", '"', "<", ">", "|"].join("");
    expect(noteExportFilename(`前${reserved}后.exe`)).toBe("前---------后.exe.txt");
  });
  it.each(["", "\u0000\n\t\u007f\u009f", "\u202e\u2069", " \u200f \u061c "])("falls back when cleaning leaves an empty or blank filename (%j)", title => {
    expect(noteExportFilename(title)).toBe("未命名便签.txt");
  });
  it("limits the stem to 60 code points without splitting an emoji surrogate pair", () => {
    expect(noteExportFilename("字".repeat(70))).toBe(`${"字".repeat(60)}.txt`);
    expect(noteExportFilename(`${"字".repeat(59)}🐈尾`)).toBe(`${"字".repeat(59)}🐈.txt`);
  });
});

describe("personal notes backups", () => {
  it("accepts previous-format notes without pinned/deleted fields", () => expect(parseNotesBackup([note])).toEqual([note]));
  it("rejects malformed and oversized note bodies", () => { expect(() => parseNotesBackup([{ ...note, body: "a".repeat(30001) }])).toThrow(); expect(() => parseNotesBackup([{ ...note, updated: "invalid" }])).toThrow(); });
  it("merges conflicts without replacing existing text or duplicating identical content", () => { const result = mergeNotes([note], [{ ...note, body: "另一个想法" }, note], () => "new"); expect(result).toHaveLength(2); expect(result[0]).toEqual(note); expect(result[1].id).toBe("new"); });
  it("keeps recoverable trash separate and pins before recent notes", () => { const notes = [note, { ...note, id: "pinned", pinned: true }, { ...note, id: "trash", deletedAt: "2026-09-12T09:00:00Z" }]; expect(visibleNotes(notes, "窗").map(item => item.id)).toEqual(["pinned", "one"]); expect(visibleNotes(notes, "", true).map(item => item.id)).toEqual(["trash"]); });
  it("reads the versioned export while retaining deleted notes and pins", () => {
    const notes = [note, { ...note, id: "deleted", pinned: true, deletedAt: "2026-09-12T09:00:00Z" }];
    expect(parseNotesBackupText(JSON.stringify({ format: "haonan-notes", version: 1, exportedAt: "2026-09-12", notes }))).toEqual(notes);
  });
  it("explains invalid JSON without exposing parser internals", () => {
    expect(() => parseNotesBackupText('{"notes":')).toThrow(NotesBackupError);
    expect(() => parseNotesBackupText('{"notes":')).toThrow("文件不是有效的 JSON");
  });
  it("accepts a UTF-8 BOM without stripping any note text", () => {
    expect(parseNotesBackupText(`\uFEFF${JSON.stringify([{ ...note, body: "\uFEFF原始正文" }])}`)[0].body).toBe("\uFEFF原始正文");
  });
  it("rejects unsupported formats and versions with a useful next step", () => {
    expect(() => parseNotesBackup({ format: "haonan-notes", version: 2, notes: [note] })).toThrow("备份全部");
    expect(() => parseNotesBackup({ notes: [note] })).toThrow("备份全部");
  });
  it("rejects duplicate identities and invalid deletion dates", () => {
    expect(() => parseNotesBackup([note, note])).toThrow("重复的便签标识");
    expect(() => parseNotesBackup([{ ...note, deletedAt: "invalid-date" }])).toThrow("日期");
    expect(() => parseNotesBackup([{ ...note, title: "字".repeat(121) }])).toThrow("标题超过 120");
  });
  it("does not partially mutate existing notes when an import exceeds capacity", () => {
    const existing = Array.from({ length: 200 }, (_, index) => ({ ...note, id: `id-${index}`, title: `便签 ${index}` }));
    const snapshot = structuredClone(existing);
    expect(() => mergeNotes(existing, [{ ...note, id: "new", title: "新内容" }], () => "fresh")).toThrow("本次没有导入任何内容");
    expect(existing).toEqual(snapshot);
    expect(mergeNotes(existing, [existing[0]], () => "fresh")).toHaveLength(200);
  });
  it("rejects an ID factory collision without altering the inputs", () => {
    const existing = [note];
    expect(() => mergeNotes(existing, [{ ...note, body: "不同内容" }], () => note.id)).toThrow("唯一的便签标识");
    expect(existing).toEqual([note]);
  });
  it("permanently deletes only the confirmed IDs that are still in trash", () => {
    const trashed = { ...note, id: "trash", deletedAt: "2026-09-12T09:00:00Z" };
    const restored = { ...note, id: "restored", deletedAt: null };
    const addedLater = { ...trashed, id: "not-confirmed" };
    const notes = [note, trashed, restored, addedLater];
    expect(permanentlyDeleteNotes(notes, [note.id, "trash", "restored", "missing"])).toEqual([note, restored, addedLater]);
    expect(notes).toHaveLength(4);
  });
  it("allows even a maximally escaped valid export within the file-size limit", () => {
    const notes = Array.from({ length: 200 }, (_, index) => ({ ...note, id: String(index), title: "\u0000".repeat(120), body: "\u0000".repeat(30000) }));
    const text = JSON.stringify({ format: "haonan-notes", version: 1, notes });
    expect(new Blob([text]).size).toBeLessThan(MAX_NOTES_BACKUP_BYTES);
    expect(parseNotesBackupText(text)).toHaveLength(200);
  });
});
