# Bug 修复日志 (BUGFIX_LOG.md)

> **用途**: 记录重要 Bug 的修复过程，作为未来参考

---

## 2026-01-24: Task Scheduler System Bug Fixes

### 背景
用户报告任务调度系统存在多个问题，需要全面测试和修复。

---

### Bug #1: 根目录任务未被扫描
**症状**: 放在 vault 根目录的任务不会被调度器扫描到

**根本原因**: 
- `TaskScheduler._resetAllIntervalTasks()` 只扫描子目录，未扫描根目录
- `_checkTasks()` 和 `notifyTask()` 同样缺少根目录扫描

**修复方案**:
```javascript
// 在三个方法中添加根目录扫描
await this.loadPromptsInDirectory(this.vaultRoot);
```

**影响文件**: `server/utils/intervalTaskScheduler.js`

**状态**: ✅ 已修复

---

### Bug #3: 类名误导
**症状**: 类名 `IntervalTaskScheduler` 不准确，实际支持所有类型任务

**修复方案**: 重命名为 `TaskScheduler`

**影响文件**: 
- `server/utils/intervalTaskScheduler.js`
- `server/index.js`
- `server/routes/intervalTasks.js`

**状态**: ✅ 已修复

---

### Bug #4: 根目录任务分类字段错误
**症状**: 根目录任务的 `category` 字段为 `undefined`，应为空字符串

**修复方案**:
```javascript
category: categoryPath || ""  // 根目录任务设置为空字符串
```

**影响文件**: `server/utils/intervalTaskScheduler.js`

**状态**: ✅ 已修复

---

### Bug #5: 周/月任务未计算触发时间
**症状**: 周任务和月任务的 `nextTriggerTime` 为 null

**根本原因**: `resolveRecurringTrigger()` 只处理未来触发时间，未考虑当前周期

**修复方案**:
```javascript
// 计算当前周期的触发时间（过去的时间点）
const cycleStart = getRecurringCycleStart(recurrence);
return cycleStart;
```

**影响文件**: `server/routes/intervalTasks.js`

**状态**: ✅ 已修复

---

### Bug #8: 删除任务后仍在待通知队列
**症状**: 删除任务后，刷新页面仍会收到通知

**根本原因**: 删除任务时未从 `scheduler.pendingNotifications` 中移除

**修复方案**:
```javascript
// 在删除路由中添加
scheduler.pendingNotifications.delete(id);
```

**影响文件**: `server/routes/prompts.js`

**状态**: ✅ 已修复

---

### Bug #9: 间隔任务确认后立即重新触发
**症状**: 点击确认后，任务立即再次触发通知

**根本原因**: `acknowledgeTask()` 更新 `last_notified` 时未检查下一周期是否已到期

**修复方案**:
```javascript
// 检查下一周期是否已到期
const nextCycleTime = lastNotifiedMs + intervalMs;
if (now >= nextCycleTime) {
  // 已进入下一周期，不更新 last_notified
  return { success: true, message: 'Next cycle already due' };
}
// 否则正常更新
```

**影响文件**: `server/routes/intervalTasks.js`

**状态**: ✅ 已修复

---

### Bug #10: 启动时立即弹出通知
**症状**: 应用启动后立即弹出多个通知

**根本原因**: 调度器启动后立即检查任务，未给予缓冲时间

**修复方案**:
```javascript
// 添加 3 秒启动抑制期
const STARTUP_GRACE_PERIOD = 3000;
if (Date.now() - this.startTime < STARTUP_GRACE_PERIOD) {
  return;
}
```

**影响文件**: `server/utils/intervalTaskScheduler.js`

**状态**: ✅ 已修复

---

### Bug #11: 刷新后倒计时未重置
**症状**: 间隔任务的倒计时在刷新页面后继续上次的进度，而非从头开始

**根本原因**: 
1. 倒计时计算依赖缓存状态，刷新后仍沿用旧进度
2. interval 任务的起始时间未统一约束

**修复方案**:
```typescript
// useCountdown 仅基于 targetDate 与 startDate 计算
const countdown = useCountdown(targetDateStr, startDateStr);

// interval 任务起点统一为 last_notified / created_at
const progressStartDate = prompt.meta.last_notified ?? prompt.meta.created_at;
```

**影响文件**: 
- `src/components/PromptList.tsx`
- `src/components/ChronoCard.tsx`
- `src/components/TaskEditorOverlay.tsx`
- `src/hooks/useCountdown.ts`

**状态**: ⚠️ 已实现，待 UI 走查

---

### Bug #12: ImportPromptsDialog 语法错误
**症状**: Vite 编译报错 "Unexpected token (742:4)"

**根本原因**: JSX 结构中缺少一个闭合的 `</div>` 标签

**定位过程**:
1. 错误信息指向 `ImportPromptsDialog.tsx:742`
2. 检查 div 标签数量: 37 个开标签，35 个闭标签
3. 追踪 `content` 变量的 JSX 结构
4. 发现在 line 719 只有一个 `</div>`，但需要两个

**修复方案**:
```jsx
// 修复前
      </div>
  );

// 修复后
      </div>
    </div>
  );
```

**影响文件**: `src/components/ImportPromptsDialog.tsx`

**状态**: ✅ 已修复

---

## 经验教训

### 1. JSX 结构验证
- **问题**: 复杂的条件渲染容易遗漏闭合标签
- **解决方案**: 
  - 使用 IDE 的括号匹配功能
  - 定期运行 `npm run build` 验证
  - 使用 `grep` 统计标签数量: `grep -o '<div' file.tsx | wc -l`

### 2. sessionStorage 持久化陷阱
- **问题**: sessionStorage 在页面刷新后仍然保留，导致状态不一致
- **解决方案**: 
  - 在应用启动时主动清理相关缓存
  - 使用时间戳作为 key 的一部分，确保每次启动都是新的周期

### 3. 调度器启动抑制
- **问题**: 调度器启动后立即检查任务，导致误报
- **解决方案**: 
  - 添加启动缓冲期（3-5 秒）
  - 区分"启动时已过期"和"运行中过期"

### 4. 删除操作的完整性
- **问题**: 删除任务时只删除文件，未清理内存中的引用
- **解决方案**: 
  - 删除时同步清理所有相关数据结构
  - 包括: 文件、内存缓存、待通知队列、倒计时状态等

---

## 测试清单

### 间隔任务 (Interval Tasks)
- [ ] 创建 1 分钟间隔任务
- [ ] 等待触发通知
- [ ] 点击确认，验证不会立即重新触发
- [ ] 刷新页面，验证倒计时从 60 秒重新开始
- [ ] 删除任务，验证不再收到通知

### 一次性任务 (One-time Tasks)
- [ ] 创建过期的一次性任务
- [ ] 验证启动后 3 秒内不弹通知
- [ ] 验证 3 秒后弹出通知
- [ ] 点击确认，验证任务移至回收站

### 重复任务 (Recurring Tasks)
- [ ] 创建每日任务，验证触发时间计算正确
- [ ] 创建每周任务，验证只在指定星期触发
- [ ] 创建每月任务，验证只在指定日期触发
- [ ] 验证重复任务确认后不移至回收站

### 根目录任务
- [ ] 在 vault 根目录创建任务
- [ ] 验证任务被正确扫描和调度
- [ ] 验证 category 字段为空字符串

---

## 2026-01-24: Lumi Sleep Bubble Bug Fixes

### 背景
用户报告 Lumi 精灵的睡眠气泡存在三个问题：
1. 气泡位置不在 Lumi 正上方
2. 出现两个睡眠气泡
3. 气泡无法消失

---

### Bug #13: 睡眠气泡位置不跟随 Lumi 方向
**症状**: 睡眠气泡始终显示在固定位置，当 Lumi 在左侧或右侧时，气泡不在正确位置

**根本原因**: 气泡位置是硬编码的 `top: -72px, left: 50%`，没有根据 Lumi 的 orientation 调整

**修复方案**:
```typescript
// 添加 state 存储气泡位置
const [sleepBubblePosition, setSleepBubblePosition] = useState({
  top: -72, left: '50%', transform: 'translateX(-50%)'
});

// 根据 orientation 动态更新位置
useEffect(() => {
  if (orientation === 'bottom') {
    setSleepBubblePosition({ top: -72, left: '50%', transform: 'translateX(-50%)' });
  } else if (orientation === 'left') {
    setSleepBubblePosition({ top: -48, left: '100%', marginLeft: 8 });
  } else {
    setSleepBubblePosition({ top: -48, right: '100%', marginRight: 8 });
  }
}, [orientation]);

// 小三角也根据方向调整
<div 
  className="absolute h-2 w-2 rotate-45 bg-indigo-500/80"
  style={{
    ...(orientation === 'bottom'
      ? { bottom: 0, left: '50%', transform: 'translateX(-50%) translateY(50%)' }
      : orientation === 'left'
      ? { left: 0, top: '50%', transform: 'translateX(-50%) translateY(-50%)' }
      : { right: 0, top: '50%', transform: 'translateX(50%) translateY(-50%)' }
    )
  }}
/>
```

**影响文件**: `src/components/LuminaCat.tsx`

**状态**: ✅ 已修复

---

### Bug #14: 出现两个睡眠气泡
**症状**: 当 Lumi 移动到不同边缘时，会同时显示两个 "Zzz" 气泡

**根本原因**: 
- 使用 `key={`sleep-bubble-${orientation}`}` 导致 orientation 改变时创建新的气泡实例
- AnimatePresence 在旧气泡退出动画期间，新气泡已经开始进入动画
- 结果：两个气泡短暂共存

**修复方案**:
```typescript
// 修复前：key 包含 orientation，导致重新创建
<motion.div key={`sleep-bubble-${orientation}`} ...>

// 修复后：固定 key，通过 CSS transition 平滑过渡位置
<motion.div 
  key="sleep-bubble"
  className="... transition-all duration-300"
  style={{ ...sleepBubblePosition }}
>
```

**额外优化**:
- 添加 `AnimatePresence mode="wait"` 确保旧气泡完全退出
- 添加 `pointer-events-none` 防止气泡干扰交互
- 使用 CSS `transition-all` 实现位置平滑过渡

**影响文件**: `src/components/LuminaCat.tsx`

**状态**: ✅ 已修复

---

### Bug #15: 睡眠气泡无法消失
**症状**: 
- 用户移动鼠标或点击后，睡眠气泡仍然显示
- 气泡与其他操作气泡同时出现

**根本原因**: 
1. 条件判断不够严格，缺少 `!isThinking` 条件
2. 没有在活动时主动通知 LumiContext 清除睡眠状态
3. `bubbleItems` 在睡眠状态下仍然返回其他气泡，导致冲突

**修复方案**:
```typescript
// 1. 加强条件判断
{isSleeping && !action && !timeState && !transferState && !isDragging && !isThinking && (
  <motion.div key="sleep-bubble" ...>
)}

// 2. 任何活动都通知 LumiContext
useEffect(() => {
  if (action || transferState || timeState || isDragging || isThinking) {
    setIsThinking(false);
    notifyActivity(); // 🔥 主动清除睡眠状态
  }
}, [action, isDragging, timeState, transferState, isThinking, notifyActivity]);

// 3. 睡眠状态下不显示其他气泡
const bubbleItems = useMemo(() => {
  if (isSleeping) return []; // 🔥 睡眠时返回空数组
  // ... 其他气泡逻辑
}, [action, chatMessage, isThinking, isDragging, timeState, transferState, isSleeping]);

// 4. 添加明确的退出动画
exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.3 } }}
```

**影响文件**: `src/components/LuminaCat.tsx`

**状态**: ✅ 已修复

---

## 经验教训

### 1. AnimatePresence 的 key 管理
**问题**: 动态 key 会导致组件重新创建，而不是更新
**解决方案**: 
- 使用固定 key，通过 props/state 更新内容
- 需要重新创建时才使用动态 key
- 使用 `mode="wait"` 控制进入/退出顺序

### 2. 状态同步
**问题**: 子组件状态与 Context 状态不同步
**解决方案**: 
- 在状态变化时主动调用 Context 的更新方法
- 使用 useEffect 监听相关状态变化
- 确保所有活动都通知到 Context

### 3. 条件渲染的完整性
**问题**: 条件判断不够全面，导致意外渲染
**解决方案**: 
- 列出所有互斥状态（睡眠 vs 活动）
- 在条件中明确排除所有冲突状态
- 使用 early return 简化逻辑

### 4. CSS vs JS 动画
**问题**: 位置变化使用 JS 重新创建组件，导致闪烁
**解决方案**: 
- 简单的位置/样式变化使用 CSS transition
- 复杂的进入/退出动画使用 framer-motion
- 结合使用以获得最佳效果

---

## 测试清单

### 睡眠气泡功能
- [x] Lumi 在底部时，气泡显示在正上方
- [x] Lumi 在左侧时，气泡显示在右侧
- [x] Lumi 在右侧时，气泡显示在左侧
- [x] 移动 Lumi 时，气泡位置平滑过渡
- [x] 只显示一个睡眠气泡
- [x] 移动鼠标时，气泡立即消失
- [x] 点击操作时，气泡立即消失
- [x] 睡眠气泡不与其他气泡同时显示
- [x] 气泡退出动画流畅

---

**最后更新**: 2026-01-24  
**维护者**: AI Bug Hunter  
**总计修复**: 15 个 Bug (12 个调度器 + 3 个 Lumi)
