Deletion Awareness (删除感知) 交互方案

该方案旨在通过灵猫的激烈反应（震动、变色、表情变化），为“删除”这一破坏性操作提供强烈的视觉反馈。

1. 核心逻辑 (Core Logic)

A. 状态管理 (State Machine)

引入一个瞬时状态 isDeleting。

触发：点击删除按钮时，置为 true。

持续：保持约 1.5秒（足以展示完整惊吓动画）。

复位：倒计时结束后自动置为 false，灵猫恢复平静。

B. 动画编排 (Choreography)

删除反馈是一个复合动画，包含以下三个维度的变化：

物理震动 (Physical Shake)：

原理：利用 framer-motion 的 keyframe 动画。

参数：rotate: [0, -5, 5, -5, 5, 0]。快速左右摇摆，模拟受到冲击或惊吓。

表情突变 (Expression Shift)：

眼睛：从温和的椭圆 (<ellipse>) 瞬间变为尖锐的叉号 (X形状的 <path>)。

颜色：瞳孔和光环颜色从原本的主题色（蓝/黄）突变为 警示红 (#EF4444)。

眨眼：强制停止眨眼 (setBlink(false))，保持“瞪大眼睛”的惊恐状。

环境光效 (Atmosphere)：

光环：外围虚线光环加速旋转，且变为红色。

气泡：头顶弹出带有垃圾桶图标 (Trash2) 的气泡，明确指示当前操作。

2. 关键代码实现 (Key Implementation)

A. App 层级控制

// App.tsx
const [isDeleting, setIsDeleting] = useState(false);

const handleDelete = () => {
  // 1. 激活删除状态
  setIsDeleting(true);
  
  // 2. 执行实际删除逻辑 (如 API 调用)
  // deleteItem(id)...

  // 3. 延时复位 (1.5秒后恢复)
  setTimeout(() => setIsDeleting(false), 1500);
};

// 传递状态给灵猫
<LuminaCat isDeleting={isDeleting} ... />


B. 灵猫震动逻辑 (LuminaCat Wrapper)

// LuminaCat Component
useEffect(() => {
  if (isDeleting) {
      // 触发震动动画
      controls.start({
          rotate: [0, -5, 5, -5, 5, 0], // 左右剧烈摇摆
          scale: [1, 1.1, 1],           // 稍微膨胀（炸毛效果）
          transition: { duration: 0.4 } // 快速完成
      });
  }
}, [isDeleting]);


C. 眼睛 SVG 变形 (SpiritCat SVG)

这里使用条件渲染来切换 SVG 路径。

// SpiritCat Component
const currentEyeColor = isDeleting ? "#EF4444" : normalColor;

return (
  <svg>
    <g transform="translate(0, 5)">
       {isDeleting ? (
         // 删除状态：绘制 X 形眼睛
         <g stroke={currentEyeColor} strokeWidth="3" strokeLinecap="round">
           {/* 左眼 X */}
           <path d="M 30 46 L 40 56" />
           <path d="M 40 46 L 30 56" />
           {/* 右眼 X */}
           <path d="M 60 46 L 70 56" />
           <path d="M 70 46 L 60 56" />
         </g>
       ) : (
         // 正常状态：绘制椭圆眼睛
         <>
           <ellipse cx="35" cy="50" rx="6" ry={blink ? 0.5 : 8} fill={currentEyeColor} />
           <ellipse cx="65" cy="50" rx="6" ry={blink ? 0.5 : 8} fill={currentEyeColor} />
         </>
       )}
    </g>
  </svg>
)


3. 视觉效果预览

状态

眼睛形状

颜色

动作

正常

椭圆 (O O)

琥珀色/青色

缓慢呼吸，偶尔眨眼

删除中

叉号 (X X)

警示红

剧烈颤抖，停止眨眼

这种设计利用了人类对“红色”和“X符号”的本能反应，无需文字说明即可传达“操作具有破坏性”或“错误”的含义。