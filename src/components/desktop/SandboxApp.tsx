import { Download, ExternalLink, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAssetDownload } from "@/hooks/use-asset-download";
import { AssetDownloadFeedback } from "./AssetDownloadFeedback";
import "@/styles/sandbox-app.css";

export default function SandboxApp({ active }: { active: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "slow" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const src = `${import.meta.env.BASE_URL}construction-sandbox.html?v=studio-v2`;
  const download = useAssetDownload(src, "little-works-studio-v2.html", "html");
  useEffect(() => {
    const receiveStatus = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "little-works-ready") setStatus("ready");
      if (event.data?.type === "little-works-error") setStatus("error");
    };
    window.addEventListener("message", receiveStatus);
    return () => window.removeEventListener("message", receiveStatus);
  }, []);
  useEffect(() => {
    const timeout = window.setTimeout(() => setStatus(current => current === "loading" ? "slow" : current), 12000);
    return () => window.clearTimeout(timeout);
  }, [attempt]);
  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ type: "little-works-visibility", active }, window.location.origin);
  }, [active, status]);
  const retry = () => { setStatus("loading"); setAttempt(value => value + 1); };
  const onLoad = () => {
    frame.current?.contentWindow?.postMessage({ type: "little-works-visibility", active }, window.location.origin);
    frame.current?.contentWindow?.postMessage({ type: "little-works-status-request" }, window.location.origin);
  };
  return (
    <section className="sandbox-app" aria-label="Little Works 微型工地" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <iframe key={attempt} ref={frame} src={`${src}&load=${attempt}`} title="Little Works 建筑工地沙盘" onLoad={onLoad} onError={() => setStatus("error")} allow="fullscreen" />
        {status === "loading" && <div role="status" aria-live="polite" style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center", gap: 12, textAlign: "center", background: "#25323b", color: "#c4d4dc", padding: 24 }}><span style={{ color: "#d9b86d", fontSize: 27, letterSpacing: -1 }}>Little Works</span><span style={{ fontSize: 11 }}>正在摆好这座小工地…</span></div>}
        {status === "slow" && <div role="status" style={{ position: "absolute", left: 14, right: 14, top: 12, padding: "13px 16px", border: "1px solid #a5bac64d", borderRadius: 7, background: "#263840f2", color: "#cadbe2", fontSize: 11, lineHeight: 1.8 }}><span>画面载入比平时久。可以再等一会儿，或重新载入。</span><button type="button" onClick={retry} style={{ marginLeft: 12, color: "#d9b86d", background: "none", border: 0, font: "inherit", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>重新载入</button></div>}
      </div>
      <nav aria-label="沙盘文件工具" style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "7px 13px", borderTop: "1px solid #afc3cb22", background: "#22313b", color: "#9eb6c2", fontSize: 9 }}>
        <span>{status === "error" ? "画面暂时中断，可重新载入" : "把这个小世界带走"}</span>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexShrink: 0 }}>
          {status === "error" && <button type="button" onClick={retry} aria-label="重新载入沙盘" title="重新载入沙盘" style={{ display: "flex", color: "#d9b86d", border: 0, padding: 0, background: "none", cursor: "pointer" }}><RotateCcw size={13} /></button>}
          <a href={src} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, color: "inherit", textDecoration: "none" }}><ExternalLink size={12} /><span>独立打开</span></a>
          <a ref={download.linkRef} href={src} download="little-works-studio-v2.html" aria-busy={download.status === "preparing"} aria-describedby={download.status === "idle" ? undefined : download.statusId} onClick={download.onClick} style={{ display: "flex", alignItems: "center", gap: 5, color: "inherit", textDecoration: "none" }}><Download size={12} /><span>离线版</span></a>
        </div>
      </nav>
      <AssetDownloadFeedback download={download} />
    </section>
  );
}
