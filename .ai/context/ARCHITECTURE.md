# 架构宪法 (ARCHITECTURE.md)

> **用途**: 定义 Lumina 项目的不变量与核心设计原则

---

## Tech Stack

### 前端 (Frontend)
- **框架**: React 18.2 + TypeScript 5.3
- **构建工具**: Vite 5.0 (开发服务器 + 打包)
- **桌面框架**: Tauri 2.9 (Rust 后端 + WebView 前端)
- **UI 库**: 
  - Tailwind CSS 3.3 (原子化样式)
  - Framer Motion 12.29 (动画引擎)
  - Lucide React 0.294 (图标库)
- **Markdown 渲染**: 
  - react-markdown 10.1
  - rehype-highlight 7.0 (代码高亮)
  - remark-gfm 4.0 (GitHub Flavored Markdown)
- **状态管理**: React Context + useReducer (无外部状态库)

### 后端 (Backend)
- **运行时**: Node.js (Express 服务器)
- **API 协议**: REST API (JSON)
- **数据持久化**: 文件系统 (Markdown + JSON)
- **端口配置**:
  - 开发模式: 前端 3000, 后端 3001
  - 桌面模式: 前端 1420 (Tauri), 后端 3002 (Sidecar)

### 数据存储 (Data Layer)
- **Vault 结构**: 文件系统目录树
  - `vault/` - 根目录
  - `vault/trash/` - 回收站 (5 天自动清理)
  - 每个 Prompt 由两个文件组成:
    - `meta.json` - 元数据 (标题、标签、时间戳等)
    - `prompt.md` - Markdown 内容

---

## Core Patterns

### 1. Adapter Pattern (适配器模式)
**位置**: `src/fileSystemAdapter.ts`, `src/adapters/ApiFileSystemAdapter.ts`

**职责**: 抽象文件系统操作，支持两种运行模式:
- **Mock 模式** (`MockFileSystemAdapter`): 内存模拟，用于开发测试
- **API 模式** (`ApiFileSystemAdapter`): 通过 HTTP 调用后端 API

**接口定义** (`IFileSystemAdapter`):
```typescript
interface IFileSystemAdapter {
  scanVault(rootPath: string): Promise<FileSystemState>;
  readPrompt(promptPath: string): Promise<PromptData>;
  savePrompt(promptData: PromptData): Promise<void>;
  deletePrompt(promptPath: string, permanent?: boolean): Promise<void>;
  createPrompt(categoryPath: string, title: string, options?: {...}): Promise<PromptData>;
  createCategory(parentPath: string, name: string): Promise<void>;
  // ... 其他方法
}
```

### 2. Context + Reducer Pattern (状态管理)
**位置**: `src/AppContext.tsx`

**核心原则**:
- 单一数据源 (`AppState`)
- 不可变更新 (Immutable Updates)
- 通过 `dispatch(action)` 触发状态变更
- 禁止在组件中直接修改 `state`

**关键状态**:
```typescript
interface AppState {
  fileSystem: FileSystemState | null;  // Vault 数据树
  selectedCategory: string | null;     // 当前选中分类
  selectedPromptId: string | null;     // 当前选中卡片
  searchQuery: string;                 // 搜索关键词
  uiState: UIState;                    // UI 状态 (侧边栏、编辑器等)
}
```

### 3. Component Composition (组件组合)
**位置**: `src/components/`

**层级结构**:
```
App.tsx (根组件)
├── Sidebar.tsx (分类树)
├── PromptList.tsx (卡片列表)
├── EditorOverlay.tsx (编辑器浮层 - NOTE 类型)
├── TaskEditorOverlay.tsx (任务编辑器 - TASK 类型)
└── ChronoAlert.tsx (任务提醒)
```

**设计原则**:
- 组件职责单一 (Single Responsibility)
- 通过 Props 传递数据，禁止跨层级直接访问 Context
- 动画组件使用 Framer Motion 的 `motion.*` 组件

### 4. Lumi 交互反馈系统
**位置**: `src/App.tsx`, `src/contexts/LumiContext.tsx`, `src/components/SpiritCat.tsx`

**核心原则**:
- Lumi 状态由 `LumiContext` 统一管理（动作/传输/时间/风压/睡眠）
- 视觉呈现由 `SpiritCat` 驱动（眼色/形变/嘴巴/尾巴）
- `App.tsx` 负责交互编排（点击思考、气泡优先级、通知融合）

### 5. Performance Optimization Patterns
**关键优化点**:

#### 4.1 启动性能
- **Splash Screen 智能关闭**: 最短动画 1.2 秒 + 数据加载完成
- **后台初始化**: HTTP 服务器先启动，Vault 扫描后台执行
- **性能监控**: `src/utils/performanceMonitor.ts` 记录启动时间点

#### 4.2 运行时性能
- **虚拟滚动**: `src/utils/virtualScroll.ts` (大列表优化)
- **Markdown 缓存**: `src/utils/markdownCache.ts` (避免重复渲染)
- **请求队列**: `server/utils/requestQueue.js` (限制并发请求数)
- **增量更新**: 分类移动时使用增量更新而非全量刷新

#### 4.3 Bundle 优化
- **代码分割** (`vite.config.ts`):
  - `markdown` chunk: react-markdown + rehype/remark 插件
  - `highlight` chunk: highlight.js
  - `tauri` chunk: @tauri-apps/* 包
  - `icons` chunk: lucide-react
  - `react-vendor` chunk: React 核心库
- **Tree Shaking**: 移除未使用代码
- **Terser 压缩**: 生产环境移除 console.log

---

## Data Flow

### 读取流程 (Read Flow)
```
用户操作 (点击分类)
  ↓
dispatch({ type: 'SELECT_CATEGORY', payload: categoryPath })
  ↓
AppContext Reducer 更新 state.selectedCategory
  ↓
PromptList 组件通过 getFilteredPrompts() 获取过滤后的卡片
  ↓
渲染卡片列表
```

### 写入流程 (Write Flow)
```
用户编辑 Prompt
  ↓
调用 savePrompt(promptData)
  ↓
adapter.savePrompt() → HTTP POST /api/prompts/:id
  ↓
后端写入文件系统 (meta.json + prompt.md)
  ↓
dispatch({ type: 'UPDATE_PROMPT', payload: promptData })
  ↓
UI 更新
```

### 特殊分类过滤逻辑
- **`all`**: 显示所有非回收站的 Prompts
- **`favorites`**: 过滤 `meta.is_favorite === true`
- **`trash`**: 过滤路径包含 `/trash/` 或 `\trash\`
- **普通分类**: 过滤 `prompt.path.includes(categoryPath)`

---

## Constraints (禁止事项)

### ❌ 禁止在组件中直接调用文件系统 API
**错误示例**:
```typescript
// ❌ 错误: 组件直接调用 adapter
const MyComponent = () => {
  const { adapter } = useApp();
  const handleSave = () => {
    adapter.savePrompt(data); // 禁止!
  };
};
```

**正确示例**:
```typescript
// ✅ 正确: 通过 Context 提供的方法
const MyComponent = () => {
  const { savePrompt } = useApp();
  const handleSave = () => {
    savePrompt(data); // 使用封装好的方法
  };
};
```

### ❌ 禁止直接修改 State
```typescript
// ❌ 错误
state.selectedCategory = 'new-category';

// ✅ 正确
dispatch({ type: 'SELECT_CATEGORY', payload: 'new-category' });
```

### ❌ 禁止在生产环境使用 Mock Adapter
- 通过环境变量 `VITE_USE_MOCK` 控制
- 生产构建必须设置 `VITE_USE_MOCK=false`

### ❌ 禁止在 Markdown 内容中注入未经过滤的 HTML
- 使用 `rehype-sanitize` 插件过滤危险标签
- 配置在 `src/components/MarkdownRenderer.tsx`

### ❌ 禁止阻塞主线程的长时间操作
- 文件扫描、图片处理等耗时操作必须异步执行
- 使用 `setTimeout(..., 0)` 或 `setImmediate` 将任务推迟到下一个事件循环

### ❌ 禁止在 JSX 中遗漏闭合标签
- 每个 `<div>` 必须有对应的 `</div>`
- 使用 IDE 的括号匹配功能检查
- 常见错误: 在复杂的条件渲染中忘记闭合标签
- **案例**: `ImportPromptsDialog.tsx` 曾因缺少闭合 `</div>` 导致 Babel 解析错误

---

## 版本信息
- **项目名称**: Lumina (原名 local-prompt-notion)
- **版本**: 1.0.0
- **产品标识**: com.lumina.desktop
- **许可证**: MIT

---

## 关键依赖版本锁定
| 依赖 | 版本 | 原因 |
|------|------|------|
| React | 18.2.0 | 稳定版本，避免 19.x 的破坏性变更 |
| Tauri | 2.9.x | 最新稳定版，支持 Sidecar 进程 |
| Vite | 5.0.7 | 构建性能优化 |
| TypeScript | 5.3.3 | 类型系统稳定性 |

---

**最后更新**: 2026-01-24
**维护者**: [待确认: 需要用户补充]
