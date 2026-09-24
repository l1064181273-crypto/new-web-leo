import { z } from "zod";

export const MAX_NOTES = 200;
export const MAX_NOTE_TITLE_LENGTH = 120;
export const MAX_NOTE_BODY_LENGTH = 30000;
// A valid 200-note export can exceed 2 MB. Forty MiB also accommodates JSON's
// escaped representation of every allowed title/body character.
export const MAX_NOTES_BACKUP_BYTES = 40 * 1024 * 1024;
const dateSchema = z.string().max(128).refine(value => Number.isFinite(Date.parse(value)));
export const noteItemSchema = z.object({
  id: z.string().min(1).max(160),
  title: z.string().max(MAX_NOTE_TITLE_LENGTH),
  body: z.string().max(MAX_NOTE_BODY_LENGTH),
  updated: dateSchema,
  pinned: z.boolean().optional(),
  deletedAt: dateSchema.nullable().optional(),
});
export const notesSchema = z.array(noteItemSchema).max(MAX_NOTES).refine(notes => new Set(notes.map(note => note.id)).size === notes.length, "笔记标识不能重复");
export type Note = z.infer<typeof noteItemSchema>;

export function noteExportFilename(title: string): string {
  // Only clean the download name, never the stored or exported note text.
  // Keep emoji joiners/variation selectors; remove controls and bidi overrides.
  const cleaned = title.replace(/[\p{Cc}\p{Bidi_Control}]/gu, "").replace(/[\\/:*?"<>|]/g, "-");
  const stem = Array.from(cleaned).slice(0, 60).join(""); // Do not split surrogate pairs.
  return `${stem.trim() ? stem : "未命名便签"}.txt`;
}

export class NotesBackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotesBackupError";
  }
}

export function parseNotesBackup(value: unknown): Note[] {
  let candidate: unknown = value;
  if (!Array.isArray(value)) {
    const envelope = z.object({ format: z.literal("haonan-notes"), version: z.literal(1), notes: z.unknown() }).safeParse(value);
    if (!envelope.success) throw new NotesBackupError("这不是受支持的 Field Notes 备份。请选择“备份全部”导出的 JSON 文件。");
    candidate = envelope.data.notes;
  }
  const result = notesSchema.safeParse(candidate);
  if (result.success) return result.data;
  if (Array.isArray(candidate) && candidate.length > MAX_NOTES) {
    throw new NotesBackupError(`一个备份最多包含 ${MAX_NOTES} 篇便签。请分批整理后再导入。`);
  }
  if (result.error.issues.some(issue => issue.path[issue.path.length - 1] === "body" && issue.code === "too_big")) {
    throw new NotesBackupError(`备份中有正文超过 ${MAX_NOTE_BODY_LENGTH.toLocaleString()} 字符的便签，请缩短后重试。`);
  }
  if (result.error.issues.some(issue => issue.path[issue.path.length - 1] === "title" && issue.code === "too_big")) {
    throw new NotesBackupError(`备份中有标题超过 ${MAX_NOTE_TITLE_LENGTH} 字符的便签，请缩短后重试。`);
  }
  if (result.error.issues.some(issue => issue.message === "笔记标识不能重复")) {
    throw new NotesBackupError("备份中有重复的便签标识，无法安全合并。请重新导出备份。");
  }
  throw new NotesBackupError("备份中的便签字段或日期不完整。请使用“备份全部”导出的文件，原内容未改变。");
}

export function parseNotesBackupText(text: string): Note[] {
  let value: unknown;
  try { value = JSON.parse(text.replace(/^\uFEFF/, "")); }
  catch { throw new NotesBackupError("文件不是有效的 JSON，可能尚未保存完整。请重新选择便签备份，原内容未改变。"); }
  return parseNotesBackup(value);
}

export function mergeNotes(existing: Note[], incoming: Note[], createId: () => string): Note[] {
  const merged = [...existing], ids = new Set(existing.map(note => note.id));
  for (const note of incoming) {
    if (merged.some(item => item.title === note.title && item.body === note.body && (item.deletedAt ?? null) === (note.deletedAt ?? null))) continue;
    const id = ids.has(note.id) ? createId() : note.id;
    if (ids.has(id)) throw new NotesBackupError("无法生成唯一的便签标识，请重新导入。原内容未改变。");
    ids.add(id); merged.push({ ...note, id });
    if (merged.length > MAX_NOTES) throw new NotesBackupError(`导入后会超过 ${MAX_NOTES} 篇（包含最近删除）。请先备份，再清理最近删除；本次没有导入任何内容。`);
  }
  return merged;
}

// Confirmation supplies a snapshot of IDs, but a note restored since then must
// still survive. Never purge active notes, newly deleted notes, or other IDs.
export function permanentlyDeleteNotes(notes: Note[], confirmedIds: string[]): Note[] {
  const ids = new Set(confirmedIds);
  return notes.filter(note => !note.deletedAt || !ids.has(note.id));
}

export function visibleNotes(notes: Note[], query: string, trash = false) {
  const search = query.trim().toLocaleLowerCase();
  return notes.filter(note => Boolean(note.deletedAt) === trash && `${note.title}\n${note.body}`.toLocaleLowerCase().includes(search)).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || Date.parse(b.updated) - Date.parse(a.updated));
}
