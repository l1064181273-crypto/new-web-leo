import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowDownToLine, ArrowLeft, ArrowRight, Bookmark, Check, ExternalLink, Heart, Images, Shuffle, ZoomIn } from "lucide-react";
import { z } from "zod";
import { filterMedia, type MediaItem } from "@/data/media";
import { filmStories, foodStories, journalStories, nextCollectionId, photoStories } from "@/data/collection-stories";
import { toggleSavedId, type CollectionRecovery } from "@/data/collection-preferences";
import { useLocalState } from "@/hooks/use-local-state";
import { useAssetDownload } from "@/hooks/use-asset-download";
import { CollectionImage, CollectionViewer } from "./GalleryApp";
import { CollectionThumbnail } from "./CollectionThumbnail";
import { CollectionStorageMessage } from "./CollectionStorageMessage";
import { AssetDownloadFeedback } from "./AssetDownloadFeedback";
import { useCollectionFocus } from "./use-collection-focus";
import "@/styles/collections.css";

const savedItemsSchema = z.array(z.string()).max(100);
const photoGroups = ["全部", "山水与自然", "建筑与街道", "人与细节", "已收藏"];

function EmptyCollection({ text, reset, focus }: { text: string; reset: () => void; focus: ReturnType<typeof useCollectionFocus> }) {
  return <div className="collection-empty"><Images size={28} /><h3>{text}</h3><p>可以回到全部内容，留下喜欢的那一项。</p><button ref={focus.emptyActionRef} onClick={event => { focus.rememberFocus(event.currentTarget); reset(); }}>查看全部</button></div>;
}

function keyboardStep(event: KeyboardEvent, step: (offset: number) => void) {
  if (event.target !== event.currentTarget) return;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault(); step(event.key === "ArrowLeft" ? -1 : 1);
  }
}

export function PhotographyApp({ favorites, toggleFavorite, favoritesSaved = true, favoritesRecovery }: { favorites: string[]; toggleFavorite: (id: string) => void; favoritesSaved?: boolean; favoritesRecovery?: CollectionRecovery }) {
  const all = filterMedia("photos");
  const [group, setGroup] = useState("全部");
  const [selectedId, setSelectedId] = useState(all[0].id);
  const [viewer, setViewer] = useState<MediaItem | null>(null);
  const [viewerItems, setViewerItems] = useState<MediaItem[]>([]);
  const focus = useCollectionFocus();
  const touchOrigin = useRef<{ x: number; y: number } | null>(null);
  const lastSwipeAt = useRef(0);
  const items = all.filter(item => group === "全部" || (group === "已收藏" ? favorites.includes(item.id) : photoStories[item.id].group === group));
  const item = items.find(entry => entry.id === selectedId) ?? items[0];
  const download = useAssetDownload(item?.image, item?.file);
  const index = items.findIndex(entry => entry.id === item?.id);
  const step = (offset: number) => { const id = nextCollectionId(items, item?.id ?? "", offset); if (id) setSelectedId(id); };
  return <section className="photo-studio collection-app" tabIndex={0} aria-label="摄影作品集" onKeyDown={event => keyboardStep(event, step)}>
    <header><div className="photo-wordmark"><span>LIGHT / FIELD</span><small>PHOTOGRAPHY BY HAONAN</small></div><div className="photo-header-actions">{item && <><button aria-label={favorites.includes(item.id) ? "取消收藏照片" : "收藏照片"} aria-pressed={favorites.includes(item.id)} onClick={event => { focus.rememberFocus(event.currentTarget); toggleFavorite(item.id); }}><Heart size={18} fill={favorites.includes(item.id) ? "currentColor" : "none"} /></button><a ref={download.linkRef} href={item.image} download={item.file} aria-label="下载照片" aria-busy={download.status === "preparing"} aria-describedby={download.status === "idle" ? undefined : download.statusId} onClick={download.onClick}><ArrowDownToLine size={18} /></a></>}</div></header>
    <nav className="collection-filters photo-filters" aria-label="摄影主题">{photoGroups.map(value => <button key={value} ref={group === value ? focus.filterRef : undefined} aria-pressed={group === value} onClick={() => setGroup(value)}>{value}{value === "已收藏" && <small>{all.filter(entry => favorites.includes(entry.id)).length}</small>}</button>)}</nav>
    <CollectionStorageMessage saved={favoritesSaved} subject="收藏" recovery={favoritesRecovery ? [favoritesRecovery] : []} reloadScope="page" />
    <AssetDownloadFeedback download={download} />
    {item ? <>
      <figure onTouchStart={event => { lastSwipeAt.current = 0; const touch = event.touches[0]; touchOrigin.current = { x: touch.clientX, y: touch.clientY }; }} onTouchEnd={event => {
        const origin = touchOrigin.current; touchOrigin.current = null;
        if (!origin) return;
        const touch = event.changedTouches[0], dx = touch.clientX - origin.x, dy = touch.clientY - origin.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { lastSwipeAt.current = Date.now(); step(dx > 0 ? -1 : 1); }
      }}>
        <button className="photo-open-frame" aria-label={`放大 ${item.title}`} onClick={() => { if (Date.now() - lastSwipeAt.current < 400) return; setViewer(item); setViewerItems(items); }}><CollectionImage item={item} key={item.id} /><span className="photo-zoom-label"><ZoomIn size={14} />查看大图</span></button>
        <button className="photo-prev" disabled={items.length < 2} aria-label="上一张作品" onClick={() => step(-1)}><ArrowLeft size={19} /></button><button className="photo-next" disabled={items.length < 2} aria-label="下一张作品" onClick={() => step(1)}><ArrowRight size={19} /></button>
      </figure>
      <div className="photo-studio-caption"><div><small>{item.subtitle.toUpperCase()} · {photoStories[item.id].group}</small><h2>{item.title}</h2><p>{photoStories[item.id].note}</p></div><span>{String(index + 1).padStart(2, "0")} / {items.length}</span></div>
      <nav className="photo-filmstrip" aria-label="摄影底片">{items.map(photo => <button key={photo.id} aria-label={`选择 ${photo.title}`} aria-current={photo.id === item.id} onClick={() => setSelectedId(photo.id)}><CollectionThumbnail item={photo} slot="filmstrip" /></button>)}</nav>
    </> : <EmptyCollection text="还没有收藏的照片" reset={() => setGroup("全部")} focus={focus} />}
    <CollectionViewer selected={viewer} items={viewerItems} onSelect={value => { setViewer(value); setSelectedId(value.id); }} onClose={() => setViewer(null)} favorites={favorites} toggleFavorite={toggleFavorite} favoritesSaved={favoritesSaved} favoritesRecovery={favoritesRecovery} restoreFocus={focus.restoreFocus} />
  </section>;
}

export function DaybookApp() {
  const all = filterMedia("daily");
  const [selectedId, setSelectedId] = useState(all[0].id);
  const [month, setMonth] = useState("全部月份");
  const [theme, setTheme] = useState("全部");
  const [bookmarks, setBookmarks, saved, recovery] = useLocalState<string[]>("leo-daybook-bookmarks-v2", [], savedItemsSchema);
  const [viewer, setViewer] = useState<MediaItem | null>(null);
  const focus = useCollectionFocus();
  const months = [...new Set(all.map(item => item.subtitle.split(" · ")[1]))];
  const items = all.filter(item => (month === "全部月份" || item.subtitle.endsWith(month)) && (theme === "全部" || (theme === "书签" ? bookmarks.includes(item.id) : journalStories[item.id].theme === theme)));
  const item = items.find(entry => entry.id === selectedId) ?? items[0];
  const index = items.findIndex(entry => entry.id === item?.id);
  const reset = () => { setMonth("全部月份"); setTheme("全部"); };
  const step = (offset: number) => { const id = nextCollectionId(items, item?.id ?? "", offset); if (id) setSelectedId(id); };
  const toggleBookmark = (id: string) => setBookmarks(old => toggleSavedId(old, id, all.map(entry => entry.id)));
  const emptyText = theme === "书签"
    ? (month === "全部月份" ? "还没有符合筛选的书签" : "这个月份还没有书签")
    : (month === "全部月份" ? "还没有符合筛选的日记" : "这个月份没有相关日记");
  return <section className="daybook collection-app" aria-label="生活日记" tabIndex={0} onKeyDown={event => keyboardStep(event, step)}>
    <aside><header><small>PERSONAL JOURNAL</small><h2>Daybook<span>.</span></h2><p>一些普通而珍贵的日子</p><label className="journal-month">翻到 <select aria-label="日记月份" value={month} onChange={event => setMonth(event.target.value)}><option>全部月份</option>{months.map(value => <option key={value}>{value}</option>)}</select></label></header>
      <nav aria-label="日记主题" className="journal-themes">{["全部", "在路上", "身边人", "日常", "书签"].map(value => <button key={value} ref={theme === value ? focus.filterRef : undefined} aria-pressed={theme === value} onClick={() => setTheme(value)}>{value}</button>)}</nav>
      <nav aria-label="日记条目" className="journal-entries">{items.map(entry => <button aria-current={entry.id === item?.id} key={entry.id} onClick={() => setSelectedId(entry.id)}><span>{String(all.findIndex(value => value.id === entry.id) + 1).padStart(2, "0")}</span><div><small>{entry.subtitle.split(" · ")[1]}</small><strong>{entry.title}</strong></div>{bookmarks.includes(entry.id) && <Bookmark size={12} fill="currentColor" />}</button>)}</nav><footer>2025.12 — 2026.03<br />{items.length} / {all.length} LITTLE MOMENTS</footer>
    </aside>
    <div className="journal-page"><CollectionStorageMessage saved={saved} subject="日记书签" recovery={[recovery]} />{item ? <article key={item.id}><div className="journal-date"><span>{item.subtitle}</span><small>{journalStories[item.id].theme}</small></div><div className="journal-title-row"><h2>{item.title}</h2><button className="journal-bookmark" aria-label={bookmarks.includes(item.id) ? "移除日记书签" : "给日记加书签"} aria-pressed={bookmarks.includes(item.id)} onClick={event => { focus.rememberFocus(event.currentTarget); toggleBookmark(item.id); }}><Bookmark size={18} fill={bookmarks.includes(item.id) ? "currentColor" : "none"} /></button></div><figure><button className="journal-image-open" aria-label={`查看日记照片 ${item.title}`} onClick={() => setViewer(item)}><CollectionImage item={item} key={item.id} /><span><ZoomIn size={13} />展开照片</span></button></figure><p className="journal-story">{journalStories[item.id].text}</p><footer><button disabled={items.length < 2} aria-label="上一篇日记" onClick={() => step(-1)}><ArrowLeft size={15} />上一篇</button><span>{index + 1} / {items.length}</span><button disabled={items.length < 2} aria-label="下一篇日记" onClick={() => step(1)}>下一篇<ArrowRight size={15} /></button></footer></article> : <EmptyCollection text={emptyText} reset={reset} focus={focus} />}</div>
    <CollectionViewer selected={viewer} items={items} onSelect={setViewer} onClose={() => setViewer(null)} restoreFocus={focus.restoreFocus} />
  </section>;
}

export function CinemaApp() {
  const all = filterMedia("films");
  const [selectedId, setSelectedId] = useState(all[0].id);
  const [genre, setGenre] = useState("全部");
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [watchlist, setWatchlist, saved, recovery] = useLocalState<string[]>("leo-cinema-watchlist-v1", [], savedItemsSchema);
  const [viewer, setViewer] = useState<MediaItem | null>(null);
  const focus = useCollectionFocus();
  const count = all.filter(item => watchlist.includes(item.id)).length;
  const items = all.filter(item => (genre === "全部" || filmStories[item.id].tags.includes(genre)) && (!watchlistOnly || watchlist.includes(item.id)));
  const film = items.find(item => item.id === selectedId) ?? items[0];
  const detail = film ? filmStories[film.id] : null;
  const step = (offset: number) => { const id = nextCollectionId(items, film?.id ?? "", offset); if (id) setSelectedId(id); };
  return <section className="cinema-app collection-app" tabIndex={0} aria-label="私人电影收藏" onKeyDown={event => keyboardStep(event, step)}>
    <header><span>LEO CINEMA</span><small>THE PRIVATE COLLECTION</small><span>{all.length} FILMS</span></header>
    <div className="cinema-browse-tools"><nav className="collection-filters" aria-label="电影类型">{["全部", "科幻", "剧情", "动画"].map(value => <button key={value} aria-pressed={genre === value} onClick={() => setGenre(value)}>{value}</button>)}</nav><button ref={focus.filterRef} className="collection-list-toggle" aria-pressed={watchlistOnly} onClick={() => setWatchlistOnly(value => !value)}><Bookmark size={14} />待看清单 <span>{count}</span></button></div>
    <CollectionStorageMessage saved={saved} subject="待看清单" recovery={[recovery]} />
    {film && detail ? <><div className="cinema-feature"><button className="cinema-poster" aria-label={`放大海报 ${film.title}`} onClick={() => setViewer(film)}><CollectionImage item={film} key={film.id} /></button><article><p className="cinema-overline">IN THE COLLECTION / {detail.year}</p><h2>{detail.en}</h2><h3>{film.title}</h3><div className="cinema-rule" /><p className="cinema-logline">{detail.line}</p><dl><div><dt>DIRECTOR</dt><dd>{detail.director}</dd></div><div><dt>RUNNING TIME</dt><dd>{detail.minutes} MIN</dd></div></dl><div className="cinema-tags">{detail.tags.map(tag => <span key={tag}>{tag}</span>)}</div><div className="cinema-viewing-note"><small>观看线索</small><p>{detail.note}</p></div><button className="watch-button" onClick={event => { focus.rememberFocus(event.currentTarget); setWatchlist(old => toggleSavedId(old, film.id, all.map(entry => entry.id))); }} aria-pressed={watchlist.includes(film.id)}>{watchlist.includes(film.id) ? <Check size={15} /> : <Bookmark size={15} />}{watchlist.includes(film.id) ? "从待看清单移除" : "加入待看清单"}</button><a className="cinema-source" href={detail.source} target="_blank" rel="noopener noreferrer">影片资料 <ExternalLink size={12} /></a></article></div>
      <div className="cinema-shelf-heading"><span>{watchlistOnly ? "你的待看片架" : "片架"} · {items.length} 部</span><div><button aria-label="上一部影片" disabled={items.length < 2} onClick={() => step(-1)}><ArrowLeft size={16} /></button><button aria-label="下一部影片" disabled={items.length < 2} onClick={() => step(1)}><ArrowRight size={16} /></button></div></div>
      <nav className="cinema-shelf" aria-label="选择影片">{items.map(entry => <button key={entry.id} aria-current={film.id === entry.id} aria-label={`选择影片 ${entry.title}`} onClick={() => setSelectedId(entry.id)}><CollectionThumbnail item={entry} slot="cinema-shelf" /><span>{entry.title}</span></button>)}</nav>
      <p className="collection-local-note">{saved ? "待看清单保存在这台设备上。" : "待看清单尚未保存到这台设备。"}</p>
    </> : <EmptyCollection text={watchlistOnly ? "这张片架还没有待看电影" : "没有符合条件的影片"} reset={() => { setGenre("全部"); setWatchlistOnly(false); }} focus={focus} />}
    <CollectionViewer selected={viewer} items={items} onSelect={setViewer} onClose={() => setViewer(null)} restoreFocus={focus.restoreFocus} />
  </section>;
}

export function TableStoriesApp() {
  const all = filterMedia("food");
  const [selectedId, setSelectedId] = useState(all[0].id);
  const [group, setGroup] = useState("全部风味");
  const [savedOnly, setSavedOnly] = useState(false);
  const [list, setList, saved, recovery] = useLocalState<string[]>("leo-tasting-list-v1", [], savedItemsSchema);
  const [viewer, setViewer] = useState<MediaItem | null>(null);
  const focus = useCollectionFocus();
  const items = all.filter(item => (group === "全部风味" || foodStories[item.id].group === group) && (!savedOnly || list.includes(item.id)));
  const item = items.find(entry => entry.id === selectedId) ?? items[0];
  const detail = item ? foodStories[item.id] : null;
  const count = all.filter(entry => list.includes(entry.id)).length;
  const surprise = () => {
    const choices = items.filter(entry => entry.id !== item?.id);
    if (choices.length) setSelectedId(choices[Math.floor(Math.random() * choices.length)].id);
  };
  return <section className="table-stories collection-app" aria-label="风味收藏">
    <header><div><small>GOOD FOOD, GOOD COMPANY</small><h2>Table Stories</h2></div><span>食 · 间</span></header>
    <div className="table-browse-tools"><label>这一餐 <select aria-label="风味分类" value={group} onChange={event => setGroup(event.target.value)}>{["全部风味", "热闹的一桌", "慢慢吃", "海的味道", "山野风味"].map(value => <option key={value}>{value}</option>)}</select></label><button ref={focus.filterRef} className="collection-list-toggle" aria-pressed={savedOnly} onClick={() => setSavedOnly(value => !value)}><Bookmark size={14} />想吃清单 <span>{count}</span></button></div>
    <CollectionStorageMessage saved={saved} subject="想吃清单" recovery={[recovery]} />
    {item && detail ? <div className="table-layout"><nav aria-label="风味菜单">{items.map(entry => { const subtitle = entry.subtitle.split(" · "); return <button key={entry.id} aria-current={item.id === entry.id} onClick={() => setSelectedId(entry.id)}><span>{String(all.findIndex(value => value.id === entry.id) + 1).padStart(2, "0")}</span><strong>{entry.title}</strong><small>{subtitle[subtitle.length - 1]}{list.includes(entry.id) ? " · 已选" : ""}</small></button>; })}</nav><article key={item.id}><figure><button className="dish-image-open" aria-label={`查看 ${item.title} 大图`} onClick={() => setViewer(item)}><CollectionImage item={item} key={item.id} /></button><figcaption>{item.subtitle}</figcaption></figure><div className="dish-details"><small>{detail.group}</small><h3>{item.title}</h3><div className="flavor-tags">{detail.flavors.map(flavor => <span key={flavor}>{flavor}</span>)}</div><p>{detail.note}</p><p className="dish-tasting-note">{detail.detail}</p><button onClick={event => { focus.rememberFocus(event.currentTarget); setList(old => toggleSavedId(old, item.id, all.map(entry => entry.id))); }} aria-pressed={list.includes(item.id)}>{list.includes(item.id) ? <Check size={16} /> : <Bookmark size={16} />}{list.includes(item.id) ? "从想吃清单移除" : "加入想吃清单"}</button></div></article></div> : <EmptyCollection text="清单里还没有这个风味" reset={() => { setGroup("全部风味"); setSavedOnly(false); }} focus={focus} />}
    <footer><span>{savedOnly ? `${count} 道想吃的风味 · ${saved ? "保存在本机" : "尚未保存"}` : "一餐一味，一期一会。"}</span><button onClick={surprise} disabled={items.length < 2}><Shuffle size={13} />随机选一道</button></footer>
    <CollectionViewer selected={viewer} items={items} onSelect={setViewer} onClose={() => setViewer(null)} restoreFocus={focus.restoreFocus} />
  </section>;
}
