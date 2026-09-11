import { FolderSearch, Home } from "lucide-react";
import { Link } from "react-router-dom";
import "@/styles/desktop.css";

export default function DesktopNotFound() {
  return <main className="desktop-not-found" style={{ backgroundImage: `url("${import.meta.env.BASE_URL}desktop/wallpaper.jpg")` }}><section><FolderSearch size={48} /><h1>找不到这个页面</h1><p>404 · 这个地址不在 Leo 的桌面里。</p><Link className="primary-button" to="/"><Home size={16} />返回桌面</Link></section></main>;
}
