import type { CollectionRecovery } from "@/data/collection-preferences";

export function CollectionStorageMessage({ saved, subject = "清单", recovery = [], reloadScope = "app" }: {
  saved: boolean;
  subject?: string;
  recovery?: readonly CollectionRecovery[];
  reloadScope?: "app" | "page";
}) {
  const incompatible = recovery.filter(item => item.recoveryRaw !== null);
  const readFailed = recovery.some(item => item.readFailed);
  const conflict = recovery.some(item => item.conflict);
  const reopen = reloadScope === "page" ? "请先导出未保存的便签或记下当前选择，再刷新整个桌面读取最新内容。" : "请记下当前选择，再关闭并重新打开此应用读取最新内容。";
  if (conflict) return <p className="collection-storage-message" role="status">检测到其他窗口或标签页更改了{subject}。本窗口更改仅临时保留，未覆盖外部数据；{reopen}</p>;
  if (saved && !incompatible.length && !readFailed) return null;
  const backupComplete = incompatible.every(item => item.recoveryKey !== null);
  return <p className="collection-storage-message" role="status">
    {incompatible.length > 0 && (backupComplete ? `旧的${subject}格式无法读取，已在本机保留备份；当前从默认设置开始。` : `旧的${subject}格式无法读取，原数据尚未覆盖。`)}
    {readFailed ? `暂时无法读取这台设备中的${subject}，本次更改仅在当前窗口中保留，不会覆盖原数据。请检查存储权限。${reopen}` : !saved && `${subject}暂时只保留在本次浏览中。请检查浏览器的存储空间或权限后重试。`}
  </p>;
}
