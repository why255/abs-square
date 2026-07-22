// ============================================================
// TypingIndicator — 小耕输入中动画
// 设计规范：三个呼吸圆点（暖阳橙 #E8935A，1.2s周期）
// ============================================================

export default function TypingIndicator() {
  return (
    <div className="flex justify-start animate-fade-up">
      <div
        className="px-4 py-3 rounded-[18px]"
        style={{
          backgroundColor: '#F3DDD0',
          color: '#3D3630',
          borderTopLeftRadius: '4px',
        }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full animate-breathe"
            style={{
              backgroundColor: '#E8935A',
              animationDelay: '0ms',
            }}
          />
          <span
            className="w-2 h-2 rounded-full animate-breathe"
            style={{
              backgroundColor: '#E8935A',
              animationDelay: '200ms',
            }}
          />
          <span
            className="w-2 h-2 rounded-full animate-breathe"
            style={{
              backgroundColor: '#E8935A',
              animationDelay: '400ms',
            }}
          />
        </div>
      </div>
    </div>
  );
}
