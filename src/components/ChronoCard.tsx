/**
 * ChronoCard 组件
 * 时空流卡片 - 带实时倒计时的任务卡片视觉元素
 * 
 * 设计理念：
 * - Live Countdown: 每秒刷新的倒计时仪表盘
 * - Visual Heartbeat: 边框和角标的呼吸效果
 * - Scanline: CRT 风格的扫描线动画，增加科技感
 */

import { memo } from 'react';
import { Clock, AlertCircle, Zap } from 'lucide-react';
import { useCountdown } from '../hooks/useCountdown';

interface ChronoCardProps {
  targetDate: string;
  startDate?: string;
  isUrgent?: boolean;
  compact?: boolean; // 紧凑模式，用于卡片内显示
  invertProgress?: boolean;
  recurrence?: { type: 'interval'; intervalMinutes: number }; // 新增：重复配置
}

const ChronoCardComponent = ({ targetDate, startDate, isUrgent, compact = false, invertProgress = false, recurrence }: ChronoCardProps) => {
  const countdown = useCountdown(targetDate, startDate, recurrence);

  const displayProgress = invertProgress ? Math.max(0, Math.min(100, 100 - countdown.progress)) : countdown.progress;

  // 格式化时间显示
  const formatTime = () => {
    if (countdown.isExpired) {
      return 'EXPIRED';
    }

    if (countdown.days > 0) {
      return `${countdown.days}d ${String(countdown.hours).padStart(2, '0')}:${String(countdown.minutes).padStart(2, '0')}:${String(countdown.seconds).padStart(2, '0')}`;
    }
    
    return `${String(countdown.hours).padStart(2, '0')}:${String(countdown.minutes).padStart(2, '0')}:${String(countdown.seconds).padStart(2, '0')}`;
  };

  // 获取状态颜色
  const getStatusColor = () => {
    if (countdown.isExpired) return 'rose';
    if (countdown.totalSeconds < 3600) return 'rose'; // < 1 hour
    if (countdown.totalSeconds < 86400) return 'orange'; // < 1 day
    return 'cyan';
  };

  const statusColor = getStatusColor();

  // 紧凑模式 - 用于卡片内显示
  if (compact) {
    return (
      <div className="chrono-compact flex items-center gap-2 px-2 py-1 rounded-md bg-muted/60 dark:bg-zinc-900/60 border border-border dark:border-zinc-700/50">
        <div className="relative">
          {countdown.isExpired ? (
            <AlertCircle size={12} className="text-rose-500" />
          ) : (
            <>
              {statusColor === 'rose' && (
                <div className="absolute inset-0 bg-rose-500 rounded-full animate-ping opacity-30" />
              )}
              <Clock size={12} className={`relative z-10 text-${statusColor}-400`} />
            </>
          )}
        </div>
        <span
          className={`text-[10px] font-mono font-bold tracking-wider ${
            statusColor === 'rose'
              ? 'text-rose-400'
              : statusColor === 'orange'
              ? 'text-orange-400'
              : 'text-cyan-400'
          }`}
        >
          {formatTime()}
        </span>
        {/* 迷你进度条 */}
        {startDate && !countdown.isExpired && (
          <div className="w-8 h-1 bg-muted dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${
                statusColor === 'rose'
                  ? 'bg-rose-500'
                  : statusColor === 'orange'
                  ? 'bg-orange-500'
                  : 'bg-cyan-500'
              }`}
              style={{ width: `${displayProgress}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  // 完整模式 - HUD 风格显示
  return (
    <div className={`chrono-card relative rounded-lg overflow-hidden ${
      statusColor === 'rose' 
        ? 'bg-gradient-to-br from-zinc-900/90 via-rose-950/20 to-zinc-900/90 border border-rose-500/40' 
        : statusColor === 'orange'
        ? 'bg-gradient-to-br from-zinc-900/90 via-orange-950/20 to-zinc-900/90 border border-orange-500/30'
        : 'bg-gradient-to-br from-zinc-900/90 via-cyan-950/20 to-zinc-900/90 border border-cyan-500/30'
    }`}>
      {/* 扫描线动画 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="scan-line opacity-50" />
      </div>

      {/* 顶部状态栏 */}
      <div className={`px-3 py-1.5 border-b ${
        statusColor === 'rose' 
          ? 'border-rose-500/30 bg-rose-500/10' 
          : statusColor === 'orange'
          ? 'border-orange-500/20 bg-orange-500/5'
          : 'border-cyan-500/20 bg-cyan-500/5'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {/* 状态指示灯 */}
            <div className="relative">
              {(isUrgent || countdown.isExpired || statusColor === 'rose') && (
                <div className={`absolute inset-0 rounded-full animate-ping opacity-50 ${
                  countdown.isExpired ? 'bg-rose-500' : 'bg-rose-400'
                }`} />
              )}
              <div className={`w-1.5 h-1.5 rounded-full ${
                countdown.isExpired 
                  ? 'bg-rose-500' 
                  : statusColor === 'rose'
                  ? 'bg-rose-400 animate-pulse'
                  : statusColor === 'orange'
                  ? 'bg-orange-400'
                  : 'bg-cyan-400'
              }`} />
            </div>
            <span className={`text-[9px] font-mono font-bold tracking-widest uppercase ${
              countdown.isExpired 
                ? 'text-rose-400' 
                : statusColor === 'rose'
                ? 'text-rose-400'
                : statusColor === 'orange'
                ? 'text-orange-400'
                : 'text-cyan-400'
            }`}>
              {countdown.isExpired ? 'EXPIRED' : statusColor === 'rose' ? 'CRITICAL' : 'ACTIVE'}
            </span>
          </div>
          {/* 闪电图标 - 紧急任务 */}
          {(isUrgent || statusColor === 'rose') && !countdown.isExpired && (
            <Zap size={10} className="text-rose-400 animate-pulse" />
          )}
        </div>
      </div>

      {/* HUD 倒计时显示 */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2">
          {countdown.isExpired ? (
            <AlertCircle size={16} className="text-rose-500" />
          ) : (
            <Clock size={16} className={`${
              statusColor === 'rose' ? 'text-rose-400' : statusColor === 'orange' ? 'text-orange-400' : 'text-cyan-400'
            }`} />
          )}
          <span
            className={`text-base font-mono font-bold tracking-wider ${
              countdown.isExpired
                ? 'text-rose-400'
                : statusColor === 'rose'
                ? 'text-rose-400'
                : statusColor === 'orange'
                ? 'text-orange-400'
                : 'text-cyan-400'
            }`}
            style={{ textShadow: `0 0 10px ${statusColor === 'rose' ? 'rgba(244,63,94,0.5)' : statusColor === 'orange' ? 'rgba(249,115,22,0.5)' : 'rgba(34,211,238,0.3)'}` }}
          >
            {formatTime()}
          </span>
        </div>

        {/* 进度条 */}
        {startDate && !countdown.isExpired && (
          <div className="mt-2 w-full h-1.5 bg-zinc-800/80 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 rounded-full ${
                statusColor === 'rose'
                  ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-red-400'
                  : statusColor === 'orange'
                  ? 'bg-gradient-to-r from-orange-600 via-orange-500 to-amber-400'
                  : 'bg-gradient-to-r from-cyan-600 via-cyan-500 to-blue-400'
              }`}
              style={{ 
                width: `${displayProgress}%`,
                boxShadow: `0 0 8px ${statusColor === 'rose' ? 'rgba(244,63,94,0.6)' : statusColor === 'orange' ? 'rgba(249,115,22,0.6)' : 'rgba(34,211,238,0.4)'}`
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// Memoize ChronoCard to prevent unnecessary re-renders
// Only re-render when props actually change
export const ChronoCard = memo(ChronoCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.targetDate === nextProps.targetDate &&
    prevProps.startDate === nextProps.startDate &&
    prevProps.isUrgent === nextProps.isUrgent &&
    prevProps.compact === nextProps.compact &&
    prevProps.invertProgress === nextProps.invertProgress &&
    prevProps.recurrence?.type === nextProps.recurrence?.type &&
    prevProps.recurrence?.intervalMinutes === nextProps.recurrence?.intervalMinutes
  );
});

ChronoCard.displayName = 'ChronoCard';
