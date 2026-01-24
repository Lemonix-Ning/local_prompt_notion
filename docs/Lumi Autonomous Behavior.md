Lumi Autonomous Behavior (主动行为) 实现方案

该方案旨在构建一个轻量级的 AI 行为系统，驱动 Lumi 在没有用户干预的情况下自主行动。

1. 行为三要素 (The Trinity of Behavior)

Lumi 的主动行为由三个核心循环组成，它们并行运行但互不干扰：

A. 游荡循环 (Wander Loop) - "巡逻"

逻辑：模拟生物的随机移动。

规则：

Idle Check：检查当前是否处于拖拽或交互状态。

Wait：随机发呆 5~12秒。

Pick Destination：根据权重选择下一个屏幕边缘坐标（底部 40% > 左右 20% > 顶部 20%）。

Move：计算距离，以恒定速度 (150px/s) 移动过去。

Repeat：到达后重新开始循环。

B. 闲聊循环 (Chat Loop) - "自言自语"

逻辑：独立的定时器，打破寂静。

规则：

每隔 10~20秒 触发一次。

从预设词库随机抽取一句（如 "Lumi~", "Anyone there?", "System OK"）。

气泡显示 3秒 后消失。

伴随动作：说话时身体会轻微向上弹跳 (y: -6)。

C. 睡眠循环 (Sleep Loop) - "生物钟"

逻辑：基于用户活跃度的全局状态机。

规则：

监听：监听全局 mousemove, keydown, click。

倒计时：每次操作重置 5秒 (演示) 或 5分钟 (实际) 倒计时。

入睡：倒计时结束 -> 切换 mode = 'sleep' -> 闭眼、趴下、冒 Zzz 气泡。

惊醒：检测到新操作 -> 切换 mode = 'idle' -> 触发惊醒弹跳动画。

2. 被动反馈 (Passive Feedback)

除了主动行为，Lumi 还能感知物理环境并做出即时反应，增强沉浸感。

A. 眼神跟随 (Gaze Tracking) - "注视"

逻辑：计算鼠标相对于猫眼中心的向量，限制瞳孔移动半径。

规则：

监听：mousemove 事件。

计算：获取鼠标坐标与猫咪中心坐标的差值 (dx, dy)。

限制：将瞳孔移动距离限制在眼眶内 (Max 3px)，避免“眼珠飞出”。

修正：吸附在顶部时保持直立，不反转 Y 轴计算。

B. 拖拽反馈 (Drag Reaction) - "被抓"

逻辑：利用 framer-motion 的 drag 属性。

规则：

开始：触发 onDragStart 时，停止所有思考和游荡，表情变为惊恐或兴奋，四肢自然下垂。

结束：触发 onDragEnd 时，根据最近边缘吸附。

C. 滚动风阻 (Scroll Wind) - "风压"

逻辑：监听滚动容器的 onScroll，计算滚动速度。

规则：

计算：velocity = |Δy| / Δt。

阈值：当速度 > 2.0 时触发。

表现：

Ears: SVG 路径变形，向后倒（飞机耳）。

Body: 重心下压 (y: 4, scaleY: 0.95) 对抗风力。

Eyes: 眯起 (ry: 2) 防止进沙。

3. 操作反馈实现详解 (Operational Feedback)

Lumi 作为系统的“第二反馈通道”，通过物理动作和眼睛变形来确认用户的操作。这部分逻辑主要由 mode 状态驱动，结合 framer-motion 的 animate 属性和 SVG 的条件渲染。

A. 通用动作库 (Action Library)

我们在 SpiritCat 组件中使用 framer-motion 的 animate 对象来定义所有物理动作。

// SpiritCat.tsx 内部
const bodyAnimation = {
  // 🚀 Create (新建卡片): 兴奋跳跃
  create_card: { y: [0, -15, 0], scale: [1, 1.1, 1] },
  
  // 📦 Folder (新建分类): 左右摇摆
  create_folder: { rotate: [0, -5, 5, -5, 5, 0] },
  
  // ✅ Update (保存成功): 用力点头
  update: { y: [0, 6, 0], scaleY: [1, 0.92, 1] },
  
  // 😱 Delete (删除): 恐惧震动
  delete: { rotate: [0, -5, 5, -5, 5, 0] },
  
  // ✨ Restore (恢复): 悬浮施法
  restore: { y: -15, rotate: [0, -2, 2, 0] },
  
  // ❤️ Favorite (收藏): 拥抱收缩
  favorite: { scaleX: 0.9, scaleY: 1.05, y: -5 },
  
  // 📌 Pin (置顶): 向上伸展
  pin: { y: -20, scaleY: 1.15, scaleX: 0.9 },
  
  // 📋 Clipboard (复制): 快速点头
  clipboard: { y: [0, 8, 0] }
};

// 应用到 motion.div
<motion.div animate={bodyAnimation[mode] || bodyAnimation.idle} ... />


B. 眼睛变形矩阵 (Eye Morphing Matrix)

通过条件渲染 SVG 路径 (path 或 rect) 来改变眼睛形状。

// SpiritCat.tsx 内部
<g transform="translate(0, 5)">
  {/* ➕ 加号眼 (Create) */}
  {mode === 'create_card' && (
    <g stroke={c.eyeCreate} strokeWidth="3" strokeLinecap="round">
      <path d="M 35 46 V 54" /> <path d="M 31 50 H 39" />
      <path d="M 65 46 V 54" /> <path d="M 61 50 H 69" />
    </g>
  )}

  {/* ■ 方块眼 (Folder) */}
  {mode === 'create_folder' && (
    <g fill={c.eyeFolder}>
       <rect x="31" y="46" width="8" height="8" rx="1" />
       <rect x="61" y="46" width="8" height="8" rx="1" />
    </g>
  )}

  {/* ✓ 对钩眼 (Update/Clipboard) */}
  {(mode === 'update' || mode === 'clipboard') && (
    <g stroke={c.eyeSuccess} strokeWidth="3" strokeLinecap="round" fill="none">
       <path d="M 28 50 L 33 55 L 42 45" />
       <path d="M 58 50 L 63 55 L 72 45" />
    </g>
  )}
  
  {/* ❌ 叉号眼 (Delete) */}
  {mode === 'delete' && (
    <g stroke={c.eyeDelete} strokeWidth="3" strokeLinecap="round">
       <path d="M 30 46 L 40 56" /> <path d="M 40 46 L 30 56" />
       <path d="M 60 46 L 70 56" /> <path d="M 70 46 L 60 56" />
    </g>
  )}

  {/* ✨ 星星眼 (Restore) */}
  {mode === 'restore' && (
     <g fill={c.eyeMagic}>
        <path d="M 35 44 L 36.5 48.5 L 41 50..." /> {/* 星星路径 */}
        <path d="M 65 44 L 66.5 48.5 L 71 50..." />
     </g>
  )}

  {/* ❤️ 爱心眼 (Favorite) */}
  {mode === 'favorite' && (
     <g fill={c.eyeLove}>
        <path d="M 35 47 C 32 44..." /> {/* 心形路径 */}
        <path d="M 65 47 C 62 44..." />
     </g>
  )}

  {/* ↑ 上视眼 (Pin) */}
  {mode === 'pin' && (
     <>
        <motion.ellipse cx="35" animate={{ cy: 40 }} rx="6" ry="8" fill={c.eyePin} />
        <motion.ellipse cx="65" animate={{ cy: 40 }} rx="6" ry="8" fill={c.eyePin} />
     </>
  )}
</g>


C. 颜色令牌 (Color Tokens)

在组件内部定义颜色映射表，支持深色/浅色模式切换。

const c = {
    // 基础色
    body: theme === 'dark' ? "#E2E8F0" : "#334155",
    
    // 状态色
    eyeCreate: "#22D3EE",   // Cyan
    eyeFolder: "#F97316",   // Orange
    eyeSuccess: "#10B981",  // Green
    eyeDelete: "#EF4444",   // Red
    eyeMagic: "#2DD4BF",    // Teal
    eyeLove: "#EC4899",     // Pink
    eyePin: "#F59E0B"       // Amber
};


4. 状态优先级与仲裁

为了防止行为冲突（例如正在睡觉时突然开始游荡），我们需要一个简单的优先级仲裁机制。

状态优先级表：

Drag (最高)：用户正在拖拽 -> 暂停所有主动行为。

Interaction：用户点击/交互 -> 唤醒睡眠，暂停游荡。

Sleep：正在睡眠 -> 暂停游荡和闲聊。

Wander/Chat (最低)：仅在 idle 且 !sleep 时运行。

5. 核心代码结构

// Wander Loop
useEffect(() => {
  const wander = async () => {
    if (isBusy || isSleeping) return retryLater();
    await moveToRandomPoint();
    wander();
  };
  wander();
}, [isSleeping]);

// Sleep System
useEffect(() => {
  const reset = () => {
     setIsSleeping(false);
     resetTimer();
  };
  window.addEventListener('mousemove', reset);
}, []);

// Gaze Tracking
useEffect(() => {
  const handleMouseMove = (e) => {
    const dx = e.clientX - (catX + 50);
    const dy = e.clientY - (catY + 50);
    const angle = Math.atan2(dy, dx);
    const dist = Math.min(3, Math.sqrt(dx*dx + dy*dy) / 20);
    
    // 倒挂修正
    const modifier = orientation === 'top' ? -1 : 1;
    pupilX.set(Math.cos(angle) * dist * modifier);
    pupilY.set(Math.sin(angle) * dist * modifier);
  };
  window.addEventListener('mousemove', handleMouseMove);
}, []);

// Scroll Wind
const handleScroll = (e) => {
  const speed = Math.abs(e.scrollTop - lastY) / (now - lastTime);
  if (speed > 2.0) setIsWindy(true);
  clearTimeout(windTimer);
  windTimer = setTimeout(() => setIsWindy(false), 200);
};
