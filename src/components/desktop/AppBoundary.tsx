import { Component, type ReactNode } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";

type Props = { children: ReactNode; name: string; onBack: () => void };

export default class AppBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <section className="studio-app-failure" role="alert">
      <span>这个空间暂时没有打开</span>
      <h2>{this.props.name}</h2>
      <p>可能是文件没有完整加载，或遇到了运行问题。已经保存在浏览器里的内容不会因此被清除。</p>
      <div><button onClick={() => window.location.reload()}><RotateCcw size={16} />重新载入页面</button><button onClick={this.props.onBack}><ArrowLeft size={16} />先回到桌面</button></div>
    </section>;
  }
}
