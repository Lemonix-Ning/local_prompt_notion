Scroll Wind (滚动风阻) 交互系统实现方案

该系统旨在增强界面的物理真实感，通过监听用户的滚动行为，将其转化为虚拟世界的“风力”，并实时反馈在灵猫的姿态上。

1. 核心原理 (Core Logic)

A. 速度监测 (Velocity Detection)

我们需要计算滚动的瞬时速度，而不仅仅是距离。

公式：Speed = |ΔY| / ΔTime

实现：

在 onScroll 事件中，记录当前的 scrollTop 和 Date.now()。

与上一次记录的值进行比较。

设置一个阈值（例如 2.0 px/ms），超过此速度即判定为“强风”。

B. 防抖与衰减 (Debounce & Decay)

风不是瞬间停止的，需要一个自然的衰减过程。

使用 setTimeout 延迟 isWindy 状态的关闭（例如 200ms）。

如果在延迟期间再次检测到高速滚动，则清除旧定时器，重置状态，维持“强风”效果。

2. 视觉反馈 (Visual Feedback)

当 isWindy === true 时，灵猫会发生以下形变：

A. 耳朵 (Ears) - 核心特征

正常态：竖立，偶尔抖动。

迎风态：向后平贴（飞机耳），减少风阻。

SVG 路径变化：

左耳：M 30 25 L 20 5 L 45 22 -> M 30 25 L 15 20 L 45 22

右耳：M 70 25 L 80 5 L 55 22 -> M 70 25 L 85 20 L 55 22

B. 眼睛 (Eyes)

表现：为了防止风沙迷眼，或者单纯因为风压，猫咪会眯起眼睛。

实现：ry (垂直半径) 从 8 压缩到 2。

C. 身体 (Body) & 尾巴 (Tail)

身体：轻微下压 (y: 4)，重心降低以保持平衡。

尾巴：停止悠闲的摆动，被风吹直或紧贴身体。

3. 代码架构

// App.tsx

// 1. 滚动处理逻辑
const handleScroll = (e) => {
  const currentY = e.target.scrollTop;
  const time = Date.now();
  // ... 计算速度 ...
  if (speed > 2) setIsWindy(true);
};

// 2. 传递状态
<LuminaCat isWindy={isWindy} ... />

// 3. SVG 响应
<motion.path 
  animate={{ d: isWindy ? "风阻路径" : "正常路径" }} 
  transition={{ duration: 0.2 }} 
/>
