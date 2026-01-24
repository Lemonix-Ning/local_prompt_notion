Restore Feedback (恢复反馈) 交互方案

该方案旨在通过“魔法复原”的视觉隐喻，为撤销删除或恢复数据操作提供积极的情感反馈。

1. 核心逻辑 (Core Logic)

A. 状态管理 (State Management)

引入瞬时状态 isRestoring。

触发：点击 "Sim Restore" 按钮（或实际业务中的撤销操作）。

行为：

isRestoring = true。

启动 2秒 的反馈动画。

复位：动画结束后自动重置为 false。

2. 视觉反馈规范 (Visual Specifications)

A. 动作：悬浮施法 (Levitation Spell)

灵猫模仿施展魔法的姿态。

身体 (Body)：

Float: 身体缓缓升起 (y: -15)，脱离地面。

Sway: 轻微的左右摇摆 (rotate: [-5, 5])，模拟漂浮的不稳定性。

光环 (Aura)：

Reverse: 光环逆时针旋转 (rotate: -360deg)，隐喻“时光倒流”。

Color: 变为 治愈青 (#2DD4BF)。

B. 表情：星星眼 (Sparkle Eyes)

原理: 将眼睛的 <ellipse> 替换为四角星形的 <path>。

路径: M 0 -6 L 1.5 -1.5 L 6 0 L 1.5 1.5 L 0 6 L -1.5 1.5 L -6 0 L -1.5 -1.5 Z。

动画: 星星眼自身在旋转和缩放，增加魔法感。

C. 氛围：反馈气泡 (Feedback Bubble)

内容: RotateCcw (逆时针箭头) 图标 + "Restored!"。

位置: 头顶上方，跟随身体浮动。

颜色: 青色/蓝绿色系背景。

3. 关键代码实现

A. 星星眼路径 (Sparkle Path)

const SPARKLE_PATH = "M 0 -6 L 1.5 -1.5 L 6 0 L 1.5 1.5 L 0 6 L -1.5 1.5 -6 0 L -1.5 -1.5 Z";


B. 身体悬浮动画 (Body Levitation)

<motion.div
  animate={isRestoring ? { y: -15, rotate: [0, -5, 5, 0] } : { y: 0 }}
  transition={{ duration: 2, ease: "easeInOut" }}
>
  {/* SVG Body */}
</motion.div>


C. 光环逆转 (Aura Reversal)

<motion.div
  animate={{ 
     rotate: isRestoring ? -360 : 360, // 负值实现逆时针
     borderColor: isRestoring ? '#2DD4BF' : '...' 
  }}
/>
