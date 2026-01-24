# 项目地图 (PROJECT_MAP.md)

> **用途**: 快速定位文件，减少 Token 消耗

---

## 目录结构 (ASCII Tree)

```
lumina/
├── .ai/
│   ├── comparison/                 <-- 文档一致性对照报告
│   └── context/                    <-- AI 认知基础设施目录
│       ├── ARCHITECTURE.md         <-- 架构宪法 (你正在读的文件的兄弟)
│       ├── PROJECT_MAP.md          <-- 项目地图 (当前文件)
│       ├── CURRENT_STATE.md        <-- 动态进度记录
│       └── AI_RULES.md             <-- AI 协作协议
│
├── src/                            <-- 前端源代码根目录
│   ├── App.tsx                     <-- 根组件: 启动画面 + 主界面渲染
│   ├── AppContext.tsx              <-- 全局状态管理: Context + Reducer
│   ├── types.ts                    <-- TypeScript 类型定义集合
│   ├── fileSystemAdapter.ts        <-- 文件系统适配器接口定义
│   ├── mockFileSystemAdapter.ts    <-- Mock 适配器实现 (开发模式)
│   │
│   ├── adapters/
│   │   └── ApiFileSystemAdapter.ts <-- API 适配器实现 (生产模式)
│   │
│   ├── api/
│   │   └── client.ts               <-- HTTP 客户端封装 (axios 风格)
│   │
│   ├── components/                 <-- React 组件目录
│   │   ├── Sidebar.tsx             <-- 左侧分类树 + 设置抽屉(自动主题/关闭行为) + 侧边栏遮罩
│   │   ├── PromptList.tsx          <-- 中间卡片列表 (瀑布流布局)
│   │   ├── SpiritCat.tsx           <-- Lumi 精灵渲染 (SVG 动画 + 状态反馈)
│   │   ├── Editor.tsx              <-- Markdown 编辑器核心组件
│   │   ├── EditorOverlay.tsx       <-- NOTE 类型编辑器浮层 (带动画)
│   │   ├── TaskEditorOverlay.tsx   <-- TASK 类型编辑器浮层 (带计划时间)
│   │   ├── MarkdownRenderer.tsx    <-- Markdown 渲染器 (支持代码高亮)
│   │   ├── ChronoCard.tsx          <-- 单个卡片组件 (支持拖拽、置顶)
│   │   ├── ContentSearchBar.tsx    <-- 搜索栏组件
│   │   ├── NewPromptOverlay.tsx    <-- 新建卡片弹窗
│   │   ├── ImportPromptsDialog.tsx <-- 导入对话框 (JSON/Markdown)
│   │   ├── ExportPromptsDialog.tsx <-- 导出对话框
│   │   ├── DeleteCategoryDialog.tsx<-- 删除分类确认对话框
│   │   ├── RecurrenceSelector.tsx  <-- 重复任务配置选择器
│   │   ├── Button.tsx              <-- 通用按钮组件
│   │   ├── ChronoAlert.tsx         <-- 警告提示组件
│   │   ├── EmptyState.tsx          <-- 空状态占位组件
│   │   ├── DisintegrateOverlay.tsx <-- 删除动画效果
│   │   └── ElasticScroll.tsx       <-- 弹性滚动容器
│   │
│   ├── contexts/                   <-- React Context 提供者
│   │   ├── ThemeContext.tsx        <-- 主题切换 (亮色/暗色 + 自动模式)
│   │   ├── ToastContext.tsx        <-- 全局 Toast 通知
│   │   ├── ConfirmContext.tsx      <-- 全局确认对话框
│   │   ├── LumiContext.tsx         <-- Lumi 行为状态 (动作/传输/时间/睡眠/风压)
│   │
│   ├── hooks/                      <-- 自定义 React Hooks
│   │   ├── useCountdown.ts         <-- 倒计时 Hook (任务提醒)
│   │   ├── useDocumentVisibility.ts<-- 页面可见性检测
│   │   ├── useIntervalTasks.ts     <-- 间隔任务轮询 Hook
│   │   └── useSystemNotification.ts<-- 系统通知 Hook (Tauri)
│   │
│   ├── utils/                      <-- 工具函数库
│   │   ├── performanceMonitor.ts   <-- 性能监控 (启动时间、内存)
│   │   ├── memoryManager.ts        <-- 内存管理 (清理缓存)
│   │   ├── markdownCache.ts        <-- Markdown 渲染缓存
│   │   ├── virtualScroll.ts        <-- 虚拟滚动计算
│   │   ├── lazyLoad.ts             <-- 懒加载工具
│   │   ├── debounce.ts             <-- 防抖函数
│   │   ├── jsonImporter.ts         <-- JSON 文件导入逻辑
│   │   ├── markdownImporter.ts     <-- Markdown 文件导入逻辑
│   │   ├── categoryContentAnalyzer.ts <-- 分类内容分析 (智能图标)
│   │   ├── smartIcon.ts            <-- 智能图标选择算法
│   │   ├── tagColors.ts            <-- 标签颜色映射
│   │   ├── recurrenceTag.ts        <-- 重复任务标签生成
│   │   ├── recentCategory.ts       <-- 最近访问分类记录
│   │   ├── notificationThrottler.ts<-- 通知节流器 (防止刷屏)
│   │   └── adaptivePolling.ts      <-- 自适应轮询策略
│   │
│   ├── types/
│   │   └── performance.ts          <-- 性能监控相关类型定义
│   │
│   ├── index.tsx                   <-- React 应用入口
│   ├── index.css                   <-- 全局样式 + Tailwind 导入
│   └── vite-env.d.ts               <-- Vite 环境变量类型声明
│
├── server/                         <-- Node.js 后端服务器
│   ├── index.js                    <-- Express 服务器入口
│   │
│   ├── routes/                     <-- API 路由模块
│   │   ├── vault.js                <-- /api/vault - Vault 扫描
│   │   ├── categories.js           <-- /api/categories - 分类 CRUD
│   │   ├── prompts.js              <-- /api/prompts - 卡片 CRUD
│   │   ├── search.js               <-- /api/search - 搜索与标签
│   │   ├── trash.js                <-- /api/trash - 回收站操作
│   │   ├── intervalTasks.js        <-- /api/interval-tasks - 间隔任务
│   │   └── images.js               <-- /api/images - 图片上传
│   │
│   └── utils/                      <-- 后端工具函数
│       ├── fileSystem.js           <-- 文件系统操作封装
│       ├── apiCache.js             <-- API 响应缓存
│       ├── requestQueue.js         <-- 请求队列 (限流)
│       └── intervalTaskScheduler.js<-- 间隔任务调度器
│
├── src-tauri/                      <-- Tauri 桌面应用配置
│   ├── src/
│   │   ├── main.rs                 <-- Rust 主程序入口
│   │   └── lib.rs                  <-- Tauri 命令定义 (含关闭行为 get/set)
│   ├── tauri.conf.json             <-- Tauri 配置文件
│   ├── Cargo.toml                  <-- Rust 依赖配置
│   └── icons/                      <-- 应用图标资源
│
├── scripts/                        <-- 构建与工具脚本
│   ├── build-sidecar.mjs           <-- 打包后端为 Sidecar 可执行文件
│   ├── analyze-bundle.mjs          <-- Bundle 体积分析
│   ├── measure-baseline.mjs        <-- 性能基线测量
│   ├── seed-vault.cjs              <-- 生成测试数据
│   ├── cleanup-temp-folders.bat   <-- 清理临时文件 (Windows)
│   ├── run-desktop-with-console.bat<-- 带控制台启动桌面应用
│   └── verify-desktop-build.bat   <-- 验证桌面构建完整性
│
├── vault/                          <-- 数据存储目录 (文件系统)
│   ├── Coding/                     <-- 示例分类: 编程相关
│   ├── Creative/                   <-- 示例分类: 创意写作
│   └── trash/                      <-- 回收站 (5 天自动清理)
│       └── .trash-visits.json      <-- 回收站访问记录
│
├── public/
│   └── favicon.svg                 <-- 网站图标
│
├── test-samples/                   <-- 测试数据样本
│   ├── sample-with-categories.json <-- 带分类的 JSON 导入样本
│   ├── sample-without-categories.json
│   └── sample-mixed-validity.json  <-- 混合有效性测试数据
│
├── package.json                    <-- 前端依赖 + 脚本定义
├── vite.config.ts                  <-- Vite 构建配置 (代码分割)
├── tailwind.config.js              <-- Tailwind CSS 配置
├── tsconfig.json                   <-- TypeScript 编译配置
├── postcss.config.js               <-- PostCSS 配置
├── index.html                      <-- HTML 入口模板
├── .env.example                    <-- 环境变量示例 (Web 模式)
├── .env.tauri.example              <-- 环境变量示例 (桌面模式)
├── README.md                       <-- 项目说明文档
└── .gitignore                      <-- Git 忽略规则
```

---

## 关键文件快速索引

### 🔥 高频修改文件 (Hot Files)
| 文件路径 | 职责 | 修改频率 |
|---------|------|---------|
| `src/components/PromptList.tsx` | 卡片列表渲染逻辑 + 任务调度前端逻辑 | ⭐⭐⭐⭐⭐ |
| `src/components/EditorOverlay.tsx` | 编辑器浮层 UI | ⭐⭐⭐⭐⭐ |
| `src/AppContext.tsx` | 状态管理核心 | ⭐⭐⭐⭐ |
| `server/routes/prompts.js` | 卡片 API 路由 | ⭐⭐⭐⭐ |
| `server/utils/intervalTaskScheduler.js` | 任务调度器 (后端) | ⭐⭐⭐⭐ |
| `src/types.ts` | 类型定义 | ⭐⭐⭐ |

### 🎨 UI 组件层级
```
App.tsx
├── ThemeProvider (主题)
│   └── ToastProvider (通知)
│       └── ConfirmProvider (确认对话框)
│           └── AppProvider (全局状态)
│               └── AppContent
│                   ├── Sidebar
│                   ├── PromptList
│                   │   └── ChronoCard (多个)
│                   ├── SpiritCat
│                   ├── EditorOverlay (条件渲染)
│                   └── TaskEditorOverlay (条件渲染)
```

### 🔌 API 路由映射
| HTTP 端点 | 文件位置 | 功能 |
|-----------|---------|------|
| `GET /api/vault/scan` | `server/routes/vault.js` | 扫描 Vault 目录树 |
| `POST /api/prompts` | `server/routes/prompts.js` | 创建新卡片 |
| `PUT /api/prompts/:id` | `server/routes/prompts.js` | 更新卡片 |
| `DELETE /api/prompts/:id` | `server/routes/prompts.js` | 删除卡片 (移至回收站) |
| `POST /api/categories` | `server/routes/categories.js` | 创建分类 |
| `PUT /api/categories/move` | `server/routes/categories.js` | 移动分类 |
| `GET /api/search` | `server/routes/search.js` | 搜索卡片 |
| `GET /api/tags` | `server/routes/search.js` | 获取所有标签 |
| `POST /api/trash/visit` | `server/routes/trash.js` | 记录回收站访问 |
| `POST /api/trash/restore` | `server/routes/trash.js` | 恢复卡片 |
| `GET /api/interval-tasks` | `server/routes/intervalTasks.js` | 获取间隔任务列表 |
| `POST /api/interval-tasks/:id/acknowledge` | `server/routes/intervalTasks.js` | 确认间隔任务完成 |
| `POST /api/interval-tasks/reset-baselines` | `server/routes/intervalTasks.js` | 重置所有任务基线时间 |
| `POST /api/images/upload` | `server/routes/images.js` | 上传图片 (Base64) |

### 📦 数据流关键节点
1. **Vault 扫描**: `server/utils/fileSystem.js::scanVault()`
2. **状态更新**: `src/AppContext.tsx::appReducer()`
3. **卡片过滤**: `src/AppContext.tsx::getFilteredPrompts()`
4. **Markdown 渲染**: `src/components/MarkdownRenderer.tsx`
5. **性能监控**: `src/utils/performanceMonitor.ts::startupTimer`
6. **任务调度**: `server/utils/intervalTaskScheduler.js::TaskScheduler` (renamed from IntervalTaskScheduler)
7. **倒计时管理**: `src/hooks/useCountdown.ts` + `src/components/PromptList.tsx::frontendStartTimeRef`

---

## 特殊文件说明

### `.env.example` vs `.env.tauri.example`
- **`.env.example`**: Web 开发模式配置
  - `VITE_USE_MOCK=false`
  - `VITE_API_BASE=http://localhost:3001/api`
- **`.env.tauri.example`**: 桌面应用配置
  - `VITE_USE_MOCK=false`
  - `VITE_API_BASE=http://localhost:3002/api` (Sidecar 端口)

### `vault/trash/.trash-visits.json`
- 记录回收站访问次数
- 用于智能清理策略 (访问频繁的项目延迟删除)

### `scripts/build-sidecar.mjs`
- 使用 `@yao-pkg/pkg` 将 Node.js 服务器打包为独立可执行文件
- 输出到 `src-tauri/bin/server.exe` (Windows)
- Tauri 配置中通过 `externalBin` 引用

---

**最后更新**: 2026-01-24
**文件总数**: 约 120+ 个源文件
