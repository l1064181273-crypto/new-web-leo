import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Aperture, BookImage, ChevronLeft, ChevronRight, Download, Film, Gamepad2, Grid2X2, Heart, Images, List, Music2, Search, Utensils, X, ZoomIn, ZoomOut } from "lucide-react";
import { collectionInfo, filterMedia, media, type CollectionId, type MediaItem } from "@/data/media";
import { collectionIntroductions, nextCollectionId, storyFor } from "@/data/collection-stories";
import type { CollectionRecovery } from "@/data/collection-preferences";
import { CollectionThumbnail } from "./CollectionThumbnail";
import { CollectionStorageMessage } from "./CollectionStorageMessage";
import { useCollectionFocus } from "./use-collection-focus";
import { useAssetDownload } from "@/hooks/use-asset-download";
import { AssetDownloadFeedback } from "./AssetDownloadFeedback";
import "@/styles/collections.css";

const icons = { daily: BookImage, photos: Aperture, artists: Music2, films: Film, games: Gamepad2, food: Utensils };
type Category = CollectionId | "all" | "favorites";

export function CollectionImage({ item, lazy = false }: { item: MediaItem; lazy?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return <>
    {!loaded && !failed && <span className="collection-image-loading" aria-hidden="true" />}
    <img src={item.image} alt={item.title} loading={lazy ? "lazy" : "eager"} decoding="async" draggable={false} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} style={failed ? { visibility: "hidden" } : undefined} />
    {failed && <span className="collection-image-error" role="status"><Images size={24} />图片未载入，请刷新后重试。</span>}
  </>;
}

export function CollectionViewer({ selected, items, onSelect, onClose, favorites = [], toggleFavorite, favoritesSaved = true, favoritesRecovery, restoreFocus }: {
  selected: MediaItem | null;
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
  onClose: () => void;
  favorites?: string[];
  toggleFavorite?: (id: string) => void;
  favoritesSaved?: boolean;
  favoritesRecovery?: CollectionRecovery;
  restoreFocus?: () => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  const touchOrigin = useRef<{ x: number; y: number } | null>(null);
  const open = !!selected;
  const download = useAssetDownload(selected?.image, selected?.file.split("/").pop());
  useEffect(() => { setZoomed(false); }, [selected?.id]);
  const step = (offset: number) => {
    const next = nextCollectionId(items, selected?.id ?? "", offset);
    const item = items.find(entry => entry.id === next);
    if (item) onSelect(item);
  };
  return <Dialog.Root open={open} onOpenChange={value => { if (!value) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="photo-overlay" />
      <Dialog.Content className="photo-viewer collection-viewer" onOpenAutoFocus={() => {
        previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      }} onCloseAutoFocus={event => {
        event.preventDefault();
        if (previousFocus.current?.isConnected) previousFocus.current.focus();
        else restoreFocus?.();
      }} onEscapeKeyDown={event => event.stopPropagation()} onKeyDown={event => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault(); event.stopPropagation(); step(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}>
        {selected && <>
          <header><Dialog.Title>{selected.title}</Dialog.Title><span>{selected.subtitle}</span><Dialog.Close className="icon-button" aria-label="关闭大图"><X size={20} /></Dialog.Close></header>
          <div className={`photo-stage${zoomed ? " is-zoomed" : ""}`} onTouchStart={event => {
            const touch = event.touches[0];
            touchOrigin.current = { x: touch.clientX, y: touch.clientY };
          }} onTouchEnd={event => {
            const origin = touchOrigin.current;
            touchOrigin.current = null;
            if (!origin || zoomed) return;
            const touch = event.changedTouches[0];
            const dx = touch.clientX - origin.x, dy = touch.clientY - origin.y;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx > 0 ? -1 : 1);
          }}>
            <button className="viewer-prev icon-button" onClick={() => step(-1)} disabled={items.length < 2} aria-label="上一张"><ChevronLeft /></button>
            <div className="collection-viewer-image"><CollectionImage item={selected} key={selected.id} /></div>
            <button className="viewer-next icon-button" onClick={() => step(1)} disabled={items.length < 2} aria-label="下一张"><ChevronRight /></button>
          </div>
          <div className="collection-viewer-note"><div><Dialog.Description>{storyFor(selected)}</Dialog.Description>{toggleFavorite && <CollectionStorageMessage saved={favoritesSaved} subject="收藏" recovery={favoritesRecovery ? [favoritesRecovery] : []} reloadScope="page" />}<AssetDownloadFeedback download={download} /></div><span>{collectionInfo[selected.category].name} · {Math.max(1, items.findIndex(item => item.id === selected.id) + 1)} / {items.length}</span></div>
          <footer><span className="viewer-hint">← → 切换 · Esc 关闭 · 左右轻扫</span><div>
            <button className="icon-button" aria-label={zoomed ? "适合窗口" : "放大图片"} aria-pressed={zoomed} onClick={() => setZoomed(value => !value)}>{zoomed ? <ZoomOut size={19} /> : <ZoomIn size={19} />}</button>
            {toggleFavorite && <button className="icon-button" onClick={() => toggleFavorite(selected.id)} aria-label={favorites.includes(selected.id) ? "取消收藏当前图片" : "收藏当前图片"} aria-pressed={favorites.includes(selected.id)}><Heart size={19} fill={favorites.includes(selected.id) ? "currentColor" : "none"} /></button>}
            <a ref={download.linkRef} className="icon-button" href={selected.image} download={selected.file.split("/").pop()} aria-label="保存图片" aria-busy={download.status === "preparing"} aria-describedby={download.status === "idle" ? undefined : download.statusId} onClick={download.onClick}><Download size={19} /></a>
          </div></footer>
        </>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

export default function GalleryApp({ initial = "all", favorites, toggleFavorite, favoritesSaved = true, favoritesRecovery }: {
  initial?: Category;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  favoritesSaved?: boolean;
  favoritesRecovery?: CollectionRecovery;
}) {
  const [category, setCategory] = useState<Category>(initial);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState<"collection" | "title">("collection");
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [viewerItems, setViewerItems] = useState<MediaItem[]>([]);
  const focus = useCollectionFocus();
  const scrollRef = useRef<HTMLDivElement>(null);
  const filtered = filterMedia(category, query, favorites);
  if (sort === "title") filtered.sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
  const title = category === "all" ? "Personal Atlas" : category === "favorites" ? "Favorites" : collectionInfo[category].en;
  const chooseCategory = (value: Category) => { setCategory(value); setQuery(""); };
  useEffect(() => { scrollRef.current?.scrollTo?.({ top: 0 }); }, [category, query, sort]);
  return <div className="finder atlas-studio">
    <aside className="finder-sidebar">
      <div className="sidebar-heading">图库</div>
      <nav aria-label="相册分类">
        <button ref={category === "all" ? focus.filterRef : undefined} className={category === "all" ? "selected" : ""} aria-pressed={category === "all"} onClick={() => chooseCategory("all")}><Images size={17} />所有收藏<small>{media.length}</small></button>
        <button ref={category === "favorites" ? focus.filterRef : undefined} className={category === "favorites" ? "selected" : ""} aria-pressed={category === "favorites"} onClick={() => chooseCategory("favorites")}><Heart size={17} />我的收藏<small>{filterMedia("favorites", "", favorites).length}</small></button>
        <div className="sidebar-heading albums-label">相簿</div>
        {(Object.keys(collectionInfo) as CollectionId[]).map(id => {
          const Icon = icons[id];
          return <button key={id} ref={category === id ? focus.filterRef : undefined} className={category === id ? "selected" : ""} aria-pressed={category === id} onClick={() => chooseCategory(id)}><Icon size={17} />{collectionInfo[id].name}<small>{filterMedia(id).length}</small></button>;
        })}
      </nav>
      <div className="sidebar-footer">HAONAN LI<br /><span>{media.length} 项影像与兴趣</span></div>
    </aside>
    <section className="finder-main">
      <div className="app-toolbar">
        <div className="breadcrumbs">Haonan <ChevronRight size={13} /> <strong>{title}</strong></div>
        <div className="segmented" aria-label="显示方式"><button aria-label="网格视图" aria-pressed={mode === "grid"} onClick={() => setMode("grid")}><Grid2X2 size={16} /></button><button aria-label="列表视图" aria-pressed={mode === "list"} onClick={() => setMode("list")}><List size={17} /></button></div>
        <label className="search-field"><Search size={15} /><input aria-label="搜索收藏" placeholder="搜索收藏" value={query} onChange={event => setQuery(event.target.value)} />{query && <button aria-label="清除搜索" onClick={() => setQuery("")}><X size={13} /></button>}</label>
      </div>
      <CollectionStorageMessage saved={favoritesSaved} subject="收藏" recovery={favoritesRecovery ? [favoritesRecovery] : []} reloadScope="page" />
      <div className="gallery-scroll" ref={scrollRef}>
        <header className="gallery-heading"><div><p>{category === "all" ? "A SMALL WORLD, KEPT CLOSE" : "PERSONAL COLLECTION"}</p><h2>{title}</h2><span>{category === "all" ? "照片、电影、声音与一桌好味道。随意打开一册。" : category === "favorites" ? `在这里，重新遇见你留下的画面。${favoritesSaved ? "收藏保存在这台设备上。" : "收藏暂时仅在本次浏览中保留。"}` : collectionIntroductions[category]}</span></div><small>{filtered.length} 项</small></header>
        {category === "all" && !query && <nav className="atlas-collection-guide" aria-label="按兴趣浏览">{(Object.keys(collectionInfo) as CollectionId[]).map(id => {
          const item = filterMedia(id)[0];
          return <button key={id} onClick={() => chooseCategory(id)}><CollectionThumbnail item={item} slot="atlas-guide" /><span><strong>{collectionInfo[id].en}</strong><small>{filterMedia(id).length} 项 · {collectionInfo[id].name}</small></span><ChevronRight size={14} /></button>;
        })}</nav>}
        <div className="atlas-result-tools"><span aria-live="polite">{query ? `“${query}” · ${filtered.length} 项结果` : "影像索引"}</span><label>排序 <select aria-label="收藏排序" value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="collection">收藏顺序</option><option value="title">名称</option></select></label></div>
        {filtered.length === 0 ? <div className="empty-state"><Images size={36} /><h3>{query ? "没有找到相关收藏" : "这里还没有收藏"}</h3><p>{query ? "试试地点、作品名或歌手名。" : "在任意图片旁点一下爱心，就能在这里重新找到它。"}</p><button ref={focus.emptyActionRef} className="text-button" onClick={event => { focus.rememberFocus(event.currentTarget); if (query) setQuery(""); else chooseCategory("all"); }}>{query ? "清除搜索" : "浏览所有收藏"}</button></div> : <div className={`media-grid is-${mode} ${category === "films" ? "posters" : ""}`}>
          {filtered.map(item => <article className="media-tile" key={item.id}>
            <button className="media-open" aria-label={`查看 ${item.title}`} onClick={() => { setSelected(item); setViewerItems(filtered); }}><CollectionThumbnail item={item} slot={mode === "list" ? "atlas-list" : category === "films" ? "atlas-posters" : "atlas-grid"} alt={item.title} /><div><strong>{item.title}</strong><span>{item.subtitle}</span></div></button>
            <button className={`favorite-button ${favorites.includes(item.id) ? "is-favorite" : ""}`} aria-label={`${favorites.includes(item.id) ? "取消收藏" : "收藏"} ${item.title}`} aria-pressed={favorites.includes(item.id)} onClick={event => { focus.rememberFocus(event.currentTarget); toggleFavorite(item.id); }}><Heart size={15} fill={favorites.includes(item.id) ? "currentColor" : "none"} /></button>
          </article>)}
        </div>}
      </div>
      <footer className="finder-status"><span>{filtered.length} 项</span><span>{favoritesSaved ? "收藏标记保存在本机" : "收藏标记尚未保存"}</span></footer>
    </section>
    <CollectionViewer selected={selected} items={viewerItems} onSelect={setSelected} onClose={() => setSelected(null)} favorites={favorites} toggleFavorite={toggleFavorite} favoritesSaved={favoritesSaved} favoritesRecovery={favoritesRecovery} restoreFocus={focus.restoreFocus} />
  </div>;
}
