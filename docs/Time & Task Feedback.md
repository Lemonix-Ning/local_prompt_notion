Time & Task Feedback (时间反馈) 技术实现方案

该方案赋予灵猫对“时间”的感知能力。当倒计时结束或定时任务触发时，灵猫不再是静默的，而是通过动态的肢体语言和视觉符号，成为一个生动的桌面闹钟。

1. 核心逻辑 (Core Logic)

A. 状态定义 (State Definition)

引入瞬时状态 timeState。

值域：'idle' (空闲) | 'countdown' (倒计时结束) | 'schedule' (日程触发)。

触发：

实际应用中：由倒计时器归零或系统时间匹配日程触发。

演示模式中：点击 "Sim Timer" 或 "Sim Schedule" 按钮触发。

持续：

倒计时 (Countdown)：持续震动 3秒（模拟闹钟铃声的急促感）。

定时任务 (Schedule)：持续展示 2秒（温和的提醒）。

B. 状态流转

[Idle] --(Timer Ends)--> [Countdown State] --(3s Timeout)--> [Idle]
[Idle] --(Task Start)--> [Schedule State] --(2s Timeout)--> [Idle]


2. 视觉反馈规范 (Visual Specifications)

场景 A：倒计时结束 (Countdown End) - "急促闹钟"

隐喻：闹钟响起，灵猫被“震”得抖动，急切地提醒用户。

物理动作 (Body)：

Shake (震动)：身体进行高频、小幅度的左右位移。

Keyframes: x: [-2, 2, -2, 2, 0]，scale: [1, 1.05, 1]。

Timing: duration: 0.1, repeat: Infinity。

面部表情 (Face)：

Eyes (眼睛)：瞳孔变为 同心圆 (◎)，并且快速脉冲缩放，模拟警报灯。

Color (颜色)：警示橙 (#F97316)。

Blink：禁止眨眼。

气泡 (Bubble)：

Icon: AlarmClock (闹钟)。

Text: "Time's Up!"。

Motion: 随身体剧烈抖动。

光环 (Aura)：

变为橙色虚线，快速旋转。

场景 B：定时任务触发 (Schedule Trigger) - "日程提醒"

隐喻：灵猫看了一眼时间，优雅地提示你该做下一件事了。

物理动作 (Body)：

Hop (轻跳)：身体轻盈地跳一下，引起注意但不惊扰。

Keyframes: y: [0, -10, 0], scaleY: [1, 1.05, 0.95, 1]。

Timing: duration: 0.5。

面部表情 (Face)：

Eyes (眼睛)：瞳孔内部出现 时钟指针 (🕒) 图案（SVG 线条）。

Color (颜色)：静谧蓝 (#3B82F6)，代表理性与计划。

气泡 (Bubble)：

Icon: CalendarClock (日历时钟)。

Text: "Task Start!"。

3. 关键代码实现细节

A. 灵猫容器 (LuminaCat)

负责处理状态变更和整体容器动画。

// LuminaCat Component
const [timeState, setTimeState] = useState(null);

// 模拟倒计时结束
const handleSimCountdown = () => {
  setTimeState('countdown');
  // 震动持续 3秒
  setTimeout(() => setTimeState(null), 3000);
};

// 动画变体应用
<motion.div
  animate={
      timeState === 'countdown' ? { x: [-2, 2, -2, 2, 0], scale: [1, 1.05, 1] } : // 震动
      timeState === 'schedule' ? { y: [0, -10, 0] } : // 跳跃
      { ...idleAnimation }
  }
  transition={{ 
      x: { duration: 0.1, repeat: timeState === 'countdown' ? Infinity : 0 }
  }}
>


B. 眼睛 SVG 变形 (SpiritCat SVG)

通过条件渲染 SVG 路径来改变眼睛形状。

// SpiritCat -> SVG Eyes Group
{timeState === 'countdown' ? (
   // ✨ 闹钟眼 (同心圆)
   <g stroke={currentColor} fill="none" strokeWidth="2">
      {/* 外圈 */}
      <circle cx="35" cy="50" r="7" />
      {/* 内芯 */}
      <circle cx="35" cy="50" r="3" fill={currentColor} />
   </g>
) : timeState === 'schedule' ? (
   // ✨ 时钟眼 (指针)
   <g stroke={currentColor} strokeWidth="2" strokeLinecap="round">
      <circle cx="35" cy="50" r="8" fill="none" />
      {/* 时针 & 分针 */}
      <path d="M 35 50 L 35 44" /> 
      <path d="M 35 50 L 39 50" />
   </g>
) : (
   // 正常椭圆眼
   <ellipse ... />
)}
