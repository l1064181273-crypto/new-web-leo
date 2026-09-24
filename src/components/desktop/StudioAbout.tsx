import {
  ArrowUpRight,
  Check,
  Copy,
  ExternalLink,
  Github,
  MessageCircle,
  Download,
  BookOpen,
  Code2,
  Leaf,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import avatar from "@/assets/optimized/avatar-3d-348h.jpg";
import qr from "@/assets/wechat-qr.jpg";
import type { AppId } from "./window-state";

const repoUrl = "https://github.com/l1064181273-crypto/new-web-leo";

export function BiographyApp({ open }: { open: (id: AppId) => void }) {
  return (
    <article className="studio-biography">
      <header>
        <p className="studio-eyebrow">A LITTLE BACKGROUND</p>
        <h2>桌面之外的我。</h2>
        <p>一些经历，也是一份仍在更新的个人说明。</p>
      </header>
      <div className="biography-line">
        <span>
          <BookOpen size={19} />
        </span>
        <div>
          <small>现在 / OPERATIONS</small>
          <h3>AI 数据与业务运营</h3>
          <p>
            在字节跳动参与 AI
            数据运营、本地生活数据运营和电商运营。关心数据背后的具体场景，也关心规则怎样被真正执行。
          </p>
        </div>
      </div>
      <div className="biography-line">
        <span>
          <Leaf size={19} />
        </span>
        <div>
          <small>专业背景 / SMART AGRICULTURE</small>
          <h3>智慧农业硕士研究生</h3>
          <p>
            从农业出发，学习把数据、环境和人的行动放在同一个系统里理解。这份观察视角，也延伸到桌面中的微型沙盘。
          </p>
        </div>
      </div>
      <div className="biography-line">
        <span>
          <Code2 size={19} />
        </span>
        <div>
          <small>创作 / VIBE CODING</small>
          <h3>从一个想法，到一个可以玩的版本</h3>
          <p>
            用 AI
            协助写代码，用自己的判断决定它应该长什么样、如何被使用。这个网站就是持续尝试的现场。
          </p>
          <button className="studio-text-link" onClick={() => open("projects")}>
            看看创作工作台 <ArrowUpRight size={15} />
          </button>
        </div>
      </div>
      <footer>
        <span>个人介绍，不是完整履历。</span>
        <button onClick={() => open("connect")}>
          继续聊聊 <ArrowUpRight size={15} />
        </button>
      </footer>
    </article>
  );
}

export function StudioContact() {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async () => {
    window.clearTimeout(timer.current);
    setCopied(false);
    setError("");
    try {
      await navigator.clipboard.writeText("Lntano.");
      setCopied(true);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("未能自动复制，请选中下方微信号手动复制。");
    }
  };
  return (
    <section className="studio-contact">
      <header>
        <span className="studio-eyebrow">SAY HELLO</span>
        <h2>从一句“你好”开始。</h2>
        <p>聊聊 AI、分享一首歌，或者告诉我你在这个桌面发现了什么。</p>
      </header>
      <div className="studio-contact-card">
        <div className="contact-identity">
          <img src={avatar} alt="Haonan 的头像" />
          <strong>Haonan Li</strong>
          <span>Shanghai, China</span>
          <div>
            <MessageCircle size={16} />
            <p>
              认识新的人，
              <br />
              听见不同的故事。
            </p>
          </div>
        </div>
        <div className="contact-wechat">
          <span>WECHAT / 微信</span>
          <img src={qr} alt="Haonan 的微信二维码" />
          <strong className="selectable">Lntano.</strong>
          <button onClick={copy}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "已复制微信号" : "复制微信号"}
          </button>
          <p role="status">
            {error ||
              (copied
                ? "可以粘贴到微信里搜索了。"
                : "也可以用微信扫描二维码。")}
          </p>
        </div>
      </div>
      <div className="contact-secondary">
        <a
          href="https://github.com/l1064181273-crypto"
          target="_blank"
          rel="noreferrer"
        >
          <Github size={18} />
          <span>
            GitHub <small>看看正在做的东西</small>
          </span>
          <ArrowUpRight size={18} />
        </a>
        <a href={qr} download="Haonan-WeChat.jpg">
          <Download size={18} />
          <span>
            保存二维码 <small>留给下一次交流</small>
          </span>
          <ArrowUpRight size={18} />
        </a>
      </div>
      <footer>没有留言服务器。这里的联系方式直接通向我。</footer>
    </section>
  );
}

export function StudioSource() {
  return (
    <article className="studio-source">
      <div className="source-mark">
        <Github size={38} strokeWidth={1.4} />
      </div>
      <p className="studio-eyebrow">OPEN THE HOOD</p>
      <h2>把好奇心写进代码。</h2>
      <p>
        这个桌面基于 React 与 TypeScript，沿着 Macxfolio 的桌面隐喻继续生长。AI
        参与实现，设计取舍和每一次试用反馈决定下一步。
      </p>
      <a
        className="studio-primary-link"
        href={repoUrl}
        target="_blank"
        rel="noreferrer"
      >
        查看 GitHub 源码 <ExternalLink size={16} />
      </a>
      <div className="source-detail-grid">
        <div>
          <span>界面</span>
          <strong>React · TypeScript</strong>
          <p>应用、窗口与浏览器本地状态</p>
        </div>
        <div>
          <span>小世界</span>
          <strong>Three.js · SVG</strong>
          <p>代码生成工地与像素庭院</p>
        </div>
        <div>
          <span>创作方式</span>
          <strong>Vibe Coding</strong>
          <p>想法 → 实现 → 试用 → 修订</p>
        </div>
      </div>
      <div className="source-credit">
        <h3>灵感与来源</h3>
        <p>
          桌面视觉参考{" "}
          <a
            href="https://macxfolio.framer.website/"
            target="_blank"
            rel="noreferrer"
          >
            Macxfolio
          </a>
          。摄影与生活素材沿用原站收藏；音乐包含标明来源的官方试听与原站附带的背景音片段。原版
          Herding Cats 沿用原站的外部游戏入口，本地牧猫庭院是独立实现。
        </p>
        <p>
          GitHub 链接打开源码仓库与更新记录，不是网站预览地址。
          此桌面的内容会继续迭代，具体版本以仓库记录为准。
        </p>
      </div>
    </article>
  );
}
