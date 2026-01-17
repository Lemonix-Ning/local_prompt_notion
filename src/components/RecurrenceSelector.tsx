/**
 * RecurrenceSelector 组件
 * 重复任务配置选择器
 * 
 * 设计说明：
 * - 一次性任务：使用"计划时间"，有明确截止日期
 * - 重复任务：使用本组件配置，每天/每周/每月固定时间提醒
 * - 两者互斥，启用重复任务后，计划时间将被忽略
 * 
 * 支持：
 * - 每日重复
 * - 每周特定日重复
 * - 每月特定日重复
 */

import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Repeat, Calendar, Clock } from 'lucide-react';
import type { RecurrenceConfig } from '../types';

interface RecurrenceSelectorProps {
  value?: RecurrenceConfig;
  onChange: (config: RecurrenceConfig | undefined) => void;
  /** 隐藏启用开关（当父组件控制启用状态时使用） */
  hideToggle?: boolean;
}

const WEEK_DAYS = [
  { value: 0, label: '日', short: '周日' },
  { value: 1, label: '一', short: '周一' },
  { value: 2, label: '二', short: '周二' },
  { value: 3, label: '三', short: '周三' },
  { value: 4, label: '四', short: '周四' },
  { value: 5, label: '五', short: '周五' },
  { value: 6, label: '六', short: '周六' },
];

export function RecurrenceSelector({ value, onChange, hideToggle = false }: RecurrenceSelectorProps) {
  const { theme } = useTheme();
  const [enabled, setEnabled] = useState(value?.enabled ?? false);
  const [type, setType] = useState<'daily' | 'weekly' | 'monthly'>(value?.type ?? 'daily');
  const [weekDays, setWeekDays] = useState<number[]>(value?.weekDays ?? [1, 2, 3, 4, 5]); // 默认工作日
  const [monthDays, setMonthDays] = useState<number[]>(value?.monthDays ?? [1]);
  const [time, setTime] = useState(value?.time ?? '09:00');

  // 同步外部值
  useEffect(() => {
    if (value) {
      setEnabled(value.enabled);
      setType(value.type);
      setWeekDays(value.weekDays ?? [1, 2, 3, 4, 5]);
      setMonthDays(value.monthDays ?? [1]);
      setTime(value.time);
    }
  }, [value]);

  // 更新配置
  const updateConfig = (updates: Partial<{
    enabled: boolean;
    type: 'daily' | 'weekly' | 'monthly';
    weekDays: number[];
    monthDays: number[];
    time: string;
  }>) => {
    const newEnabled = updates.enabled ?? enabled;
    const newType = updates.type ?? type;
    const newWeekDays = updates.weekDays ?? weekDays;
    const newMonthDays = updates.monthDays ?? monthDays;
    const newTime = updates.time ?? time;

    if (!newEnabled) {
      onChange(undefined);
      return;
    }

    onChange({
      type: newType,
      weekDays: newType === 'weekly' ? newWeekDays : undefined,
      monthDays: newType === 'monthly' ? newMonthDays : undefined,
      time: newTime,
      enabled: newEnabled,
    });
  };

  const toggleWeekDay = (day: number) => {
    const newDays = weekDays.includes(day)
      ? weekDays.filter(d => d !== day)
      : [...weekDays, day].sort((a, b) => a - b);
    setWeekDays(newDays);
    updateConfig({ weekDays: newDays });
  };

  const toggleMonthDay = (day: number) => {
    const newDays = monthDays.includes(day)
      ? monthDays.filter(d => d !== day)
      : [...monthDays, day].sort((a, b) => a - b);
    setMonthDays(newDays);
    updateConfig({ monthDays: newDays });
  };

  const bgColor = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
  const borderColor = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const textColor = theme === 'dark' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)';
  const mutedColor = theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const accentColor = '#f43f5e'; // rose-500

  // 当 hideToggle 为 true 时，直接显示配置（不显示开关）
  const showConfig = hideToggle ? true : enabled;

  return (
    <div style={{
      padding: '16px',
      borderRadius: '12px',
      background: bgColor,
      border: `1px solid ${borderColor}`,
    }}>
      {/* 启用开关 - 仅在 hideToggle 为 false 时显示 */}
      {!hideToggle && (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: enabled ? '16px' : '0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Repeat size={18} style={{ color: enabled ? accentColor : mutedColor }} />
          <span style={{ fontSize: '14px', fontWeight: 500, color: textColor }}>
            重复任务
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            const newEnabled = !enabled;
            setEnabled(newEnabled);
            updateConfig({ enabled: newEnabled });
          }}
          style={{
            width: '44px',
            height: '24px',
            borderRadius: '12px',
            background: enabled ? accentColor : (theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'),
            border: 'none',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background 0.2s',
          }}
        >
          <div style={{
            width: '20px',
            height: '20px',
            borderRadius: '10px',
            background: '#fff',
            position: 'absolute',
            top: '2px',
            left: enabled ? '22px' : '2px',
            transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }} />
        </button>
      </div>
      )}

      {/* 配置选项 */}
      {showConfig && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 重复类型 */}
          <div>
            <label style={{ fontSize: '12px', color: mutedColor, marginBottom: '8px', display: 'block' }}>
              重复频率
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['daily', 'weekly', 'monthly'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t);
                    updateConfig({ type: t });
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${type === t ? accentColor : borderColor}`,
                    background: type === t ? `${accentColor}20` : 'transparent',
                    color: type === t ? accentColor : textColor,
                    fontSize: '13px',
                    fontWeight: type === t ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {t === 'daily' ? '每天' : t === 'weekly' ? '每周' : '每月'}
                </button>
              ))}
            </div>
          </div>

          {/* 每周选择 */}
          {type === 'weekly' && (
            <div>
              <label style={{ fontSize: '12px', color: mutedColor, marginBottom: '8px', display: 'block' }}>
                选择星期
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {WEEK_DAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleWeekDay(day.value)}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      border: `1px solid ${weekDays.includes(day.value) ? accentColor : borderColor}`,
                      background: weekDays.includes(day.value) ? `${accentColor}20` : 'transparent',
                      color: weekDays.includes(day.value) ? accentColor : textColor,
                      fontSize: '13px',
                      fontWeight: weekDays.includes(day.value) ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    title={day.short}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 每月选择 */}
          {type === 'monthly' && (
            <div>
              <label style={{ fontSize: '12px', color: mutedColor, marginBottom: '8px', display: 'block' }}>
                选择日期
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '4px',
              }}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleMonthDay(day)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      border: `1px solid ${monthDays.includes(day) ? accentColor : borderColor}`,
                      background: monthDays.includes(day) ? `${accentColor}20` : 'transparent',
                      color: monthDays.includes(day) ? accentColor : textColor,
                      fontSize: '12px',
                      fontWeight: monthDays.includes(day) ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 触发时间 */}
          <div>
            <label style={{ fontSize: '12px', color: mutedColor, marginBottom: '8px', display: 'block' }}>
              提醒时间
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '8px',
                border: `1px solid ${borderColor}`,
                background: theme === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.8)',
                cursor: 'pointer',
              }}
              onClick={() => {
                const input = document.getElementById('recurrence-time-input') as HTMLInputElement;
                input?.showPicker?.();
              }}
            >
              <Clock size={16} style={{ color: accentColor }} />
              <input
                id="recurrence-time-input"
                type="time"
                value={time}
                onChange={(e) => {
                  setTime(e.target.value);
                  updateConfig({ time: e.target.value });
                }}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: textColor,
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  pointerEvents: 'none',
                }}
                tabIndex={-1}
              />
            </div>
          </div>

          {/* 预览 */}
          <div style={{
            padding: '12px',
            borderRadius: '8px',
            background: `${accentColor}10`,
            border: `1px solid ${accentColor}30`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={14} style={{ color: accentColor }} />
              <span style={{ fontSize: '12px', color: accentColor, fontWeight: 500 }}>
                {getRecurrenceDescription({ type, weekDays, monthDays, time, enabled })}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 生成重复规则描述
function getRecurrenceDescription(config: RecurrenceConfig): string {
  if (!config.enabled) return '未启用';

  const timeStr = config.time;

  switch (config.type) {
    case 'daily':
      return `每天 ${timeStr} 提醒`;
    case 'weekly':
      if (!config.weekDays || config.weekDays.length === 0) {
        return `每周 ${timeStr} 提醒`;
      }
      const dayNames = config.weekDays.map(d => WEEK_DAYS.find(w => w.value === d)?.short || '').join('、');
      return `每${dayNames} ${timeStr} 提醒`;
    case 'monthly':
      if (!config.monthDays || config.monthDays.length === 0) {
        return `每月 ${timeStr} 提醒`;
      }
      const days = config.monthDays.join('、');
      return `每月 ${days} 日 ${timeStr} 提醒`;
    default:
      return '未知规则';
  }
}

// 导出描述函数供其他组件使用
export { getRecurrenceDescription };
