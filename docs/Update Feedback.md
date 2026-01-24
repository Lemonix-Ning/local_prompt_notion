Update Feedback (保存/更新反馈) 交互方案

该方案旨在通过灵猫的肢体语言为“保存成功”这一不可见的状态提供确切的视觉反馈。

1. 核心逻辑 (Core Logic)

A. 状态管理

引入瞬时状态 isUpdated。

触发：点击 "Sim Edit" 按钮（模拟保存操作）。

行为：

isUpdated = true。

启动 1.5秒 的反馈动画。

复位：动画结束后自动重置为 false。

2. 视觉反馈规范 (Visual Specifications)

A. 动作：盖章点头 (The Stamp Nod)

灵猫模仿“盖章”或“用力点头”的动作，表示确认。

身体 (Body)：

Down: 快速下沉 (y: 6)。

Squash: 身体被压扁 (scaleY: 0.95, scaleX: 1.05)。

Rebound: 弹性恢复原状。

时序: duration: 0.3s，短促有力。

B. 表情：对钩眼 (Checkmark Eyes)

原理: 将眼睛的 <ellipse> 替换为对钩形的 <path>。

路径: 绘制一个简单的 ✓ 形状。

颜色: 翡翠绿 (#10B981)，通用的成功色。

眨眼: 反馈期间禁止眨眼。

C. 氛围：成功气泡 (Success Bubble)

内容: Check 图标 + "Saved!"。

位置: 头顶上方，带有轻微的上浮消失动画。

颜色: 绿色系背景。

光环: 变为绿色虚线，旋转一圈。

3. 关键代码实现

A. 对钩眼绘制

// 左眼对钩路径 (SVG Path)
const CHECK_PATH_LEFT = "M 28 50 L 33 55 L 42 45"; 
// 右眼对钩路径
const CHECK_PATH_RIGHT = "M 58 50 L 63 55 L 72 45";


B. 身体点头动画

利用 Framer Motion 的 Keyframes 数组模拟物理弹性。

<motion.div
  style={{ transformOrigin: "bottom center" }}
  animate={isUpdated ? { 
      y: [0, 6, 0],         // 下沉再回弹
      scaleY: [1, 0.92, 1], // 压扁再恢复
      scaleX: [1, 1.05, 1]  // 变宽再恢复
  } : { y: 0 }}
  transition={{ duration: 0.3, ease: "easeInOut" }}
>
  {/* SVG Body */}
</motion.div>
