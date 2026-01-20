# Lumina - 本地优先的 AI 卡片与任务工作台

> Lumina 是一款本地优先的 AI 卡片与任务工作台，用来沉淀提示词、想法与问题，并通过搜索与计划提醒快速复用。结合 Notion 风格的现代化 UI，支持分类、搜索、收藏、回收站等功能，提供顺滑的交互与体验。

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](#license)
[![Node](https://img.shields.io/badge/node-%3E%3D16-brightgreen)](#getting-started)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](#getting-started)

## Table of Contents

- [About The Project](#about-the-project)
  - [核心特性](#核心特性)
  - [Built With](#built-with)
  - [目录结构](#目录结构)
  - [数据模型](#数据模型)
- [Getting Started](#getting-started)
  - [前置要求](#前置要求)
  - [安装步骤](#安装步骤)
  - [运行项目](#运行项目)
  - [构建生产版本](#构建生产版本)
- [Usage](#usage)
- [API](#api)
- [UI](#ui)
- [Configuration](#configuration)
- [Development](#development)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)
- [Acknowledgments](#acknowledgments)

## About The Project

Lumina 是一个全栈本地应用，用于沉淀与复用 AI 相关内容卡片（提示词/思路/问题等），并通过任务系统帮助你按计划执行。提供类似 Notion 的优雅界面，同时确保所有数据保存在本地文件系统中。

### 核心特性

#### **现代化 UI/UX**
- **双主题系统**: 浅色/深色主题无缝切换，自动保存用户偏好
- **玻璃拟态设计**: 深色模式采用网格/极光背景 + Spotlight 跟随发光卡片
- **响应式布局**: 完美适配桌面和移动设备
- **专业级交互**: 悬停效果、过渡动画、视觉反馈

#### **智能分类管理**
- **无限层级**: 支持无限层级的分类树形结构
- **树形下拉选择器**: 现代化的分类选择体验，支持搜索和层级显示
- **内联编辑**: 双击重命名、右键菜单、智能交互
- **目录同步**: 编辑器修改分类会移动提示词文件夹到目标分类目录

#### **提示词管理**
- **CRUD 操作**: 创建、编辑、删除、恢复提示词
- **全屏编辑器**: 专注的编写体验，支持 Markdown
- **智能 Logo**: 根据提示词标题/标签自动匹配图标并生成稳定配色
- **确定性标签颜色**: 基于哈希算法的标签颜色系统，相同标签永远相同颜色

#### **强大搜索功能**
- **全文搜索**: 按标题、标签、内容全文搜索
- **实时过滤**: 输入即搜索，无需等待
- **智能匹配**: 支持模糊搜索和关键词高亮

#### **数据管理**
- **收藏系统**: 快速收藏常用提示词
- **回收站**: 删除的提示词先移入回收站，支持恢复
- **自动清理**: 回收站访问次数达到阈值自动永久删除
- **本地持久化**: 所有数据保存到本地文件系统，完全离线可用

#### **导入/导出与快速导入**
- **导入/导出**: 支持提示词的导入与导出
- **快速导入**: 支持拖拽导入 Markdown 与 JSON 文件（自动解析标题/分类/冲突，并给出导入结果提示）

#### **任务与提醒（Interval Task System V2）**
- **后端调度**: 后端 1s 定时调度 + 前端 5s 轮询，降低资源消耗并避免前端生命周期导致的重复通知
- **时间基线**: 以 `meta.last_notified` 作为唯一持久化基线字段，保证倒计时与通知一致
- **确认语义**: 关闭通知时推进 `last_notified`，进入下一周期

#### **编辑器体验优化**
- **图片引用式链接**: 粘贴图片时使用引用式链接，自动将长路径移动到文档末尾，编辑区更整洁

#### **开发者友好**
- **TypeScript**: 完整的类型安全
- **模块化架构**: 清晰的代码组织和可扩展性
- **API 设计**: RESTful API 支持外部集成
- **配置灵活**: 支持环境变量和自定义配置

### Built With

**前端**:
- React 18.2.0 + TypeScript 5.3.3
- Vite 5.0.7 (快速构建工具)
- Tailwind CSS 3.3.6 (原子化 CSS)
- Lucide React (现代图标库)
- CSS Variables (主题系统)

**后端**:
- Express.js 4.18.2 (Web 框架)
- Node.js 文件系统 API (持久化)
- RESTful API 设计

**开发工具**:
- ESLint (代码检查)
- TypeScript (类型安全)
- Vite HMR (热重载)

### 目录结构

```
local_prompt_notion/
├── src/                          # 前端源代码
│   ├── components/               # React 组件
│   │   ├── Sidebar.tsx           # 左侧导航(分类树、主题切换)
│   │   ├── PromptList.tsx        # 提示词列表卡片(新建页面)
│   │   ├── EditorOverlay.tsx     # Mac 风格编辑器覆盖层
│   │   └── NewPromptOverlay.tsx  # 新建提示词覆盖层
│   ├── contexts/                 # React 上下文
│   │   ├── ThemeContext.tsx      # 主题管理上下文
│   │   ├── ToastContext.tsx      # 消息提示上下文
│   │   └── ConfirmContext.tsx    # 确认对话框上下文
│   ├── adapters/
│   │   └── ApiFileSystemAdapter.ts   # API 适配器
│   ├── api/
│   │   └── client.ts             # HTTP 客户端
│   ├── utils/
│   │   ├── smartIcon.ts          # 智能图标/配色工具
│   │   └── tagColors.ts          # 确定性标签颜色系统
│   ├── App.tsx                   # 主应用组件
│   ├── AppContext.tsx            # 全局状态管理
│   ├── mockFileSystemAdapter.ts  # Mock 适配器(浏览器/前端安全)
│   ├── types.ts                  # TypeScript 类型定义
│   ├── index.css                 # 全局样式(主题系统)
│   └── main.tsx                  # 入口文件
├── server/                       # 后端源代码
│   ├── index.js                  # 服务器入口
│   ├── routes/                   # Express 路由
│   │   ├── vault.js              # Vault 扫描路由
│   │   ├── prompts.js            # 提示词 CRUD 路由
│   │   ├── categories.js         # 分类管理路由
│   │   ├── trash.js              # 回收站路由
│   │   └── search.js             # 搜索路由
│   └── utils/
│       └── fileSystem.js         # 文件系统工具函数
├── src-tauri/                    # Tauri 桌面应用
│   ├── src/
│   │   └── lib.rs                # Rust 主程序
│   ├── tauri.conf.json           # Tauri 配置
│   └── Cargo.toml                # Rust 依赖
├── scripts/                      # 工具脚本
│   ├── cleanup-temp-folders.js   # 清理临时文件夹
│   └── cleanup-temp-folders.bat  # Windows 清理脚本
├── sample-vault/                 # 示例数据目录（提交到 Git）
│   ├── Business/                 # 业务分类
│   ├── Coding/                   # 编程分类
│   ├── Creative Writing/         # 创意写作分类
│   └── trash/                    # 回收站
├── vault/                        # 本地数据目录（不提交，.gitignore）
├── test-vault/                   # 测试数据目录（不提交，.gitignore）
├── package.json                  # 前端依赖配置
├── vite.config.ts                # Vite 配置
├── tsconfig.json                 # TypeScript 配置
└── README.md                     # 本文档
```

**目录说明**:
- `sample-vault/` - 示例数据，包含在 Git 仓库中，供新用户参考
- `vault/` - 本地实际使用的数据目录，不提交到 Git
- `test-vault/` - 测试用数据目录，不提交到 Git
- 所有 `*_restored_*` 文件夹都是临时文件，应该删除

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

## Getting Started

> 目标: 让你在本地最快跑起来。

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

#### Web版本
```bash
npm run build
# 生成文件在 dist/ 目录
```

#### 桌面应用版本 (Windows exe)

**完整构建流程：**

```bash
# 一键构建（推荐）
npm run desktop:build

# 这个命令会自动：
# 1. 构建后端 sidecar
# 2. 构建前端
# 3. 打包桌面应用
```

**手动构建（如果需要）：**

```bash
# 1. 先构建后端 sidecar
npm run build:sidecar

# 2. 再构建桌面应用
npm run tauri build
```

**生成文件位置：**
```
src-tauri/target/release/
├── Lumina.exe                                           # 绿色版（免安装）
└── bundle/
    ├── msi/
    │   └── Lumina_1.0.0_x64_en-US.msi                  # MSI 安装包
    └── nsis/
        └── Lumina_1.0.0_x64-setup.exe                  # NSIS 安装包
```

**桌面应用特性**:
- 原生Windows应用体验
- 内置后端服务器（端口 3002），无需单独启动
- 完整功能，包含所有主题和交互特性
- 支持绿色版(免安装)和安装包两种分发方式
- 数据存储在可执行文件旁边的 `vault/` 目录

**详细说明**：本文档已包含完整构建流程说明。

## Usage

### 主题切换

**快速切换**:
- 侧边栏顶部的主题切换按钮
- 一键在浅色/深色主题间切换
- 主题偏好自动保存到本地存储

**设置面板**:
- 点击侧边栏底部"设置"按钮
- 在设置面板中选择主题
- 支持主题预览和详细配置

### 分类管理

**创建分类**:
- 右键点击空白区域或分类名称
- 选择"新建分类"或"新建子分类"
- 支持无限层级嵌套

**重命名分类**:
- 双击分类名称进入编辑模式
- 或右键选择"重命名"
- 支持 Enter 确认、Esc 取消

**删除分类**:
- 右键选择"删除"
- 系统会检查分类是否为空
- 非空分类需要先清空内容

**展开/折叠**:
- 点击箭头图标展开/折叠子分类
- 点击分类名称选中分类
- 支持键盘导航

### 提示词管理

**创建提示词**:
- 点击右下角"新建"按钮
- 在新建页面中填写标题和选择分类位置
- 使用树形下拉选择器选择分类
- 支持搜索分类名称

**编辑提示词**:
- 双击提示词卡片进入全屏编辑模式
- 支持 Markdown 语法
- 实时保存草稿
- 退出时提示保存更改

**标签系统**:
- 标签颜色基于确定性哈希算法
- 相同标签在任何地方都是相同颜色
- 支持 18 种精选配色方案
- 自动适配浅色/深色主题

**智能图标**:
- 根据标题和标签自动匹配图标
- 生成一致的渐变配色
- 提供视觉识别和美观性

### 搜索功能

**全文搜索**:
- 顶部搜索框支持实时搜索
- 搜索范围包括标题、内容、标签
- 支持模糊匹配和关键词高亮

**筛选功能**:
- 按分类筛选提示词
- 查看收藏的提示词
- 管理回收站内容

### 基本操作

1. **查看所有提示词**: 左侧导航 → "全部"
2. **浏览收藏**: 左侧导航 → "收藏"
3. **浏览回收站**: 左侧导航 → "回收站"
4. **选择分类**: 点击左侧分类树中的分类
5. **搜索提示词**: 使用顶部搜索框

## API

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

## UI/UX 设计

### 主题系统

本项目采用 CSS Variables 驱动的双主题系统：

**浅色主题 (Light Mode)**:
- 纯白背景 (`#ffffff`)
- 深色文字，高对比度
- 隐藏装饰性特效
- 专业简洁的视觉风格

**深色主题 (Dark Mode)**:
- 深色背景 (`#09090b`)
- 浅色文字，护眼设计
- 网格/极光背景特效
- 现代科技感视觉

**技术实现**:
```css
/* 浅色模式 (默认) */
:root {
  --bg-main: #ffffff;
  --text-primary: #18181b;
  /* ... */
}

/* 深色模式覆盖 */
:root.dark {
  --bg-main: #09090b;
  --text-primary: #e4e4e7;
  /* ... */
}
```

### 确定性标签颜色系统

**核心原理**:
- 基于 djb2 哈希算法
- 标签名称 → 固定数字 → 颜色索引
- 相同标签永远相同颜色

**颜色盘设计**:
- 18 种精选 Tailwind 颜色
- 覆盖蓝、绿、紫、暖、红、青、中性色系
- 半透明背景 + 高对比文字
- 自动适配主题

**使用示例**:
```typescript
import { getTagStyle } from '@/utils/tagColors';

// Python 永远是蓝色系
const style = getTagStyle('Python');
// 返回: "bg-blue-500/10 text-blue-300 border-blue-500/20"
```

### 交互设计

**Spotlight 卡片**:
- 鼠标跟随的光效
- 玻璃拟态材质
- 微妙的悬停动画

**树形下拉选择器**:
- 层级缩进显示
- 搜索实时过滤
- 键盘导航支持
- 视觉引导线

**内联编辑**:
- 双击进入编辑模式
- Enter 确认，Esc 取消
- 失焦自动保存
- 无模态设计

关键实现位置:
- `src/index.css`: 主题系统、全局样式
- `src/contexts/ThemeContext.tsx`: 主题状态管理
- `src/utils/tagColors.ts`: 标签颜色算法
- `src/components/PromptList.tsx`: Spotlight 卡片、新建页面
- `src/components/Sidebar.tsx`: 分类树、主题切换

## Configuration

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

## Development

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

##  提示词最佳实践

1. **使用明确的标题**: "Python 调试助手" 而不是 "Python"
2. **添加相关标签**: 便于搜索和组织
3. **编写清晰的说明**: 包括角色、任务、约束
4. **使用模板**: 建立一致的提示词格式
5. **经常更新**: 根据使用情况改进提示词

## Roadmap

### 已完成 (v1.0.0)

- [x] **双主题系统**: 浅色/深色主题无缝切换
- [x] **确定性标签颜色**: 基于哈希算法的一致性颜色系统
- [x] **树形分类选择器**: 现代化的下拉选择体验
- [x] **内联编辑**: 分类重命名、新建的无模态交互
- [x] **悬停视觉反馈**: 完善的交互提示和动画效果
- [x] **新建页面重设计**: 更大的编辑区域和更好的布局
- [x] **主题适配**: 所有组件完美适配双主题
- [x] **导入/导出功能**: 支持提示词的导入与导出
- [x] **快速导入功能**: 支持拖拽导入 Markdown 与 JSON 文件
- [x] **Interval 任务系统 V2**: 后端调度 + 前端轮询的 Interval 任务提醒体系
- [x] **图片引用式链接**: 粘贴图片使用引用式链接格式，编辑区更整洁

### 计划中 (v1.1.0)

- [ ] **标签管理**: 标签的批量编辑和管理界面
- [ ] **快捷键支持**: 键盘快捷键提升操作效率
- [ ] **搜索增强**: 高级搜索、搜索历史、搜索建议
- [ ] **模板系统**: 提示词模板和快速创建
- [ ] **数据统计**: 使用统计和数据可视化

### 未来规划 (v2.0.0)

- [ ] **多语言支持**: 国际化和本地化
- [ ] **插件系统**: 支持第三方扩展
- [ ] **云同步**: 可选的云端数据同步
- [ ] **协作功能**: 团队共享和协作编辑
- [ ] **AI 集成**: 智能提示词生成和优化建议
- [ ] **移动端应用**: 原生移动应用支持

### 技术债务

- [ ] **编辑页分类选择器统一**: 将编辑页的原生 `select` 改为自定义组件
- [ ] **Git 仓库治理**: 清理嵌套仓库，规范 `.gitignore`
- [ ] **数据目录规范**: 明确生产环境的 `VAULT_PATH` 配置
- [ ] **测试覆盖**: 添加单元测试和集成测试
- [ ] **性能优化**: 大量数据时的性能优化
- [ ] **错误处理**: 更完善的错误处理和用户提示

## Contributing

欢迎提交 Issue 和 Pull Request。

在提交前建议遵守以下约定(可以显著减少冲突与误提交):

### 提交前检查清单

- **不要提交本地敏感信息**
  - `.env`(包含本地 API 地址/配置)
  - `sample-vault/`(除非你明确要更新示例数据)
  - `sample-vault/trash/.trash-visits.json`(运行时状态文件)
- **避免引入嵌套 Git 仓库导致“子模块不洁净”提示**
  - 如果某目录是独立仓库(例如 `Dashboard/`),请确保它自身是 clean(没有未跟踪文件如 `.vs/`)
  - 若不需要独立仓库,请不要在子目录保留 `.git`

### 推荐流程(与 Best-README-Template 一致)

1. Fork 本项目
2. 新建分支: `git checkout -b feature/AmazingFeature`
3. 提交改动: `git commit -m "feat: ..."`
4. 推送分支: `git push origin feature/AmazingFeature`
5. 发起 Pull Request

## License

MIT License

## Contact

- Project Link: https://github.com/Lemonix-Ning/local_prompt_notion

## Acknowledgments

- [Best-README-Template](https://github.com/othneildrew/Best-README-Template)
- [Lucide Icons](https://lucide.dev)
- [Tailwind CSS](https://tailwindcss.com)

##  故障排查

详见 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

### 桌面版窗口按钮/拖拽失效

如果桌面版出现“右上角最小化/最大化/关闭不可用”或“窗口无法拖动”，请检查:

1. `src-tauri/tauri.conf.json` 是否启用了 capabilities:

   - `app.security.capabilities: ["default"]`

2. `src-tauri/capabilities/default.json` 是否包含窗口权限(示例):

   - `core:window:allow-minimize`
   - `core:window:allow-maximize`
   - `core:window:allow-unmaximize`
   - `core:window:allow-close`
   - `core:window:allow-start-dragging`

---

**最后更新**: 2026 年 1 月 20 日  
**版本**: 1.0.0  
**构建状态**: 通过  
**主要更新**: Interval 任务系统 V2、快速导入（拖拽 Markdown/JSON）、图片引用式链接优化、性能与交互修复
