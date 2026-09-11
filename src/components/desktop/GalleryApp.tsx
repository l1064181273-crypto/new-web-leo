import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Aperture,
  BookImage,
  ChevronLeft,
  ChevronRight,
  Download,
  Film,
  Gamepad2,
  Grid2X2,
  Heart,
  Images,
  List,
  Music2,
  Search,
  Utensils,
  X,
} from "lucide-react";
import {
  collectionInfo,
  filterMedia,
  media,
  type CollectionId,
  type MediaItem,
} from "@/data/media";

const icons = {
  daily: BookImage,
  photos: Aperture,
  artists: Music2,
  films: Film,
  games: Gamepad2,
  food: Utensils,
};
type Category = CollectionId | "all" | "favorites";

export default function GalleryApp({
  initial = "all",
  favorites,
  toggleFavorite,
}: {
  initial?: Category;
  favorites: string[];
  toggleFavorite: (id: string) => void;
}) {
  const [category, setCategory] = useState<Category>(initial);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [viewerItems, setViewerItems] = useState<MediaItem[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const filtered = filterMedia(category, query, favorites);
  const title =
    category === "all"
      ? "Personal Atlas"
      : category === "favorites"
        ? "Favorites"
        : collectionInfo[category].en;
  const step = (offset: number) => {
    const index = viewerItems.findIndex((item) => item.id === selected?.id);
    if (viewerItems.length)
      setSelected(
        viewerItems[(index + offset + viewerItems.length) % viewerItems.length],
      );
  };
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [category, query]);
  return (
    <div className="finder">
      <aside className="finder-sidebar">
        <div className="sidebar-heading">图库</div>
        <nav aria-label="相册分类">
          <button
            className={category === "all" ? "selected" : ""}
            onClick={() => {
              setCategory("all");
              setQuery("");
            }}
          >
            <Images size={17} />
            所有照片<small>{media.length}</small>
          </button>
          <button
            className={category === "favorites" ? "selected" : ""}
            onClick={() => {
              setCategory("favorites");
              setQuery("");
            }}
          >
            <Heart size={17} />
            个人收藏<small>{favorites.length}</small>
          </button>
          <div className="sidebar-heading albums-label">相簿</div>
          {(Object.keys(collectionInfo) as CollectionId[]).map((id) => {
            const Icon = icons[id];
            return (
              <button
                key={id}
                className={category === id ? "selected" : ""}
                aria-pressed={category === id}
                onClick={() => {
                  setCategory(id);
                  setQuery("");
                }}
              >
                <Icon size={17} />
                {collectionInfo[id].name}
                <small>{filterMedia(id).length}</small>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          HAONAN LI
          <br />
          <span>{media.length} 段记忆</span>
        </div>
      </aside>
      <section className="finder-main">
        <div className="app-toolbar">
          <div className="breadcrumbs">
            Haonan <ChevronRight size={13} /> <strong>{title}</strong>
          </div>
          <div className="segmented" aria-label="显示方式">
            <button
              aria-label="网格视图"
              title="网格视图"
              aria-pressed={mode === "grid"}
              onClick={() => setMode("grid")}
            >
              <Grid2X2 size={16} />
            </button>
            <button
              aria-label="列表视图"
              title="列表视图"
              aria-pressed={mode === "list"}
              onClick={() => setMode("list")}
            >
              <List size={17} />
            </button>
          </div>
          <label className="search-field">
            <Search size={15} />
            <input
              aria-label="搜索照片"
              placeholder="搜索"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        <div className="gallery-scroll" ref={scrollRef}>
          <header className="gallery-heading">
            <div>
              <p>
                {category === "all"
                  ? "LIFE, THROUGH MY LENS"
                  : "PERSONAL COLLECTION"}
              </p>
              <h2>{title}</h2>
              <span>
                {category === "all"
                  ? "生活值得被看见，也值得被记住。"
                  : category === "favorites"
                    ? "留下你喜欢的瞬间。"
                    : collectionInfo[category].description}
              </span>
            </div>
            <small>{filtered.length} 项</small>
          </header>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <Images size={36} />
              <h3>{query ? "没有找到这段记忆" : "还没有收藏"}</h3>
              {query && (
                <button className="text-button" onClick={() => setQuery("")}>
                  清除搜索
                </button>
              )}
            </div>
          ) : (
            <div
              className={`media-grid is-${mode} ${category === "films" ? "posters" : ""}`}
            >
              {filtered.map((item) => (
                <article className="media-tile" key={item.id}>
                  <button
                    className="media-open"
                    aria-label={`查看 ${item.title}`}
                    onClick={(event) => {
                      triggerRef.current = event.currentTarget;
                      setSelected(item);
                      setViewerItems(filtered);
                    }}
                  >
                    <img
                      src={item.image}
                      alt={item.title}
                      loading="lazy"
                      draggable={false}
                    />
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.subtitle}</span>
                    </div>
                  </button>
                  <button
                    className={`favorite-button ${favorites.includes(item.id) ? "is-favorite" : ""}`}
                    aria-label={`收藏 ${item.title}`}
                    aria-pressed={favorites.includes(item.id)}
                    title="收藏"
                    onClick={() => toggleFavorite(item.id)}
                  >
                    <Heart
                      size={15}
                      fill={
                        favorites.includes(item.id) ? "currentColor" : "none"
                      }
                    />
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
        <footer className="finder-status">
          <span>{filtered.length} 项</span>
          <span>个人影像与兴趣收藏</span>
        </footer>
      </section>
      <Dialog.Root
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="photo-overlay" />
          <Dialog.Content
            className="photo-viewer"
            aria-describedby="photo-caption"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              triggerRef.current?.focus();
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                step(-1);
              }
              if (event.key === "ArrowRight") {
                event.preventDefault();
                step(1);
              }
            }}
          >
            {selected && (
              <>
                <header>
                  <Dialog.Title>{selected.title}</Dialog.Title>
                  <span>{selected.subtitle}</span>
                  <Dialog.Close
                    className="icon-button"
                    aria-label="关闭大图"
                    title="关闭"
                  >
                    <X size={20} />
                  </Dialog.Close>
                </header>
                <div className="photo-stage">
                  <button
                    className="viewer-prev icon-button"
                    onClick={() => step(-1)}
                    disabled={viewerItems.length < 2}
                    aria-label="上一张"
                    title="上一张"
                  >
                    <ChevronLeft />
                  </button>
                  <img src={selected.image} alt={selected.title} />
                  <button
                    className="viewer-next icon-button"
                    onClick={() => step(1)}
                    disabled={viewerItems.length < 2}
                    aria-label="下一张"
                    title="下一张"
                  >
                    <ChevronRight />
                  </button>
                </div>
                <footer>
                  <Dialog.Description id="photo-caption">
                    {collectionInfo[selected.category].name} ·{" "}
                    {Math.max(
                      1,
                      viewerItems.findIndex((item) => item.id === selected.id) + 1,
                    )}{" "}
                    / {viewerItems.length}
                  </Dialog.Description>
                  <div>
                    <button
                      className="icon-button"
                      onClick={() => toggleFavorite(selected.id)}
                      aria-label="收藏当前照片"
                      aria-pressed={favorites.includes(selected.id)}
                      title="收藏"
                    >
                      <Heart
                        size={19}
                        fill={
                          favorites.includes(selected.id)
                            ? "currentColor"
                            : "none"
                        }
                      />
                    </button>
                    <a
                      className="icon-button"
                      href={selected.image}
                      download={selected.file.split("/").pop()}
                      aria-label="下载原图"
                      title="下载原图"
                    >
                      <Download size={19} />
                    </a>
                  </div>
                </footer>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
