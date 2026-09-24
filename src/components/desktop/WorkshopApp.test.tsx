import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkshopApp from "./WorkshopApp";

afterEach(cleanup);

const perspectives = [
  { nav: "Signal Lab", label: "语言小实验", questions: ["它说了什么？", "我们知道多少？", "下一步看哪里？"], headings: ["先保留原话", "把事实和推测分开", "回到边界样本"], disclosure: "以下为手工编写的示例，不调用模型，也不代表真实用户数据。", destination: "notes" },
  { nav: "City Lens", label: "三个观察角度", questions: ["从人的视角", "从时间的视角", "从供需的视角"], headings: ["一条路线为什么被选择？", "同一个地方，会有几种节奏？", "一个选择怎样发生？"], disclosure: "这些是观察提示。你也可以在自己的便签中记下城市片段。", destination: "notes" },
  { nav: "Market Flow", label: "体验拆解", questions: ["被看见", "被理解", "被记住"], headings: ["第一眼传递了什么？", "信息足够做决定吗？", "体验结束以后呢？"], disclosure: "这里展示观察方法，不展示未公开的业务数据或效果数字。", destination: "notes" },
  { nav: "Field Notes", label: "从专业到小世界", questions: ["观察", "连接", "表达"], headings: ["一个数字背后有什么？", "变化会传到哪里？", "怎样让过程被理解？"], disclosure: "Little Works 是程序生成的视觉模拟，不是工程设计或生产调度系统。", destination: "cats" },
];

describe("workshop navigation", () => {
  it("opens each real playable work in the correct desktop app", () => {
    const open = vi.fn();
    render(<WorkshopApp open={open} />);
    fireEvent.click(screen.getByRole("button", { name: "进入 Little Works 沙盘" }));
    expect(open).toHaveBeenLastCalledWith("cats");
    fireEvent.click(screen.getByRole("button", { name: "打开猫咪小游戏" }));
    expect(open).toHaveBeenLastCalledWith("games");
    expect(open).toHaveBeenCalledTimes(2);
    expect(screen.getByText("九段工序 · 一座工地")).toBeInTheDocument();
  });

  it("keeps side navigation and the window title callback in sync", () => {
    const changed = vi.fn();
    render(<WorkshopApp open={vi.fn()} onSectionChange={changed} />);
    const navigation = screen.getByRole("navigation", { name: "创作工作台" });
    for (const title of ["创作手记", "Signal Lab", "City Lens", "Market Flow", "Field Notes", "源码与来源", "小作品"]) {
      fireEvent.click(within(navigation).getByRole("button", { name: title }));
      expect(changed).toHaveBeenLastCalledWith(title);
      expect(within(navigation).getByRole("button", { name: title })).toHaveAttribute("aria-current", "true");
      expect(within(navigation).getAllByRole("button").filter((button) => button.getAttribute("aria-current") === "true")).toHaveLength(1);
    }
    expect(screen.getByRole("button", { name: "进入 Little Works 沙盘" })).toBeInTheDocument();
  });

  it("resets the desktop section title when a closed workshop is reopened", () => {
    const changed = vi.fn();
    const first = render(<WorkshopApp open={vi.fn()} onSectionChange={changed} />);
    expect(changed).toHaveBeenLastCalledWith("小作品");
    fireEvent.click(screen.getByRole("button", { name: "Signal Lab" }));
    expect(changed).toHaveBeenLastCalledWith("Signal Lab");
    first.unmount();
    render(<WorkshopApp open={vi.fn()} onSectionChange={changed} />);
    expect(changed).toHaveBeenLastCalledWith("小作品");
    expect(screen.getByRole("button", { name: "进入 Little Works 沙盘" })).toBeInTheDocument();
  });

  it("switches all build journal entries while keeping honest process and source notes", () => {
    const changed = vi.fn();
    render(<WorkshopApp open={vi.fn()} onSectionChange={changed} />);
    fireEvent.click(screen.getByRole("button", { name: /这个桌面，也是一件作品/ }));
    expect(changed).toHaveBeenLastCalledWith("创作手记");
    const navigation = screen.getByRole("navigation", { name: "创作记录" });
    const entries = [
      ["先有一个可以打开的桌面", "页面按内容顺序向下滚动。"],
      ["让一个微型工地活起来", "一块场景需要同时呈现建筑、人员与机械。"],
      ["从收藏入口，变成完整的小体验", "同一种图片网格，很难表达不同收藏的性格。"],
    ];
    for (const [title, before] of entries) {
      const button = within(navigation).getByRole("button", { name: new RegExp(title) });
      fireEvent.click(button);
      const panel = screen.getByRole("region", { name: title });
      expect(panel).toHaveAttribute("tabindex", "0");
      expect(button).toHaveAttribute("aria-controls", panel.id);
      expect(button).toHaveAttribute("aria-current", "true");
      expect(within(panel).getByText(before)).toBeInTheDocument();
      expect(within(panel).getByRole("heading", { name: "为什么这样做" })).toBeInTheDocument();
    }
    expect(screen.getByText(/没有把模板、AI 协助或第三方游戏当作从零独立完成/)).toBeInTheDocument();
    expect(screen.getByText(/每轮更新先验证使用流程，再记录实际测试结果/)).toBeInTheDocument();
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it("preserves source and inspiration credits without claiming a deployment state", () => {
    render(<WorkshopApp open={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "源码与来源" }));
    expect(screen.getByRole("link", { name: "查看 GitHub 源码" })).toHaveAttribute("href", "https://github.com/l1064181273-crypto/new-web-leo");
    expect(screen.getByRole("link", { name: "Macxfolio" })).toHaveAttribute("href", "https://macxfolio.framer.website/");
    expect(screen.getByText(/原版 Herding Cats 沿用原站的外部游戏入口，本地牧猫庭院是独立实现。/)).toBeInTheDocument();
    expect(screen.getByText(/GitHub 链接打开源码仓库与更新记录，不是网站预览地址/)).toBeInTheDocument();
    expect(screen.queryByText(/新版变更尚未推送/)).not.toBeInTheDocument();
  });
});

describe("perspective keyboard tabs", () => {
  for (const item of perspectives) {
    it("makes all three " + item.nav + " observations keyboard reachable with correct relationships", () => {
      const open = vi.fn();
      render(<WorkshopApp open={open} />);
      fireEvent.click(screen.getByRole("button", { name: item.nav }));
      const list = screen.getByRole("tablist", { name: item.label });
      expect(list).toHaveAttribute("aria-orientation", "horizontal");
      const tabs = within(list).getAllByRole("tab");
      expect(tabs).toHaveLength(3);
      const check = (index: number) => {
        const panel = screen.getByRole("tabpanel", { name: item.questions[index] });
        expect(panel).toHaveAttribute("tabindex", "0");
        expect(panel).toHaveAttribute("aria-labelledby", tabs[index].id);
        expect(tabs[index]).toHaveAttribute("aria-controls", panel.id);
        expect(tabs[index]).toHaveAttribute("aria-selected", "true");
        expect(tabs[index]).toHaveAttribute("tabindex", "0");
        expect(tabs.filter((tab) => tab.getAttribute("tabindex") === "0")).toHaveLength(1);
        expect(within(panel).getByRole("heading", { name: item.headings[index] })).toBeInTheDocument();
      };
      check(0);
      fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
      check(1);
      expect(document.activeElement).toBe(tabs[1]);
      fireEvent.keyDown(tabs[1], { key: "ArrowRight" });
      check(2);
      fireEvent.keyDown(tabs[2], { key: "ArrowRight" });
      check(0);
      fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });
      check(2);
      fireEvent.keyDown(tabs[2], { key: "Home" });
      check(0);
      fireEvent.keyDown(tabs[0], { key: "End" });
      check(2);
      expect(document.activeElement).toBe(tabs[2]);
      expect(screen.getByText(item.disclosure)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: item.destination === "cats" ? "去看 Little Works" : "打开自己的便签" }));
      expect(open).toHaveBeenCalledExactlyOnceWith(item.destination);
    });
  }

  it("keeps click activation and native Tab behavior, ignoring modified arrows", () => {
    render(<WorkshopApp open={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Signal Lab" }));
    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[1]);
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    tabs[1].dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
    fireEvent.keyDown(tabs[1], { key: "ArrowLeft", ctrlKey: true });
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(tabs[1]);
  });

  it("uses unique panel relationships if the workshop is rendered more than once", () => {
    render(<><div aria-label="first workshop"><WorkshopApp open={vi.fn()} /></div><div aria-label="second workshop"><WorkshopApp open={vi.fn()} /></div></>);
    for (const button of screen.getAllByRole("button", { name: "Signal Lab" })) fireEvent.click(button);
    const panels = screen.getAllByRole("tabpanel");
    expect(panels).toHaveLength(2);
    expect(panels[0].id).not.toBe(panels[1].id);
    for (const panel of panels) expect(document.getElementById(panel.getAttribute("aria-labelledby")!)).toHaveAttribute("aria-controls", panel.id);
  });
});
