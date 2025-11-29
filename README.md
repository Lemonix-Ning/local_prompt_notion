# Local Prompt Notion - 本地提示词管理系统

> 一个功能完整的本地提示词(Prompt)管理系统,结合 Notion 风格的现代化 UI,支持分类、搜索、收藏、回收站等功能。

## 📋 项目概述

Local Prompt Notion 是一个全栈应用,用于组织、管理和使用 AI 提示词(Prompts)。提供类似 Notion 的优雅界面,同时确保所有数据保存在本地文件系统中。

### 核心特性

- ✅ **分类管理**: 支持无限层级的分类树形结构
- ✅ **提示词 CRUD**: 创建、编辑、删除提示词
- ✅ **智能搜索**: 按标题、标签、内容全文搜索
- ✅ **收藏管理**: 快速收藏常用提示词
- ✅ **回收站**: 删除的提示词先移入回收站,支持恢复
- ✅ **回收站自动清理**: 每次打开/刷新网站计 1 次访问,达到 10 次仍在回收站将自动永久删除(包含文件)
- ✅ **回收站访问次数显示**: 回收站列表中显示 `x/10`
- ✅ **分类同步(目录即真相)**: 编辑器修改分类会移动提示词文件夹到目标分类目录,确保网页分类树与磁盘目录一致
- ✅ **UI 重设计**: 深色玻璃拟态 + 网格/极光背景 + Spotlight 跟随发光卡片
- ✅ **智能 Logo**: 根据提示词标题/标签自动匹配图标并生成稳定配色
- ✅ **新建弹窗自定义分类选择器**: 替代原生 select,避免 Windows/Chromium 首次展开闪白
- ✅ **分类管理**: 重命名和删除分类(支持验证防止数据丢失)
- ✅ **编辑模式**: 全屏编辑提示词,退出时提示保存
- ✅ **本地持久化**: 所有数据保存到本地文件系统
- ✅ **元数据支持**: 记录创建时间、更新时间、作者、标签等

## 🏗️ 架构设计

### 技术栈

**前端**:
- React 18.2.0 + TypeScript 5.3.3
- Vite 5.0.7 (快速构建工具)
- Tailwind CSS 3.3.6 (样式)
- Lucide React (图标库)

**后端**:
- Express.js 4.18.2 (Web 框架)
- Node.js 文件系统 API (持久化)

**开发工具**:
- ESLint (代码检查)
- TypeScript (类型安全)

### 目录结构

```
local_prompt_notion/
├── src/                          # 前端源代码
│   ├── components/               # React 组件
│   │   ├── Sidebar.tsx           # 左侧导航(分类树)
│   │   ├── PromptList.tsx        # 提示词列表卡片
│   │   ├── EditorPage.tsx        # 全屏编辑器
│   │   └── Editor.tsx            # 编辑组件(已弃用)
│   ├── adapters/
│   │   └── ApiFileSystemAdapter.ts   # API 适配器
│   ├── api/
│   │   └── client.ts             # HTTP 客户端
│   ├── utils/
│   │   └── smartIcon.ts          # 智能图标/配色工具
│   ├── App.tsx                   # 主应用组件
│   ├── AppContext.tsx            # 全局状态管理
│   ├── fileSystemAdapter.ts      # 文件系统适配器(本地/模拟)
│   ├── types.ts                  # TypeScript 类型定义
│   └── index.tsx                 # 入口文件
├── server/                       # 后端源代码
│   ├── index.js                  # 服务器入口
│   ├── routes/                   # Express 路由
│   │   ├── vault.js              # Vault 扫描路由
│   │   ├── prompts.js            # 提示词 CRUD 路由
│   │   ├── categories.js         # 分类管理路由
│   │   └── search.js             # 搜索路由
│   └── utils/
│       └── fileSystem.js         # 文件系统工具函数
├── sample-vault/                 # 示例数据目录
│   ├── Business/                 # 业务分类
│   ├── Coding/                   # 编程分类
│   ├── Creative Writing/         # 创意写作分类
│   └── trash/                    # 回收站
├── package.json                  # 前端依赖配置
├── server/package.json           # 后端依赖配置
├── vite.config.ts                # Vite 配置
├── tsconfig.json                 # TypeScript 配置
└── README.md                     # 本文档
```

### 数据模型

**Vault 结构**: 以文件系统目录为基础
```
sample-vault/
├── Category1/
│   ├── prompt1/
│   │   ├── meta.json            # 元数据
│   │   └── prompt.md            # 内容
│   └── prompt2/
│       ├── meta.json
│       └── prompt.md
└── Category2/
    └── ...
```

**PromptMetadata** (meta.json):
```json
{
  "id": "uuid",
  "title": "提示词标题",
  "slug": "prompt_slug",
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z",
  "tags": ["tag1", "tag2"],
  "version": "1.0.0",
  "author": "User",
  "model_config": {
    "default_model": "gpt-4",
    "temperature": 0.7,
    "top_p": 1.0
  },
  "is_favorite": false,
  "category": "分类名称",
  "category_path": "分类目录绝对路径",
  "original_path": "删除前的原始路径"
}
```

## 🚀 快速开始

### 前置要求

- Node.js 16+ 和 npm 7+
- Git (用于版本控制)

### 安装步骤

1. **克隆或解压项目**
```bash
cd local_prompt_notion
```

2. **安装前端依赖**
```bash
npm install
```

3. **安装后端依赖**
```bash
cd server
npm install
cd ..
```

### 运行项目

#### 方式 1: 使用 Mock 模式(不需要后端,数据不持久化)
```bash
npm run dev
```
打开 `http://localhost:3002`

#### 方式 2: 使用 API 模式(需要后端,数据持久化到本地)

**终端 1 - 启动后端服务器**:
```bash
cd server
npm start
# 服务器将在 http://localhost:3001 启动
```

**终端 2 - 启动前端开发服务器**:
```bash
npm run dev:client
# 打开 http://localhost:3002
```

或使用一个命令同时启动前后端:
```bash
npm run dev:api
```

### 构建生产版本

```bash
npm run build
# 生成文件在 dist/ 目录
```

## 📖 使用指南

### 基本操作

1. **查看所有提示词**: 左侧导航 → "全部提示词"
2. **浏览收藏**: 左侧导航 → "收藏夹"
3. **浏览回收站**: 左侧导航 → "回收站"
4. **选择分类**: 点击左侧分类树中的分类
5. **搜索提示词**: 使用顶部搜索框

### 提示词管理

**创建提示词**:
- 选择要添加的分类
- 点击分类上的加号或右下角"新建页面"
- 输入提示词标题

**编辑提示词**:
- 双击提示词卡片进入编辑模式
- 修改内容、标签、分类等
- 关闭时会提示是否保存更改

**修改分类(会移动目录)**:
- 在编辑器中选择新的分类
- 保存后提示词目录会从旧分类目录移动到新分类目录
- `meta.json` 会同步更新 `category` 与 `category_path`

**提示词 Logo(自动匹配)**:
- 列表卡片与编辑页顶部 Logo 会根据 `title/tags` 自动匹配图标
- 同一个提示词在不同页面展示的图标与配色保持一致

**删除提示词**:
- 打开提示词→点击删除按钮
- 提示词会移入回收站
- 可从回收站恢复或永久删除

**收藏提示词**:
- 打开提示词→点击星标按钮
- 收藏的提示词显示在"收藏夹"

### 分类管理

**创建分类**:
- 选择父分类
- 点击"分类标签"旁的加号
- 输入分类名称

**重命名分类**:
- 将鼠标悬停在分类名称上
- 点击铅笔图标 (✏️)
- 输入新名称

**删除分类**:
- 将鼠标悬停在分类名称上
- 点击垃圾桶图标 (🗑️)
- 分类必须为空(无提示词且无子分类)

**展开/折叠分类**:
- 点击分类名称或箭头

## 🔌 API 文档

### 后端 API 端点

**Vault 管理**:
- `GET /api/vault/scan` - 扫描并返回整个 Vault 结构
- `POST /api/vault/normalize` - 依据真实目录回填所有提示词的 `meta.category_path`/`meta.category`

**提示词操作**:
- `GET /api/prompts` - 获取所有提示词
- `GET /api/prompts/:id` - 获取单个提示词
- `POST /api/prompts` - 创建提示词
- `PUT /api/prompts/:id` - 更新提示词(支持 `categoryPath` 触发目录移动)
- `DELETE /api/prompts/:id` - 删除提示词(移到回收站)
- `DELETE /api/prompts/:id/permanent` - 永久删除提示词
- `POST /api/prompts/:id/restore` - 从回收站恢复提示词

**分类操作**:
- `GET /api/categories` - 获取所有分类
- `POST /api/categories` - 创建分类
- `PUT /api/categories/rename` - 重命名分类
- `DELETE /api/categories` - 删除分类

**搜索**:
- `GET /api/search?query=...` - 搜索提示词

**回收站**:
- `POST /api/trash/visit` - 网站打开/刷新计数 + 自动清理(阈值 10)
- `GET /api/trash/status` - 获取回收站每个条目的访问计数

## 🎨 UI 说明

本项目 UI 采用暗色主题,并使用网格/极光背景与 Spotlight 跟随发光卡片增强质感。

关键实现位置:
- `src/index.css`: 暗色基底、网格/极光背景、滚动条与原生控件暗色方案
- `src/App.tsx`: 背景层(网格/极光)
- `src/components/PromptList.tsx`: Spotlight 卡片、智能 Logo、新建弹窗 UI
- `src/components/EditorPage.tsx`: 编辑页暗色风格与智能 Logo
- `src/utils/smartIcon.ts`: `getSmartIcon/getSmartGradient`

## 🔧 配置

### 环境变量

**前端** (`.env` 文件):
```dotenv
# 后端 API 地址
VITE_API_BASE=http://localhost:3001/api

# 是否使用 Mock 适配器(true/false)
VITE_USE_MOCK=false
```

**后端** (环境变量):
```bash
# Vault 数据目录(默认: ./sample-vault)
VAULT_PATH=/path/to/vault

# 服务器端口(默认: 3001)
PORT=3001
```

## 🐛 开发

### 代码风格

- 前端: TypeScript + React Hooks
- 后端: Node.js + Express
- 样式: Tailwind CSS
- 代码检查: ESLint

### 运行 Linter

```bash
npm run lint
```

### 开发工作流

1. 修改代码
2. Vite 会自动热重载(前端)或重新运行(后端需手动重启)
3. 在浏览器 DevTools 中调试

## 📝 提示词最佳实践

1. **使用明确的标题**: "Python 调试助手" 而不是 "Python"
2. **添加相关标签**: 便于搜索和组织
3. **编写清晰的说明**: 包括角色、任务、约束
4. **使用模板**: 建立一致的提示词格式
5. **经常更新**: 根据使用情况改进提示词

## 🤝 贡献

欢迎提交 Issue 和 Pull Request!

## 📄 许可证

MIT License

## 🆘 故障排查

详见 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

**最后更新**: 2026 年 1 月 10 日  
**版本**: 1.0.0
