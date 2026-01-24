Rename Feedback (重命名反馈) 交互设计与实现方案

该方案利用灵猫的肢体语言，将抽象的“重命名/编辑”操作转化为具象的“书写”行为，增强用户对系统状态的感知。

1. 设计隐喻 (Design Metaphor)

动作隐喻：灵猫化身为一个小作家或速记员。它的身体快速左右晃动，仿佛正在键盘上敲击或用笔疾书。

视觉隐喻：

眼睛：变为文本输入光标 (I-Beam) 的形状，直接对应“文本编辑”的概念。

颜色：使用 电光紫 (#A855F7)，在设计系统中通常代表“创造”或“编辑”。

2. 核心逻辑 (Core Logic)

A. 状态管理

引入瞬时状态 isRenaming。

触发：点击 "Sim Rename" 按钮（或实际业务中的重命名提交）。

生命周期：

isRenaming = true (动画开始)。

持续 1.5秒 (展示完整书写动作)。

isRenaming = false (复位，灵猫恢复待机)。

B. 动画编排 (Choreography)

1. 身体 (Body) - "The Writer's Wiggle"

晃动 (Wiggle)：身体进行快速、小幅度的左右位移 (x: [-2, 2, -2, 2, 0])，模拟打字时的震动感。

呼吸 (Breath)：配合晃动，进行轻微的缩放 (scale: 1.02)，表现专注时的呼吸节奏。

时序：duration: 0.4s，动作轻快。

2. 眼睛 (Eyes) - "Cursor Mode"

形状：将原本的椭圆眼睛替换为 "I" 字型 路径。

路径构造：M (x-3) (y-7) H (x+3) ... (类似于工字钢)。

颜色：电光紫 (#A855F7)。

专注：动作期间禁止眨眼。

3. 气泡 (Bubble)

弹窗：头顶弹出带有 FileSignature (签名/重命名) 图标的气泡。

文字：显示 "Renamed!"。

光环：变为紫色虚线，并带有脉冲效果。

3. 关键代码实现

A. 身体书写动画

<motion.div
  style={{ transformOrigin: "bottom center" }}
  animate={isRenaming ? { 
      x: [-2, 2, -1, 1, 0], // 左右快速抖动
      scale: [1, 1.02, 1]   // 轻微呼吸
  } : { x: 0, scale: 1 }}
  transition={{ duration: 0.4, ease: "easeInOut" }}
>
  {/* SVG Body */}
</motion.div>


B. 光标眼路径 (SVG Path)

// I-Beam 形状
<g stroke={currentEyeColor} strokeWidth="2.5" strokeLinecap="round">
  {/* 左眼 I */}
  <path d="M 35 43 V 57" />       // 竖线
  <path d="M 32 43 H 38" />       // 上横线
  <path d="M 32 57 H 38" />       // 下横线
</g>
