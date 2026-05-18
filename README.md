# 🚀 XHSCopyGen Demo: 高可用小红书爆款文案生成控制台

本仓库是一个面向独立开发者、内容创作者和 AI 架构师的 SaaS 支付与前端交互完全体 Demo。我们在此项目里实践了高可用异步网络层熔断、浏览器缓存生命周期自愈、以及大模型流式内容构建等顶级工程规范。

🌟 **体验地址：** Vercel Global Fast Deployment（即将关联您自己的 Vercel 地址）

## ✨ 核心技术亮点 (Engineering Highlights)

- **🛡️ bfcache 往返自愈 (bfcache Healing)：** 深度适配现代浏览器 BvCache 缓存生命周期。解决用户外跳到第三方托管页再通过「返回/后退」回到站点时，React 内存状态冻结、主 Action 按钮被死锁的顽疾。
- **🛑 流式熔断控制 (AbortController Integration)：** 基于标准的 AbortController 信号链设计。实现进行中大模型请求和 Session 握手的主动中止与优雅退避，保障高并发调用下的客户端性能隔离。
- **🔒 零信任 BYOK 机密边界 (Zero-Trust BYOK Sandbox)：** 纯前端安全沙盒设计，采用 BYOK（Bring Your Own Key - 自备密钥）机制。所有密钥水合至 LocalStorage 存储并在前端直接向 AI 服务商端点建立通信。不经过任何第三方服务器，100% 保护隐私。
- **📝 监管合规硬兜底 (Regulatory Compliance Safeguard)：** 内置安全审计逻辑。自动检测并补全符合 2026 最新内容生成监管规定的合规安全后缀（`#AI辅助创作`），确保线上安全运营。

## 🛠️ 快速开始

本地克隆本项目：

```bash
git clone https://github.com/你的GitHub用户名/xhscopygen-demo.git
cd xhscopygen-demo
```

安装并运行：

```bash
npm install
npm run dev
```

**填入自备密钥：** 在本地浏览器主页点击右上角 「配置自备 API Key」，填入您的 DeepSeek / OpenAI Key 以及对应的 Model Name，即刻开始丝滑流畅、低延迟地在本地生成爆款小红书文案！

## 🏆 商业完全体升级路径

想要体验免除「自备 API Key」、拥有多款大模型深度种草/反直觉高阶风格预置、以及支持双重保底自动续费和 credits 云端对账上分的完全体系统？

👉 欢迎访问商用 Pro 生产版在线网站：[XHSCopyGen Pro 官方入口](https://xhscopy.top)
