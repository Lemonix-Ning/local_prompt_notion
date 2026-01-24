Creation Feedback (创建反馈) 技术实现方案

该方案利用灵猫作为系统反馈的情感化载体。当用户执行“新建”操作时，灵猫不再是静态的装饰，而是通过特定的肢体语言（跳跃、摇摆）和面部表情（眼睛变形），提供即时的成功确认。

1. 核心逻辑 (Core Logic)

A. 状态定义 (State Definition)

在 App 组件或 LuminaCat 组件中引入一个瞬时状态 creationState。

type CreationState = 'idle' | 'card' | 'folder';

const [creationState, setCreationState] = useState<CreationState>('idle');


B. 触发机制 (Trigger Mechanism)

新建卡片 (Create Card)：

触发源：顶部栏的 "New" 按钮或快捷键。

行为：设置 creationState = 'card'。

持续时间：1.5秒后自动重置为 'idle'。

新建分类 (Create Folder)：

触发源：侧边栏 Folders 标题旁的 + 按钮。

行为：设置 creationState = 'folder'。

持续时间：1.5秒后自动重置为 'idle'。

2. 视觉反馈规范 (Visual Specifications)

场景 A：新建卡片 (Create Card) - "灵感迸发"

隐喻：灵猫捕捉到了一个新的想法，感到兴奋。

物理动作 (Body)：

Jump (跳跃)：身体轻微上弹，模拟兴奋跳跃。

Keyframes: y: [0, -15, 0], scale: [1, 1.1, 1]。

面部表情 (Face)：

Eyes (眼睛)：瞳孔变为 加号 (+) 形状，代表“增加/正向”。

Color (颜色)：眼睛变为 亮青色 (#22D3EE)，代表科技与灵感。

Blink (眨眼)：动画期间禁止眨眼。

气泡 (Bubble)：

Icon: Sparkles (闪光)。

Text: "New Card!"。

Color: 青色系背景。

场景 B：新建分类 (Create Folder) - "归档整理"

隐喻：灵猫正在整理东西，或者打开了一个箱子。

物理动作 (Body)：

Wiggle (摇摆)：身体左右晃动，模拟挤进箱子或整理动作。

Keyframes: rotate: [0, -5, 5, -5, 5, 0]。

面部表情 (Face)：

Eyes (眼睛)：瞳孔变为 矩形 (■) 形状，模拟文件夹/箱子的轮廓。

Color (颜色)：眼睛变为 橙黄色 (#F59E0B)，代表文件夹的标准色。

气泡 (Bubble)：

Icon: FolderPlus。

Text: "New Folder!"。

Color: 橙色系背景。

3. 关键代码实现 (Code Implementation)

A. 灵猫容器 (LuminaCat Wrapper)

负责处理气泡的弹入弹出和整体物理位移。

// LuminaCat Component
<AnimatePresence>
  {/* 新建卡片气泡 */}
  {creationState === 'card' && (
      <motion.div 
      initial={{ opacity: 0, y: 20, scale: 0.8 }}
      animate={{ opacity: 1, y: -40, scale: 1 }} // 向上浮起
      exit={{ opacity: 0, scale: 0.8, y: -60 }}
      className="absolute -top-14 left-1/2 -translate-x-1/2 flex items-center gap-2 ..."
    >
      <Sparkles size={14} className="animate-spin-slow" />
      <span>New Card!</span>
    </motion.div>
  )}

  {/* 新建分类气泡 */}
  {creationState === 'folder' && (
      <motion.div 
      initial={{ opacity: 0, y: 20, scale: 0.8 }}
      animate={{ opacity: 1, y: -40, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, y: -60 }}
      className="absolute -top-14 left-1/2 -translate-x-1/2 flex items-center gap-2 ..."
    >
      <FolderPlus size={14} />
      <span>New Folder!</span>
    </motion.div>
  )}
</AnimatePresence>

{/* 传递状态给 SVG 组件 */}
<SpiritCat creationState={creationState} ... />


B. 身体动画 (Body Animation)

在 SpiritCat 组件的最外层 motion.div 上应用。

// SpiritCat Component
<motion.div
  style={{ transformOrigin: "bottom center" }} // 关键：底部固定，动作更稳
  animate={
      creationState === 'card' ? { y: [0, -15, 0], scale: [1, 1.1, 1] } : // 跳跃
      creationState === 'folder' ? { rotate: [0, -5, 5, -5, 5, 0] } :    // 摇摆
      // ... 其他状态 (悬浮/静止)
  }
  transition={{ 
      duration: creationState ? 0.5 : 3, // 动作发生时加快节奏
      ease: "easeInOut" 
  }}
>


C. 眼睛变形 (Eye Morphing)

这是最精细的部分，直接操作 SVG 路径。

// SpiritCat Component -> SVG Group
{creationState === 'card' ? (
   // ✨ 加号眼 (SVG Path)
   <g stroke={currentEyeColor} strokeWidth="3" strokeLinecap="round">
      {/* 左眼 + */}
      <path d="M 35 46 V 54" /> <path d="M 31 50 H 39" />
      {/* 右眼 + */}
      <path d="M 65 46 V 54" /> <path d="M 61 50 H 69" />
   </g>
) : creationState === 'folder' ? (
   // ✨ 方块眼 (SVG Rect)
   <g fill={currentEyeColor}>
      <rect x="31" y="46" width="8" height="8" rx="1" />
      <rect x="61" y="46" width="8" height="8" rx="1" />
   </g>
) : (
   // ✨ 正常椭圆眼
   <>
      <motion.ellipse cx="35" cy="50" rx="6" ry={blink ? 0.5 : 8} fill={currentEyeColor} />
      <motion.ellipse cx="65" cy="50" rx="6" ry={blink ? 0.5 : 8} fill={currentEyeColor} />
   </>
)}


4. 颜色映射表 (Color Tokens)

建议在 App.tsx 的 colors 对象中添加专门的键值。

const colors = {
  light: {
    // ...
    eyeCard: "#22D3EE",   // Cyan 400
    eyeFolder: "#F97316"  // Orange 500
  },
  dark: {
    // ...
    eyeCard: "#67E8F9",   // Cyan 300
    eyeFolder: "#FDBA74"  // Orange 300
  }
};
