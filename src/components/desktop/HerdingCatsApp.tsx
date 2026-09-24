import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Cat, ExternalLink, Globe2, LoaderCircle, RefreshCw, WifiOff } from "lucide-react";
import CatCourtyard from "@/components/cat-game/CatCourtyard";
import "@/styles/herding-cats.css";

const GAME_URL = "https://herding-cats-ten.vercel.app/";

function OriginalHerdingCats({ active }: { active: boolean }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "connected" | "slow" | "error" | "paused">("idle");

  const retry = () => {
    restoreFocus.current = true;
    setAttempt((value) => value + 1);
    if (!navigator.onLine) { setStatus("error"); setLoad(false); return; }
    setStatus("loading");
    setLoad(true);
  };

  useEffect(() => {
    if (!active && load) { restoreFocus.current = true; setLoad(false); setStatus("paused"); }
  }, [active, load]);

  useEffect(() => {
    if (!active || !restoreFocus.current) return;
    const target = load ? frameRef.current : retryRef.current;
    if (target) { target.focus({ preventScroll: true }); restoreFocus.current = false; }
  }, [active, load, attempt]);

  useEffect(() => {
    if (!load || status !== "loading") return;
    const timeout = window.setTimeout(() => setStatus((current) => current === "loading" ? "slow" : current), 15000);
    return () => window.clearTimeout(timeout);
  }, [load, attempt, status]);

  useEffect(() => {
    if (!load || !active) return;
    const frame = frameRef.current;
    const stop = (reason: "error" | "paused") => {
      restoreFocus.current = document.activeElement === frame || document.activeElement === document.body;
      setStatus(reason);
      setLoad(false);
    };
    const onError = () => stop("error");
    const onVisibility = () => { if (document.hidden) stop("paused"); };
    frame?.addEventListener("error", onError);
    window.addEventListener("offline", onError);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      frame?.removeEventListener("error", onError);
      window.removeEventListener("offline", onError);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load, active, attempt]);

  return (
    <section className="cat-original" aria-label="原版 Herding Cats">
      <div className="cat-original-intro"><div><span className="cat-eyebrow">THE ORIGINAL GAME</span><h2>Herding Cats</h2><p>保留原来的 Unity 游戏，想念那群猫时，仍然可以回来玩。</p></div><a className="cat-original-source" href={GAME_URL} target="_blank" rel="noopener noreferrer">打开源站<ArrowUpRight size={15} /></a></div>
      <div className="cat-original-notice"><Globe2 size={17} /><p>原版由外部站点提供，需要联网。首次加载可能较久；存档与操作以原版为准。切换 APP 或浏览器标签后会卸载外部页面，返回时需要重新载入。</p></div>
      <div className="cat-original-frame-wrap">
        {load && active ? <>
          <iframe ref={frameRef} key={attempt} src={GAME_URL} title="原版 Herding Cats Unity 游戏" allow="autoplay; fullscreen; gamepad" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onLoad={() => setStatus("connected")} />
          {(status === "loading" || status === "slow") && <div className="cat-original-loading"><LoaderCircle size={19} className="cat-spinner" /><span>{status === "slow" ? "连接比预期久。可以再等等，或在源站打开。" : "正在连接原版游戏…"}</span><a href={GAME_URL} target="_blank" rel="noopener noreferrer">打开源站<ExternalLink size={13} /></a></div>}
        </> : <div className="cat-original-placeholder">
          {status === "error" ? <WifiOff size={34} /> : <Cat size={38} />}
          <h3>{status === "paused" ? "原版已停止运行" : status === "error" ? "还没有连接上原版" : "另一群猫，在这扇窗后。"}</h3>
          <p>{status === "paused" ? "离开游戏或切换浏览器标签时，已卸载外部页面。重新载入可能重新开始，是否保留进度由原版决定。" : status === "error" ? "检查网络后重试，或直接打开原版网站。" : "点击后连接外部 Unity 游戏。这里新增的本地庭院与原版是两款独立游戏。"}</p>
          <button type="button" className="cat-button is-primary" ref={retryRef} onClick={retry} disabled={!active}>{attempt ? <RefreshCw size={16} /> : <Globe2 size={16} />}{attempt ? "重新载入原版" : "载入原版游戏"}</button>
          <a className="cat-text-button" href={GAME_URL} target="_blank" rel="noopener noreferrer">在新标签页打开<ArrowUpRight size={14} /></a>
        </div>}
      </div>
      <div className="cat-original-footer"><span role="status" aria-live="polite" aria-atomic="true">{status === "connected" ? "已连接外部页面；Unity 启动状态请看游戏画面。" : status === "error" ? "原版连接中断，请检查网络后重试。" : status === "paused" ? "外部游戏已卸载，重新载入前不会继续运行。" : status === "loading" ? "连接原版中，请稍候。" : status === "slow" ? "外部页面尚未响应，可以重试或打开源站。" : "本地庭院不依赖这个外部站点。"}</span>{load && <button type="button" onClick={retry}><RefreshCw size={13} />重新载入</button>}</div>
    </section>
  );
}

export default function HerdingCatsApp({ active }: { active: boolean }) {
  const [tab, setTab] = useState<"courtyard" | "original">("courtyard");
  return <section className="herding-cats" aria-label="猫咪游戏室">
    <nav className="cat-studio-tabs" aria-label="选择猫咪游戏"><button type="button" className={tab === "courtyard" ? "is-selected" : ""} aria-pressed={tab === "courtyard"} onClick={() => setTab("courtyard")}><Cat size={16} />牧猫庭院<span>本地原创</span></button><button type="button" className={tab === "original" ? "is-selected" : ""} aria-pressed={tab === "original"} onClick={() => setTab("original")}><Globe2 size={15} />原版 Herding Cats<ArrowUpRight size={13} /></button></nav>
    <div className="cat-studio-view" style={{ display: tab === "courtyard" ? "block" : "none" }}><CatCourtyard active={active && tab === "courtyard"} /></div>
    <div className="cat-studio-view" style={{ display: tab === "original" ? "block" : "none" }}><OriginalHerdingCats active={active && tab === "original"} /></div>
  </section>;
}
