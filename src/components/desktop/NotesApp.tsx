import { Download, FilePenLine, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { useLocalState } from "@/hooks/use-local-state";

const noteSchema = z
  .array(
    z.object({
      id: z.string(),
      title: z.string().max(120),
      body: z.string().max(30000),
      updated: z.string(),
    }),
  )
  .max(200);
const initialNotes = [
  {
    id: "welcome",
    title: "保持好奇，持续创造",
    body: "AI 数据运营 / Vibe Coding / 智慧农业\n\n把复杂的问题拆开，把值得记录的瞬间留下。\n\n这个桌面，是我的工作和生活交汇的地方。",
    updated: "2026-09-09T00:00:00.000Z",
  },
  {
    id: "learning",
    title: "我的学习清单",
    body: "提示词工程\nAIGC 图像创作\n智慧农业数据分析\n个人知识库\nPython 与自动化\n技术哲学",
    updated: "2026-09-09T00:00:00.000Z",
  },
];

export default function NotesApp() {
  const [notes, setNotes, saved] = useLocalState(
    "leo-desktop-notes-v1",
    initialNotes,
    noteSchema,
  );
  const [selectedId, setSelectedId] = useState(notes[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const note = notes.find((item) => item.id === selectedId);
  const update = (field: "title" | "body", value: string) => {
    setNotes((previous) =>
      previous.map((item) =>
        item.id === selectedId
          ? { ...item, [field]: value, updated: new Date().toISOString() }
          : item,
      ),
    );
  };
  const create = () => {
    if (notes.length >= 200) return;
    const id = crypto.randomUUID();
    setNotes((previous) => [
      { id, title: "新的想法", body: "", updated: new Date().toISOString() },
      ...previous,
    ]);
    setSelectedId(id);
    setQuery("");
  };
  const download = () => {
    if (!note) return;
    const url = URL.createObjectURL(
      new Blob([`${note.title}\n\n${note.body}`], {
        type: "text/plain;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "leo-note.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="notes-app">
      <aside>
        <div className="notes-list-toolbar">
          <strong>备忘录</strong>
          <button
            className="icon-button"
            onClick={create}
            disabled={notes.length >= 200}
            title="新建笔记"
            aria-label="新建笔记"
          >
            <FilePenLine size={19} />
          </button>
        </div>
        <label className="search-field">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索笔记"
            aria-label="搜索笔记"
          />
        </label>
        <div className="notes-list">
          {notes
            .filter((item) =>
              `${item.title}${item.body}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((item) => (
              <button
                key={item.id}
                className={item.id === selectedId ? "selected" : ""}
                onClick={() => {
                  setSelectedId(item.id);
                  setConfirmDelete(false);
                }}
              >
                <strong>{item.title || "无标题"}</strong>
                <span>{item.body.split("\n")[0] || "空白笔记"}</span>
              </button>
            ))}
        </div>
        <small>
          {notes.length} 篇 · {saved ? "本机存储" : "仅当前会话"}
        </small>
      </aside>
      <section className="note-editor">
        <div className="app-toolbar">
          <span role="status">
            {saved ? "已保存在此浏览器" : "存储不可用，请导出备份"}
          </span>
          <div>
            <button
              className="icon-button"
              onClick={download}
              disabled={!note}
              aria-label="导出笔记"
              title="导出笔记"
            >
              <Download size={17} />
            </button>
            <button
              className="icon-button"
              onClick={() => setConfirmDelete(true)}
              disabled={!note}
              aria-label="删除笔记"
              title="删除笔记"
            >
              <Trash2 size={17} />
            </button>
          </div>
        </div>
        {confirmDelete && note ? (
          <div className="note-confirm" role="alert">
            <p>删除“{note.title || "无标题"}”？此操作不可撤销。</p>
            <button onClick={() => setConfirmDelete(false)}>取消</button>
            <button
              className="danger"
              onClick={() => {
                const next = notes.filter((item) => item.id !== selectedId);
                setNotes(next);
                setSelectedId(next[0]?.id ?? "");
                setConfirmDelete(false);
              }}
            >
              确认删除
            </button>
          </div>
        ) : null}
        {note ? (
          <>
            <input
              className="note-title"
              aria-label="笔记标题"
              value={note.title}
              maxLength={120}
              onChange={(event) => update("title", event.target.value)}
            />
            <textarea
              className="note-body"
              aria-label="笔记内容"
              value={note.body}
              maxLength={30000}
              onChange={(event) => update("body", event.target.value)}
              spellCheck={false}
            />
            <footer>{note.body.length} 字符</footer>
          </>
        ) : (
          <div className="empty-state">
            <FilePenLine size={36} />
            <button className="text-button" onClick={create}>
              写下新的想法
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
