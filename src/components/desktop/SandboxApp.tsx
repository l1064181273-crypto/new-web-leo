import { Download, ExternalLink } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function SandboxApp({ active }: { active: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const src = `${import.meta.env.BASE_URL}construction-sandbox.html`;
  useEffect(() => { frame.current?.contentWindow?.postMessage({ type: "little-works-visibility", active }, window.location.origin); }, [active, loaded]);
  return <section className="sandbox-app" aria-label="建筑工地沙盘应用"><iframe ref={frame} src={src} title="Little Works 建筑工地沙盘" onLoad={() => setLoaded(true)} allow="fullscreen" /><nav className="sandbox-file-tools"><a href={src} target="_blank" rel="noreferrer" title="独立打开沙盘" aria-label="独立打开沙盘"><ExternalLink size={15} /></a><a href={src} download="little-works-sandbox.html" title="下载离线 HTML" aria-label="下载离线沙盘"><Download size={15} /></a></nav></section>;
}
