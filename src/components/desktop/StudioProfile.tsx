import {
  ArrowDownRight,
  ArrowUpRight,
  Camera,
  Code2,
  Headphones,
  Leaf,
  MapPin,
} from "lucide-react";
import avatar from "@/assets/optimized/avatar-3d-348h.jpg";
import sea from "@/assets/photo-10.jpg";
import type { AppId } from "./window-state";

export default function StudioProfile({ open }: { open: (id: AppId) => void }) {
  return (
    <article className="studio-profile">
      <header className="studio-profile-heading">
        <span>PERSONAL FILE / HAONAN LI</span>
        <span>
          <MapPin size={12} /> Shanghai, China
        </span>
      </header>
      <div className="studio-profile-intro">
        <div className="studio-profile-copy">
          <p className="studio-eyebrow">HELLO, MAKE YOURSELF AT HOME.</p>
          <h2>
            我是 Haonan。
            <br />
            <em>欢迎来到我的桌面。</em>
          </h2>
          <p>
            这里装着我拍下的风景、循环播放的音乐，
            <br className="desktop-only" />
            还有那些忍不住想要做出来的小想法。
          </p>
          <button className="studio-text-link" onClick={() => open("connect")}>
            交个朋友 <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="studio-profile-portrait">
          <div className="portrait-orbit" />
          <img src={avatar} alt="Haonan 的三维风格头像" />
          <span>CURIOUS BY DEFAULT.</span>
        </div>
      </div>
      <div className="studio-profile-footnote">
        <span>ABOUT ME</span>
        <p>
          在字节跳动参与 AI 数据与业务运营，智慧农业硕士研究生背景。工作之外，用
          Vibe Coding 把想法变成可以打开、触碰和游玩的小世界。
        </p>
      </div>
      <div className="studio-profile-interests">
        <button onClick={() => open("photos")}>
          <Camera size={20} />
          <strong>看见光</strong>
          <span>摄影与生活片刻</span>
          <ArrowUpRight size={14} />
        </button>
        <button onClick={() => open("music")}>
          <Headphones size={20} />
          <strong>留一首歌</strong>
          <span>桌面上的随身听</span>
          <ArrowUpRight size={14} />
        </button>
        <button onClick={() => open("cats")}>
          <Leaf size={20} />
          <strong>观察小世界</strong>
          <span>Little Works 工地沙盘</span>
          <ArrowUpRight size={14} />
        </button>
        <button onClick={() => open("projects")}>
          <Code2 size={20} />
          <strong>动手做点什么</strong>
          <span>想法、代码与创作记录</span>
          <ArrowUpRight size={14} />
        </button>
      </div>
      <div className="studio-profile-postcard">
        <img src={sea} alt="收藏中的海边路灯" loading="lazy" />
        <div>
          <span>A SMALL REMINDER</span>
          <p>
            不着急看完。
            <br />
            随便点点，待一会儿。
          </p>
          <button onClick={() => open("daily")}>
            翻开生活手记 <ArrowDownRight size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}
