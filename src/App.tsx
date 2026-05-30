import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { defaultUrlTransform } from 'react-markdown';
import { toast, Toaster } from 'sonner';
import { 
  Sparkles, 
  Send, 
  Settings, 
  Hash, 
  LayoutDashboard, 
  Star,
  Type,
  Eye,
  Mail,
  Github,
  Key,
  Globe,
  HelpCircle,
  Code
} from 'lucide-react';

/**
 * 1. 纯前端轻量级日志模拟（展示工程化规范）
 */
const log = {
  info: (msg: string, details?: any) => console.log(`[INFO] [Client] ${msg}`, details || ''),
  warn: (msg: string, details?: any) => console.warn(`[WARN] [Client] ${msg}`, details || ''),
  error: (msg: string, details?: any) => console.error(`[ERROR] [Client] ${msg}`, details || '')
};

/**
 * 2. 默认的开源提示词脱敏模板
 */
const DEFAULT_SYSTEM_PROMPT = `你是一个拥有百万粉丝的小红书爆款文案专家。请根据用户输入的主题和参数，创作极具吸引力、排版优美、包含丰富Emoji的小红书种草文案。文案末尾必须包含相关的热门标签。`;

/** 纯前端访问统计（CountAPI，无需自建后端） */
const VISIT_COUNTER_NAMESPACE = 'xhscopygen-demo';
const VISIT_COUNTER_KEY = 'netlify-pv';
const VISIT_SESSION_KEY = 'xhscopygen_pv_recorded';
const SITE_LINKS = {
  github: 'https://github.com/dongzhijie2017/xhscopygen-demo',
  pro: 'https://xhscopy.top',
  issues: 'https://github.com/dongzhijie2017/xhscopygen-demo/issues',
} as const;

/** 邮箱仅存混淆串，避免明文出现在 HTML / mailto 中供爬虫抓取 */
const EMAIL_OBFUSCATED = 'ZG9uZy56akAxMzkuY29t';
const revealContactEmail = (): string => {
  try {
    return atob(EMAIL_OBFUSCATED);
  } catch {
    return '';
  }
};

export default function App() {
  // --- 纯前端 BYOK 配置状态机 ---
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('BYOK_LLM_API_KEY') || '');
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem('BYOK_LLM_API_URL') || 'https://api.deepseek.com/v1');
  const [modelName, setModelName] = useState(() => localStorage.getItem('BYOK_LLM_MODEL_NAME') || 'deepseek-chat');
  
  // --- 创作参数 ---
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('种草');
  const [targetWords, setTargetWords] = useState<number>(300);
  const [seoKeywords, setSeoKeywords] = useState('');
  
  // --- 运行状态 ---
  const [result, setResult] = useState('');
  const [polishPrompt, setPolishPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // --- 异步请求控制器引用（GitHub Portfolio 核心亮点：AbortController 中断流展示） ---
  const generationAbortRef = useRef<AbortController | null>(null);

  // --- 满意度反馈状态机 ---
  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const feedbackTags = ['排版惊艳', '文笔风趣', 'Emoji恰到好处', '字数超预期'];

  const [visitCount, setVisitCount] = useState<number | null>(null);
  const [emailRevealed, setEmailRevealed] = useState(false);

  // 访问统计：同会话内只 hit 一次，避免刷新重复累加；展示仍拉取全局计数
  useEffect(() => {
    const counterGetUrl = `https://api.countapi.xyz/get/${VISIT_COUNTER_NAMESPACE}/${VISIT_COUNTER_KEY}`;
    const counterHitUrl = `https://api.countapi.xyz/hit/${VISIT_COUNTER_NAMESPACE}/${VISIT_COUNTER_KEY}`;

    const applyCount = (value: unknown) => {
      const n = typeof value === 'number' ? value : Number(value);
      setVisitCount(Number.isFinite(n) ? n : null);
    };

    const fetchGet = () =>
      fetch(counterGetUrl)
        .then((r) => r.json())
        .then((d) => applyCount(d.value))
        .catch(() => setVisitCount(null));

    if (sessionStorage.getItem(VISIT_SESSION_KEY)) {
      void fetchGet();
      return;
    }

    fetch(counterHitUrl)
      .then((r) => r.json())
      .then((d) => {
        applyCount(d.value);
        sessionStorage.setItem(VISIT_SESSION_KEY, '1');
      })
      .catch(() => {
        const local = Number(localStorage.getItem('xhscopygen_local_pv') || '0') + 1;
        localStorage.setItem('xhscopygen_local_pv', String(local));
        setVisitCount(local);
      });
  }, []);

  // 🛡️ 往返缓存(bfcache)防冻结自愈：展示客户端自愈方案的健壮性
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        log.info('页面通过 bfcache 历史缓存恢复。自动熔断并释放请求锁。');
        setLoading(false);
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  // 监听配置落盘存储
  useEffect(() => {
    localStorage.setItem('BYOK_LLM_API_KEY', apiKey);
    localStorage.setItem('BYOK_LLM_API_URL', apiUrl);
    localStorage.setItem('BYOK_LLM_MODEL_NAME', modelName);
  }, [apiKey, apiUrl, modelName]);

  // 取消本次生成尝试（主动熔断）
  const cancelGenerationAttempt = () => {
    if (generationAbortRef.current) {
      generationAbortRef.current.abort();
      generationAbortRef.current = null;
      log.warn('用户主动中断了大模型流式生成请求');
    }
    setLoading(false);
  };

  // 兼容 iframe 的绿色安全拷贝机制
  const copyToClipboard = (text: string, successMsg: string) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      toast.success(successMsg);
    } catch (err) {
      toast.error('拷贝失败，请手动选取复制');
    }
    document.body.removeChild(textarea);
  };

  // 监管合规：后端同款强监管兜底标签自动闭环
  const COMPLIANCE_HASHTAG = '#AI辅助创作';
  const enforceComplianceFootnote = (text: string): string => {
    const body = text.replace(/\s+$/g, '');
    if (!body) return body;
    return body.endsWith(COMPLIANCE_HASHTAG) ? text : `${body}\n\n${COMPLIANCE_HASHTAG}`;
  };

  // 核心：直接连接用户自备的大模型网关（BYOK 模式）
  const handleGenerate = async () => {
    if (!prompt) return toast.error('请输入文案主题或产品描述');
    if (!apiKey) {
      toast.error('请先在右上角配置您的 API Key');
      setShowConfigModal(true);
      return;
    }

    // 1. 每次生成前，先优雅中断可能残留的历史挂起请求
    if (generationAbortRef.current) {
      generationAbortRef.current.abort();
    }
    generationAbortRef.current = new AbortController();
    setLoading(true);
    setResult('');

    try {
      log.info('开始发起 BYOK 大模型请求', { apiUrl, modelName });

      const finalUserPrompt = `
文案主题/描述：${prompt}
写作风格：${style}
期望字数：${targetWords}字左右
SEO 关键词：${seoKeywords || '无'}

请为我生成一篇符合小红书风格的爆款文案。
`;

      const response = await fetch(`${apiUrl.trim().replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        signal: generationAbortRef.current.signal, // 挂载 Abort 信号
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: DEFAULT_SYSTEM_PROMPT },
            { role: 'user', content: finalUserPrompt }
          ],
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 返回错误 (${response.status}): ${errorText || '未知接口异常'}`);
      }

      const data = await response.json();
      const rawOutput = data.choices?.[0]?.message?.content || '';
      
      if (!rawOutput) {
        throw new Error('模型输出内容为空');
      }

      // 自动强行拼接监管合规标签
      const finalizedOutput = enforceComplianceFootnote(rawOutput);
      setResult(finalizedOutput);
      toast.success('爆款文案生成成功！');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        toast.info('已主动中止文案生成');
        return;
      }
      log.error('大模型接口调用遭遇崩溃', err);
      toast.error(err.message || '大模型网络连接失败，请核对您的配置与余额');
    } finally {
      if (!generationAbortRef.current?.signal.aborted) {
        generationAbortRef.current = null;
      }
      setLoading(false);
    }
  };

  // 纯前端模拟多轮润色
  const handlePolish = async () => {
    if (!result) return toast.error('请先生成首版文案再进行润色');
    if (!polishPrompt) return toast.error('请输入您的润色微调指令');
    if (!apiKey) {
      toast.error('请先配置 API Key');
      setShowConfigModal(true);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiUrl.trim().replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: DEFAULT_SYSTEM_PROMPT },
            { role: 'user', content: `原先生成的文案：\n${result}` },
            { role: 'user', content: `请基于上述原先生成的文案，进行如下的润色修改指导：${polishPrompt}` }
          ],
          temperature: 0.6
        })
      });

      if (!response.ok) {
        throw new Error('润色接口调用失败');
      }

      const data = await response.json();
      const polishedOutput = data.choices?.[0]?.message?.content || '';
      setResult(enforceComplianceFootnote(polishedOutput));
      setPolishPrompt('');
      toast.success('润色微调完成！');
    } catch (err: any) {
      log.error('多轮润色失败', err);
      toast.error(err.message || '润色失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  // Markdown 渲染安全隔离
  const safeMdUrl = (uri: string): string => {
    return defaultUrlTransform(uri);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] font-sans antialiased text-slate-800">
      <Toaster position="bottom-center" richColors />

      {/* 顶部导航 */}
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-2xl tracking-tight text-red-600">XHSCopyGen</h1>
            <span className="bg-slate-100 text-slate-500 font-bold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">Demo / BYOK</span>
          </div>
          <p className="text-xs text-slate-400 font-semibold tracking-wider mt-0.5">小红书爆款文案开源演示站</p>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-400 tabular-nums"
            title="全站累计访问（CountAPI 统计，同浏览器会话内刷新不重复计数）"
          >
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span>
              {visitCount !== null ? visitCount.toLocaleString('zh-CN') : '—'} 次访问
            </span>
          </div>
          {/* 配置 API 密钥按钮 */}
          <button 
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-4 py-2 rounded-full cursor-pointer transition-all text-xs font-bold text-slate-700 active:scale-95"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            <span>配置自备 API Key</span>
          </button>
        </div>
      </header>

      {/* 顶部开源黄条告示 */}
      <div className="bg-[#FFFDF4] border-b border-[#FBEFBE] px-6 py-3.5 text-[#855F1C] text-xs font-medium leading-relaxed">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="font-bold text-sm text-[#9A6E24] flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-amber-500" /> 
              零成本、零充值、100% 隐私安全的开源沙箱
            </p>
            <p className="text-slate-600">
              这是一个纯前端展示 Demo，采用 **BYOK (自备密钥)** 方案，所有的 API 密钥均保存在您的浏览器本地，直接对接您的 API 终点。
            </p>
          </div>
          <a 
            href="https://xhscopy.top" // 引导流：返回你的商业正式版
            target="_blank" 
            rel="noopener noreferrer"
            className="flex-shrink-0 bg-red-500 text-white hover:bg-red-600 px-4.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 self-start sm:self-center no-underline text-center"
          >
            🔥 访问商用 Pro 完整免 Key 版
          </a>
        </div>
      </div>

      {/* 主面板 */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 左侧：控制配置面板 */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col gap-6">
            <h2 className="font-black text-slate-800 text-lg flex items-center gap-2">
              <Code className="w-5 h-5 text-red-500" /> 创作参数
            </h2>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2.5">主题 / 产品描述</label>
                <textarea 
                  rows={6}
                  placeholder="例如：杭州法式餐厅 探店、敏感肌修复精华、独角兽独立开发..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-slate-100 rounded-2xl px-4 py-3.5 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition-all placeholder:text-slate-300 resize-none font-medium text-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2.5">写作风格</label>
                  <select 
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition-all font-bold text-slate-700 cursor-pointer"
                  >
                    <option value="种草">种草</option>
                    <option value="测评">测评</option>
                    <option value="反直觉营销">反直觉</option>
                    <option value="深度干货分享">干货分享</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 tracking-wider mb-2.5">目标字数</label>
                  <input 
                    type="number"
                    value={targetWords}
                    onChange={(e) => setTargetWords(parseInt(e.target.value) || 300)}
                    className="w-full bg-[#F8FAFC] border border-slate-100 rounded-2xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition-all font-bold text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2.5">SEO 关键词（可选）</label>
                <div className="relative">
                  <Hash className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-300" />
                  <input 
                    type="text" 
                    placeholder="空格或逗号分隔，如：杭州 咖啡 探店"
                    value={seoKeywords}
                    onChange={(e) => setSeoKeywords(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-slate-100 rounded-2xl pl-10 pr-4 py-3 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition-all placeholder:text-slate-300 text-slate-700"
                  />
                </div>
              </div>

              {/* 核心动作按钮 */}
              <div className="flex flex-col gap-2">
                <button 
                  onClick={handleGenerate}
                  disabled={loading}
                  className={`w-full py-4 rounded-2xl font-black text-white flex items-center justify-center gap-2 shadow-xl transition-all active:scale-[0.98] cursor-pointer border-none ${
                    loading ? 'bg-red-400 cursor-wait shadow-none animate-pulse' : 'bg-red-500 hover:bg-red-600 shadow-red-100'
                  }`}
                >
                  {loading ? (
                    <span>算法生成中... 请稍候</span>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> 
                      <span>开始文案创作</span>
                    </>
                  )}
                </button>

                {/* 🛑 中断熔断按钮（技术力拉满展示） */}
                {loading && (
                  <button 
                    type="button"
                    onClick={cancelGenerationAttempt}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-all border-none cursor-pointer animate-in fade-in"
                  >
                    取消并中止生成
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 右侧：结果面板与反馈系统 */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col min-h-[380px]">
            <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">输出预览</span>
              </div>
              {result && (
                <button 
                  onClick={() => copyToClipboard(result, '小红书文案已成功拷贝！')}
                  className="text-xs font-bold text-red-500 px-3 py-1.5 rounded-xl border border-red-50 hover:bg-red-50 transition-all cursor-pointer bg-white"
                >
                  复制全文
                </button>
              )}
            </div>

            <div className="flex-1 p-8">
              {!result && !loading && (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-3 py-12">
                  <Type className="w-12 h-12 text-slate-200" />
                  <p className="text-sm font-medium">配置自备 Key 后，即可在此处实时输出。</p>
                </div>
              )}

              {loading && (
                <div className="h-full flex flex-col items-center justify-center gap-4 py-16">
                  <div className="w-10 h-10 border-4 border-slate-100 border-t-red-500 rounded-full animate-spin" />
                  <p className="text-xs font-bold text-slate-400 animate-pulse">正在直连大模型算力通道中...</p>
                </div>
              )}

              {result && !loading && (
                <div className="animate-in fade-in duration-500">
                  <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed">
                    <ReactMarkdown urlTransform={safeMdUrl}>{result}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 满意度反馈展示 */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">本地模拟反馈卡片</h3>
                <p className="text-xs text-slate-400 mt-1">展示系统内置的小红书算法体验评估回执。</p>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star 
                      key={i} 
                      onClick={() => setRating(i)}
                      className={`w-5 h-5 cursor-pointer transition-colors ${
                        i <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200 hover:text-amber-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs font-bold text-slate-400">{rating > 0 ? `${rating} 星` : '未评分'}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {feedbackTags.map((tag) => (
                  <button 
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                      selectedTags.includes(tag) 
                        ? 'bg-red-500 text-white border-red-500' 
                        : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 多轮润色模拟 */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">多轮追问润色</h3>
              <p className="text-xs text-slate-400 mt-1">基于当前正文提出润色方案，模型将携带上下文为您深度调整。</p>
            </div>

            <textarea 
              rows={3}
              placeholder="例如：开头加几句反问 / 调皮可爱的口吻 / 再缩短一些字数 ..."
              value={polishPrompt}
              onChange={(e) => setPolishPrompt(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition-all placeholder:text-slate-300 resize-none font-medium text-slate-700"
            />

            <button 
              onClick={handlePolish}
              className="w-full bg-[#FFF1F2] hover:bg-[#FFE4E6] text-red-500 font-bold text-xs py-3.5 rounded-xl transition-all cursor-pointer text-center border-none"
            >
              微调应用润色
            </button>
          </div>
        </div>
      </main>

      <footer className="mt-auto border-t border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-bold text-slate-500">联系方式</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold">
              <a
                href={SITE_LINKS.github}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-slate-600 hover:text-red-600 no-underline transition-colors"
              >
                <Github className="w-3.5 h-3.5" />
                GitHub 开源仓库
              </a>
              <a
                href={SITE_LINKS.pro}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 hover:text-red-600 no-underline transition-colors"
              >
                商用 Pro 官网
              </a>
              {emailRevealed ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <a
                    href={`mailto:${revealContactEmail()}`}
                    className="inline-flex items-center gap-1 text-slate-600 hover:text-red-600 no-underline transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {revealContactEmail().replace('@', ' [at] ')}
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(revealContactEmail(), '邮箱已复制到剪贴板')
                    }
                    className="text-[10px] font-bold text-red-500 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-lg border-none cursor-pointer"
                  >
                    复制完整地址
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setEmailRevealed(true)}
                  className="inline-flex items-center gap-1 text-slate-600 hover:text-red-600 bg-transparent border-none cursor-pointer p-0 text-xs font-semibold"
                  title="需人工点击后才显示，降低自动爬虫抓取概率"
                >
                  <Mail className="w-3.5 h-3.5" />
                  邮件联系（点击显示）
                </button>
              )}
              <a
                href={SITE_LINKS.issues}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 hover:text-red-600 no-underline transition-colors"
              >
                提交 Issue / 反馈（推荐）
              </a>
            </div>
            <p className="text-[10px] text-slate-300 mt-1 max-w-md">
              防骚扰：页内不写明文邮箱；优先走 GitHub Issue。公开邮箱仍可能被爬取，请在 139 邮箱开启反垃圾策略。
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-1 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums">
              <Eye className="w-3.5 h-3.5" />
              累计访问 {visitCount !== null ? visitCount.toLocaleString('zh-CN') : '加载中…'} 次
            </span>
            <span className="text-[10px] text-slate-300">统计由 CountAPI 提供 · 同会话刷新不重复计数</span>
            <span className="text-[10px] text-slate-300">© {new Date().getFullYear()} XHSCopyGen Demo · BYOK 开源演示</span>
          </div>
        </div>
      </footer>

      {/* BYOK 自备 Key 配置 Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-8 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-lg text-slate-800 flex items-center gap-1.5">
                <Key className="w-5 h-5 text-red-500" /> 密钥安全配置沙盒
              </h3>
              <button 
                onClick={() => setShowConfigModal(false)}
                className="text-slate-300 hover:text-slate-500 font-bold text-lg bg-transparent border-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5">
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-[11px] text-slate-500 leading-relaxed">
                密钥仅存储在您的本地浏览器 LocalStorage 中，直接同大模型端点发起请求。我们 100% 承诺绝不收集、上传任何敏感信息。
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5" /> API Base URL
                </label>
                <input 
                  type="text" 
                  placeholder="https://api.deepseek.com/v1"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5" /> API Key
                </label>
                <input 
                  type="password" 
                  placeholder="sk_..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5" /> Model Name
                </label>
                <input 
                  type="text" 
                  placeholder="deepseek-chat"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none"
                />
              </div>

              <button 
                onClick={() => {
                  if (!apiKey) return toast.error('请输入 API Key');
                  toast.success('配置已安全落盘保存');
                  setShowConfigModal(false);
                }}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-extrabold text-sm py-4 rounded-2xl shadow-xl shadow-red-100 active:scale-95 transition-all cursor-pointer border-none"
              >
                保存配置并启用
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
