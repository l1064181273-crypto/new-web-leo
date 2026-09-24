import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  ChevronRight,
  Code2,
  Construction,
  Gamepad2,
  Github,
  Leaf,
  MapPin,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { AppId } from "./window-state";
import { StudioSource } from "./StudioAbout";
import { PixelCat } from "../cat-game/PixelCat";

type Page =
  | "desk"
  | "build"
  | "signals"
  | "city"
  | "market"
  | "field"
  | "source";
const pages = [
  { id: "desk", title: "小作品", en: "WORKSHOP", icon: Sparkles },
  { id: "build", title: "创作手记", en: "BUILD LOG", icon: Code2 },
  { id: "signals", title: "Signal Lab", en: "DATA & CONTEXT", icon: Bot },
  { id: "city", title: "City Lens", en: "EVERYDAY SYSTEMS", icon: MapPin },
  {
    id: "market",
    title: "Market Flow",
    en: "PEOPLE & THINGS",
    icon: ShoppingBag,
  },
  { id: "field", title: "Field Notes", en: "NATURE & SYSTEMS", icon: Leaf },
  { id: "source", title: "源码与来源", en: "SOURCE", icon: Github },
] as const;

const perspectives = {
  signals: {
    title: "信息里，藏着不同的视角。",
    intro:
      "同一句话放进不同的语境，会显出不同的含义。这个小练习，来自我对数据和语言的兴趣。",
    label: "语言小实验",
    note: "以下为手工编写的示例，不调用模型，也不代表真实用户数据。",
    questions: [
      [
        "它说了什么？",
        "先保留原话",
        "“这家店值得再来一次。”它表达了一次正向体验，但没有告诉我们是口味、价格还是服务。给内容贴标签之前，先保留上下文。",
      ],
      [
        "我们知道多少？",
        "把事实和推测分开",
        "“外卖终于到了。”只看这六个字，既可能是开心，也可能是等了很久。标记不确定性，比补出一个确定答案更诚实。",
      ],
      [
        "下一步看哪里？",
        "回到边界样本",
        "当两个人给同一句话不同判断，分歧就是线索。把争议留下来，往往能找到规则真正需要被解释的地方。",
      ],
    ],
  },
  city: {
    title: "城市，值得慢一点看。",
    intro:
      "地图里的一个点，也可以是一顿饭、一段步行，或一个让人愿意停留的地方。",
    label: "三个观察角度",
    note: "这些是观察提示。你也可以在自己的便签中记下城市片段。",
    questions: [
      [
        "从人的视角",
        "一条路线为什么被选择？",
        "距离只是其中一个答案。阴凉、红绿灯、路边的店、是否好走，都在悄悄改变人的路线。把注意力从地图移回街道。",
      ],
      [
        "从时间的视角",
        "同一个地方，会有几种节奏？",
        "早晨的早餐铺、午后的街角、夜里的烧烤摊，让城市在不同时间显出不同的形状。记录时间，才能理解场景。",
      ],
      [
        "从供需的视角",
        "一个选择怎样发生？",
        "看见一家店、决定进去、点一份食物、愿意再来，每个动作都有自己的原因。日常的小决定，也是一条完整的体验路径。",
      ],
    ],
  },
  market: {
    title: "人与东西，怎样发生连接？",
    intro:
      "我对电商的兴趣，也来自一个朴素的问题：一个东西怎样被看见、被理解，最后被选择。",
    label: "体验拆解",
    note: "这里展示观察方法，不展示未公开的业务数据或效果数字。",
    questions: [
      [
        "被看见",
        "第一眼传递了什么？",
        "图片、标题和场景决定最初的印象。好看的内容还需要说清楚：它是什么，适合谁，为什么值得多看一眼。",
      ],
      [
        "被理解",
        "信息足够做决定吗？",
        "尺寸、使用方式、限制条件和真实细节，能把期待变得具体。好的说明不只讲优点，也减少不必要的猜测。",
      ],
      [
        "被记住",
        "体验结束以后呢？",
        "打开包裹、第一次使用、遇到问题时的反馈，是内容之外的另一半体验。回头看整条路径，才能理解一次选择。",
      ],
    ],
  },
  field: {
    title: "把技术放回真实的环境。",
    intro:
      "智慧农业的学习背景，让我习惯同时看数据、环境和过程。桌面沙盘则是把这种兴趣变成可观察的小世界。",
    label: "从专业到小世界",
    note: "Little Works 是程序生成的视觉模拟，不是工程设计或生产调度系统。",
    questions: [
      [
        "观察",
        "一个数字背后有什么？",
        "同样的传感器读数，在不同时间、地点和环境里可能意味着不同的事情。数据需要被放回它发生的地方。",
      ],
      [
        "连接",
        "变化会传到哪里？",
        "天气变化影响行动，行动改变环境，环境又产生新的数据。我喜欢这样的反馈关系，也尝试在沙盘里让它们被看见。",
      ],
      [
        "表达",
        "怎样让过程被理解？",
        "把复杂系统缩成一块桌面模型：看见车辆进出、工人停靠、楼层逐渐形成。可视化最有趣的地方，是让抽象的过程有了形状。",
      ],
    ],
  },
};

function Perspective({
  id,
  open,
}: {
  id: keyof typeof perspectives;
  open: (id: AppId) => void;
}) {
  const [selected, setSelected] = useState(0);
  const instanceId = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const content = perspectives[id];
  const panelId = id + "-" + instanceId + "-panel";
  const tabId = (index: number) => id + "-" + instanceId + "-tab-" + index;

  const selectTab = (index: number) => {
    setSelected(index);
    tabs.current[index]?.focus({ preventScroll: true });
  };

  return (
    <article className={"workshop-perspective perspective-" + id}>
      <span className="studio-eyebrow">{content.label}</span>
      <h2>{content.title}</h2>
      <p className="workshop-lead">{content.intro}</p>
      <div
        className="perspective-tabs"
        role="tablist"
        aria-label={content.label}
        aria-orientation="horizontal"
      >
        {content.questions.map(([question], index) => (
          <button
            type="button"
            key={question}
            ref={(element) => {
              tabs.current[index] = element;
            }}
            id={tabId(index)}
            role="tab"
            tabIndex={selected === index ? 0 : -1}
            aria-selected={selected === index}
            aria-controls={panelId}
            onClick={() => selectTab(index)}
            onKeyDown={(event) => {
              if (event.altKey || event.ctrlKey || event.metaKey) return;
              let next: number;
              if (event.key === "ArrowRight")
                next = (index + 1) % content.questions.length;
              else if (event.key === "ArrowLeft")
                next =
                  (index + content.questions.length - 1) %
                  content.questions.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = content.questions.length - 1;
              else return;
              event.preventDefault();
              event.stopPropagation();
              selectTab(next);
            }}
          >
            {question}
          </button>
        ))}
      </div>
      <section
        id={panelId}
        role="tabpanel"
        tabIndex={0}
        aria-labelledby={tabId(selected)}
        className="perspective-card"
      >
        <span>{content.questions[selected][0]}</span>
        <h3>{content.questions[selected][1]}</h3>
        <p>{content.questions[selected][2]}</p>
      </section>
      <p className="workshop-disclosure">{content.note}</p>
      <button
        type="button"
        className="studio-text-link"
        onClick={() => open(id === "field" ? "cats" : "notes")}
      >
        {id === "field" ? "去看 Little Works" : "打开自己的便签"}
        <ArrowUpRight size={16} />
      </button>
    </article>
  );
}

function BuildJournal() {
  const [entry, setEntry] = useState(0);
  const entryPanelId = useId();
  const entryHeadingId = useId();
  const entries = [
    {
      title: "先有一个可以打开的桌面",
      date: "DESKTOP",
      before: "页面按内容顺序向下滚动。",
      after: "照片、音乐和小世界成为独立 APP，让访客自己决定从哪里开始。",
      decision:
        "沿用 Macxfolio 的桌面隐喻，把窗口收起、搜索、键盘和手机返回作为同一套体验来设计。",
      detail:
        "React 管理应用状态，URL 可以直达 APP；原站和当前版本分别保留，迭代有回退点。",
    },
    {
      title: "让一个微型工地活起来",
      date: "LITTLE WORKS",
      before: "一块场景需要同时呈现建筑、人员与机械。",
      after: "楼体按工序生长，车辆作业、回场和待命，工人走向各自的岗位。",
      decision:
        "不用外部模型，用代码生成几何。重点是能看懂的动作、连贯的过程，以及不同光线里的细节。",
      detail:
        "Three.js 场景和依赖可以打包成独立 HTML；雨、昼夜、工序和相机都有对应控制。",
    },
    {
      title: "从收藏入口，变成完整的小体验",
      date: "STUDIO V2",
      before: "同一种图片网格，很难表达不同收藏的性格。",
      after: "摄影像底片工作台，日记像随手翻开的手札，音乐保留 iPod 的触感。",
      decision:
        "每个 APP 都要回答：为什么值得点开，点开后能做什么，下一步是否清楚。",
      detail:
        "每轮更新先验证使用流程，再记录实际测试结果；源码与更新记录可以在 GitHub 查看。",
    },
  ];
  const current = entries[entry];
  return (
    <article className="workshop-build">
      <p className="studio-eyebrow">BUILD LOG / NOTES FROM THE PROCESS</p>
      <h2>
        想法是起点，
        <br />
        细节在一次次试用里长出来。
      </h2>
      <p className="workshop-lead">
        AI 帮助实现，人的判断决定留下什么。这里记录真实的设计取舍。
      </p>
      <nav aria-label="创作记录">
        {entries.map((item, index) => (
          <button
            type="button"
            key={item.date}
            aria-current={entry === index}
            aria-controls={entryPanelId}
            onClick={() => setEntry(index)}
          >
            <span>{item.date}</span>
            <strong>{item.title}</strong>
            <ChevronRight size={16} />
          </button>
        ))}
      </nav>
      <section
        className="build-entry"
        id={entryPanelId}
        tabIndex={0}
        aria-labelledby={entryHeadingId}
      >
        <span>{current.date}</span>
        <h3 id={entryHeadingId}>{current.title}</h3>
        <div className="build-before-after">
          <div>
            <small>起点</small>
            <p>{current.before}</p>
          </div>
          <ArrowRight size={18} />
          <div>
            <small>现在的方向</small>
            <p>{current.after}</p>
          </div>
        </div>
        <h4>为什么这样做</h4>
        <p>{current.decision}</p>
        <div className="build-implementation">
          <Check size={17} />
          <p>{current.detail}</p>
        </div>
      </section>
      <p className="workshop-disclosure">
        基于已有模板与原站继续设计。没有把模板、AI
        协助或第三方游戏当作从零独立完成的内容。
      </p>
    </article>
  );
}

export default function WorkshopApp({
  open,
  onSectionChange,
}: {
  open: (id: AppId) => void;
  onSectionChange?: (title: string) => void;
}) {
  const [page, setPage] = useState<Page>("desk");
  useEffect(() => {
    onSectionChange?.(pages.find(item => item.id === page)!.title);
  }, [page, onSectionChange]);
  return (
    <div className="studio-workshop">
      <aside>
        <header>
          <span>OPEN WORKSHOP</span>
          <h2>造物间</h2>
          <p>
            一些作品，
            <br />
            一些仍在发芽的想法。
          </p>
        </header>
        <nav aria-label="创作工作台">
          {pages.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-current={page === item.id}
              onClick={() => {
                setPage(item.id);
              }}
            >
              <item.icon size={16} />
              <span>{item.title}</span>
            </button>
          ))}
        </nav>
        <footer>
          MADE WITH CURIOSITY
          <br />
          HAONAN LI · STUDIO V2
        </footer>
      </aside>
      <main className="workshop-main" key={page}>
        {page === "desk" ? (
          <>
            <header className="workshop-header">
              <p className="studio-eyebrow">SMALL THINGS, MADE REAL.</p>
              <h2>
                把好奇心，
                <br />
                <em>做成可以打开的东西。</em>
              </h2>
              <p>
                从一块工地、一只猫，到这个桌面。
                <br />
                点击作品，进入它自己的小世界。
              </p>
            </header>
            <div className="workshop-projects">
              <button
                type="button"
                aria-label="进入 Little Works 沙盘"
                onClick={() => open("cats")}
              >
                <div
                  className="workshop-art construction-art"
                  aria-hidden="true"
                >
                  <span className="art-ground" />
                  <i />
                  <i />
                  <i />
                  <Construction size={52} strokeWidth={1.15} />
                  <span>九段工序 · 一座工地</span>
                </div>
                <div>
                  <small>INTERACTIVE DIORAMA</small>
                  <h3>Little Works</h3>
                  <p>在工序、光线和细小的动作之间，观察一座正在形成的建筑。</p>
                  <strong>
                    进入沙盘 <ArrowUpRight size={17} />
                  </strong>
                </div>
              </button>
              <button
                type="button"
                aria-label="打开猫咪小游戏"
                onClick={() => open("games")}
              >
                <div className="workshop-art cat-art" aria-hidden="true">
                  <span className="workshop-cat-cover">
                    <PixelCat size={84} />
                  </span>
                  <Gamepad2 size={35} strokeWidth={1.25} />
                  <span>COME HOME, LITTLE CATS.</span>
                </div>
                <div>
                  <small>PLAYFUL EXPERIMENT</small>
                  <h3>牧猫庭院</h3>
                  <p>走进像素庭院，试着把各有脾气的小猫带回家。</p>
                  <strong>
                    去玩一会儿 <ArrowUpRight size={17} />
                  </strong>
                </div>
              </button>
            </div>
            <button
              type="button"
              className="workshop-journal-link"
              onClick={() => {
                setPage("build");
              }}
            >
              <Code2 size={23} />
              <span>
                <strong>这个桌面，也是一件作品。</strong>
                <small>从最初的想法，到每一次具体的调整。</small>
              </span>
              <ArrowRight size={19} />
            </button>
          </>
        ) : page === "build" ? (
          <BuildJournal />
        ) : page === "source" ? (
          <StudioSource />
        ) : (
          <Perspective id={page} open={open} />
        )}
      </main>
    </div>
  );
}
