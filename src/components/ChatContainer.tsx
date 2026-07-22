'use client';

// ============================================================
// ChatContainer — 对话主容器（P2 对话页）
// 设计规范：米白背景，顶栏极简，消息逐条上浮淡入
// ============================================================

import { useState, useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';
import SolutionPage from './SolutionPage';
import type { Stage, SPlan } from '@/types';
import type { Scenario } from '@/app/page';

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SCENE_OPENINGS: Record<Scenario, string> = {
  F: '嗨，我是小耕。\n\n最近是不是有那么些瞬间，会突然心里一空，想："我这一年，到底往前走了吗？"\n\n没事儿，咱们就当朋友聊天，慢慢说——你现在工作状态怎么样？最近是特别忙，还是有点闲？',
  C: '嗨，我是小耕。\n\n最近是不是有那么些瞬间，打开招聘网站，看着那几十份简历，却觉得"没有一份对得上"？\n\n没事儿，咱们当朋友聊天——你最近在招什么岗位？卡在哪一步了？',
};

const SCENE_LABELS: Record<Scenario, string> = {
  F: '职业迷茫',
  C: '招不到人',
};

interface ChatContainerProps {
  scenario: Scenario;
}

export default function ChatContainer({ scenario }: ChatContainerProps) {
  const DEFAULT_OPENING: DisplayMessage = {
    id: '0',
    role: 'assistant',
    content: SCENE_OPENINGS[scenario],
  };

  const [messages, setMessages] = useState<DisplayMessage[]>([DEFAULT_OPENING]);
  const [isLoading, setIsLoading] = useState(false);
  const [stage, setStage] = useState<Stage>('A');
  const [sPlan, setSPlan] = useState<SPlan | null>(null);
  const [sessionId] = useState(() => {
    if (typeof window !== 'undefined') {
      const key = `abs_session_${scenario}`;
      let id = localStorage.getItem(key);
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(key, id);
      }
      return id;
    }
    return '';
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 页面加载时从后端恢复对话历史（支撑30天回访）
  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        const res = await fetch(`/api/chat?session_id=${encodeURIComponent(sessionId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          setMessages(
            data.messages.map((m: { id: string; role: string; content: string }) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
            }))
          );
        }
        if (data.stage) setStage(data.stage);
      } catch {
        // 恢复失败则保留默认开场白
      }
    })();
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text: string) => {
    const userMsg: DisplayMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: text, scenario }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const assistantMsg: DisplayMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (data.stage) setStage(data.stage);

      // S方案包生成 → 0.8s后展示P3（让小耕的最后一条消息先呈现）
      if (data.s_plan) {
        setTimeout(() => setSPlan(data.s_plan), 800);
      }
    } catch {
      const errorMsg: DisplayMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '信号不太好，我们稍等它一下',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // P3：方案包展示（收到 s_plan 后自动切换）
  if (sPlan) {
    return <SolutionPage plan={sPlan} onClose={() => setSPlan(null)} />;
  }

  return (
    <div className="flex flex-col h-screen max-w-[640px] mx-auto">
      {/* 顶栏 */}
      <header
        className="flex-shrink-0 px-6 py-4 flex items-center gap-3"
        style={{ borderBottom: '1px solid #E5DFD8' }}
      >
        {/* 小耕头像占位：暖阳橙圆底 + 白色宋体"耕"字 */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: '#E8935A' }}
        >
          <span
            className="text-white text-base font-medium"
            style={{ fontFamily: '"Noto Serif SC", "STSong", serif' }}
          >
            耕
          </span>
        </div>
        <div className="flex-1">
          <span
            className="text-[17px] font-medium"
            style={{ color: '#3D3630', fontFamily: '"Noto Serif SC", serif' }}
          >
            小耕
          </span>
          <span
            className="ml-2 text-[13px]"
            style={{ color: '#8A857E' }}
          >
            ● 在线
          </span>
          <span
            className="ml-1 text-[12px] px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: '#FAF6F0',
              color: '#8A857E',
              border: '1px solid #E5DFD8',
            }}
          >
            {SCENE_LABELS[scenario]}
          </span>
        </div>
        {stage && stage !== 'A' && (
          <span
            className="px-2.5 py-0.5 text-[13px] rounded-full"
            style={{
              backgroundColor: '#FAF6F0',
              color: '#8A857E',
              border: '1px solid #E5DFD8',
            }}
          >
            {stage === 'B' ? '澄清中' : (stage === 'S' || stage === 'done') ? '方案生成' : ''}
          </span>
        )}
      </header>

      {/* 消息列表 */}
      <main className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div
            className="text-center py-20 text-[16px]"
            style={{ color: '#8A857E' }}
          >
            还没有聊过呢，和小耕说第一句话吧
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
        ))}
        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </main>

      {/* 底部输入区 */}
      <footer
        className="flex-shrink-0"
        style={{ borderTop: '1px solid #E5DFD8' }}
      >
        <ChatInput onSend={handleSend} disabled={isLoading || stage === 'done'} stage={stage} />
      </footer>
    </div>
  );
}
