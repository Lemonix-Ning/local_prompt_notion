Favorite Feedback (收藏反馈) 交互方案

该方案旨在通过情感化的视觉反馈（拥抱、爱心、暖色调），强化用户“收藏”这一行为的满足感，赋予工具软件以温度。

1. 核心逻辑 (Core Logic)

A. 状态管理 (State Management)

引入瞬时状态 isFavoriting。

触发：点击任意卡片上的 Star 按钮，或顶部栏的 "Sim Favorite" 模拟按钮。

行为：

isFavoriting = true。

触发 React 状态更新（卡片变亮）。

启动 1.5秒 的反馈动画。

复位：动画结束后自动重置为 false。

2. 视觉反馈规范 (Visual Specifications)

A. 动作：拥抱 (The Hug)

灵猫模仿“将珍爱之物抱在怀里”的动作。

身体 (Body)：

Squeeze: 宽度收缩 (scaleX: 0.9)，高度微增 (scaleY: 1.05)，表现出用力的感觉。

Lift: 轻微踮脚 (y: -5)。

爪子 (Paws)：

位置变化: 从身体两侧 (x: 20/80) 移动到胸前 (x: 40/60)。

旋转: 向内旋转 (rotate: -15deg / 15deg)，形成环抱姿态。

B. 表情：爱心眼 (Heart Eyes)

原理: 将眼睛的 <ellipse> 替换为心形的 <path>。

路径: 使用三次贝塞尔曲线绘制完美心形。

颜色: 甜心粉 (#EC4899) 或 暖金色 (#F59E0B)。

高光: 在心形上方添加微小的白色反光点，增加水润感。

C. 氛围：粒子特效 (Particle Effects)

头顶爱心: 一个大的爱心气泡从头顶升起并淡出。

光环: 变为粉色虚线，缓慢旋转。

动效:

气泡: y: 10 -> -20, scale: 0.8 -> 1。

消失: 停留片刻后淡出。

3. 关键代码实现

A. 爱心路径数据 (SVG Path)

基于 100x100 画布的相对坐标设计。

const HEART_PATH = "M 0 -3 C -3 -6 -8 -3 -5 1 C -2 5 0 8 0 8 C 0 8 2 5 5 1 C 8 -3 3 -6 0 -3";
// 使用 transform 属性将其定位到左眼 (35, 50) 和右眼 (65, 50)


B. 爪子聚合动画 (Paws Animation)

<motion.g>
  {/* 左爪：向右移动 */}
  <motion.ellipse 
    animate={isFavoriting ? { cx: 45, rotate: -15 } : { cx: 40, rotate: 0 }} 
    ... 
  />
  {/* 右爪：向左移动 */}
  <motion.ellipse 
    animate={isFavoriting ? { cx: 55, rotate: 15 } : { cx: 60, rotate: 0 }} 
    ... 
  />
</motion.g>
