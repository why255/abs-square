'use client';

// ============================================================
// P3 S方案包展示页（收获时刻）
// UI设计规范 V1.0 §四 P3 严格实现
// ============================================================

import { useState, useEffect } from 'react';
import type { SPlan } from '@/types';

interface SolutionPageProps {
  plan: SPlan;
  onClose: () => void;
}

export default function SolutionPage({ plan, onClose }: SolutionPageProps) {
  const [visibleCards, setVisibleCards] = useState<number>(0);
  const [saved, setSaved] = useState(false);

  // 卡片逐张展开（0.3s 间隔，模拟"她在一张张翻开"）
  useEffect(() => {
    const totalCards = 6;
    const timers: NodeJS.Timeout[] = [];
    for (let i = 0; i < totalCards; i++) {
      timers.push(setTimeout(() => setVisibleCards(i + 1), i * 300));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => onClose(), 1200);
  };

  const handleExport = () => {
    const md = generateMarkdown(plan);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ABS广场_个人发展路线图_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cards = buildCards(plan);

  return (
    <div
      className="flex flex-col items-center min-h-screen px-5 py-10"
      style={{ backgroundColor: '#FAF6F0', fontFamily: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif' }}
    >
      {/* 容器：移动端全宽，桌面端限宽640px */}
      <div className="w-full" style={{ maxWidth: '640px' }}>

        {/* 顶部：仪式感标题 */}
        <div
          className={`text-center mb-10 transition-all duration-500 ${visibleCards >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
          style={{ transitionDelay: '0.1s' }}
        >
          {/* 麦金点缀 */}
          <div className="text-2xl mb-3" style={{ color: '#D4B06A' }}>✦</div>
          <h1
            className="text-[28px] leading-[1.6] mb-2"
            style={{ color: '#3D3630', fontFamily: '"Noto Serif SC", "STSong", serif' }}
          >
            你的专属路线图
          </h1>
          <p className="text-[15px]" style={{ color: '#8A857E', lineHeight: '1.8' }}>
            基于我们聊的，我为你做了这份个人发展路线图
          </p>
        </div>

        {/* 卡片区：逐张展开 */}
        <div className="space-y-4 mb-10">
          {cards.map((card, i) => (
            <div
              key={i}
              className={`rounded-[16px] p-5 transition-all duration-500 ease-out ${
                visibleCards > i
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-2'
              }`}
              style={{
                backgroundColor: '#FFFFFF',
                boxShadow: '0 1px 3px rgba(61,54,48,0.08)',
                transitionDelay: `${i * 0.1}s`,
              }}
            >
              <div className="flex items-start gap-3">
                {/* 序号 */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-medium flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: card.index === 6 ? '#D4B06A' : '#E8935A', color: '#FFFFFF' }}
                >
                  {card.index}
                </div>
                <div className="flex-1 min-w-0">
                  <h3
                    className="text-[17px] font-medium mb-3"
                    style={{ color: '#3D3630', fontFamily: '"Noto Serif SC", "STSong", serif' }}
                  >
                    {card.title}
                  </h3>
                  <div className="text-[15px] leading-[1.8]" style={{ color: '#3D3630' }}>
                    {card.content}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 底部按钮区 */}
        <div
          className={`text-center transition-all duration-500 ${visibleCards >= 6 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
          style={{ transitionDelay: '0.3s' }}
        >
          {/* 主按钮：存入档案 */}
          <button
            className="w-56 h-12 rounded-[24px] text-[16px] font-medium transition-all active:scale-[0.98] mb-3"
            style={{
              backgroundColor: saved ? '#7FA88A' : '#E8935A',
              color: '#FFFFFF',
              fontFamily: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
            }}
            onClick={handleSave}
            disabled={saved}
          >
            {saved ? '✓ 已存入档案' : '存入我的档案'}
          </button>

          {/* 次按钮：导出Markdown */}
          <br />
          <button
            className="text-[14px] px-5 py-2 rounded-[24px] transition-all active:scale-[0.98]"
            style={{
              color: '#8A857E',
              border: '1px solid #E5DFD8',
              backgroundColor: 'transparent',
              fontFamily: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
            }}
            onClick={handleExport}
          >
            ⬇ 下载 Markdown
          </button>

          {/* 返回对话 */}
          <p
            className="text-[13px] mt-5 cursor-pointer hover:opacity-70 transition-opacity"
            style={{ color: '#8A857E' }}
            onClick={onClose}
          >
            ← 返回对话
          </p>

          {/* 回访约定 */}
          <p className="text-[13px] mt-1" style={{ color: '#8A857E', lineHeight: '1.8' }}>
            30天后，小耕会来找你聊聊
          </p>
        </div>

      </div>
    </div>
  );
}

// ============================================================
// 卡片构建器
// ============================================================

interface Card {
  index: number;
  title: string;
  content: React.JSX.Element;
}

function buildCards(plan: SPlan): Card[] {
  const cards: Card[] = [];

  // ① 诊断
  cards.push({
    index: 1,
    title: '你的处境诊断',
    content: (
      <p style={{ color: '#3D3630' }}>{plan.diagnosis}</p>
    ),
  });

  // ② 路径总览
  cards.push({
    index: 2,
    title: '路径总览',
    content: (
      <div className="space-y-3">
        {(plan.route_map || []).map((phase, i) => (
          <div key={i} className="flex items-start gap-3">
            <div
              className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
              style={{ backgroundColor: '#E8935A' }}
            />
            <div>
              <span className="font-medium" style={{ color: '#3D3630' }}>
                {phase.phase}
              </span>
              <span className="text-[13px] ml-2" style={{ color: '#8A857E' }}>
                {phase.duration}
              </span>
              <p className="text-[14px] mt-0.5" style={{ color: '#8A857E' }}>
                {phase.goal}
              </p>
            </div>
          </div>
        ))}
      </div>
    ),
  });

  // ③ 每个阶段的具体动作
  cards.push({
    index: 3,
    title: '每个阶段的具体动作',
    content: (
      <div className="space-y-4">
        {(plan.actions || []).map((act, i) => (
          <div key={i}>
            <p className="font-medium text-[15px] mb-2" style={{ color: '#3D3630' }}>
              {act.phase}
            </p>
            <ul className="space-y-1.5">
              {(act.tasks || []).map((task, j) => (
                <li key={j} className="flex items-start gap-2 text-[14px]" style={{ color: '#3D3630' }}>
                  <span className="mt-0.5 flex-shrink-0" style={{ color: '#D4B06A' }}>•</span>
                  {task}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    ),
  });

  // ④ 避坑指南
  cards.push({
    index: 4,
    title: '避坑指南',
    content: (
      <ul className="space-y-2">
        {(plan.pitfalls || []).map((pit, i) => (
          <li key={i} className="flex items-start gap-2 text-[14px]" style={{ color: '#3D3630' }}>
            <span className="mt-0.5 flex-shrink-0 text-[16px]" style={{ color: '#E8935A' }}>⚠️</span>
            {pit}
          </li>
        ))}
      </ul>
    ),
  });

  // ⑤ 第一个7天启动清单
  cards.push({
    index: 5,
    title: '第一个7天，从这里开始',
    content: (
      <ul className="space-y-2">
        {(plan.first_week || []).map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-[14px]" style={{ color: '#3D3630' }}>
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] text-white flex-shrink-0 mt-0.5"
              style={{ backgroundColor: '#7FA88A' }}
            >
              {i + 1}
            </span>
            {item}
          </li>
        ))}
      </ul>
    ),
  });

  // ⑥ 30天回访约定
  cards.push({
    index: 6,
    title: '30天回访约定',
    content: (
      <div>
        <p className="text-[14px] mb-2" style={{ color: '#3D3630', lineHeight: '1.8' }}>
          方案不是终点，行动才是。30天后我会来回访，咱们看看走到了哪一步。
        </p>
        <p className="text-[13px]" style={{ color: '#8A857E' }}>
          这份方案已经存入你的专属档案。你不是一个人在走这条路——有什么想聊的，随时来找我。
        </p>
      </div>
    ),
  });

  return cards;
}

// ============================================================
// Markdown 导出
// ============================================================

function generateMarkdown(plan: SPlan): string {
  let md = '';

  md += `# 个人发展路线图\n\n`;
  md += `> 生成时间：${new Date().toISOString().slice(0, 10)}\n`;
  md += `> ABS超级广场 · 小耕\n\n`;
  md += `---\n\n`;

  md += `## ① 你的处境诊断\n\n${plan.diagnosis}\n\n`;

  md += `## ② 路径总览\n\n`;
  for (const phase of plan.route_map || []) {
    md += `- **${phase.phase}**（${phase.duration}）：${phase.goal}\n`;
  }
  md += '\n';

  md += `## ③ 每个阶段的具体动作\n\n`;
  for (const act of plan.actions || []) {
    md += `### ${act.phase}\n\n`;
    for (const task of act.tasks || []) {
      md += `- ${task}\n`;
    }
    md += '\n';
  }

  md += `## ④ 避坑指南\n\n`;
  for (const pit of plan.pitfalls || []) {
    md += `- ⚠️ ${pit}\n`;
  }
  md += '\n';

  md += `## ⑤ 第一个7天启动清单\n\n`;
  (plan.first_week || []).forEach((item, i) => {
    md += `${i + 1}. ${item}\n`;
  });
  md += '\n';

  md += `## ⑥ 30天回访约定\n\n`;
  md += `方案不是终点，行动才是。30天后小耕会来回访。\n`;
  md += `———\n`;
  md += `ABS超级广场 · AI时代的结构化认知基本功\n`;

  return md;
}
