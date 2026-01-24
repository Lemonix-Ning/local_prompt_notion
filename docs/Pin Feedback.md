Pin Feedback (置顶反馈) 交互设计与实现方案

该方案旨在通过灵猫的物理动作，为抽象的“置顶”操作提供具象化的视觉反馈。

1. 设计隐喻 (Design Metaphor)

动作隐喻：灵猫踮起脚尖、伸长身体、举起爪子，仿佛在努力将一张卡片挂到高处的墙上。

视觉隐喻：

高度 (Height)：向上移动代表“优先级提升”。

颜色 (Color)：使用琥珀金 (Amber/Gold)，代表“星标”、“重要”、“高亮”。

2. 核心逻辑 (Core Logic)

A. 状态管理

引入瞬时状态 isPinning。

触发：点击 "Sim Pin" 按钮或业务中的置顶操作。

生命周期：

isPinning = true (动画开始)。

持续 1.5秒 (展示完整动作)。

isPinning = false (复位，灵猫落地)。

B. 动画编排 (Choreography)

1. 身体 (Body) - "Reach Up"

拉伸 (Stretch)：身体在 Y 轴拉长 (scaleY: 1.15)，X 轴收缩 (scaleX: 0.9)，模拟用力的挤压感。

悬浮 (Levitate)：整体向上位移 (y: -20)，模拟跳起或踮脚。

原点 (Origin)：transformOrigin: "bottom center"，确保从地面向上生长。

2. 爪子 (Paws) - "Hang"

举手：爪子的 Y 坐标从默认的 85 (地面) 上移至 65 (空中)。

靠拢：爪子 X 坐标微调，模拟抓住物体。

3. 眼睛 (Eyes) - "Focus Up"

视线：瞳孔 (<ellipse>) 和高光点 (<circle>) 向上移动 (cy 减小)，注视上方。

专注：动作期间禁止眨眼。

变色：瞳孔颜色变为 #F59E0B (琥珀金)。

4. 气泡 (Bubble)

弹窗：头顶弹出带有 Pin 图标的气泡。

动效：随身体一起向上浮动 (y: -25)。

3. 关键代码实现

A. 身体变形 (Framer Motion)

<motion.div
  style={{ transformOrigin: "bottom center" }}
  animate={isPinning ? { 
      y: -20,       // 向上位移
      scaleY: 1.15, // 纵向拉伸
      scaleX: 0.9   // 横向收缩
  } : { y: 0, scaleY: 1, scaleX: 1 }}
  transition={{ type: "spring", stiffness: 300, damping: 15 }}
>
  {/* SVG Body */}
</motion.div>


B. 爪子位移 (SVG Animation)

<motion.ellipse 
  cx="40" 
  // 正常: 85, 置顶: 65
  animate={{ cy: isPinning ? 65 : 85 }} 
  ry="4" fill={c.paw} 
/>


C. 眼睛注视 (Eye Gaze)

<motion.ellipse 
  cx="35" 
  // 正常: 50, 向上看: 40
  animate={{ cy: isPinning ? 40 : 50 }} 
  fill={isPinning ? c.eyePin : c.eyeNormal} 
/>
