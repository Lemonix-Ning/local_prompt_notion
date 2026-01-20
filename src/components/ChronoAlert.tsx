/**
 * ChronoAlert 组件
 * 时空警报 - 顶部悬浮的任务提醒
 * 
 * 设计理念：
 * - Top-Center Floating: 顶部居中悬浮，既显眼又不遮挡主内容
 * - Auto-Dismiss: 5 秒后自动关闭（用户也可以手动关闭）
 * - Focus Entry: 点击后直接进入专注模式（定位+高亮）
 */

import { Bell, X, Zap, Target } from 'lucide-react';
import { useEffect } from 'react';
import { PromptData } from '../types';

interface ChronoAlertProps {
  task: PromptData;
  onFocus: () => void;
  onDismiss: () => void;
}

export const ChronoAlert = ({ task, onFocus, onDismiss }: ChronoAlertProps) => {
  // 🔥 5 秒后自动关闭
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onDismiss]);
  return (
    <div className="fixed top-4 left-1/2 z-[999999] animate-slide-down">
      {/* 外层光晕 */}
      <div className="absolute inset-0 bg-rose-500/20 rounded-full blur-xl animate-pulse" />
      
      {/* 主体容器 */}
      <div className="relative bg-gradient-to-r from-zinc-900/98 via-zinc-900/95 to-zinc-900/98 border border-rose-500/40 text-white shadow-2xl backdrop-blur-xl rounded-full px-5 py-2.5 flex gap-3 items-center hover:border-rose-500/60 transition-all duration-300 hover:shadow-rose-500/20 hover:shadow-lg">
        
        {/* 左侧：心跳图标 */}
        <div className="relative flex items-center justify-center w-8 h-8">
          {/* 多层脉冲动画 */}
          <div className="absolute inset-0 bg-rose-500 rounded-full animate-ping opacity-20" />
          <div className="absolute inset-1 bg-rose-500 rounded-full animate-ping opacity-30" style={{ animationDelay: '0.2s' }} />
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/30 to-red-600/30 rounded-full" />
          <Bell size={14} className="relative z-10 text-rose-300" />
        </div>

        {/* 中间：任务信息 */}
        <div className="flex flex-col gap-0.5 min-w-0">
          {/* 状态标签 */}
          <div className="flex items-center gap-1.5">
            <Zap size={10} className="text-rose-400 animate-pulse" />
            <span className="text-[9px] font-mono font-bold tracking-widest text-rose-400 uppercase">
              MISSION CRITICAL
            </span>
          </div>
          {/* 任务标题 */}
          <span className="text-sm font-medium text-white/90 truncate max-w-[200px]">
            {task.meta.title}
          </span>
        </div>

        {/* 右侧：操作按钮 */}
        <div className="flex items-center gap-2 ml-2">
          {/* FOCUS 按钮 */}
          <button
            onClick={onFocus}
            className="group relative px-4 py-1.5 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white text-xs font-bold rounded-full transition-all duration-300 flex items-center gap-1.5 shadow-lg shadow-rose-500/30 hover:shadow-rose-500/50 hover:scale-105"
          >
            <Target size={12} className="group-hover:animate-pulse" />
            <span className="tracking-wider">FOCUS</span>
          </button>

          {/* 关闭按钮 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
