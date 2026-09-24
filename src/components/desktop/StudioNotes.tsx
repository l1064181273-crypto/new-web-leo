import { ArrowLeft, Download, FilePenLine, List, Pin, Search, Trash2, Undo2, Upload, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useEffect, useId, useRef, useState } from "react";
import { useLocalState } from "@/hooks/use-local-state";
import {
  MAX_NOTES, MAX_NOTES_BACKUP_BYTES, MAX_NOTE_BODY_LENGTH, MAX_NOTE_TITLE_LENGTH,
  mergeNotes, noteExportFilename, notesSchema, NotesBackupError, parseNotesBackupText, permanentlyDeleteNotes, visibleNotes, type Note,
} from "./notes-model";
import "@/styles/notes-v2.css";

const initialNotes: Note[] = [
  { id: "welcome", title: "给路过这个桌面的人", body: "欢迎，随便坐。\n\n这个小小的便签本也留给你。写一个想法，记下一部想看的电影，或者什么都不写。\n\n内容只保存在你现在的浏览器里，不会发给 Haonan，也不会同步到其他设备。记得用“备份全部”把重要的文字带走。\n\n—— 一张示例便签", updated: "2026-09-12T08:14:00.000Z", pinned: true },
  { id: "explore", title: "几个可以试的小动作", body: "在工地沙盘里，把时间调到黄昏。\n在猫咪庭院里，试着带一只猫回家。\n打开随身听，放一段音乐。\n翻翻摄影收藏，找一张让你想停留的照片。\n\n也许还会有一个新的想法。", updated: "2026-09-12T08:14:00.000Z" },
];

function downloadText(text: string, filename: string, mime: string) {
  let url: string | null = null;
  let link: HTMLAnchorElement | null = null;
  const release = () => {
    if (!url) return;
    try { URL.revokeObjectURL(url); } catch { /* The document may already be tearing down. */ }
  };
  try {
    url = URL.createObjectURL(new Blob([text], { type: mime }));
    link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    // The browser owns the download after the click; it exposes no completion
    // event. Keep the URL alive through delayed download startup, even if the
    // Notes component is closed, then reclaim it without an unhandled timer.
    window.setTimeout(release, 60_000);
    return true;
  } catch {
    release();
    return false;
  } finally {
    try { link?.remove(); } catch { /* Cleanup must not hide the download result. */ }
  }
}

function useMobileNotes() {
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 720px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px)");
    const update = () => setMobile(media.matches);
    media.addEventListener("change", update);
    update();
    return () => media.removeEventListener("change", update);
  }, []);
  return mobile;
}

export default function StudioNotes() {
  const [notes, setNotes, saved, recovery] = useLocalState<Note[]>("leo-desktop-notes-v1", initialNotes, notesSchema);
  const [selectedId, setSelectedId] = useState(visibleNotes(notes, "")[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [trash, setTrash] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean; forConfirmation?: boolean } | null>(null);
  const storageWarning = recovery.conflict
    ? "检测到本机便签已在其他窗口或标签页中更改。本窗口编辑仅在内存中保留，未覆盖外部内容；请先导出备份，再关闭并重新打开便签。"
    : recovery.readFailed ? "未能读取本机便签。为保护原内容，本次编辑仅保留在内存中；请先导出备份，再关闭并重新打开便签。" : null;
  const [importing, setImporting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ ids: string[]; title: string } | null>(null);
  const isMobile = useMobileNotes();
  const listId = useId();
  const surfaceRef = useRef<HTMLElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const newNoteRef = useRef<HTMLButtonElement>(null);
  const listTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const deleteTriggerRef = useRef<HTMLElement | null>(null);
  const closeFocus = useRef<"trigger" | "editor">("trigger");
  const focusTimer = useRef<number>();
  const mounted = useRef(true);
  const importGeneration = useRef(0);
  // Every mutation updates this ref synchronously: file reads merge with the
  // latest edits, including edits queued before React's next render.
  const latestNotes = useRef(notes);
  const latestSelectedId = useRef(selectedId);
  const latestTrash = useRef(false);

  useEffect(() => {
    const requests = importGeneration;
    mounted.current = true;
    return () => {
      mounted.current = false;
      requests.current++;
      window.clearTimeout(focusTimer.current);
    };
  }, []);
  useEffect(() => { if (!isMobile) setListOpen(false); }, [isMobile]);

  const commit = (transform: (previous: Note[]) => Note[]) => {
    const next = transform(latestNotes.current);
    latestNotes.current = next;
    setNotes(next);
    return next;
  };
  const select = (id: string) => { latestSelectedId.current = id; setSelectedId(id); };
  const changeSection = (deleted: boolean) => { latestTrash.current = deleted; setTrash(deleted); };
  const focusAfterClose = (target: "trigger" | "editor") => {
    window.clearTimeout(focusTimer.current);
    focusTimer.current = window.setTimeout(() => {
      const preferred = target === "editor" ? titleRef.current : listTriggerRef.current;
      if (mounted.current) (preferred ?? titleRef.current ?? listTriggerRef.current ?? newNoteRef.current ?? surfaceRef.current)?.focus();
    }, 0);
  };
  const closeList = (target: "trigger" | "editor" = "trigger") => {
    closeFocus.current = target;
    setListOpen(false);
    if (!listOpen) focusAfterClose(target);
  };
  const note = notes.find(item => item.id === selectedId && Boolean(item.deletedAt) === trash);
  const filtered = visibleNotes(notes, query, trash);
  const activeCount = notes.filter(item => !item.deletedAt).length;
  const trashCount = notes.length - activeCount;

  const update = (field: "title" | "body", value: string) => commit(previous => previous.map(item =>
    item.id === latestSelectedId.current && !item.deletedAt ? { ...item, [field]: value, updated: new Date().toISOString() } : item,
  ));
  const create = () => {
    if (latestNotes.current.length >= MAX_NOTES) {
      setNotice({ text: `便签已达到 ${MAX_NOTES} 篇上限（含最近删除）。请先备份，再永久清理最近删除以腾出位置。` });
      return;
    }
    const id = crypto.randomUUID();
    commit(previous => [{ id, title: "", body: "", updated: new Date().toISOString() }, ...previous]);
    select(id); setQuery(""); changeSection(false); setNotice(null); closeList("editor");
  };
  const startDownload = (text: () => string, filename: string, mime: string, message: string, forConfirmation = false) => {
    try {
      if (!downloadText(text(), filename, mime)) throw new Error("Download did not start");
      setNotice({ text: message, forConfirmation });
    } catch {
      setNotice({ text: "下载未能启动。请检查浏览器的下载权限后重试，现有内容未改变。", error: true, forConfirmation });
    }
  };
  const exportNote = () => {
    const current = latestNotes.current.find(item => item.id === latestSelectedId.current);
    if (!current) return;
    startDownload(() => `${current.title}\n\n${current.body}`, noteExportFilename(current.title), "text/plain;charset=utf-8", "已开始下载当前便签，请在浏览器下载记录中确认。");
  };
  const backup = (forConfirmation = false) => {
    startDownload(() => JSON.stringify({ format: "haonan-notes", version: 1, exportedAt: new Date().toISOString(), notes: latestNotes.current }, null, 2),
      `Haonan-Notes-${new Date().toISOString().slice(0, 10)}.json`, "application/json", "已开始下载全部便签（含最近删除），请在浏览器下载记录中确认。", forConfirmation);
  };
  const exportRecovery = () => {
    if (recovery.recoveryRaw === null) return;
    startDownload(() => recovery.recoveryRaw!, "Haonan-Notes-recovery.txt", "text/plain;charset=utf-8", "已开始下载原始数据，请在浏览器下载记录中确认。");
  };
  const cancelImport = () => {
    importGeneration.current++;
    setImporting(false);
    setNotice({ text: "已取消导入，原内容未改变。" });
  };
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    const generation = ++importGeneration.current;
    setImporting(true); setNotice(null);
    try {
      if (file.size > MAX_NOTES_BACKUP_BYTES) throw new NotesBackupError("备份文件超过 40 MB，请分批整理后再导入。原内容未改变。");
      const text = await file.text();
      if (!mounted.current || generation !== importGeneration.current) return;
      const incoming = parseNotesBackupText(text);
      const previousCount = latestNotes.current.length;
      const merged = commit(previous => mergeNotes(previous, incoming, () => crypto.randomUUID()));
      setNotice({ text: `导入完成，新增 ${merged.length - previousCount} 篇。相同内容已跳过，原便签保留。` });
      if (!merged.some(item => item.id === latestSelectedId.current)) select(visibleNotes(merged, "", latestTrash.current)[0]?.id ?? "");
    } catch (error) {
      if (mounted.current && generation === importGeneration.current) {
        setNotice({ text: error instanceof NotesBackupError ? error.message : "无法读取这个文件，请重新选择便签备份。原内容未改变。", error: true });
      }
    } finally {
      if (mounted.current && generation === importGeneration.current) setImporting(false);
    }
  };
  const switchSection = (deleted: boolean) => {
    changeSection(deleted); setQuery("");
    select(visibleNotes(latestNotes.current, "", deleted)[0]?.id ?? "");
  };
  const setTrashed = (restore: boolean) => {
    if (!note) return;
    const next = commit(previous => previous.map(item => item.id === note.id
      ? { ...item, deletedAt: restore ? null : new Date().toISOString() } : item));
    if (restore) { changeSection(false); setQuery(""); select(note.id); closeList("editor"); }
    else select(visibleNotes(next, query, trash)[0]?.id ?? "");
    setNotice({ text: restore ? "便签已恢复，可以继续编辑。" : "已移到最近删除，可以随时恢复。" });
  };
  const requestPermanentDelete = (ids: string[], trigger: HTMLElement) => {
    const targets = latestNotes.current.filter(item => item.deletedAt && ids.includes(item.id));
    if (!targets.length) return;
    deleteTriggerRef.current = trigger;
    setNotice(previous => previous?.forConfirmation ? null : previous);
    setPendingDelete({ ids: targets.map(item => item.id), title: targets.length === 1 ? targets[0].title || "未命名便签" : `${targets.length} 篇便签` });
  };
  const confirmPermanentDelete = () => {
    if (!pendingDelete) return;
    const before = latestNotes.current.length;
    const next = commit(previous => permanentlyDeleteNotes(previous, pendingDelete.ids));
    if (!next.some(item => item.id === latestSelectedId.current)) select(visibleNotes(next, query, trash)[0]?.id ?? "");
    setPendingDelete(null);
    setNotice({ text: `已永久删除 ${before - next.length} 篇便签，释放了对应位置。此操作无法撤销，已有导出备份不受影响。` });
  };
  const manageCapacity = () => {
    if (trashCount) switchSection(true);
    else setNotice({ text: "先在列表中选择要整理的便签，移到最近删除；备份后再永久清理。" });
    if (isMobile) { closeFocus.current = "trigger"; setListOpen(true); }
  };

  const sidebar = (mobile: boolean) => <aside className={`notes-sidebar${mobile ? " notes-mobile-drawer" : ""}`}>
    <header><div><span>THOUGHTS, UNFINISHED.</span>{mobile ? <Dialog.Title asChild><h2>Field Notes</h2></Dialog.Title> : <h2>Field Notes</h2>}</div>
      <div className="notes-sidebar-actions"><button ref={newNoteRef} className="notes-new" onClick={create} aria-label="新建笔记" aria-disabled={notes.length >= MAX_NOTES} title="新建便签"><FilePenLine size={18} /></button>
        {mobile && <Dialog.Close asChild><button ref={drawerCloseRef} className="notes-drawer-close" aria-label="关闭便签列表"><X size={18} /></button></Dialog.Close>}
      </div>
    </header>
    {mobile && <Dialog.Description className="sr-only">搜索、选择或整理便签。关闭列表后返回编辑器。</Dialog.Description>}
    <label className="notes-search"><Search size={14} /><input aria-label="搜索笔记" placeholder="寻找一句话…" value={query} onChange={event => setQuery(event.target.value)} />{query && <button aria-label="清空搜索" onClick={() => setQuery("")}><X size={12} /></button>}</label>
    <div className="notes-section-heading"><span>{trash ? "最近删除" : "所有便签"}</span><small aria-live="polite">{filtered.length} 篇</small></div>
    <nav aria-label="便签列表">{filtered.map(item => <button key={item.id} aria-current={selectedId === item.id ? "true" : undefined} onClick={() => { select(item.id); closeList("editor"); }}>
      <strong>{item.pinned && <Pin size={10} aria-label="已置顶" />} {item.title || "未命名便签"}</strong><p>{item.body.split("\n").find(Boolean) || "还没有写下内容"}</p><small>{new Date(item.updated).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}</small>
    </button>)}{!filtered.length && <p className="notes-empty-search">{query ? "没有找到。换个词，或清空搜索查看全部。" : trash ? "这里没有被删除的便签。" : "给第一个想法留个位置。"}</p>}</nav>
    <footer><p className="notes-capacity">{notes.length} / {MAX_NOTES} 篇 · 含最近删除</p>
      {notes.length >= MAX_NOTES && <p className="notes-limit-hint" role="status">{trashCount ? "已达上限。先备份，再清理最近删除，即可继续新建。" : "已达上限。选择一篇便签移到最近删除，备份后再清理。"}</p>}
      <button onClick={() => switchSection(!trash)}>{trash ? <ArrowLeft size={14} /> : <Trash2 size={14} />} {trash ? `返回便签 · ${activeCount}` : `最近删除 · ${trashCount}`}</button>
      {trash && trashCount > 0 && <button className="notes-purge-link" onClick={event => requestPermanentDelete(latestNotes.current.filter(item => item.deletedAt).map(item => item.id), event.currentTarget)}>清空最近删除</button>}
      <div><button onClick={() => backup()} title="备份全部便签"><Download size={13} />备份全部</button><button onClick={() => importRef.current?.click()} title="导入便签备份" disabled={importing}><Upload size={13} />{importing ? "读取中…" : "导入"}</button>{importing && <button onClick={cancelImport}>取消导入</button>}</div>
      <input type="file" ref={importRef} accept=".json,application/json" className="sr-only" tabIndex={-1} aria-label="选择便签备份文件" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void importFile(file); }} />
    </footer>
  </aside>;

  return <Dialog.Root open={isMobile && listOpen} onOpenChange={value => { if (value) closeFocus.current = "trigger"; setListOpen(value); }}>
    <section ref={surfaceRef} tabIndex={-1} className={`studio-notes ${listOpen ? "notes-list-open" : ""}`} aria-label="Field Notes 本地便签" onKeyDown={event => {
      if (!event.defaultPrevented && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); exportNote(); }
    }}>
      {!isMobile && sidebar(false)}
      <div className="studio-note-editor"><header>
        {isMobile && <Dialog.Trigger asChild><button ref={listTriggerRef} className="notes-mobile-list" aria-label="打开便签列表" aria-expanded={listOpen} aria-controls={listId}><List size={19} /></button></Dialog.Trigger>}
        <span role="status"><i data-saved={saved} />{saved ? "已保存在此浏览器" : "未能保存，请导出备份"}</span>
        <div>{note && !note.deletedAt && <button aria-pressed={Boolean(note.pinned)} onClick={() => commit(previous => previous.map(item => item.id === note.id ? { ...item, pinned: !item.pinned } : item))} aria-label={note.pinned ? "取消置顶" : "置顶便签"} title={note.pinned ? "取消置顶" : "置顶便签"}><Pin size={15} /></button>}
          <button onClick={exportNote} disabled={!note} aria-label="导出笔记" title="导出便签"><Download size={16} /></button>
          {note && <button onClick={() => setTrashed(Boolean(note.deletedAt))} aria-label={note.deletedAt ? "恢复便签" : "移到最近删除"} title={note.deletedAt ? "恢复便签" : "移到最近删除"}>{note.deletedAt ? <Undo2 size={16} /> : <Trash2 size={16} />}</button>}
        </div>
      </header>
        {storageWarning && <div className="notes-notice notes-import-error" role="alert"><span>{storageWarning}</span></div>}
        {recovery.recoveryRaw !== null && <div className="notes-notice notes-recovery" role="status"><span>检测到格式不兼容的旧数据。{recovery.recoveryKey ? "原始内容已单独保留。" : recovery.conflict ? "启动时读取的原始内容仍可导出，请先带走备份。" : "原始内容没有被覆盖，请立即导出。"}</span><button onClick={exportRecovery}>导出原始数据</button></div>}
        {notes.length >= MAX_NOTES && <div className="notes-capacity-warning" role="status"><span>已达 {MAX_NOTES} 篇上限，最近删除也占位置。先备份，再清理。</span><button onClick={manageCapacity}>{trashCount ? "整理最近删除" : "选择要整理的便签"}</button></div>}
        {importing && <div className="notes-notice" role="status"><span>正在读取备份，你仍可继续编辑。导入只会合并，不会替换现有便签。</span></div>}
        {notice && <div className={`notes-notice${notice.error ? " notes-import-error" : ""}`} role={notice.error ? "alert" : "status"}><span>{notice.text}</span><button aria-label="关闭便签提示" onClick={() => setNotice(null)}><X size={12} /></button></div>}
        {note ? <>
          <div className="note-paper-top"><small>{note.deletedAt ? "RECENTLY REMOVED / 可恢复" : "A PLACE FOR YOUR THOUGHTS"}</small><span>{new Date(note.updated).toLocaleDateString("zh-CN")}</span></div>
          <input ref={titleRef} className="studio-note-title" aria-label="笔记标题" placeholder="给这个想法起个名字" value={note.title} maxLength={MAX_NOTE_TITLE_LENGTH} readOnly={Boolean(note.deletedAt)} onChange={event => update("title", event.target.value)} />
          <textarea className="studio-note-body" aria-label="笔记内容" placeholder="从一句话开始。" value={note.body} maxLength={MAX_NOTE_BODY_LENGTH} readOnly={Boolean(note.deletedAt)} onChange={event => update("body", event.target.value)} spellCheck={false} />
          {note.deletedAt && <div className="notes-trash-actions"><span>这篇便签仍可恢复。</span><button onClick={event => requestPermanentDelete([note.id], event.currentTarget)}>永久删除这篇便签</button></div>}
          <footer><span>{note.body.length.toLocaleString()} / {MAX_NOTE_BODY_LENGTH.toLocaleString()} 字符</span><span>{note.deletedAt ? "点击右上角恢复，继续编辑。" : "只在你的浏览器里 · ⌘ / Ctrl + S 导出"}</span></footer>
        </> : <div className="studio-notes-empty"><FilePenLine size={35} strokeWidth={1.2} /><h3>{trash ? "想法还在原来的地方。" : "留一个位置，给下个想法。"}</h3><p>{trash ? "被移除的便签会出现在这里，可以恢复。" : "便签不会发送给作者，只属于此刻的你。"}</p><button onClick={create}>写一张新便签</button></div>}
      </div>
      {isMobile && <Dialog.Portal container={surfaceRef.current}>
        <Dialog.Overlay className="notes-drawer-overlay" />
        <Dialog.Content id={listId} asChild onOpenAutoFocus={event => { event.preventDefault(); drawerCloseRef.current?.focus(); }} onCloseAutoFocus={event => { event.preventDefault(); focusAfterClose(closeFocus.current); }} onEscapeKeyDown={event => event.stopPropagation()}>{sidebar(true)}</Dialog.Content>
      </Dialog.Portal>}
      <AlertDialog.Root open={Boolean(pendingDelete)} onOpenChange={value => { if (!value) setPendingDelete(null); }}>
        <AlertDialog.Portal><AlertDialog.Overlay className="notes-confirm-overlay" /><AlertDialog.Content className="notes-confirm-dialog" onEscapeKeyDown={event => event.stopPropagation()} onCloseAutoFocus={event => {
          event.preventDefault();
          if (deleteTriggerRef.current?.isConnected) deleteTriggerRef.current.focus();
          else if (listOpen) drawerCloseRef.current?.focus();
          else focusAfterClose("editor");
        }}>
          <AlertDialog.Title>永久删除{pendingDelete && pendingDelete.ids.length > 1 ? `这 ${pendingDelete.ids.length} 篇便签` : "这篇便签"}？</AlertDialog.Title>
          <AlertDialog.Description>将删除“{pendingDelete?.title}”。删除后无法在最近删除中恢复；已有导出备份不受影响。需要保留时，请先备份。</AlertDialog.Description>
          <button className="notes-confirm-backup" onClick={() => backup(true)}><Download size={15} />先备份全部</button>
          {notice?.forConfirmation && <p role={notice.error ? "alert" : "status"}>{notice.text}</p>}
          <div className="notes-confirm-actions"><AlertDialog.Cancel asChild><button>取消，保留便签</button></AlertDialog.Cancel><AlertDialog.Action asChild><button className="notes-confirm-delete" onClick={confirmPermanentDelete}>确认永久删除 {pendingDelete?.ids.length ?? 0} 篇</button></AlertDialog.Action></div>
        </AlertDialog.Content></AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  </Dialog.Root>;
}
