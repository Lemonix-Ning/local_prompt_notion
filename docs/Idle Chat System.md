Idle Chat System (闲聊系统) 交互设计方案

该方案旨在赋予 Lumi 独立的“性格”。通过随机触发的对话气泡，打破静态界面的沉闷感，建立与用户的情感连接。

1. 核心逻辑 (Core Logic)

A. 闲聊引擎 (Chat Engine)

触发机制：基于随机时间间隔的递归定时器。

频率：每隔 10 ~ 20 秒 触发一次对话，保持一种“偶尔活跃”的节奏，不造成干扰。

词库 (Vocabulary)：

标志性口头禅： "Lumi Lumi~" (高频出现，建立角色认知)。

环境感知： "System stable." "Pixel perfect." (体现工具属性)。

卖萌： "Meow?" "stares" (增加生物感)。

B. 状态管理

状态：chatMessage (string | null)。

互斥：当用户正在拖拽 (isDragging) 或触发了创建反馈 (creationState) 时，暂停闲聊，优先响应用户操作。

2. 视觉反馈规范 (Visual Specifications)

A. 气泡设计 (Bubble Design)

样式：采用漫画风格的对话框，圆角矩形，底部带有指向 Lumi 的小三角。

位置：头顶右上方 (top: -24px, right: -16px)。

动效：

Enter: 弹性弹出 (scale: 0.5 -> 1, opacity: 0 -> 1)。

Exit: 快速淡出 (opacity: 1 -> 0)。

B. 伴随动作 (Body Language)

说话时不能只是弹个框，身体也要动。

动作：身体轻微向上弹跳两次 (y: [0, -6, 0])，模拟说话时的身体起伏。

时序：与气泡出现同步。

3. 关键代码实现

A. 随机说话循环 (The Loop)

useEffect(() => {
  const phrases = ["Lumi Lumi~", "System All Green", "Meow?", "✨"];
  
  const talk = () => {
     // 如果正在忙（拖拽或交互），则推迟说话
     if (isDragging.current || creationState) {
         timeoutRef.current = setTimeout(talk, 5000); 
         return;
     }
     
     // 1. 说话
     const text = phrases[Math.floor(Math.random() * phrases.length)];
     setChatMessage(text);
     
     // 2. 闭嘴 (3秒后)
     setTimeout(() => setChatMessage(null), 3000);
     
     // 3. 下一次说话 (10-20秒后)
     timeoutRef.current = setTimeout(talk, 10000 + Math.random() * 10000);
  };
  
  // 启动
  timeoutRef.current = setTimeout(talk, 2000);
  
  return () => clearTimeout(timeoutRef.current);
}, [creationState]); // 依赖 creationState 以便在交互结束后重启


B. 身体动作响应

// SpiritCat 组件
<motion.div
  animate={
      chatMessage ? { y: [0, -6, 0] } : // 说话时跳动
      creationState ? { ... } :         // 创建时反馈
      orientation !== 'bottom' ? ...    // 悬浮时呼吸
  }
  transition={{ 
      y: { 
          // 说话动作要快且重复
          duration: chatMessage ? 0.3 : 3, 
          repeat: chatMessage ? 2 : Infinity 
      } 
  }}
>
