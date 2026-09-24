import { ExternalLink, Heart, Headphones, LoaderCircle, Music2, Pause, Play, Repeat2, RotateCcw, Search, SkipBack, SkipForward, Square, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { media } from "@/data/media";
import { playbackTime } from "@/data/collection-stories";
import { toggleSavedId } from "@/data/collection-preferences";
import { useLocalState } from "@/hooks/use-local-state";
import { CollectionThumbnail } from "./CollectionThumbnail";
import { CollectionStorageMessage } from "./CollectionStorageMessage";
import { useCollectionFocus } from "./use-collection-focus";
import music from "@/data/chart-music.json";
import "@/styles/collections.css";

const tracks = music.tracks;
const favoritesSchema = z.array(z.number().int()).max(100);
const preferencesSchema = z.object({ volume: z.number().min(0).max(1), repeat: z.boolean() });
type Source = "chart" | "ambient";

function releaseAudio(audio: HTMLAudioElement | null) {
  if (!audio) return;
  audio.pause();
  audio.removeAttribute("src");
  audio.load(); // Abort the old fetch and discard its decoder/buffer.
}

export default function MusicApp() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const generation = useRef(0);
  const autoplay = useRef(false);
  const playIntent = useRef(false);
  const lastVolume = useRef(.35);
  const [source, setSource] = useState<Source>("chart");
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pending, setPending] = useState(false);
  const [playRequest, setPlayRequest] = useState(0);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const focus = useCollectionFocus();
  const [favorites, setFavorites, favoritesSaved, favoritesRecovery] = useLocalState<number[]>("leo-music-favorites-v2", [], favoritesSchema);
  const [preferences, setPreferences, preferencesSaved, preferencesRecovery] = useLocalState("leo-music-preferences-v2", { volume: .35, repeat: false }, preferencesSchema);
  const track = tracks[selected];
  const cover = media.find(item => item.id === "photo-10.jpg")!;
  const sourceUrl = source === "chart" ? track.previewUrl : `${import.meta.env.BASE_URL}audio/lofi-ambient.mp3`;
  const trackTitle = source === "chart" ? track.title : "Lofi · 桌面背景音";
  const trackArtist = source === "chart" ? track.artist : "本站附带音频片段";
  const queue = tracks.filter(item => !favoritesOnly || favorites.includes(item.trackId));
  const visible = queue.filter(item => `${item.title} ${item.artist}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const favoriteCount = tracks.filter(item => favorites.includes(item.trackId)).length;
  const invalidatePlayback = useCallback(() => { generation.current++; }, []);

  const playAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    const version = ++generation.current;
    playIntent.current = true;
    setError(""); setPending(true); setPlayRequest(version);
    try {
      if (audio.getAttribute("src") !== sourceUrl) { audio.src = sourceUrl; audio.load(); }
      await audio.play();
      if (version === generation.current) setPending(false);
    } catch {
      if (version === generation.current) {
        playIntent.current = false;
        releaseAudio(audio);
        setPending(false); setPlaying(false);
        setCurrent(0); setDuration(0);
        setError("音频暂时无法播放。请重试，或切换音频来源。");
      }
    }
  }, [sourceUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    invalidatePlayback();
    playIntent.current = false;
    audio.pause();
    audio.src = sourceUrl;
    audio.load();
    setPlaying(false); setCurrent(0); setDuration(0); setError(""); setPending(false);
    if (autoplay.current) { autoplay.current = false; void playAudio(); }
    return () => { invalidatePlayback(); playIntent.current = false; releaseAudio(audio); };
  }, [sourceUrl, playAudio, invalidatePlayback]);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = preferences.volume; }, [preferences.volume, sourceUrl]);
  useEffect(() => {
    if (!pending) return;
    const timeout = window.setTimeout(() => {
      generation.current++; playIntent.current = false;
      releaseAudio(audioRef.current); setPending(false); setPlaying(false);
      setCurrent(0); setDuration(0);
      setError("载入时间较长，已暂停等待。请重试，或切换到本站背景音。");
    }, 15000);
    return () => window.clearTimeout(timeout);
  }, [pending, playRequest, sourceUrl]);

  const choose = (index: number, shouldPlay = playing || pending) => {
    if (source === "chart" && index === selected) { if (shouldPlay) void playAudio(); return; }
    autoplay.current = shouldPlay;
    setSource("chart"); setSelected(index); setMenu(false);
  };
  const changeSource = (value: Source) => {
    autoplay.current = false;
    setSource(value); setMenu(false);
  };
  const step = (offset: number, shouldPlay = playing || pending) => {
    if (source !== "chart" || !queue.length) return;
    const index = queue.findIndex(item => item.trackId === track.trackId);
    const next = index < 0 ? 0 : (index + offset + queue.length) % queue.length;
    choose(tracks.findIndex(item => item.trackId === queue[next].trackId), shouldPlay);
  };
  const toggle = () => {
    if (playing || pending) {
      generation.current++; playIntent.current = false;
      if (pending) { releaseAudio(audioRef.current); setCurrent(0); setDuration(0); }
      else audioRef.current?.pause();
      setPending(false); setPlaying(false);
    } else {
      void playAudio();
    }
  };
  const seek = (value: number) => {
    if (audioRef.current && duration) {
      audioRef.current.currentTime = Math.min(duration, Math.max(0, value));
      setCurrent(audioRef.current.currentTime);
    }
  };
  const ended = () => {
    playIntent.current = false; setPlaying(false); setPending(false);
    if (source !== "chart") return;
    const index = queue.findIndex(item => item.trackId === track.trackId);
    if (index < queue.length - 1 || preferences.repeat) step(1, true);
  };
  const toggleFavorite = (trackId: number) => setFavorites(old => toggleSavedId(old, trackId, tracks.map(item => item.trackId)));
  const isCurrentAudio = (audio: HTMLAudioElement) => audio === audioRef.current && audio.getAttribute("src") === sourceUrl;
  const playLabel = pending ? "取消加载" : playing ? "暂停音乐" : "播放音乐";
  const playbackIcon = pending ? <Square size={15} fill="currentColor" /> : playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />;

  return <section className="music-studio is-library" tabIndex={0} aria-label="音乐试听桌" onKeyDown={event => {
    if (event.target !== event.currentTarget) return;
    if (event.key === " ") { event.preventDefault(); toggle(); }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); step(event.key === "ArrowLeft" ? -1 : 1); }
  }}>
    <audio key={sourceUrl} ref={audioRef} preload="none" loop={source === "ambient" && preferences.repeat} onPlay={event => {
      if (!isCurrentAudio(event.currentTarget) || !playIntent.current) event.currentTarget.pause();
    }} onPlaying={event => {
      if (isCurrentAudio(event.currentTarget) && playIntent.current) { setPlaying(true); setPending(false); }
      else event.currentTarget.pause();
    }} onPause={event => { if (isCurrentAudio(event.currentTarget)) setPlaying(false); }} onEnded={event => { if (isCurrentAudio(event.currentTarget) && playIntent.current) ended(); }} onWaiting={event => { if (isCurrentAudio(event.currentTarget) && playIntent.current) setPending(true); }} onTimeUpdate={event => { if (isCurrentAudio(event.currentTarget)) setCurrent(Number.isFinite(event.currentTarget.currentTime) ? event.currentTarget.currentTime : 0); }} onLoadedMetadata={event => { if (isCurrentAudio(event.currentTarget)) setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0); }} onDurationChange={event => { if (isCurrentAudio(event.currentTarget)) setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0); }} onError={event => {
      if (!isCurrentAudio(event.currentTarget) || !playIntent.current) return;
      generation.current++; playIntent.current = false;
      releaseAudio(event.currentTarget);
      setError(source === "chart" ? "这段试听暂不可用。可重试、换一首，或到官方页面收听。" : "背景音暂未载入。请刷新页面后重试。");
      setPlaying(false); setPending(false); setCurrent(0); setDuration(0);
    }} />
    <aside className="listening-desk">
      <p className="music-desk-label"><Headphones size={12} /> A LITTLE LISTENING DESK</p>
      <div className="ipod">
        <div className="ipod-screen">
          <div className="ipod-status"><strong>Leo's iPod</strong><span>{source === "chart" ? `#${track.rank}` : "LOCAL"} ▰</span></div>
          {menu ? <div className="ipod-menu"><button onClick={() => setMenu(false)}>返回播放器 <span>›</span></button><button onClick={() => changeSource(source === "chart" ? "ambient" : "chart")}>{source === "chart" ? "本站背景音" : "榜单试听"}<span>›</span></button>{source === "chart" && <a href={track.url} target="_blank" rel="noopener noreferrer">官方收听 <span>↗</span></a>}<p>{source === "chart" ? "BILLBOARD 2024 · PREVIEWS" : "LOCAL BACKGROUND CLIP"}</p></div> : <>
            <div className="ipod-track"><CollectionThumbnail item={cover} slot="ipod" alt="桌面封面：海边路灯" lazy={false} /><div><strong title={trackTitle}>{trackTitle}</strong><span title={trackArtist}>{trackArtist}</span><small>{source === "chart" ? "iTunes 官方试听片段" : "可循环的背景音片段"}</small></div></div>
            <input className="ipod-seek" type="range" aria-label="播放进度" aria-valuetext={`${playbackTime(current)} / ${playbackTime(duration)}`} min={0} max={duration || 1} step={.1} value={Math.min(current, duration || 1)} onChange={event => seek(Number(event.target.value))} disabled={!duration} /><div className="ipod-times"><span>{playbackTime(current)}</span><span>{duration ? playbackTime(duration) : "--:--"}</span></div>
          </>}
        </div>
        <div className="ipod-wheel"><button className="wheel-menu" aria-expanded={menu} onClick={() => setMenu(value => !value)}>MENU</button><button className="wheel-prev" disabled={source !== "chart" || !queue.length} onClick={() => step(-1)} aria-label="上一首"><SkipBack size={17} fill="currentColor" /></button><button className="wheel-next" disabled={source !== "chart" || !queue.length} onClick={() => step(1)} aria-label="下一首"><SkipForward size={17} fill="currentColor" /></button><button className="wheel-play" onClick={toggle} aria-label={playLabel}>{playbackIcon}</button><button className="wheel-center" onClick={toggle} aria-label={`${playLabel}（中央按钮）`}>{pending && <LoaderCircle size={18} className="music-loading-spinner" />}</button></div>
        <div className="ipod-volume"><button aria-label={preferences.volume ? "静音" : "取消静音"} onClick={() => {
          if (preferences.volume) lastVolume.current = preferences.volume;
          setPreferences(old => ({ ...old, volume: old.volume ? 0 : lastVolume.current }));
        }}>{preferences.volume ? <Volume2 size={15} /> : <VolumeX size={15} />}</button><input type="range" aria-label="音量" aria-valuetext={`${Math.round(preferences.volume * 100)}%`} min={0} max={1} step={.01} value={preferences.volume} onChange={event => setPreferences(old => ({ ...old, volume: Number(event.target.value) }))} /></div>
      </div>
      <div className="music-player-options"><button aria-pressed={preferences.repeat} onClick={() => setPreferences(old => ({ ...old, repeat: !old.repeat }))}><Repeat2 size={14} />{preferences.repeat ? "循环已开" : "循环关闭"}</button>{source === "chart" && <button aria-label={favorites.includes(track.trackId) ? "取消收藏当前歌曲" : "收藏当前歌曲"} aria-pressed={favorites.includes(track.trackId)} onClick={() => toggleFavorite(track.trackId)}><Heart size={14} fill={favorites.includes(track.trackId) ? "currentColor" : "none"} />收藏</button>}</div>
      <p className="music-player-status" role="status">{pending ? "正在载入音频…" : playing ? `正在播放 · ${trackTitle}` : "已暂停 · 按播放开始聆听"}</p>
      {error && <div className="music-playback-error" role="alert"><p>{error}</p><button onClick={() => { void playAudio(); }}><RotateCcw size={13} />重试播放</button>{source === "chart" && <a href={track.url} target="_blank" rel="noopener noreferrer">官方收听 <ExternalLink size={12} /></a>}</div>}
      <p className="music-cover-credit">封面来自 Photography · 海边路灯</p>
    </aside>
    <div className="music-library">
      <header><p>SOUND ARCHIVE</p><h2>留一点声音在桌上。</h2><span>选一段试听，或者让背景音慢慢循环。</span></header>
      <nav className="music-source-tabs" aria-label="音频来源"><button aria-pressed={source === "chart"} onClick={() => changeSource("chart")}>榜单试听</button><button aria-pressed={source === "ambient"} onClick={() => changeSource("ambient")}>本站背景音</button></nav>
      {source === "chart" ? <>
        <div className="music-chart-heading"><div><strong>2024 年终榜 · 前十</strong><span>Billboard Hot 100 · 固定收藏</span></div><a href={music.chart.url} target="_blank" rel="noopener noreferrer" aria-label="查看 Billboard 榜单来源"><ExternalLink size={15} /></a></div>
        <div className="music-library-tools"><label><Search size={14} /><input aria-label="搜索歌曲或歌手" value={query} onChange={event => setQuery(event.target.value)} placeholder="歌曲或歌手" /></label><button ref={focus.filterRef} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(value => !value)}><Heart size={13} />{favoritesOnly ? "全部歌曲" : `收藏 ${favoriteCount}`}</button></div>
        <div className="track-list" role="list" aria-label="试听歌曲列表">{visible.map(item => <div key={item.trackId} role="listitem" className={track.trackId === item.trackId ? "selected" : ""}><button className="track-play" aria-label={`播放 ${item.title}`} aria-current={track.trackId === item.trackId} onClick={() => choose(tracks.findIndex(entry => entry.trackId === item.trackId), true)}><span className="track-rank">{track.trackId === item.trackId && playing ? <span className="music-equalizer" aria-hidden="true"><i /><i /><i /></span> : String(item.rank).padStart(2, "0")}</span><span><strong>{item.title}{item.explicit && <small className="explicit-mark">E</small>}</strong><small>{item.artist}</small></span><Play size={12} /></button><button className="track-favorite" aria-label={`${favorites.includes(item.trackId) ? "取消收藏" : "收藏"} ${item.title}`} aria-pressed={favorites.includes(item.trackId)} onClick={event => { focus.rememberFocus(event.currentTarget); toggleFavorite(item.trackId); }}><Heart size={13} fill={favorites.includes(item.trackId) ? "currentColor" : "none"} /></button><a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`在 Apple Music 收听 ${item.title}`}><ExternalLink size={13} /></a></div>)}{!visible.length && <div className="music-empty"><Music2 size={24} /><p>{query ? "没有找到这首歌。试试歌手名。" : "还没有收藏，点歌曲旁的爱心留下它。"}</p><button ref={focus.emptyActionRef} onClick={event => { focus.rememberFocus(event.currentTarget); setFavoritesOnly(false); setQuery(""); }}>查看全部歌曲</button></div>}</div>
        <footer><p>播放的是 iTunes 提供的试听片段，并非完整歌曲。完整版本可从每首歌旁的来源链接打开。</p><span>榜单发布 {music.chart.published} · 收录 {tracks.length} 首</span></footer>
      </> : <div className="music-ambient"><div className="ambient-art"><CollectionThumbnail item={cover} slot="ambient" alt="海边路灯" /><span><Headphones size={24} /></span></div><h3>Lofi · 桌面背景音</h3><p>本站附带的一段背景音，不属于上面的榜单歌曲。无需第三方试听服务，音频载入后可以循环播放。</p><button className="ambient-play" onClick={toggle}>{playbackIcon}{pending ? "取消加载" : playing ? "暂停背景音" : "播放背景音"}</button><p className="ambient-tip">用 iPod 下方的循环开关控制重复播放。</p></div>}
      <CollectionStorageMessage saved={favoritesSaved && preferencesSaved} subject="收藏或播放设置" recovery={[favoritesRecovery, preferencesRecovery]} />
    </div>
  </section>;
}
