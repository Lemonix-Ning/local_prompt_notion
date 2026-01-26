# Lumi Spirit Cat 集成指南

## 概述

`feature/lumi-spirit-cat` 分支包含 Lumi 精灵猫的核心组件，但需要手动集成到主应用中才能使用。

## 已包含的文件

- `src/components/SpiritCat.tsx` - Lumi 组件（SVG 猫咪角色 + 动画）
- `src/contexts/LumiContext.tsx` - Lumi 状态管理

## 需要集成的文件

要让 Lumi 正常工作，需要修改以下文件：

### 1. `src/App.tsx`

#### 添加导入：

```typescript
import { useCallback, useRef, type ComponentProps, type RefObject } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, type Transition } from 'framer-motion';
import { useTheme } from './contexts/ThemeContext';
import { LumiProvider, useLumi } from './contexts/LumiContext';
import { SpiritCat, type LumiOrientation } from './components/SpiritCat';
import { AlertCircle, Bell, Check, Clock, Copy, Download, FileSignature, FolderPlus, Heart, Loader2, Pin, RotateCcw, Search, Sparkles, Trash2 } from 'lucide-react';
```

#### 添加 LumiOverlay 组件：

在 `AppContent` 组件之前添加完整的 `LumiOverlay` 组件（约 600 行代码）。

关键部分：
- 常量定义：`CAT_SIZE`, `CONTAINER_PADDING`, `IDLE_PHRASES`, `EDGE_BAND`
- 辅助函数：`getSidebarWidth`, `getSafeBounds`, `pickWanderTarget`
- `LumiOverlay` 组件：包含所有 Lumi 的行为逻辑

#### 修改 AppContent：

```typescript
function AppContent({ initialRoot }: { initialRoot: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { triggerTransfer } = useLumi();
  
  // ... 其他代码
  
  return (
    <div ref={containerRef} className="app-container">
      {/* 现有内容 */}
      <Sidebar />
      <PromptList />
      
      {/* 添加 Lumi */}
      <LumiOverlay containerRef={containerRef} />
    </div>
  );
}
```

#### 包装 LumiProvider：

```typescript
export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <LumiProvider>  {/* 添加这一层 */}
            <AppProvider adapter={adapter}>
              <AppContent initialRoot={initialRoot} />
            </AppProvider>
          </LumiProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
```

### 2. `src/components/Sidebar.tsx`

#### 添加导入：

```typescript
import { useLumi } from '../contexts/LumiContext';
```

#### 在组件中使用：

```typescript
function Sidebar() {
  const { triggerAction } = useLumi();
  
  // 在创建分类时触发动画
  const handleCreateCategory = async () => {
    // ... 创建逻辑
    triggerAction('create_folder', '已创建分类');
  };
  
  // 在删除分类时触发动画
  const handleDeleteCategory = async () => {
    // ... 删除逻辑
    triggerAction('delete', '已删除分类');
  };
}
```

### 3. `src/components/PromptList.tsx`

#### 添加导入：

```typescript
import { useLumi } from '../contexts/LumiContext';
```

#### 在组件中使用：

```typescript
function PromptList() {
  const { triggerAction, notifyMessage } = useLumi();
  
  // 创建卡片
  const handleCreatePrompt = async () => {
    // ... 创建逻辑
    triggerAction('create_card', '已创建新卡片');
  };
  
  // 删除卡片
  const handleDeletePrompt = async () => {
    // ... 删除逻辑
    triggerAction('delete', '已删除卡片');
  };
  
  // 恢复卡片
  const handleRestorePrompt = async () => {
    // ... 恢复逻辑
    triggerAction('restore', '已恢复卡片');
  };
  
  // 收藏
  const handleToggleFavorite = async () => {
    // ... 收藏逻辑
    triggerAction('favorite', isFavorite ? '已取消收藏' : '已收藏');
  };
  
  // 置顶
  const handleTogglePin = async () => {
    // ... 置顶逻辑
    triggerAction('pin', isPinned ? '已取消置顶' : '已置顶');
  };
  
  // 重命名
  const handleRename = async () => {
    // ... 重命名逻辑
    triggerAction('rename', '已重命名');
  };
  
  // 复制
  const handleCopy = async () => {
    // ... 复制逻辑
    triggerAction('clipboard', '已复制到剪贴板');
  };
  
  // 搜索
  const handleSearch = async () => {
    // ... 搜索逻辑
    triggerAction('search', '搜索中...');
  };
}
```

## 完整集成步骤

### 方法 1：手动集成（推荐用于学习）

1. 从 `feature/lumi-spirit-cat` 分支复制两个核心文件：
   ```bash
   git checkout feature/lumi-spirit-cat -- src/components/SpiritCat.tsx src/contexts/LumiContext.tsx
   ```

2. 参考 `feature/lumi-on-master` 分支的完整实现，手动修改：
   - `src/App.tsx`
   - `src/components/Sidebar.tsx`
   - `src/components/PromptList.tsx`

3. 测试所有功能是否正常工作

### 方法 2：直接合并（快速集成）

如果你的项目基于 `master` 分支，可以直接合并 `feature/lumi-on-master` 分支：

```bash
# 切换到你的分支
git checkout your-branch

# 合并 Lumi 完整实现
git merge feature/lumi-on-master

# 解决冲突（如果有）
# 然后提交
git commit
```

### 方法 3：Cherry-pick 提交（精确控制）

从 `feature/lumi-on-master` 分支选择性地应用提交：

```bash
# 查看 feature/lumi-on-master 的提交历史
git log feature/lumi-on-master --oneline

# Cherry-pick 特定的 Lumi 提交
git cherry-pick <commit-hash>
```

## 依赖检查

确保 `package.json` 中包含以下依赖：

```json
{
  "dependencies": {
    "framer-motion": "^11.x.x",
    "lucide-react": "^0.x.x"
  }
}
```

如果缺少，运行：
```bash
npm install framer-motion lucide-react
```

## 功能验证

集成完成后，验证以下功能：

1. **Lumi 显示**：页面加载后应该看到一只小猫在屏幕边缘
2. **自主游荡**：Lumi 会自动在屏幕边缘移动
3. **闲聊**：偶尔会显示闲聊气泡（"Lumi Lumi~", "System stable." 等）
4. **动作反馈**：
   - 创建卡片 → 显示 "New Card!" 气泡
   - 删除卡片 → 显示 "Deleted!" 气泡
   - 收藏 → 显示 "Loved!" 气泡
   - 等等
5. **拖拽**：可以拖动 Lumi 到不同位置
6. **睡眠模式**：长时间不操作会进入睡眠状态

## 常见问题

### Q: Lumi 不显示？
A: 检查：
1. `LumiProvider` 是否正确包装了 `AppProvider`
2. `LumiOverlay` 是否添加到 `AppContent` 中
3. `containerRef` 是否正确传递
4. 浏览器控制台是否有错误

### Q: 动作反馈不工作？
A: 检查：
1. 是否在操作函数中调用了 `triggerAction()`
2. `useLumi()` hook 是否正确导入和使用
3. 操作是否成功执行（先确保基础功能正常）

### Q: Lumi 位置不对？
A: 检查：
1. `containerRef` 是否绑定到正确的容器元素
2. CSS 样式是否影响了定位
3. 容器是否有 `position: relative` 或 `position: absolute`

## 参考实现

完整的集成实现可以参考 `feature/lumi-on-master` 分支：

```bash
# 查看完整实现
git checkout feature/lumi-on-master

# 查看具体文件的差异
git diff master feature/lumi-on-master -- src/App.tsx
git diff master feature/lumi-on-master -- src/components/Sidebar.tsx
git diff master feature/lumi-on-master -- src/components/PromptList.tsx
```

## 自定义配置

### 修改 Lumi 行为

在 `src/App.tsx` 的 `LumiOverlay` 组件中：

```typescript
// 修改闲聊词库
const IDLE_PHRASES = ['你的自定义文本', 'Hello!', '...'];

// 修改游荡频率
setTimeout(wander, 5000 + Math.random() * 7000); // 5-12秒

// 修改闲聊频率
scheduleNext(18000 + Math.random() * 10000); // 18-28秒
```

### 修改 Lumi 外观

在 `src/components/SpiritCat.tsx` 中修改 SVG 路径和颜色。

## 总结

Lumi 是一个模块化的功能，核心组件独立，但需要在主应用中集成才能使用。建议：

1. **学习阶段**：使用方法 1 手动集成，理解每个部分的作用
2. **快速使用**：使用方法 2 直接合并完整实现
3. **精确控制**：使用方法 3 选择性应用提交

如有问题，参考 `feature/lumi-on-master` 分支的完整实现。
