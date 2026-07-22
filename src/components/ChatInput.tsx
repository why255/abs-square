'use client';

// ============================================================
// ChatInput — 底部输入区
// 设计规范：圆角24px，placeholder随阶段变化
// ============================================================

import { useState, useRef, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  stage?: string; // A | B | S | done
}

const PLACEHOLDERS: Record<string, string> = {
  A: '慢慢说，我在听…',
  B: '想到哪说到哪…',
  S: '小耕正在为你整理方案…',
  done: '对话已结束',
};

export default function ChatInput({ onSend, disabled, stage = 'A' }: ChatInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  };

  const placeholder = PLACEHOLDERS[stage] || PLACEHOLDERS.A;

  return (
    <div className="flex items-end gap-3 px-4 py-3">
      <textarea
        ref={inputRef}
        className="flex-1 resize-none rounded-[24px] border px-5 py-2.5 text-[17px] leading-[1.8] placeholder-gray-400 focus:outline-none focus:ring-1 transition-colors"
        style={{
          fontFamily: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
          backgroundColor: '#FFFFFF',
          borderColor: '#E5DFD8',
          color: '#3D3630',
        }}
        rows={1}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          handleInput();
        }}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
      <button
        className="flex-shrink-0 px-6 h-12 rounded-[24px] text-[16px] font-medium transition-all active:scale-[0.98]"
        style={{
          fontFamily: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
          backgroundColor: disabled || !value.trim() ? '#E5DFD8' : '#E8935A',
          color: disabled || !value.trim() ? '#8A857E' : '#FFFFFF',
          cursor: disabled || !value.trim() ? 'not-allowed' : 'pointer',
        }}
        onClick={handleSend}
        disabled={disabled || !value.trim()}
      >
        发送
      </button>
    </div>
  );
}
