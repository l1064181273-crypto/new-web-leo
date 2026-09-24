import type { useAssetDownload } from "@/hooks/use-asset-download";
import { useLayoutEffect, useRef } from "react";
import "@/styles/asset-download.css";

export function AssetDownloadFeedback({ download }: { download: ReturnType<typeof useAssetDownload> }) {
  const focusedCancel = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(() => {
    // Only recover focus lost with our own disappearing cancel control.
    const previous = focusedCancel.current;
    if (previous && !previous.isConnected && document.activeElement === document.body) download.linkRef.current?.focus();
    focusedCancel.current = null;
  }, [download.status, download.linkRef]);
  if (download.status === "idle") return null;
  const asset = download.kind === "image" ? "原图" : "离线版";
  const messages = {
    preparing: `正在准备${asset}下载…`,
    started: `已发起下载，请查看浏览器下载记录；若未出现，可打开${asset}保存。`,
    error: `下载未能发起。请重试，或打开${asset}后保存。`,
    cancelled: "已取消下载准备。",
  };
  return <div className="asset-download-feedback" data-status={download.status}>
    <p id={download.statusId} role={download.status === "error" ? "alert" : "status"}>{messages[download.status]}</p>
    <div className="asset-download-actions">
      {download.status === "preparing" && <button type="button" onFocus={event => { focusedCancel.current = event.currentTarget; }} onBlur={event => { if (event.currentTarget.isConnected) focusedCancel.current = null; }} onClick={download.cancel}>取消准备</button>}
      <a href={download.href} target="_blank" rel="noopener noreferrer">打开{asset}</a>
    </div>
  </div>;
}
