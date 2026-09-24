import { useCallback, useId, useLayoutEffect, useRef, useState, type MouseEvent } from "react";

type DownloadStatus = "idle" | "preparing" | "started" | "error" | "cancelled";
type AssetKind = "image" | "html";

function startBlobDownload(blob: Blob, filename: string) {
  let url: string | null = null;
  let anchor: HTMLAnchorElement | null = null;
  let timer: number | undefined;
  let started = false;
  const release = () => {
    if (!url) return;
    const value = url;
    url = null;
    try { URL.revokeObjectURL(value); } catch { /* The document may already be closing. */ }
  };
  try {
    url = URL.createObjectURL(blob);
    // A click only initiates a browser-owned download. Retain its URL even if
    // the app closes: immediate revocation can prevent delayed startup.
    timer = window.setTimeout(release, 60_000);
    anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
    started = true;
  } finally {
    try { anchor?.remove(); } catch { /* Do not hide the original download error. */ }
    if (!started) {
      window.clearTimeout(timer);
      release();
    }
  }
}

export function useAssetDownload(href: string | undefined, filename: string | undefined, kind: AssetKind = "image") {
  const key = `${kind}\0${href ?? ""}\0${filename ?? ""}`;
  const [state, setState] = useState<{ key: string; status: DownloadStatus }>({ key, status: "idle" });
  const pending = useRef<AbortController | null>(null);
  const linkRef = useRef<HTMLAnchorElement | null>(null);
  const statusId = useId();
  const abortPending = useCallback(() => {
    const controller = pending.current;
    pending.current = null;
    controller?.abort();
  }, []);

  // Invalidate synchronously when another asset is committed or the view
  // closes, including responses whose blob reader ignores AbortSignal.
  useLayoutEffect(() => {
    setState(previous => previous.key === key && previous.status === "idle" ? previous : { key, status: "idle" });
    return abortPending;
  }, [key, abortPending]);

  const cancel = () => {
    if (!pending.current) return;
    abortPending();
    setState({ key, status: "cancelled" });
  };
  const onClick = async (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.currentTarget.target && event.currentTarget.target !== "_self") return;
    if (!href || !filename) return;
    let source: URL;
    try { source = new URL(href, window.location.href); }
    catch { event.preventDefault(); setState({ key, status: "error" }); return; }
    // Originals are same-origin static files. Other URLs, new-tab requests,
    // and modified clicks keep the browser's native link action.
    if (source.origin !== window.location.origin || !["http:", "https:"].includes(source.protocol)) return;
    event.preventDefault();
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    const current = () => pending.current === controller && !controller.signal.aborted;
    setState({ key, status: "preparing" });
    try {
      const response = await fetch(source.href, { signal: controller.signal, mode: "same-origin", credentials: "same-origin", redirect: "error" });
      if (!current()) return;
      if (!response.ok) throw new Error("Asset request failed");
      const blob = await response.blob();
      if (!current()) return;
      const mime = blob.type.split(";")[0].trim().toLowerCase();
      const expected = kind === "image" ? mime.startsWith("image/") : mime === "text/html";
      if (!blob.size || (mime && mime !== "application/octet-stream" && !expected)) throw new Error("Unexpected asset response");
      // Preserve the response bytes and metadata: no canvas, transcoding,
      // thumbnail substitution, HTML rewriting, or filename normalization.
      startBlobDownload(blob, filename);
      if (current()) setState({ key, status: "started" });
    } catch {
      if (current()) setState({ key, status: "error" });
    } finally {
      if (pending.current === controller) pending.current = null;
      // Close unread error bodies without touching a newer request or Blob URLs.
      controller.abort();
    }
  };

  return { href, kind, linkRef, statusId, status: state.key === key ? state.status : "idle" as const, onClick, cancel };
}
