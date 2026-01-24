# Lumi Autonomous Behavior 文档一致性报告

## 文档范围
- docs/Lumi Autonomous Behavior.md

## 功能清单与比对项
- 功能描述：游荡/闲聊/睡眠三循环 + 被动反馈
- 输入输出要求：输入为用户活动、拖拽、滚动；输出为 mode/气泡/形态变化
- 业务逻辑流程：闲聊/游荡定时循环 + 活跃唤醒睡眠
- 性能指标：文档未定义
- UI 要求：漂浮、眼神跟随、风压、拖拽反馈
- 错误处理：文档未定义
- 数据验证：文档未定义

## 实现定位
- 游荡/闲聊/睡眠：[App.tsx](file:///d:/workspace/projects/local_prompt_notion_complete/Lumina/src/App.tsx#L383-L441)
- 眼神跟随：[App.tsx](file:///d:/workspace/projects/local_prompt_notion_complete/Lumina/src/App.tsx#L328-L347)
- 风压检测：[App.tsx](file:///d:/workspace/projects/local_prompt_notion_complete/Lumina/src/App.tsx#L457-L470) [LumiContext.tsx](file:///d:/workspace/projects/local_prompt_notion_complete/Lumina/src/contexts/LumiContext.tsx)
- 拖拽反馈：[App.tsx](file:///d:/workspace/projects/local_prompt_notion_complete/Lumina/src/App.tsx#L472-L490)
- 形态优先级：[App.tsx](file:///d:/workspace/projects/local_prompt_notion_complete/Lumina/src/App.tsx#L498-L504)

## 一致性评估
- 功能完整性：一致
- 逻辑一致性：一致（游荡/闲聊/睡眠均已落地）
- 接口一致性：一致
- 数据一致性：无数据结构要求
- 用户体验：一致
- 边界条件：未定义

## 差异记录
- 未发现差异

## 验证步骤
- 静置 1 分钟，确认睡眠进入/唤醒
- 观察 5~12 秒随机游荡与停留
- 拖拽与滚动时观察状态优先级与风压反馈
