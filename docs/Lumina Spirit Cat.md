Lumina Spirit Cat - 视觉形态学与基础部件实现

该文档详细拆解了 Lumi 的 SVG 构造。Lumi 不是一张静态图片，而是由多个独立的、可动画的 SVG 路径 (Paths) 组成的“矢量生物”。

1. 构造拆解 (Anatomy)

Lumi 的身体被限制在一个 100x100 的 SVG 视口 (viewBox) 中，各部位通过相对坐标绘制。

A. 身体 (The Body)

元素: <motion.path>

绘制: 使用三次贝塞尔曲线 (C 指令) 绘制一个类圆形的“馒头”形状。

动画能力:

呼吸: 通过微调控制点坐标，实现胸廓起伏。

变形: 在不同状态（如睡觉、思考）下，改变 d 属性路径，实现形状切换。

B. 眼睛 (The Eyes)

元素: 组合 (<g>) + 椭圆 (<motion.ellipse>)

层级: 包含底色、瞳孔、高光点。

动画能力:

眨眼: 将垂直半径 ry 从 8 动画过渡到 0.5。

注视: 通过 pupilX/Y 位移整个眼球组。

变身: 通过条件渲染，将椭圆替换为其他 SVG 路径（如 +, x, ♥）。

C. 尾巴 (The Tail)

元素: <motion.path>

层级: z-index: -1 (位于身体后方)。

绘制: 一条较粗的描边路径 (strokeWidth="6")。

动画能力: 摆动 (Wagging)。通过关键帧循环改变贝塞尔曲线的控制点，模拟正弦波摆动。

D. 爪子 (The Paws)

元素: <motion.ellipse>

策略: 根据 orientation (吸附方向) 改变形态。

Bottom: 扁椭圆，模拟趴在平面上。

Side/Top: 正圆，模拟肉球吸附在玻璃上。

E. 光环 (The Aura)

元素: HTML <div> + CSS Border

样式: 虚线边框 (border-dashed)。

动画: 无限旋转 (rotate: 360deg)，速度随状态改变（思考时变快）。

2. 关键技术点

2.1 颜色系统 (Theming)

所有 SVG 的 fill 和 stroke 均不硬编码颜色值，而是从 colors[theme] 对象中读取。

Light: 实体感强，深色填充。

Dark: 灵体感强，浅色填充 + 发光。

2.2 动作编排 (Orchestration)

使用 Framer Motion 的 variants 和 animate 属性。

Idle: y: [-4, 4, -4] (悬浮)。

Sleep: scaleY: 0.95 (趴下)。

Windy: d 路径变形 (耳朵后倒)。

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// 定义接口，确保类型安全
interface SpiritCatProps {
  orientation: 'bottom' | 'left' | 'right' | 'top'; // 吸附方向
  mode: string;                                     // 当前行为模式 (idle, sleep, create...)
  theme: 'light' | 'dark';                          // 主题
  pupilX?: any;                                     // 眼神跟随 X (MotionValue)
  pupilY?: any;                                     // 眼神跟随 Y (MotionValue)
  blink?: boolean;                                  // 强制眨眼控制 (可选)
}

export const SpiritCat: React.FC<SpiritCatProps> = ({ 
  orientation, 
  mode, 
  theme, 
  pupilX, 
  pupilY, 
  blink: externalBlink 
}) => {
  // 内部眨眼状态
  const [internalBlink, setInternalBlink] = useState(false);
  
  // 1. 自动眨眼逻辑 (Auto Blink Loop)
  useEffect(() => {
    // 特殊模式下禁止自动眨眼 (如睡眠、删除、搜索等)
    if (mode === 'sleep' || mode === 'search' || mode === 'delete') {
        setInternalBlink(false);
        return;
    }

    const timer = setInterval(() => {
      setInternalBlink(true);
      setTimeout(() => setInternalBlink(false), 200); // 闭眼 200ms
    }, 4000 + Math.random() * 2000); // 随机间隔 4~6秒

    return () => clearInterval(timer);
  }, [mode]);

  const isBlinking = externalBlink || internalBlink;

  // 2. 颜色配置 (Color Palette)
  const c = {
    body: theme === 'dark' ? "#E2E8F0" : "#334155", // Light: Slate-700, Dark: Slate-200
    stroke: theme === 'dark' ? "#94A3B8" : "#1E293B",
    paw: theme === 'dark' ? "#E2E8F0" : "#334155",
    
    // 眼睛状态色
    eyeNormal: theme === 'dark' ? "#FBBF24" : "#F59E0B", // Amber
    eyeSleep: theme === 'dark' ? "#94A3B8" : "#475569",  // Grey
    eyeSearch: "#10B981", // Emerald
    eyeCreate: "#22D3EE", // Cyan
    eyeFolder: "#F97316", // Orange
    eyeDelete: "#EF4444", // Red
    eyeMagic: "#2DD4BF",  // Teal
    eyeLove: "#EC4899",   // Pink
    eyePin: "#F59E0B"     // Gold
  };

  // 3. 决定当前眼睛颜色
  let eyeColor = c.eyeNormal;
  if (mode === 'search') eyeColor = c.eyeSearch;
  if (mode === 'create_card') eyeColor = c.eyeCreate;
  if (mode === 'create_folder') eyeColor = c.eyeFolder;
  if (mode === 'update' || mode === 'clipboard') eyeColor = c.eyeSuccess; // Green
  if (mode === 'delete') eyeColor = c.eyeDelete;
  if (mode === 'restore') eyeColor = c.eyeMagic;
  if (mode === 'favorite') eyeColor = c.eyeLove;
  if (mode === 'pin') eyeColor = c.eyePin;
  if (mode === 'sleep') eyeColor = c.eyeSleep;

  return (
    <motion.div 
      className="relative w-full h-full"
      // 整体旋转：根据吸附方向调整身体朝向
      animate={orientation}
      variants={{
        bottom: { rotate: 0 },
        left: { rotate: 0 }, // 或 90 (如果想让它趴墙上)
        right: { rotate: 0 },
        top: { rotate: 0 }
      }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
      <motion.div
        className="w-full h-full"
        style={{ transformOrigin: "bottom center" }}
        // --- 4. 身体物理动作编排 (Physical Choreography) ---
        animate={
            mode === 'sleep' ? { scaleY: 0.95 } : // 睡眠：身体压低
            mode === 'windy' ? { y: 4, scaleY: 0.95 } : // 风阻：压低抗风
            mode === 'create_card' ? { y: [0, -15, 0], scale: [1, 1.1, 1] } : // 跳跃
            mode === 'create_folder' ? { rotate: [0, -5, 5, -5, 5, 0] } : // 摇摆
            mode === 'update' ? { y: [0, 6, 0], scaleY: [1, 0.92, 1] } : // 点头
            mode === 'clipboard' ? { y: [0, 8, 0] } : // 复制点头
            mode === 'delete' ? { rotate: [0, -5, 5, -5, 5, 0] } : // 惊恐震动
            mode === 'restore' ? { y: -15, rotate: [0, -2, 2, 0] } : // 悬浮施法
            mode === 'favorite' ? { scaleX: 0.9, scaleY: 1.05, y: -5 } : // 拥抱收缩
            mode === 'pin' ? { y: -20, scaleY: 1.15, scaleX: 0.9 } : // 向上伸展
            orientation !== 'bottom' ? { y: [-4, 4, -4] } : // 默认：悬浮呼吸
            { y: 0 }
        }
        transition={{ 
            // 交互动作快(0.3s)，闲置呼吸慢(3s)
            y: { duration: (mode === 'idle' || mode === 'restore') ? 3 : 0.3, repeat: (mode === 'idle' || mode === 'restore') ? Infinity : 0, ease: "easeInOut" },
            default: { duration: 0.3 }
        }}
      >
        {/* --- 5. 能量光环 (The Aura) --- */}
        <motion.div
           className={`absolute inset-0 rounded-full border-2 border-dashed ${theme === 'dark' ? 'border-indigo-400/50' : 'border-indigo-500/20'}`}
           animate={{ 
             rotate: mode === 'restore' ? -360 : 360, // 恢复时逆时针(时光倒流)
             scale: mode !== 'idle' && mode !== 'sleep' ? 1.2 : 1, 
             opacity: mode === 'sleep' ? 0 : (mode !== 'idle' ? 0.8 : 0.2), // 睡眠时隐藏
             borderColor: mode !== 'idle' ? eyeColor : undefined // 光环随眼睛变色
           }}
           transition={{ rotate: { duration: mode === 'restore' ? 5 : 10, repeat: Infinity, ease: "linear" } }}
        />
        
        {/* --- 6. SVG 矢量绘图 (The Vector Body) --- */}
        <motion.svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl relative z-10">
           <motion.g initial="idle">
             {/* A. 身体躯干 */}
             <motion.path
               d="M 50 20 C 75 20 85 40 85 60 C 85 85 70 95 50 95 C 30 95 15 85 15 60 C 15 40 25 20 50 20 Z"
               fill={c.body} stroke={c.stroke} strokeWidth="2"
             />

             {/* B. 耳朵 (动态变形) */}
             {/* 左耳 */}
             <motion.path 
                // 正常: 竖立 | 刮风: 向后平贴 (飞机耳)
                animate={{ d: mode === 'windy' ? "M 30 25 L 15 20 L 45 22" : "M 30 25 L 20 5 L 45 22" }}
                fill={c.body} stroke={c.stroke} strokeWidth="2" transition={{ duration: 0.2 }}
             />
             {/* 右耳 */}
             <motion.path 
                animate={{ d: mode === 'windy' ? "M 70 25 L 85 20 L 55 22" : "M 70 25 L 80 5 L 55 22" }}
                fill={c.body} stroke={c.stroke} strokeWidth="2" transition={{ duration: 0.2 }}
             />
             
             {/* C. 面部五官组 */}
             <g transform="translate(0, 5)">
                {/* --- 眼睛变形矩阵 --- */}
                {mode === 'create_card' ? (
                   // 形态：加号 (+)
                   <g stroke={eyeColor} strokeWidth="3" strokeLinecap="round">
                      <path d="M 35 46 V 54" /> <path d="M 31 50 H 39" />
                      <path d="M 65 46 V 54" /> <path d="M 61 50 H 69" />
                   </g>
                ) : mode === 'create_folder' ? (
                   // 形态：方块 (■)
                   <g fill={eyeColor}>
                      <rect x="31" y="46" width="8" height="8" rx="1" />
                      <rect x="61" y="46" width="8" height="8" rx="1" />
                   </g>
                ) : mode === 'delete' ? (
                   // 形态：叉号 (X)
                   <g stroke={eyeColor} strokeWidth="3" strokeLinecap="round">
                      <path d="M 30 46 L 40 56" /> <path d="M 40 46 L 30 56" />
                      <path d="M 60 46 L 70 56" /> <path d="M 70 46 L 60 56" />
                   </g>
                ) : mode === 'update' || mode === 'clipboard' ? (
                   // 形态：对钩 (✓)
                   <g stroke={eyeColor} strokeWidth="3" strokeLinecap="round" fill="none">
                      <path d="M 28 50 L 33 55 L 42 45" />
                      <path d="M 58 50 L 63 55 L 72 45" />
                   </g>
                ) : mode === 'favorite' ? (
                   // 形态：爱心 (♥)
                   <g fill={eyeColor}>
                      <path d="M 35 47 C 32 44 27 47 30 51 C 33 55 35 58 35 58 C 35 58 37 55 40 51 C 43 47 38 44 35 47" />
                      <path d="M 65 47 C 62 44 57 47 60 51 C 63 55 65 58 65 58 C 65 58 67 55 70 51 C 73 47 68 44 65 47" />
                   </g>
                ) : mode === 'restore' ? (
                   // 形态：星星 (✨)
                   <g fill={eyeColor}>
                      <path d="M 35 44 L 36.5 48.5 L 41 50 L 36.5 51.5 L 35 56 L 33.5 51.5 L 29 50 L 33.5 48.5 Z" />
                      <path d="M 65 44 L 66.5 48.5 L 71 50 L 66.5 51.5 L 65 56 L 63.5 51.5 L 59 50 L 63.5 48.5 Z" />
                   </g>
                ) : mode === 'search' ? (
                   // 形态：侦探眼镜 (👓)
                    <g stroke={eyeColor} strokeWidth="2" fill="rgba(255,255,255,0.15)">
                      <circle cx="35" cy="50" r="11" />
                      <circle cx="65" cy="50" r="11" />
                      <path d="M 46 50 Q 50 45 54 50" fill="none" />
                      <path d="M 24 50 L 15 45" />
                      <path d="M 76 50 L 85 45" />
                    </g>
                ) : (
                   // 形态：正常椭圆 (支持 Gaze Tracking 和 睡眠闭眼)
                   <>
                      <motion.ellipse 
                        cx="35" cy="50" rx="6" 
                        animate={{ 
                            ry: (mode === 'sleep' || isBlinking || mode === 'windy') ? 0.5 : 8, // 闭眼: ry=0.5
                            cy: mode === 'pin' ? 40 : 50 // 置顶: 向上看
                        }} 
                        fill={eyeColor} 
                        style={mode === 'idle' ? { x: pupilX, y: pupilY } : {}} // 绑定眼神跟随
                      />
                      {/* 高光点 */}
                      <motion.circle 
                        cx="37" cy="46" r="2" fill="white" opacity="0.8" 
                        animate={{ opacity: mode === 'sleep' ? 0 : 0.8, cy: mode === 'pin' ? 36 : 46 }}
                        style={mode === 'idle' ? { x: pupilX, y: pupilY } : {}}
                      />
                      
                      <motion.ellipse 
                        cx="65" cy="50" rx="6" 
                        animate={{ 
                            ry: (mode === 'sleep' || isBlinking || mode === 'windy') ? 0.5 : 8,
                            cy: mode === 'pin' ? 40 : 50
                        }} 
                        fill={eyeColor} 
                        style={mode === 'idle' ? { x: pupilX, y: pupilY } : {}}
                      />
                      <motion.circle 
                        cx="67" cy="46" r="2" fill="white" opacity="0.8" 
                        animate={{ opacity: mode === 'sleep' ? 0 : 0.8, cy: mode === 'pin' ? 36 : 46 }}
                        style={mode === 'idle' ? { x: pupilX, y: pupilY } : {}}
                      />
                   </>
                )}
             </g>

             {/* D. 爪子 (The Paws) */}
             <AnimatePresence>
                {/* 悬浮时：圆形肉球 */}
                {orientation !== 'bottom' && (
                <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <circle cx="20" cy="70" r="6" fill={c.paw} stroke={c.stroke} />
                    <circle cx="80" cy="70" r="6" fill={c.paw} stroke={c.stroke} />
                </motion.g>
                )}
                {/* 落地时：扁椭圆手 */}
                {orientation === 'bottom' && (
                <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <motion.ellipse 
                        animate={{ 
                            cx: mode === 'favorite' ? 45 : 40, // 拥抱时内移
                            cy: mode === 'pin' ? 65 : 85,      // 置顶时上举
                            rotate: mode === 'favorite' ? -15 : 0 
                        }}
                        rx="5" ry="4" fill={c.paw} 
                    />
                    <motion.ellipse 
                        animate={{ 
                            cx: mode === 'favorite' ? 55 : 60, 
                            cy: mode === 'pin' ? 65 : 85,
                            rotate: mode === 'favorite' ? 15 : 0 
                        }}
                        rx="5" ry="4" fill={c.paw} 
                    />
                </motion.g>
                )}
             </AnimatePresence>

             {/* E. 尾巴 (The Tail) */}
             <motion.path 
                d="M 50 85 Q 80 100 90 80" 
                stroke={c.body} strokeWidth="6" fill="none" strokeLinecap="round"
                style={{ zIndex: -1 }} // 位于身体后方
                animate={mode === 'update' 
                   ? { d: "M 50 85 Q 50 80 50 70" } // 竖直尾巴 (开心)
                   : { d: ["M 50 85 Q 80 100 90 80", "M 50 85 Q 90 90 95 70", "M 50 85 Q 80 100 90 80"] }
                }
                // 睡眠时摆动变慢 (6s)，平时 (3s)
                transition={{ duration: mode === 'sleep' ? 6 : 3, repeat: Infinity, ease: "easeInOut" }}
             />
           </motion.g>
        </motion.svg>
      </motion.div>
    </motion.div>
  );
};
