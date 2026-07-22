'use client';

// ============================================================
// P1 进入页（落地页）
// 设计规范 V1.0：一个按钮走天下
// ============================================================

interface LandingPageProps {
  onEnter: () => void;
}

export default function LandingPage({ onEnter }: LandingPageProps) {
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
        className="text-[16px] leading-[1.8] mb-10 max-w-xs animate-fade-up"
        style={{
          color: '#8A857E',
          fontFamily: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
          animationDelay: '0.2s',
        }}
      >
        我是小耕，最近是不是有那么些瞬间，会突然心里一空？
      </p>

      {/* 主按钮 */}
      <button
        className="w-56 h-12 rounded-[24px] text-[16px] font-medium transition-all active:scale-[0.98] animate-fade-up mb-12"
        style={{
          backgroundColor: '#E8935A',
          color: '#FFFFFF',
          fontFamily: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
          animationDelay: '0.3s',
        }}
        onClick={onEnter}
      >
        和小耕聊聊 →
      </button>

      {/* 底部副标 */}
      <p
        className="text-[13px] animate-fade-up"
        style={{
          color: '#8A857E',
          fontFamily: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
          animationDelay: '0.4s',
        }}
      >
        ABS：AI时代的结构化认知基本功
      </p>
    </div>
  );
}
