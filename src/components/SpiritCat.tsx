import { motion, AnimatePresence, type MotionValue } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { LumiAction } from '../contexts/LumiContext';

export type LumiOrientation = 'bottom' | 'left' | 'right' | 'top';

type SpiritMode =
  | 'idle'
  | 'sleep'
  | 'windy'
  | 'dragging'
  | 'chat'
  | 'countdown'
  | 'schedule'
  | 'importing'
  | 'exporting'
  | LumiAction;

interface SpiritCatProps {
  orientation: LumiOrientation;
  mode: SpiritMode;
  theme: 'light' | 'dark';
  pupilX?: MotionValue<number> | null;
  pupilY?: MotionValue<number> | null;
  isWindy: boolean;
  isSleeping: boolean;
  isThinking?: boolean;
}

export function SpiritCat({
  orientation,
  mode,
  theme,
  pupilX,
  pupilY,
  isWindy,
  isSleeping,
  isThinking = false,
}: SpiritCatProps) {
  const [internalBlink, setInternalBlink] = useState(false);

  useEffect(() => {
    if (
      mode === 'sleep' ||
      mode === 'delete' ||
      mode === 'search' ||
      mode === 'countdown' ||
      mode === 'dragging' ||
      mode === 'pin' ||
      mode === 'update' ||
      mode === 'clipboard' ||
      mode === 'rename' ||
      mode === 'create_card' ||
      mode === 'create_folder'
    ) {
      setInternalBlink(false);
      return;
    }
    const timer = window.setInterval(() => {
      setInternalBlink(true);
      window.setTimeout(() => setInternalBlink(false), 200);
    }, 4000 + Math.random() * 2000);
    return () => window.clearInterval(timer);
  }, [mode]);

  const isBlinking = internalBlink;

  const colors = {
    body: theme === 'dark' ? '#E2E8F0' : '#334155',
    stroke: theme === 'dark' ? '#94A3B8' : '#1E293B',
    paw: theme === 'dark' ? '#E2E8F0' : '#334155',
    eyeNormal: theme === 'dark' ? '#FBBF24' : '#F59E0B',
    eyeSleep: theme === 'dark' ? '#94A3B8' : '#475569',
    eyeSearch: '#10B981',
    eyeCreate: '#22D3EE',
    eyeFolder: '#F97316',
    eyeDelete: '#EF4444',
    eyeMagic: '#2DD4BF',
    eyeLove: '#EC4899',
    eyePin: '#F59E0B',
    eyeRename: '#A855F7',
    eyeThinking: '#22D3EE',
    eyeImport: '#22C55E',
    eyeExport: '#3B82F6',
    eyeCountdown: '#F97316',
    eyeSchedule: '#60A5FA',
    eyeSuccess: '#10B981',
  };

  let eyeColor = colors.eyeNormal;
  if (mode === 'sleep') eyeColor = colors.eyeSleep;
  if (mode === 'search') eyeColor = colors.eyeSearch;
  if (mode === 'create_card') eyeColor = colors.eyeCreate;
  if (mode === 'create_folder') eyeColor = colors.eyeFolder;
  if (mode === 'delete') eyeColor = colors.eyeDelete;
  if (mode === 'restore') eyeColor = colors.eyeMagic;
  if (mode === 'favorite') eyeColor = colors.eyeLove;
  if (mode === 'pin') eyeColor = colors.eyePin;
  if (mode === 'rename') eyeColor = colors.eyeRename;
  if (mode === 'importing') eyeColor = colors.eyeImport;
  if (mode === 'exporting') eyeColor = colors.eyeExport;
  if (mode === 'countdown') eyeColor = colors.eyeCountdown;
  if (mode === 'schedule') eyeColor = colors.eyeSchedule;
  if (mode === 'update' || mode === 'clipboard') eyeColor = colors.eyeSuccess;
  const isThinkingIdle = isThinking && (mode === 'idle' || mode === 'chat');
  if (isThinkingIdle) eyeColor = colors.eyeThinking;

  const bodyAnimation =
    mode === 'sleep'
      ? { scaleY: 0.95 }
                    : mode === 'windy'
                    ? { y: 4, scaleY: 0.95 }
        : mode === 'dragging'
          ? { y: 6 }
          : mode === 'create_card'
            ? { y: [0, -15, 0], scale: [1, 1.1, 1] }
            : mode === 'create_folder'
              ? { rotate: [0, -5, 5, -5, 5, 0] }
                : mode === 'update'
                  ? { y: [0, 6, 0], scaleY: [1, 0.92, 1] }
                  : mode === 'clipboard'
                    ? { y: [0, 8, 0] }
                    : mode === 'delete'
                      ? { rotate: [0, -5, 5, -5, 5, 0] }
                  : mode === 'restore'
                    ? { y: -15, rotate: [0, -2, 2, 0] }
                    : mode === 'favorite'
                      ? { scaleX: 0.9, scaleY: 1.05, y: -5 }
                      : mode === 'pin'
                        ? { y: -20, scaleY: 1.15, scaleX: 0.9 }
                        : mode === 'importing'
                          ? { scaleY: [1, 1.1, 0.85, 1], scaleX: [1, 0.9, 1.1, 1] }
                          : mode === 'exporting'
                            ? { scaleY: [1, 0.8, 1.2, 1], scaleX: [1, 1.2, 0.8, 1], y: [0, 5, -20, 0] }
                            : mode === 'countdown'
                              ? { x: [-2, 2, -2, 2, 0], scale: [1, 1.05, 1] }
                              : mode === 'schedule'
                                ? { y: [0, -10, 0], scaleY: [1, 1.05, 0.95, 1] }
                                : mode === 'rename'
                                  ? { x: [-2, 2, -2, 2, 0], scale: [1, 1.02, 1] }
        : mode === 'chat'
          ? { y: [0, -6, 0] }
        : orientation !== 'bottom'
          ? { y: [-4, 4, -4] }
          : { scaleY: [1, 0.985, 1] };

  const bodyTransition = {
    default: { duration: 0.3 },
    y: {
      duration: mode === 'chat' ? 0.3 : mode === 'idle' || mode === 'restore' ? 3 : 0.3,
      repeat: mode === 'chat' ? 2 : mode === 'idle' || mode === 'restore' ? Infinity : 0,
      ease: [0.42, 0, 0.58, 1] as [number, number, number, number],
    },
    x: {
      duration: mode === 'countdown' ? 0.1 : mode === 'rename' ? 0.4 : 0.3,
      repeat: mode === 'countdown' ? Infinity : 0,
      ease: [0.42, 0, 0.58, 1] as [number, number, number, number],
    },
  };

  const eyeRy = isWindy ? 2 : isSleeping || isBlinking ? 0.5 : mode === 'dragging' ? 10 : 8;
  const eyeBaseCy =
    mode === 'pin' ? 40 : mode === 'importing' ? 55 : mode === 'exporting' ? 45 : 50;
  const eyeHighlightCy =
    mode === 'pin' ? 36 : mode === 'importing' ? 51 : mode === 'exporting' ? 41 : 46;
  const idleBodyPath = 'M 50 20 C 75 20 85 40 85 60 C 85 85 70 95 50 95 C 30 95 15 85 15 60 C 15 40 25 20 50 20 Z';
  const thinkingBodyPath = 'M 50 15 C 80 15 90 35 90 60 C 90 90 70 90 50 95 C 30 90 10 90 10 60 C 10 35 20 15 50 15 Z';
  const outerRingRotation = mode === 'restore' ? -360 : 360;
  const outerRingDuration =
    mode === 'delete'
      ? 4
      : mode === 'countdown'
        ? 4
        : mode === 'favorite'
          ? 12
          : mode === 'update'
            ? 0.6
            : isThinkingIdle
              ? 6
              : 10;
  const outerRingRepeat = mode === 'update' ? 0 : Infinity;
  const outerRingScale = mode === 'rename' ? [1, 1.08, 1] : mode !== 'idle' && mode !== 'sleep' ? 1.2 : 1;
  const innerRingDuration = isThinkingIdle ? 8 : 15;

  return (
    <motion.div
      className="relative w-full h-full"
      animate={orientation}
      variants={{
        bottom: { rotate: 0 },
        left: { rotate: 0 },
        right: { rotate: 0 },
        top: { rotate: 0 },
      }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      <motion.div className="w-full h-full" style={{ transformOrigin: 'bottom center' }} animate={bodyAnimation} transition={bodyTransition}>
        <motion.div
          className={`absolute inset-0 rounded-full border-2 border-dashed ${theme === 'dark' ? 'border-indigo-400/50' : 'border-cyan-400/30'}`}
          animate={{
            rotate: outerRingRotation,
            scale: outerRingScale,
            opacity: mode === 'sleep' ? 0 : mode !== 'idle' ? 0.8 : 0.2,
            borderColor: mode !== 'idle' ? eyeColor : undefined,
          }}
          transition={{
            rotate: { duration: outerRingDuration, repeat: outerRingRepeat, ease: 'linear' },
            scale: { duration: 0.6, repeat: mode === 'rename' ? Infinity : 0, ease: 'easeInOut' },
          }}
        />
        <motion.div
          className={`absolute inset-2 rounded-full border ${theme === 'dark' ? 'border-indigo-400/30' : 'border-cyan-400/20'}`}
          animate={{
            rotate: -360,
            opacity: mode === 'sleep' ? 0 : mode !== 'idle' ? 0.6 : 0.15,
          }}
          transition={{ rotate: { duration: innerRingDuration, repeat: Infinity, ease: 'linear' } }}
        />
        <motion.svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl relative z-10">
          <motion.g>
            <AnimatePresence>
              {mode === 'favorite' && (
                <motion.path
                  d="M 50 18 C 47 14 40 14 40 22 C 40 28 50 34 50 34 C 50 34 60 28 60 22 C 60 14 53 14 50 18"
                  fill={eyeColor}
                  initial={{ opacity: 0, y: 6, scale: 0.8 }}
                  animate={{ opacity: 0.9, y: -8, scale: 1 }}
                  exit={{ opacity: 0, y: -16, scale: 0.8 }}
                  transition={{ duration: 1 }}
                />
              )}
            </AnimatePresence>
            <motion.path
              d="M 50 85 Q 80 100 90 80"
              stroke={colors.body}
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              animate={
                mode === 'update'
                  ? { d: 'M 50 85 Q 50 80 50 70' }
                  : isWindy
                    ? { d: 'M 50 85 Q 90 85 95 75' }
                    : { d: ['M 50 85 Q 80 100 90 80', 'M 50 85 Q 90 90 95 70', 'M 50 85 Q 80 100 90 80'] }
              }
              transition={{ duration: mode === 'sleep' ? 6 : 3, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.path
              d={idleBodyPath}
              animate={{ d: isThinkingIdle ? thinkingBodyPath : idleBodyPath }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              fill={colors.body}
              stroke={colors.stroke}
              strokeWidth="2"
            />
            <motion.path
              animate={{ d: isWindy ? 'M 30 25 L 15 20 L 45 22' : 'M 30 25 L 20 5 L 45 22' }}
              fill={colors.body}
              stroke={colors.stroke}
              strokeWidth="2"
              transition={{ duration: 0.2 }}
            />
            <motion.path
              animate={{ d: isWindy ? 'M 70 25 L 85 20 L 55 22' : 'M 70 25 L 80 5 L 55 22' }}
              fill={colors.body}
              stroke={colors.stroke}
              strokeWidth="2"
              transition={{ duration: 0.2 }}
            />
            <g transform="translate(0, 5)">
              {mode === 'create_card' && (
                <g stroke={eyeColor} strokeWidth="3" strokeLinecap="round">
                  <path d="M 35 46 V 54" />
                  <path d="M 31 50 H 39" />
                  <path d="M 65 46 V 54" />
                  <path d="M 61 50 H 69" />
                </g>
              )}
              {mode === 'create_folder' && (
                <g fill={eyeColor}>
                  <rect x="31" y="46" width="8" height="8" rx="1" />
                  <rect x="61" y="46" width="8" height="8" rx="1" />
                </g>
              )}
              {(mode === 'update' || mode === 'clipboard') && (
                <g stroke={eyeColor} strokeWidth="3" strokeLinecap="round" fill="none">
                  <path d="M 28 50 L 33 55 L 42 45" />
                  <path d="M 58 50 L 63 55 L 72 45" />
                </g>
              )}
              {mode === 'delete' && (
                <g stroke={eyeColor} strokeWidth="3" strokeLinecap="round">
                  <path d="M 30 46 L 40 56" />
                  <path d="M 40 46 L 30 56" />
                  <path d="M 60 46 L 70 56" />
                  <path d="M 70 46 L 60 56" />
                </g>
              )}
              {mode === 'restore' && (
                <g fill={eyeColor}>
                  <motion.path
                    d="M 35 44 L 36.5 48.5 L 41 50 L 36.5 51.5 L 35 56 L 33.5 51.5 L 29 50 L 33.5 48.5 Z"
                    animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
                    style={{ transformOrigin: '35px 50px' }}
                  />
                  <motion.path
                    d="M 65 44 L 66.5 48.5 L 71 50 L 66.5 51.5 L 65 56 L 63.5 51.5 L 59 50 L 63.5 48.5 Z"
                    animate={{ rotate: -360, scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
                    style={{ transformOrigin: '65px 50px' }}
                  />
                </g>
              )}
              {mode === 'favorite' && (
                <g fill={eyeColor}>
                  <path d="M 35 47 C 32 44 27 47 30 51 C 33 55 35 58 35 58 C 35 58 37 55 40 51 C 43 47 38 44 35 47" />
                  <path d="M 65 47 C 62 44 57 47 60 51 C 63 55 65 58 65 58 C 65 58 67 55 70 51 C 73 47 68 44 65 47" />
                  <circle cx="33" cy="48" r="1.5" fill="white" opacity="0.8" />
                  <circle cx="63" cy="48" r="1.5" fill="white" opacity="0.8" />
                </g>
              )}
              {mode === 'rename' && (
                <g stroke={eyeColor} strokeWidth="3" strokeLinecap="round">
                  <path d="M 33 44 V 56" />
                  <path d="M 31 44 H 35" />
                  <path d="M 31 56 H 35" />
                  <path d="M 63 44 V 56" />
                  <path d="M 61 44 H 65" />
                  <path d="M 61 56 H 65" />
                </g>
              )}
              {mode === 'countdown' && (
                <g stroke={eyeColor} strokeWidth="2" fill="none">
                  <circle cx="35" cy="50" r="7" />
                  <circle cx="35" cy="50" r="3" />
                  <circle cx="65" cy="50" r="7" />
                  <circle cx="65" cy="50" r="3" />
                </g>
              )}
              {mode === 'schedule' && (
                <g stroke={eyeColor} strokeWidth="2" fill="none" strokeLinecap="round">
                  <circle cx="35" cy="50" r="7" />
                  <path d="M 35 50 L 35 46" />
                  <path d="M 35 50 L 38 52" />
                  <circle cx="65" cy="50" r="7" />
                  <path d="M 65 50 L 65 46" />
                  <path d="M 65 50 L 68 52" />
                </g>
              )}
              {mode === 'search' && (
                <g stroke={eyeColor} strokeWidth="2" fill="rgba(255,255,255,0.15)">
                  <circle cx="35" cy="50" r="11" />
                  <circle cx="65" cy="50" r="11" />
                  <path d="M 46 50 Q 50 45 54 50" fill="none" />
                  <path d="M 24 50 L 15 45" />
                  <path d="M 76 50 L 85 45" />
                </g>
              )}
              {mode !== 'create_card' &&
                mode !== 'create_folder' &&
                mode !== 'update' &&
                mode !== 'clipboard' &&
                mode !== 'delete' &&
                mode !== 'restore' &&
                mode !== 'favorite' &&
                mode !== 'rename' &&
                mode !== 'countdown' &&
                mode !== 'schedule' &&
                mode !== 'search' && (
                  <>
                    <motion.ellipse
                      cx="35"
                      cy="50"
                      rx="6"
                      animate={{ ry: eyeRy, cy: eyeBaseCy }}
                      fill={eyeColor}
                      style={mode === 'idle' ? { x: pupilX ?? 0, y: pupilY ?? 0 } : {}}
                    />
                    <motion.circle
                      cx="37"
                      cy="46"
                      r="2"
                      fill="white"
                      opacity="0.8"
                      animate={{ opacity: mode === 'sleep' ? 0 : 0.8, cy: eyeHighlightCy }}
                      style={mode === 'idle' ? { x: pupilX ?? 0, y: pupilY ?? 0 } : {}}
                    />
                    <motion.ellipse
                      cx="65"
                      cy="50"
                      rx="6"
                      animate={{ ry: eyeRy, cy: eyeBaseCy }}
                      fill={eyeColor}
                      style={mode === 'idle' ? { x: pupilX ?? 0, y: pupilY ?? 0 } : {}}
                    />
                    <motion.circle
                      cx="67"
                      cy="46"
                      r="2"
                      fill="white"
                      opacity="0.8"
                      animate={{ opacity: mode === 'sleep' ? 0 : 0.8, cy: eyeHighlightCy }}
                      style={mode === 'idle' ? { x: pupilX ?? 0, y: pupilY ?? 0 } : {}}
                    />
                  </>
                )}
              <motion.path
                d="M 45 62 Q 50 66 55 62"
                stroke={eyeColor}
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                animate={{
                  d: isSleeping
                    ? 'M 45 66 Q 50 66 55 66'
                    : isThinkingIdle
                      ? 'M 45 62 Q 50 68 55 62'
                      : isWindy
                        ? 'M 45 60 Q 50 58 55 60'
                        : mode === 'dragging'
                          ? 'M 46 60 Q 50 70 54 60'
                          : 'M 45 62 Q 50 66 55 62',
                }}
                transition={{ duration: 0.3 }}
              />
            </g>
            <AnimatePresence>
              {orientation !== 'bottom' && (
                <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <circle cx="20" cy="70" r="6" fill={colors.paw} stroke={colors.stroke} />
                  <circle cx="80" cy="70" r="6" fill={colors.paw} stroke={colors.stroke} />
                </motion.g>
              )}
              {orientation === 'bottom' && (
                <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <motion.ellipse
                    animate={{
                      cx: mode === 'favorite' ? 45 : 40,
                      cy: mode === 'pin' ? 65 : mode === 'dragging' ? 90 : 85,
                      rotate: mode === 'favorite' ? -15 : 0,
                    }}
                    rx="5"
                    ry="4"
                    fill={colors.paw}
                  />
                  <motion.ellipse
                    animate={{
                      cx: mode === 'favorite' ? 55 : 60,
                      cy: mode === 'pin' ? 65 : mode === 'dragging' ? 90 : 85,
                      rotate: mode === 'favorite' ? 15 : 0,
                    }}
                    rx="5"
                    ry="4"
                    fill={colors.paw}
                  />
                </motion.g>
              )}
            </AnimatePresence>
          </motion.g>
        </motion.svg>
      </motion.div>
    </motion.div>
  );
}
