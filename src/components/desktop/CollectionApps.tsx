import { useState } from "react";
import { ArrowDownToLine, ArrowLeft, ArrowRight, Bookmark, Check, Heart } from "lucide-react";
import { z } from "zod";
import { filterMedia } from "@/data/media";
import { useLocalState } from "@/hooks/use-local-state";
import "@/styles/collections.css";

export function PhotographyApp({ favorites, toggleFavorite }: { favorites: string[]; toggleFavorite: (id: string) => void }) {
  const items = filterMedia("photos");
  const [index, setIndex] = useState(0);
  const item = items[index];
  const step = (value: number) => setIndex(previous => (previous + value + items.length) % items.length);
  return <section className="photo-studio" tabIndex={0} aria-label="摄影作品集" onKeyDown={event => { if (event.key === "ArrowLeft") step(-1); if (event.key === "ArrowRight") step(1); }}>
    <header><span>LIGHT / FIELD</span><small>PHOTOGRAPHY BY HAONAN</small><div><button title="收藏照片" aria-label="收藏照片" aria-pressed={favorites.includes(item.id)} onClick={() => toggleFavorite(item.id)}><Heart size={17} fill={favorites.includes(item.id) ? "currentColor" : "none"} /></button><a href={item.image} download={item.file} title="下载原图" aria-label="下载原图"><ArrowDownToLine size={17} /></a></div></header>
    <figure><img src={item.image} alt={item.title} /><button className="photo-prev" aria-label="上一张作品" onClick={() => step(-1)}><ArrowLeft size={19} /></button><button className="photo-next" aria-label="下一张作品" onClick={() => step(1)}><ArrowRight size={19} /></button></figure>
    <div className="photo-studio-caption"><div><small>{item.subtitle.toUpperCase()}</small><h2>{item.title}</h2></div><span>{String(index + 1).padStart(2, "0")} / {items.length}</span></div>
    <nav className="photo-filmstrip" aria-label="摄影底片">{items.map((photo, i) => <button key={photo.id} aria-label={`选择 ${photo.title}`} aria-current={i === index} onClick={() => setIndex(i)}><img src={photo.image} alt="" loading="lazy" /></button>)}</nav>
  </section>;
}

const journalNotes = [
  "和朋友一起出发。关于路途，也关于陪伴。",
  "老君山，山顶的一碗泡面。",
  "妹妹弹古筝的片刻，留在生活的声音里。",
  "实验室的日常。记录研究之外的小瞬间。",
  "西岛两日，把步调交给海风。",
  "朋友送来的一本书。书页之外，还有心意。",
  "一次可爱的偶遇。",
];
export function DaybookApp() {
  const items = filterMedia("daily");
  const [index, setIndex] = useState(0);
  const item = items[index];
  return <div className="daybook">
    <aside><header><small>PERSONAL JOURNAL</small><h2>Daybook<span>.</span></h2><p>一些普通而珍贵的日子</p></header><nav aria-label="日记条目">{items.map((entry, i) => <button aria-current={i === index} key={entry.id} onClick={() => setIndex(i)}><span>{String(i + 1).padStart(2, "0")}</span><div><small>{entry.subtitle.split(" · ")[1]}</small><strong>{entry.title}</strong></div></button>)}</nav><footer>2025 — 2026<br />SEVEN LITTLE MOMENTS</footer></aside>
    <article key={item.id}><div className="journal-date"><span>{item.subtitle}</span><small>ENTRY {String(index + 1).padStart(2, "0")}</small></div><h2>{item.title}</h2><figure><img src={item.image} alt={item.title} /></figure><p>{journalNotes[index]}</p><footer><span>Haonan's journal</span><button aria-label="下一篇日记" onClick={() => setIndex((index + 1) % items.length)}>下一篇 <ArrowRight size={15} /></button></footer></article>
  </div>;
}

const filmDetails = [
  { en: "INTERSTELLAR", director: "Christopher Nolan", minutes: "169 MIN", year: "2014", line: "穿越时间，寻找回家的方向。", tags: ["科幻", "宇宙", "亲情"] },
  { en: "THE SHAWSHANK REDEMPTION", director: "Frank Darabont", minutes: "142 MIN", year: "1994", line: "关于希望，也关于漫长的自由。", tags: ["剧情", "希望", "友谊"] },
  { en: "SPIRITED AWAY", director: "Hayao Miyazaki", minutes: "125 MIN", year: "2001", line: "在陌生的世界里，记得自己的名字。", tags: ["动画", "成长", "奇幻"] },
  { en: "INCEPTION", director: "Christopher Nolan", minutes: "148 MIN", year: "2010", line: "一个念头，能抵达多深的梦境？", tags: ["科幻", "悬疑", "梦境"] },
  { en: "FORREST GUMP", director: "Robert Zemeckis", minutes: "142 MIN", year: "1994", line: "向前奔跑，生活自有它的答案。", tags: ["剧情", "人生", "成长"] },
  { en: "THE MATRIX", director: "The Wachowskis", minutes: "136 MIN", year: "1999", line: "真实世界，也许从一个问题开始。", tags: ["科幻", "动作", "哲学"] },
];
export function CinemaApp() {
  const items = filterMedia("films");
  const [index, setIndex] = useState(0);
  const [watchlist, setWatchlist] = useLocalState<string[]>("leo-cinema-watchlist-v1", [], z.array(z.string()).max(100));
  const film = items[index], detail = filmDetails[index];
  return <section className="cinema-app"><header><span>LEO CINEMA</span><small>THE PRIVATE COLLECTION</small><span>06 FILMS</span></header>
    <div className="cinema-feature"><div className="cinema-poster"><img src={film.image} alt={film.title} /></div><article><p className="cinema-overline">NOW IN THE COLLECTION / {detail.year}</p><h2>{detail.en}</h2><h3>{film.title}</h3><div className="cinema-rule" /><p className="cinema-logline">{detail.line}</p><dl><div><dt>DIRECTOR</dt><dd>{detail.director}</dd></div><div><dt>RUNNING TIME</dt><dd>{detail.minutes}</dd></div></dl><div className="cinema-tags">{detail.tags.map(tag => <span key={tag}>{tag}</span>)}</div><button className="watch-button" onClick={() => setWatchlist(old => old.includes(film.id) ? old.filter(id => id !== film.id) : [...old, film.id])} aria-pressed={watchlist.includes(film.id)}>{watchlist.includes(film.id) ? <Check size={15} /> : <Bookmark size={15} />}{watchlist.includes(film.id) ? "已加入待看" : "加入待看清单"}</button></article></div>
    <nav className="cinema-shelf" aria-label="选择影片">{items.map((entry, i) => <button key={entry.id} aria-current={index === i} aria-label={`选择影片 ${entry.title}`} onClick={() => setIndex(i)}><img src={entry.image} alt="" /><span>{String(i + 1).padStart(2, "0")}</span></button>)}</nav>
  </section>;
}

const flavors = [["麻", "辣", "鲜香"], ["清鲜", "精致", "早茶"], ["鲜甜", "海味"], ["炭香", "热烈"], ["浓郁", "麦香"], ["山野", "鲜香"], ["麻辣", "小食"], ["时令", "海味"], ["酥脆", "酱香"], ["鲜甜", "海风"]];
export function TableStoriesApp() {
  const items = filterMedia("food");
  const [index, setIndex] = useState(0);
  const [list, setList] = useLocalState<string[]>("leo-tasting-list-v1", [], z.array(z.string()).max(100));
  const item = items[index];
  return <section className="table-stories"><header><div><small>GOOD FOOD, GOOD COMPANY</small><h2>Table Stories</h2></div><span>食 · 间</span></header><div className="table-layout"><nav aria-label="风味菜单">{items.map((entry, i) => { const subtitle = entry.subtitle.split(" · "); return <button key={entry.id} aria-current={index === i} onClick={() => setIndex(i)}><span>{String(i + 1).padStart(2, "0")}</span><strong>{entry.title}</strong><small>{subtitle[subtitle.length - 1]}</small></button>; })}</nav><article><figure><img src={item.image} alt={item.title} /><figcaption>{item.subtitle}</figcaption></figure><div className="dish-details"><small>ON THE TABLE / {String(index + 1).padStart(2, "0")}</small><h3>{item.title}</h3><div className="flavor-tags">{flavors[index].map(flavor => <span key={flavor}>{flavor}</span>)}</div><button onClick={() => setList(old => old.includes(item.id) ? old.filter(id => id !== item.id) : [...old, item.id])} aria-pressed={list.includes(item.id)}>{list.includes(item.id) ? <Check size={16} /> : <Bookmark size={16} />}{list.includes(item.id) ? "已加入想吃清单" : "加入想吃清单"}</button></div></article></div><footer><span>一餐一味，一期一会。</span><span>{list.length} 道想吃的风味</span></footer></section>;
}
