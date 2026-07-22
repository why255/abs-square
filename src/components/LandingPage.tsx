'use client';

// ============================================================
// P1 进入页（落地页）
// 设计规范 V1.0：品牌展示 + 场景选择
// ============================================================

import { useState } from 'react';
import type { Scenario } from '@/app/page';

interface LandingPageProps {
  onEnter: (scenario: Scenario) => void;
}

const SCENES: { key: Scenario; title: string; desc: string }[] = [
  {
    key: 'F',
    title: '职业迷茫',
    desc: '升值涨薪难 · 路径看不清 · 怕被AI替代',
  },
  {
    key: 'C',
    title: '招不到合适的人',
    desc: 'JD写不准 · 简历筛不出 · 面试聊不深',
  },
];

export default function LandingPage({ onEnter }: LandingPageProps) {
  const [selected, setSelected] = useState<Scenario>('F');

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen px-6 text-center"
      style={{ backgroundColor: '#FAF6F0' }}
    >
      {/* 小耕头像 */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-8 animate-fade-up"
        style={{ backgroundColor: '#E8935A' }}
      >
        <span
          className="text-white text-[28px] font-medium"
          style={{ fontFamily: '"Noto Serif SC", "STSong", serif' }}
        >
          耕
        </span>
      </div>

      {/* 品牌 Slogan */}
      <h1
        className="text-[28px] leading-[1.6] mb-3 animate-fade-up"
        style={{
          color: '#3D3630',
          fontFamily: '"Noto Serif SC", "STSong", serif',
          animationDelay: '0.1s',
        }}
      >
        AI遍地是道理，ABS给方案
      </h1>

      {/* 邀请语 */}
      <p
        className="text-[16px] leading-[1.8] mb-8 max-w-xs animate-fade-up"
        style={{
          color: '#8A857E',
          fontFamily: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
          animationDelay: '0.2s',
        }}
      >
        我是小耕，聊聊最近卡住你的事？
      </p>

      {/* 场景选择 */}
      <div className="w-full max-w-xs mb-8 animate-fade-up space-y-2" style={{ animationDelay: '0.25s' }}>
        {SCENES.map((s) => (
          <button
            key={s.key}
            className="w-full text-left px-4 py-3 rounded-[16px] transition-all active:scale-[0.98]"
            style={{
              backgroundColor: selected === s.key ? '#FFFFFF' : 'transparent',
              border: selected === s.key ? '2px solid #E8935A' : '1px solid #E5DFD8',
              boxShadow: selected === s.key ? '0 2px 8px rgba(61,54,48,0.08)' : 'none',
            }}
            onClick={() => setSelected(s.key)}
          >
            <div
              className="text-[16px] font-medium mb-0.5"
              style={{
                color: '#3D3630',
                fontFamily: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
              }}
            >
              {s.title}
            </div>
            <div
              className="text-[13px]"
              style={{
                color: '#8A857E',
                fontFamily: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
              }}
            >
              {s.desc}
            </div>
          </button>
        ))}
      </div>

      {/* 主按钮 */}
      <button
        className="w-56 h-12 rounded-[24px] text-[16px] font-medium transition-all active:scale-[0.98] animate-fade-up mb-12"
        style={{
          backgroundColor: '#E8935A',
          color: '#FFFFFF',
          fontFamily: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
          animationDelay: '0.35s',
        }}
        onClick={() => onEnter(selected)}
      >
        和小耕聊聊 →
      </button>

      {/* 底部副标 */}
      <p
        className="text-[13px] animate-fade-up"
        style={{
          color: '#8A857E',
          fontFamily: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
          animationDelay: '0.45s',
        }}
      >
        ABS：AI时代的结构化认知基本功
      </p>
    </div>
  );
}
