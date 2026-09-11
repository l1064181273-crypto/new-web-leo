import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Bot,
  Check,
  Code2,
  Copy,
  ExternalLink,
  Github,
  Leaf,
  LineChart,
  Mail,
  MapPin,
  UserRound,
} from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import avatarImage from "@/assets/avatar-3d.png";
import wechatQr from "@/assets/wechat-qr.jpg";
import contactAppIcon from "@/assets/macos-icons/contact.png";
import githubAppIcon from "@/assets/macos-icons/github.png";
import PersonalAtlas from "@/components/PersonalAtlas";

type DesktopApp =
  | "about"
  | "ai"
  | "local"
  | "commerce"
  | "agriculture"
  | "build"
  | "music"
  | "cats"
  | "resume"
  | "life"
  | "github"
  | "source"
  | "contact";

type AppDefinition = {
  id: DesktopApp;
  label: string;
  eyebrow: string;
  x: string;
  y: string;
  href?: string;
  desktop?: boolean;
};

const apps: AppDefinition[] = [
  { id: "github", label: "GitHub", eyebrow: "EXTERNAL", x: "2%", y: "3%", href: "https://github.com/l1064181273-crypto/new-web-leo" },
  { id: "music", label: "Music", eyebrow: "SOUND ARCHIVE", x: "25%", y: "17%" },
  { id: "resume", label: "Resume", eyebrow: "CAREER", x: "47%", y: "4%" },
  { id: "build", label: "Build Log", eyebrow: "VIBE CODING", x: "75%", y: "15%" },
  { id: "local", label: "City Lens", eyebrow: "LOCAL SERVICES", x: "8%", y: "43%" },
  { id: "ai", label: "Signal Lab", eyebrow: "AI DATA OPERATIONS", x: "50%", y: "32%" },
  { id: "commerce", label: "Market Flow", eyebrow: "E COMMERCE", x: "22%", y: "63%" },
  { id: "source", label: "Source", eyebrow: "GITHUB", x: "42%", y: "70%" },
  { id: "agriculture", label: "Field Notes", eyebrow: "SMART AGRICULTURE AI", x: "68%", y: "58%" },
  { id: "cats", label: "Herding cats", eyebrow: "PLAYGROUND", x: "83%", y: "62%" },
  { id: "about", label: "Profile", eyebrow: "IDENTITY", x: "2%", y: "72%" },
  { id: "life", label: "Personal Atlas", eyebrow: "COLLECTIONS", x: "91%", y: "72%" },
  { id: "contact", label: "Connect", eyebrow: "HELLO", x: "58%", y: "76%", desktop: false },
];

const appMap = Object.fromEntries(apps.map((app) => [app.id, app])) as Record<DesktopApp, AppDefinition>;
const dockApps: DesktopApp[] = ["resume", "about", "life", "build", "contact"];

const macxfolioAssets = {
  about: "https://framerusercontent.com/images/cJYhDULgupLu6dqAItTs6sT1xE.png?width=2469&height=2469",
  music: "https://framerusercontent.com/images/YqNlwVIK7rA6jF6BGN2QuviBMXk.png?width=2478&height=2472",
  resume: "https://framerusercontent.com/images/4g2FaJC8YD1UjBtuLdnGpDvQ.png?width=2466&height=2475",
  cats: "https://framerusercontent.com/images/NBs3etFTadPxbSVNjpbB56GouU.png?width=478&height=561",
  source: "https://framerusercontent.com/images/PWuUiO2aouvctH4NNK1MNPe9o.png?width=312&height=312",
  local: "https://framerusercontent.com/images/xybTQ8M8gQkUOzQ57Horl5riXsc.png?width=736&height=547",
  commerce: "https://framerusercontent.com/images/HcRlNxppO9AMHI0KhcKJtc3wvO0.png?width=1199&height=1740",
  ai: "https://framerusercontent.com/images/oPWqkM4Rtq6IW8rAis6I2SC7CfE.png?width=1200&height=1200",
  agriculture: "https://framerusercontent.com/images/BL7zv9EGej7d1dYE5rLEhB911pI.png?width=735&height=490",
  build: "https://framerusercontent.com/images/uy87JonjAVE23J7z8J81GA0A0U.png?width=750&height=994",
  life: "https://framerusercontent.com/images/JNuFoJNZB5xor0NzSTUqoFLBk.png?width=2478&height=2502",
  dockFinder: "https://framerusercontent.com/images/EVSY45U60gTa9UjvovzPTZx7Hw.png?width=180&height=180",
  dockPhotos: "https://framerusercontent.com/images/yFESVGBo8X29XNkGZlJPVzWkQgI.png?width=180&height=180",
  dockFinalCut: "https://framerusercontent.com/images/qQXlQqG22a2tDAPOZckDUXrENk.png?width=177&height=180",
  dockMail: "https://framerusercontent.com/images/ZAH3C8amQUigspCjEG1FJWPjI.png?width=180&height=180",
} as const;

const appIconMap: Record<DesktopApp, string> = {
  about: macxfolioAssets.about,
  ai: macxfolioAssets.ai,
  local: macxfolioAssets.local,
  commerce: macxfolioAssets.commerce,
  agriculture: macxfolioAssets.agriculture,
  build: macxfolioAssets.build,
  music: macxfolioAssets.music,
  cats: macxfolioAssets.cats,
  resume: macxfolioAssets.resume,
  life: macxfolioAssets.life,
  github: githubAppIcon,
  source: macxfolioAssets.source,
  contact: contactAppIcon,
};

const dockIconMap: Partial<Record<DesktopApp, string>> = {
  resume: macxfolioAssets.resume,
  about: macxfolioAssets.dockFinder,
  life: macxfolioAssets.dockPhotos,
  build: macxfolioAssets.dockFinalCut,
  contact: macxfolioAssets.dockMail,
};

const AppArtwork = ({ id, compact = false }: { id: DesktopApp; compact?: boolean }) => {
  const source = compact && dockIconMap[id] ? dockIconMap[id] : appIconMap[id];
  return <img className="os-native-app-icon" src={source} alt="" draggable={false} data-compact={compact || undefined} />;
};

const WindowHeader = ({ eyebrow, title, icon }: { eyebrow: string; title: string; icon?: ReactNode }) => (
  <div className="os-window-heading">
    <div>
      <p>{eyebrow}</p>
      <h2>{title}</h2>
    </div>
    {icon && <span>{icon}</span>}
  </div>
);

const AboutContent = () => (
  <div className="os-about-content">
    <div className="os-about-intro">
      <div className="os-about-portrait"><img src={avatarImage} alt="Haonan Li" /></div>
      <div>
        <p className="os-content-kicker">HELLO I AM</p>
        <h2>Haonan Li</h2>
        <p className="os-about-role">AI 数据运营者和 Vibe Coding 实践者</p>
        <div className="os-availability"><i />在字节跳动参与 AI 数据运营和业务运营</div>
      </div>
    </div>

    <div className="os-about-statement">
      <p>我擅长在复杂信息里找到结构</p>
      <p>把业务问题转化成可执行的数据工作</p>
      <p>再用 AI 和代码让想法变成真实产品</p>
    </div>

    <div className="os-quick-grid">
      <div><span>现在</span><strong>ByteDance</strong><p>AI 数据运营和业务运营</p></div>
      <div><span>背景</span><strong>智慧农业硕士</strong><p>AI 数据和系统思维</p></div>
      <div><span>正在做</span><strong>Vibe Coding</strong><p>从想法到可交互作品</p></div>
    </div>
  </div>
);

const workCards = {
  ai: {
    title: "让数据标准持续学习",
    intro: "把模型需求翻译成可以执行和检查的数据规则",
    metric: "QUALITY LOOP",
    color: "violet",
    steps: [
      ["Define", "拆解需求并明确规则边界"],
      ["Review", "识别质量偏差和异常样本"],
      ["Feedback", "把问题反馈到下一轮生产"],
    ],
  },
  local: {
    title: "从指标回到真实生活场景",
    intro: "连接用户需求供给状态和城市生活语境",
    metric: "CONTEXT MAP",
    color: "blue",
    steps: [
      ["Observe", "发现指标变化和关键问题"],
      ["Context", "补齐用户商家和场景信息"],
      ["Action", "形成清晰的运营下一步"],
    ],
  },
  commerce: {
    title: "在内容商品和转化之间找连接",
    intro: "理解链路并确定真正值得推进的优先级",
    metric: "GROWTH PATH",
    color: "orange",
    steps: [
      ["Content", "识别用户正在关注的信号"],
      ["Product", "连接内容表达和商品价值"],
      ["Convert", "观察路径并持续调整策略"],
    ],
  },
  agriculture: {
    title: "保留农业和 AI 的交叉视角",
    intro: "专业起点不是职业终点但训练了我的系统思维",
    metric: "FIELD SIGNAL",
    color: "green",
    steps: [
      ["Sense", "理解传感器数据和真实环境"],
      ["Model", "关注 AI 如何理解复杂场景"],
      ["System", "把技术放回完整业务系统"],
    ],
  },
} as const;

const WorkContent = ({ id }: { id: "ai" | "local" | "commerce" | "agriculture" }) => {
  const content = workCards[id];
  const icons = {
    ai: <Bot size={22} />,
    local: <MapPin size={22} />,
    commerce: <LineChart size={22} />,
    agriculture: <Leaf size={22} />,
  };

  return (
    <div className={`os-work-content is-${content.color}`}>
      <WindowHeader eyebrow={content.metric} title={content.title} icon={icons[id]} />
      <p className="os-window-lead">{content.intro}</p>
      <div className="os-signal-strip">
        <span>INPUT</span><i /><span>CONTEXT</span><i /><span>ACTION</span>
      </div>
      <div className="os-work-steps">
        {content.steps.map(([title, copy], index) => (
          <article key={title}>
            <span>0{index + 1}</span>
            <div><strong>{title}</strong><p>{copy}</p></div>
            <Check size={15} />
          </article>
        ))}
      </div>
    </div>
  );
};

const BuildContent = () => (
  <div className="os-build-content">
    <WindowHeader eyebrow="VIBE CODING CASE 01" title="这个网站本身就是作品" icon={<Code2 size={23} />} />
    <p className="os-window-lead">我用 Codex 参与需求梳理视觉设计 React 开发浏览器测试和 Git 版本管理</p>
    <div className="os-build-layout">
      <div className="os-code-preview">
        <div><i /><i /><i /><span>leo-homepage</span></div>
        <pre><span>01</span> define the story{"\n"}<span>02</span> build the system{"\n"}<span>03</span> test the feeling{"\n"}<b>04</b> ship something real</pre>
        <p><Check size={14} />持续迭代中</p>
      </div>
      <div className="os-build-notes">
        <div><span>角色</span><strong>产品经理和开发者</strong></div>
        <div><span>技术</span><strong>React TypeScript Motion</strong></div>
        <div><span>证据</span><strong>Git 历史和本地测试</strong></div>
        <a href="https://github.com/l1064181273-crypto/new-web-leo" target="_blank" rel="noreferrer">
          查看 GitHub 仓库 <ArrowUpRight size={15} />
        </a>
      </div>
    </div>
  </div>
);

const CatContent = () => (
  <div className="os-cat-content">
    <img src="https://webneko.net/lucky/sleep1.gif" alt="像素猫" />
    <p className="os-content-kicker">PLAYGROUND</p>
    <h2>Herding cats</h2>
    <p>在数据和代码之外留一个可以放松的小角落</p>
    <span>打开桌面左下角的开关就能让它继续待在桌面上</span>
  </div>
);

type ProjectApp = "ai" | "local" | "commerce" | "agriculture" | "build" | "source";

const projectApps: ProjectApp[] = ["ai", "local", "commerce", "agriculture", "build", "source"];

const projectIconMap: Record<ProjectApp, ReactNode> = {
  ai: <Bot size={17} />,
  local: <MapPin size={17} />,
  commerce: <LineChart size={17} />,
  agriculture: <Leaf size={17} />,
  build: <Code2 size={17} />,
  source: <Github size={17} />,
};

const ProjectHub = ({ initialId, onSectionChange }: { initialId: ProjectApp; onSectionChange?: (title: string) => void }) => {
  const [selectedId, setSelectedId] = useState<ProjectApp>(initialId);
  const select = (id: ProjectApp) => {
    setSelectedId(id);
    onSectionChange?.(appMap[id].label);
  };
  const SelectedContent = selectedId === "build"
    ? BuildContent
    : selectedId === "source"
      ? GithubContent
      : () => <WorkContent id={selectedId} />;

  return (
    <div className="os-project-hub">
      <aside className="os-project-sidebar">
        <div className="os-project-sidebar-heading">
          <span>WORK</span>
          <strong>Projects</strong>
        </div>
        <nav aria-label="专业项目模块">
          {projectApps.map((id) => (
            <button
              type="button"
              key={id}
              className={selectedId === id ? "is-active" : ""}
              onClick={() => select(id)}
            >
              {projectIconMap[id]}
              <span>{appMap[id].label}</span>
            </button>
          ))}
        </nav>
        <div className="os-project-sidebar-meta">
          <span>HAONAN LI</span>
          <span>6 PROJECTS</span>
        </div>
      </aside>
      <section className="os-project-main" key={selectedId}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
        >
          <div className="os-project-breadcrumb">
            <span>User</span><i /><span>Projects</span><i /><strong>{appMap[selectedId].label}</strong>
          </div>
          <SelectedContent />
        </motion.div>
      </section>
      <nav className="project-pager" aria-label="切换项目">
        <button title="上一个项目" aria-label="上一个项目" onClick={() => select(projectApps[(projectApps.indexOf(selectedId) + projectApps.length - 1) % projectApps.length])}><ChevronLeft size={24} /></button>
        <button title="下一个项目" aria-label="下一个项目" onClick={() => select(projectApps[(projectApps.indexOf(selectedId) + 1) % projectApps.length])}><ChevronRight size={24} /></button>
      </nav>
    </div>
  );
};

const ResumeContent = () => (
  <div className="os-resume-content">
    <WindowHeader eyebrow="RESUME 2026" title="经历和背景" icon={<UserRound size={22} />} />
    <div className="os-resume-layout">
      <aside>
        <div><span>定位</span><strong>AI 数据运营</strong><p>业务运营</p></div>
        <div><span>能力</span><strong>结构化思考</strong><p>跨领域学习</p></div>
        <div><span>工具</span><strong>AI 和 Codex</strong><p>React 和 Git</p></div>
      </aside>
      <section>
        <article>
          <div><span>NOW</span><small>ByteDance</small></div>
          <h3>AI 数据运营和业务运营</h3>
          <p>参与 AI 数据运营 本地生活数据运营和电商运营</p>
        </article>
        <article>
          <div><span>EDU</span><small>Masters Degree</small></div>
          <h3>智慧农业硕士研究生</h3>
          <p>关注智慧农业 AI 数据和真实场景之间的联系</p>
        </article>
      </section>
    </div>
  </div>
);

const GithubContent = () => (
  <div className="os-link-content">
    <Github size={44} strokeWidth={1.35} />
    <p className="os-content-kicker">SOURCE AND HISTORY</p>
    <h2>每一次改版都有记录</h2>
    <p>你可以在 GitHub 看到这个网站如何从想法一步步变成现在的样子</p>
    <a href="https://github.com/l1064181273-crypto/new-web-leo" target="_blank" rel="noreferrer">
      打开 GitHub <ExternalLink size={15} />
    </a>
  </div>
);

const ContactContent = () => {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const copyReset = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (copyReset.current !== null)
        window.clearTimeout(copyReset.current);
    },
    [],
  );

  const copyWechat = async () => {
    setCopyError("");
    if (copyReset.current !== null)
      window.clearTimeout(copyReset.current);
    try {
      await navigator.clipboard.writeText("Lntano.");
      setCopied(true);
      copyReset.current = window.setTimeout(() => {
        setCopied(false);
        copyReset.current = null;
      }, 1800);
    } catch {
      setCopied(false);
      setCopyError("复制失败，请手动选取微信号。");
    }
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {showDetails ? (
        <motion.div
          key="contact-details"
          className="os-contact-details"
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 18 }}
          transition={{ duration: 0.22 }}
        >
          <div className="os-contact-detail-head">
            <button type="button" onClick={() => setShowDetails(false)}>
              <ArrowLeft size={15} />
              返回介绍
            </button>
            <span>CONTACT CARD</span>
          </div>

          <div className="os-contact-detail-grid">
            <article className="os-contact-profile-card">
              <div className="os-contact-avatar">
                <img src={avatarImage} alt="Haonan Li" />
                <i aria-hidden="true" />
              </div>
              <p>HAONAN LI</p>
              <h2>认真认识新的人</h2>
              <span>AI Data Operator</span>
              <span>Vibe Builder</span>
              <div className="os-contact-tags">
                <small>AI 数据业务</small>
                <small>本地生活</small>
                <small>电商运营</small>
                <small>Vibe Coding</small>
              </div>
            </article>

            <article className="os-contact-channel-card">
              <div className="os-contact-channel-title">
                <div><Mail size={18} /><span>WECHAT</span></div>
                <span>PRIMARY</span>
              </div>
              <div className="os-contact-qr-row">
                <div className="os-contact-qr">
                  <img src={wechatQr} alt="Haonan Li 的微信二维码" />
                </div>
                <div className="os-contact-wechat-copy">
                  <span>微信号</span>
                  <strong>Lntano.</strong>
                  <button type="button" onClick={copyWechat} aria-live="polite">
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                    {copied ? "已复制" : "复制微信号"}
                  </button>
                  <p role="status">{copyError}</p>
                </div>
              </div>
              <a href="https://github.com/l1064181273-crypto" target="_blank" rel="noreferrer">
                <div>
                  <Github size={18} />
                  <span>查看 GitHub 构建记录</span>
                </div>
                <ArrowUpRight size={16} />
              </a>
            </article>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="contact-intro"
          className="os-link-content is-contact"
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -18 }}
          transition={{ duration: 0.22 }}
        >
          <Mail size={44} strokeWidth={1.35} />
          <p className="os-content-kicker">LET US CONNECT</p>
          <h2>从一次真实的交流开始</h2>
          <p>如果你也关注 AI 数据业务和产品创造欢迎认识我</p>
          <button className="os-contact-open" type="button" onClick={() => setShowDetails(true)}>
            查看联系方式 <ArrowUpRight size={15} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const contentByApp: Record<DesktopApp, () => JSX.Element> = {
  about: AboutContent,
  ai: () => <ProjectHub initialId="ai" />,
  local: () => <ProjectHub initialId="local" />,
  commerce: () => <ProjectHub initialId="commerce" />,
  agriculture: () => <ProjectHub initialId="agriculture" />,
  build: () => <ProjectHub initialId="build" />,
  music: () => <PersonalAtlas initialCollectionId="sound" />,
  cats: CatContent,
  resume: ResumeContent,
  life: () => <PersonalAtlas />,
  github: GithubContent,
  source: () => <ProjectHub initialId="source" />,
  contact: ContactContent,
};

const PortfolioDesk = () => {
  const [activeApp, setActiveApp] = useState<DesktopApp | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showCat, setShowCat] = useState(true);
  const [time, setTime] = useState(() => new Date());
  const [canDrag, setCanDrag] = useState(false);
  const desktopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bootTimer = window.setTimeout(() => setIsBooting(false), 1450);
    const timer = window.setInterval(() => setTime(new Date()), 60_000);
    const media = window.matchMedia("(min-width: 721px)");
    const syncDrag = () => setCanDrag(media.matches);
    syncDrag();
    media.addEventListener("change", syncDrag);
    return () => {
      window.clearTimeout(bootTimer);
      window.clearInterval(timer);
      media.removeEventListener("change", syncDrag);
    };
  }, []);

  const formattedTime = useMemo(() => new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(time), [time]);

  const openApp = (id: DesktopApp) => {
    setActiveApp(id);
    setIsMinimized(false);
    setIsMaximized(false);
  };

  const closeApp = () => {
    setActiveApp(null);
    setIsMinimized(false);
    setIsMaximized(false);
  };

  const ActiveContent = activeApp ? contentByApp[activeApp] : null;
  const activeDefinition = activeApp ? appMap[activeApp] : null;
  const isAtlasApp = activeApp === "life" || activeApp === "music";
  const isProjectApp = activeApp ? projectApps.includes(activeApp as ProjectApp) : false;

  return (
    <section className="os-desktop" ref={desktopRef} aria-label="Haonan OS 可交互作品集桌面">
      <div className="os-wallpaper" aria-hidden="true">
        <div className="os-field os-field-one" />
        <div className="os-field os-field-two" />
        <div className="os-field os-field-three" />
        <div className="os-contours" />
        <div className="os-signal-node"><i /><i /><i /><span>DATA SIGNAL</span></div>
      </div>

      <AnimatePresence>
        {isBooting && (
          <motion.div
            className="os-boot-screen"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            aria-label="正在进入 Haonan Li 的个人桌面"
          >
            <motion.span
              initial={{ opacity: 0, y: 8, filter: "blur(5px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.65, delay: 0.18 }}
            >
              hello
            </motion.span>
            <motion.i
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.8, delay: 0.36, ease: [0.22, 1, 0.36, 1] }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <header className="os-menubar">
        <div className="os-menu-profile">
          <strong>Haonan Li</strong>
          <span>{activeDefinition?.label ?? "Portfolio"}</span>
        </div>
        <div className="os-menu-status">
          <a href="https://github.com/l1064181273-crypto" target="_blank" rel="noreferrer" aria-label="打开 GitHub"><Github size={14} /></a>
          <time>{formattedTime}</time>
        </div>
      </header>

      <div className="os-desktop-apps" aria-label="桌面应用">
        {apps.filter((app) => app.desktop !== false).map((app, index) => {
          const visual = (
            <>
              <span className="os-app-art"><AppArtwork id={app.id} /></span>
              <span className="os-app-label">{app.label}</span>
            </>
          );
          const sharedMotion = {
            className: `os-desktop-app app-${app.id}`,
            style: { "--app-x": app.x, "--app-y": app.y } as CSSProperties,
            initial: { opacity: 0, scale: 0.9, y: 10 },
            animate: { opacity: 1, scale: 1, y: 0 },
            transition: { duration: 0.42, delay: 0.08 + index * 0.035, ease: [0.22, 1, 0.36, 1] as const },
            whileHover: { y: -4 },
            whileTap: { scale: 0.95 },
          };

          return app.href ? (
            <motion.a
              {...sharedMotion}
              key={app.id}
              href={app.href}
              target="_blank"
              rel="noreferrer"
              aria-label={`打开 ${app.label}`}
            >
              {visual}
            </motion.a>
          ) : (
            <motion.button
              {...sharedMotion}
              type="button"
              key={app.id}
              onClick={() => openApp(app.id)}
              aria-label={`打开 ${app.label}`}
            >
              {visual}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {activeApp && !isMinimized && ActiveContent && activeDefinition && (
          <motion.article
            className={`os-window ${isAtlasApp ? "is-atlas-window" : ""} ${isProjectApp ? "is-project-window" : ""} ${isMaximized ? "is-maximized" : ""}`}
            key={activeApp}
            initial={{ opacity: 0, scale: 0.93, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 24 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            drag={canDrag && !isMaximized}
            dragConstraints={desktopRef}
            dragMomentum={false}
            aria-label={`${activeDefinition.label} 窗口`}
          >
            <div className="os-window-titlebar">
              <div className="os-traffic-lights">
                <button type="button" className="is-close" onClick={closeApp} aria-label="关闭窗口" />
                <button type="button" className="is-minimize" onClick={() => setIsMinimized(true)} aria-label="最小化窗口" />
                <button type="button" className="is-maximize" onClick={() => setIsMaximized((value) => !value)} aria-label="最大化窗口" />
              </div>
              <span>{activeDefinition.label}</span>
              <span>{activeDefinition.eyebrow}</span>
            </div>
            <div className={`os-window-body ${isAtlasApp ? "is-atlas" : ""} ${isProjectApp ? "is-project" : ""}`}><ActiveContent /></div>
          </motion.article>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isMinimized && activeDefinition && (
          <motion.button
            className="os-minimized-app"
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={() => setIsMinimized(false)}
          >
            <span className="os-minimized-art"><AppArtwork id={activeDefinition.id} compact /></span>
            <span>{activeDefinition.label}</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCat && (
          <motion.img
            className="os-neko"
            src="https://webneko.net/lucky/sleep1.gif"
            alt="像素猫"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          />
        )}
      </AnimatePresence>

      <button
        className="os-cat-toggle"
        type="button"
        role="switch"
        aria-checked={showCat}
        onClick={() => setShowCat((value) => !value)}
      >
        <span>You like cats</span>
        <i data-active={showCat || undefined}><b /></i>
      </button>

      <nav className="os-dock" aria-label="应用程序坞">
        {dockApps.map((id) => {
          const app = appMap[id];
          const isOpen = activeApp === id;
          return (
            <button type="button" key={id} onClick={() => openApp(id)} aria-label={`打开 ${app.label}`}>
              <span className={`os-dock-art app-${id}`}><AppArtwork id={id} compact /></span>
              <small>{app.label}</small>
              {isOpen && <i />}
            </button>
          );
        })}
      </nav>
    </section>
  );
};

export default PortfolioDesk;
export { AboutContent, ResumeContent, ProjectHub, ContactContent, GithubContent };
