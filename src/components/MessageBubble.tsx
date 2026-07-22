// ============================================================
// MessageBubble — 单条消息气泡
// 设计规范：小耕=雾粉底+思源宋体 / 用户=白底+思源黑体
// ============================================================

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
}

export default function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-up`}
    >
      <div
        className="max-w-[80%] px-4 py-3 rounded-[18px] text-[17px] leading-[1.8]"
        style={{
          fontFamily: isUser
            ? '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif'
            : '"Noto Serif SC", "PingFang SC", "STSong", serif',
          backgroundColor: isUser ? '#FFFFFF' : '#F3DDD0',
          color: '#3D3630',
          borderTopLeftRadius: isUser ? '18px' : '4px',
          borderTopRightRadius: isUser ? '4px' : '18px',
          boxShadow: isUser ? '0 1px 3px rgba(61,54,48,0.08)' : 'none',
        }}
      >
        <span>{content}</span>
      </div>
    </div>
  );
}
