# Lumi 交互与反馈更新

**日期**: 2026-01-24  
**组件**: SpiritCat / LumiContext / App  
**变更范围**: 交互反馈 + 气泡统一 + 嘴巴/风压形态

---

## 更新概览

- 点击 Lumi 切换思考形态，触发缩放反馈、眼色变青与身体路径拉伸
- 气泡反馈统一为图标样式，动作优先级高于闲聊/提示
- 风压与睡眠状态下嘴巴/眼睛/尾巴细节同步

## 交互规范

### 1. 气泡优先级
- 动作/传输/时间反馈优先于通知/闲聊
- 图标 + 文字一致，颜色与动作类型绑定

### 2. 思考交互
- 点击 Lumi 切换思考状态
- 光环加速、眼色变青、身体拉伸、缩放反馈

### 3. 嘴巴与风压
- 睡眠为直线嘴型
- 思考为更深的弧线
- 风压时嘴型收敛、眼睛更小

---

## 旧版记录（已过期）

---

## Bug #13: 睡眠气泡位置不跟随 Lumi 方向

### 症状
睡眠气泡始终显示在固定位置，当 Lumi 在左侧或右侧时，气泡不在正确位置。

### 根本原因
气泡位置是硬编码的 `top: -72px, left: 50%`，没有根据 Lumi 的 `orientation` (bottom/left/right) 调整。

### 修复方案
```typescript
// 1. 添加 state 存储气泡位置
const [sleepBubblePosition, setSleepBubblePosition] = useState({
  top: -72, left: '50%', transform: 'translateX(-50%)'
});

// 2. 根据 orientation 动态更新位置
useEffect(() => {
  if (orientation === 'bottom') {
    setSleepBubblePosition({ top: -72, left: '50%', transform: 'translateX(-50%)' });
  } else if (orientation === 'left') {
    setSleepBubblePosition({ top: -48, left: '100%', marginLeft: 8 });
  } else {
    setSleepBubblePosition({ top: -48, right: '100%', marginRight: 8 });
  }
}, [orientation]);

// 3. 应用动态位置
<motion.div
  style={{ 
    maxWidth: 220,
    ...sleepBubblePosition
  }}
>
```

### 效果
- ✅ Lumi 在底部时，气泡显示在正上方
- ✅ Lumi 在左侧时，气泡显示在右侧
- ✅ Lumi 在右侧时，气泡显示在左侧
- ✅ 位置变化平滑过渡

---

## Bug #14: 出现两个睡眠气泡

### 症状
当 Lumi 移动到不同边缘时，会同时显示两个 "Zzz" 气泡。

### 根本原因
使用动态 key `key={`sleep-bubble-${orientation}`}` 导致：
1. orientation 改变时，React 认为是新组件
2. 创建新气泡实例，旧气泡开始退出动画
3. 在退出动画期间，两个气泡同时存在

### 修复方案
```typescript
// 修复前：动态 key 导致重新创建
<motion.div key={`sleep-bubble-${orientation}`} ...>

// 修复后：固定 key + CSS transition
<motion.div 
  key="sleep-bubble"
  className="... transition-all duration-300"
  style={{ ...sleepBubblePosition }}
>

// 添加 AnimatePresence 配置
<AnimatePresence mode="wait">
  {isSleeping && ... && (
    <motion.div ... />
  )}
</AnimatePresence>
```

### 关键改进
1. **固定 key**: 避免组件重新创建
2. **CSS transition**: 位置变化使用 CSS 平滑过渡
3. **mode="wait"**: 确保旧气泡完全退出后再显示新气泡
4. **pointer-events-none**: 防止气泡干扰交互

### 效果
- ✅ 只显示一个睡眠气泡
- ✅ 位置变化平滑过渡，无闪烁
- ✅ 不干扰用户交互

---

## Bug #15: 睡眠气泡无法消失

### 症状
- 用户移动鼠标或点击后，睡眠气泡仍然显示
- 气泡与其他操作气泡同时出现

### 根本原因
1. **条件判断不完整**: 缺少 `!isThinking` 条件
2. **状态不同步**: 子组件活动时没有通知 LumiContext
3. **气泡冲突**: `bubbleItems` 在睡眠状态下仍返回其他气泡

### 修复方案

#### 1. 加强条件判断
```typescript
// 修复前
{isSleeping && !action && !timeState && !transferState && !isDragging && (

// 修复后：添加 !isThinking
{isSleeping && !action && !timeState && !transferState && !isDragging && !isThinking && (
```

#### 2. 主动通知 Context
```typescript
useEffect(() => {
  // 任何活动都通知 LumiContext 清除睡眠状态
  if (action || transferState || timeState || isDragging || isThinking) {
    setIsThinking(false);
    notifyActivity(); // 🔥 关键：主动清除睡眠状态
  }
}, [action, isDragging, timeState, transferState, isThinking, notifyActivity]);
```

#### 3. 防止气泡冲突
```typescript
const bubbleItems = useMemo(() => {
  // 睡眠状态下不显示其他气泡
  if (isSleeping) return [];
  
  // ... 其他气泡逻辑
}, [action, chatMessage, isThinking, isDragging, timeState, transferState, isSleeping]);
```

#### 4. 明确退出动画
```typescript
exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.3 } }}
```

### 效果
- ✅ 移动鼠标时，气泡立即消失
- ✅ 点击操作时，气泡立即消失
- ✅ 睡眠气泡不与其他气泡同时显示
- ✅ 退出动画流畅

---

## 技术要点

### 1. AnimatePresence 的 key 管理
**原则**: 
- 需要更新内容时使用固定 key + props/state
- 需要重新创建时才使用动态 key

**示例**:
```typescript
// ❌ 错误：位置变化使用动态 key
<motion.div key={`bubble-${position}`} style={{ left: position }} />

// ✅ 正确：固定 key + CSS transition
<motion.div 
  key="bubble" 
  className="transition-all"
  style={{ left: position }} 
/>
```

### 2. 状态同步模式
**问题**: 子组件状态与 Context 状态不同步

**解决方案**:
```typescript
// 在状态变化时主动调用 Context 方法
useEffect(() => {
  if (hasActivity) {
    notifyActivity(); // 通知 Context
  }
}, [hasActivity, notifyActivity]);
```

### 3. 条件渲染的完整性
**原则**: 列出所有互斥状态

```typescript
// ❌ 不完整
{isSleeping && !action && (

// ✅ 完整：排除所有冲突状态
{isSleeping && !action && !timeState && !transferState && !isDragging && !isThinking && (
```

### 4. CSS vs JS 动画选择
**指导原则**:
- **CSS transition**: 简单的位置/样式变化
- **framer-motion**: 复杂的进入/退出动画
- **结合使用**: 获得最佳效果

```typescript
<motion.div
  // framer-motion: 进入/退出动画
  initial={{ opacity: 0, scale: 0.85 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.8 }}
  // CSS: 位置变化
  className="transition-all duration-300"
  style={{ left: dynamicPosition }}
/>
```

---

## 测试清单

### 功能测试
- [x] Lumi 在底部时，气泡显示在正上方
- [x] Lumi 在左侧时，气泡显示在右侧
- [x] Lumi 在右侧时，气泡显示在左侧
- [x] 移动 Lumi 时，气泡位置平滑过渡
- [x] 只显示一个睡眠气泡（无重复）

### 交互测试
- [x] 移动鼠标时，气泡立即消失
- [x] 点击页面时，气泡立即消失
- [x] 拖动 Lumi 时，气泡立即消失
- [x] 点击 Lumi 时，气泡立即消失

### 状态测试
- [x] 睡眠气泡不与操作气泡同时显示
- [x] 睡眠气泡不与聊天气泡同时显示
- [x] 睡眠气泡不与思考气泡同时显示
- [x] 气泡退出动画流畅

### 边缘情况
- [x] 快速移动 Lumi 不会产生多个气泡
- [x] 快速触发多个操作不会导致气泡卡住
- [x] 页面刷新后睡眠状态正确重置

---

## 文件变更

### 修改的文件
- `src/components/LuminaCat.tsx` - 修复所有三个睡眠气泡问题

### 变更统计
- 新增代码: ~30 行
- 修改代码: ~15 行
- 删除代码: ~5 行
- 总计: ~40 行变更

---

## 经验教训

### 1. 动画组件的 key 管理很重要
动态 key 会导致组件重新创建，而不是更新。只在真正需要重新创建时使用动态 key。

### 2. 状态同步需要主动通知
子组件的状态变化需要主动通知父组件或 Context，不能依赖被动监听。

### 3. 条件渲染要考虑所有互斥状态
不完整的条件判断会导致意外的渲染冲突。

### 4. CSS 和 JS 动画各有优势
简单的样式变化用 CSS transition 更高效，复杂的动画用 framer-motion 更灵活。

---

## 后续优化建议

### P0 (已完成)
- ✅ 修复气泡位置跟随
- ✅ 修复重复气泡
- ✅ 修复气泡消失

### P1 (可选)
- ⚪ 添加气泡淡入淡出音效
- ⚪ 优化气泡动画性能（使用 will-change）
- ⚪ 添加气泡大小随时间变化的呼吸效果

### P2 (未来)
- ⚪ 支持自定义气泡样式
- ⚪ 支持多种睡眠状态（浅睡、深睡）
- ⚪ 添加唤醒动画

---

**修复完成时间**: 2026-01-24  
**测试状态**: ✅ 全部通过  
**部署状态**: ✅ 已部署到开发环境
