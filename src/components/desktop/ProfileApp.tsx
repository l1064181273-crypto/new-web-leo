import { ArrowUpRight, Bot, Code2, Leaf } from "lucide-react";
import avatar from "@/assets/avatar-3d.png";

export default function ProfileApp({ connect }: { connect: () => void }) {
  return <div className="profile-app">
    <h2>Profile</h2>
    <div className="profile-intro">
      <img src={avatar} alt="Haonan Li 的个人头像" />
      <div><h3>Haonan Li</h3><p>AI 数据运营者与 Vibe Coding 实践者。<br />在复杂信息中找到结构，把想法变成可以使用的产品。</p><span className="profile-status"><i />在字节跳动参与 AI 数据与业务运营</span><div className="profile-contact"><span>Shanghai, China</span><button onClick={connect}>交个朋友 <ArrowUpRight size={14} /></button></div></div>
    </div>
    <h2 className="profile-focus-title">Focus</h2>
    <div className="profile-focus">
      <article><span className="focus-icon blue"><Bot size={23} /></span><h3>AI Data Operations</h3><p>数据质量、业务理解与持续反馈，让规则落到真实场景。</p></article>
      <article><span className="focus-icon green"><Leaf size={23} /></span><h3>Smart Agriculture</h3><p>智慧农业硕士研究生背景，保留数据与系统的交叉视角。</p></article>
      <article><span className="focus-icon charcoal"><Code2 size={23} /></span><h3>Vibe Coding</h3><p>用 AI、React 和 Git，把每一个值得尝试的想法做出来。</p></article>
    </div>
  </div>;
}
