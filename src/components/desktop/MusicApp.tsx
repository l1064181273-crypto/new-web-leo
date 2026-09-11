import { Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { media } from "@/data/media";
import music from "@/data/chart-music.json";

const timeLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const tracks = music.tracks;

export default function MusicApp() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const generation = useRef(0);
  const autoplay = useRef(false);
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(.35);
  const [menu, setMenu] = useState(false);
  const track = tracks[selected];
  const cover = media.find(item => item.id === "photo-10.jpg")!;
  const invalidatePlayback = useCallback(() => { generation.current++; }, []);
  const playAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    const version = ++generation.current;
    setError(""); setPending(true);
    try { await audio.play(); }
    catch { if (version === generation.current) setError("试听暂不可用，可前往官方页面收听。"); }
    finally { if (version === generation.current) setPending(false); }
  }, []);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    invalidatePlayback();
    audio.pause();
    audio.src = tracks[selected].previewUrl;
    audio.load();
    setPlaying(false); setCurrent(0); setDuration(0); setError(""); setPending(false);
    if (autoplay.current) { autoplay.current = false; void playAudio(); }
    return () => { invalidatePlayback(); audio.pause(); };
  }, [selected, invalidatePlayback, playAudio]);
  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);
  const choose = (index: number, shouldPlay = playing) => {
    if (index === selected) { if (shouldPlay) void playAudio(); return; }
    autoplay.current = shouldPlay;
    setSelected((index + tracks.length) % tracks.length);
  };
  const toggle = () => {
    if (playing || pending) { generation.current++; audioRef.current?.pause(); setPending(false); }
    else void playAudio();
  };
  const seek = (value: number) => {
    if (audioRef.current && duration) { audioRef.current.currentTime = Math.min(duration, Math.max(0, value)); setCurrent(audioRef.current.currentTime); }
  };
  return <div className="music-studio">
    <div className="ipod">
      <audio ref={audioRef} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => choose(selected + 1, true)} onTimeUpdate={event => setCurrent(event.currentTarget.currentTime)} onLoadedMetadata={event => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)} onError={() => { setError("试听暂不可用。"); setPlaying(false); setPending(false); }} />
      <div className="ipod-screen">
        <div className="ipod-status"><strong>Leo's iPod</strong><span>#{track.rank} ▰</span></div>
        {menu ? <div className="ipod-menu"><button onClick={() => setMenu(false)}>正在播放 <span>›</span></button><a href={track.url} target="_blank" rel="noreferrer">官方收听 <span>›</span></a><p>BILLBOARD 2024<br />10 TRACKS</p></div> : <>
          <div className="ipod-track"><img src={cover.image} alt="海边路灯" /><div><strong>{track.title}</strong><span>{track.artist}</span><small>iTunes 官方试听</small></div></div>
          <input className="ipod-seek" type="range" aria-label="播放进度" min={0} max={duration || 1} step={.1} value={current} onChange={event => seek(Number(event.target.value))} disabled={!duration} /><div className="ipod-times"><span>{timeLabel(current)}</span><span>{timeLabel(duration)}</span></div>
        </>}
      </div>
      <div className="ipod-wheel"><button className="wheel-menu" onClick={() => setMenu(!menu)}>MENU</button>
        <button className="wheel-prev" onClick={() => choose(selected - 1)} aria-label="上一首" title="上一首"><SkipBack size={17} fill="currentColor" /></button>
        <button className="wheel-next" onClick={() => choose(selected + 1)} aria-label="下一首" title="下一首"><SkipForward size={17} fill="currentColor" /></button>
        <button className="wheel-play" onClick={toggle} aria-label={playing ? "暂停音乐" : "播放音乐"} title={playing ? "暂停" : "播放"}>{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button>
        <button className="wheel-center" onClick={toggle} aria-label={playing ? "暂停" : "播放"} title={playing ? "暂停" : "播放"} />
      </div>
      <label className="ipod-volume"><Volume2 size={13} /><input type="range" aria-label="音量" min={0} max={1} step={.01} value={volume} onChange={event => setVolume(Number(event.target.value))} /></label>
      {(pending || error) && <p className="ipod-error" role="status">{pending ? "正在载入试听…" : error}</p>}
    </div>
  </div>;
}
