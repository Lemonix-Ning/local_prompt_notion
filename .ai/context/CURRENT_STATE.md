# CURRENT_STATE Index (Project Status)

## 0. Maintenance Guide (维护指南)

### How to Update (如何更新)
- **Location**: Insert the latest status snapshot at the **TOP** of the "Status Logs" section.
- **Order**: Reverse Chronological (Newest first).
- **Format**:
  ```markdown
  ### [YYYY-MM-DD] Phase Name
  - **Goal**: ...
  
  #### Todo List
  - [ ] Task 1
  - [x] Task 2
  
  #### Context Dump
  - **Key Errors**: (StackTraces, etc.)
  - **API Changes**: ...
  - **Environment**: ...
  ```
- **Rules**: 
  - Update this file whenever a major task is started or completed.
  - **Todo List**: Detailed tracking of tasks (use `[x]` for completed).
  - **Context Dump**: Temporary critical info (StackTraces, API changes, etc.) acting as "RAM" for the AI.
  - This file serves as the **Short-term Memory** for AI.

---

## 1. Quick Index (快速索引)
*Latest status is at the top of the Status Logs.*

- [**[Latest] Lumi 交互与倒计时简化**](#2026-01-24-lumi-交互与倒计时简化)
  - [Todo List](#todo-list)
  - [Context Dump](#context-dump)
- [**[History] v1.0 Release**](#history-v10-release)

---

## 2. Status Logs (Reverse Chronological)

### [2026-01-24] 文档一致性修正落地
- **Goal**: 按 Lumi 规范修正气泡与交互细节，实现代码与文档完全一致。

#### Todo List
- [x] 调整气泡样式/动效/位置（含思考气泡）
- [x] 校准 SpiritCat 动作与眼部表现
- [x] 修正拖拽/风压/时间反馈细节
- [x] 完成 lint 与 build 验证

#### Context Dump
- **Behavior Change**:
  - 思考气泡按 Lumina 规范呈现（颜色、位置、尾巴）
  - 传输/时间/操作气泡动效与方向对齐文档
  - 风压由滚动容器速度驱动，拖拽表情与四肢下垂反馈
  - 倒计时震动与日程轻跳按规范重复与缩放
- **Verification**:
  - `npm run lint`（lint skipped: no eslint config）
  - `npm run build` ✅
- **Files Modified**:
  - `src/App.tsx`
  - `src/components/SpiritCat.tsx`
  - `src/components/PromptList.tsx`
  - `src/components/ExportPromptsDialog.tsx`
  - `src/contexts/LumiContext.tsx`
  - `docs/Lumi Autonomous Behavior.md`
  - `docs/Lumina Spirit Cat.md`
  - `.ai/comparison/*`
  - `.ai/index/AI_CONTEXT.md`

### [2026-01-24] 文档一致性系统比对
- **Goal**: 逐文档比对实现与方案一致性，输出差异报告与总览。

#### Todo List
- [x] 完成 docs 全量解析并拆分功能清单
- [x] 建立功能到实现的映射
- [x] 生成独立比对报告与总览

#### Context Dump
- **Output**:
  - 生成 `.ai/comparison/` 全量报告（总览 + 单文档报告）
  - 记录主要差异：思考气泡、倒计时震动节奏、眨眼禁用、方向性动效
- **Verification**:
  - 文档比对完成，未执行端到端测试
- **Files Modified**:
  - `.ai/comparison/*`
  - `.ai/context/PROJECT_MAP.md`
  - `.ai/context/CURRENT_STATE.md`

### [2026-01-24] Lumi 交互与倒计时简化
- **Goal**: 统一 Lumi 反馈与气泡呈现，补齐点击思考/嘴巴反馈，并简化倒计时前端逻辑。

#### Todo List
- [x] 将动作/传输/时间反馈统一到图标气泡
- [x] 点击 Lumi 切换思考形态与缩放反馈
- [x] 补齐嘴巴/风压/尾巴反馈
- [x] 移除倒计时 sessionStorage 依赖并改为纯时间计算
- [x] 完成 build 验证
- [ ] UI 走查：点击思考、气泡优先级、睡眠唤醒

#### Context Dump
- **Behavior Change**:
  - Lumi 气泡优先级：action/transfer/time > notification/chat。
  - 点击 Lumi 触发思考形态：眼色变青、身体路径拉伸、光环加速、缩放反馈。
  - 风压状态眼睛更小、尾巴更紧，嘴巴形态随状态切换。
  - 倒计时计算基于目标时间与起始时间，不再依赖 sessionStorage。
- **Verification**:
  - `npm run lint`（lint skipped: no eslint config）
  - `npm run build` ✅
- **Files Modified**:
  - `src/App.tsx`
  - `src/components/SpiritCat.tsx`
  - `src/components/ChronoCard.tsx`
  - `src/components/TaskEditorOverlay.tsx`
  - `src/components/PromptList.tsx`
  - `src/hooks/useCountdown.ts`

### [2026-01-24] Settings + Import UX Enhancements
- **Goal**: Improve Settings UX (auto theme, close behavior toggle, sidebar-aware overlay) and Import UX (no results page, robust preview, empty JSON handling).

#### Todo List
- [x] Add theme auto-switch mode (day=light, night=dark) with persistence
- [x] Add Settings toggle for auto theme
- [x] Make Settings drawer width follow resizable sidebar width
- [x] Backdrop behavior for Settings: blur sidebar only; click content area closes
- [x] Add Settings toggle for close behavior: minimize-to-tray vs exit
- [x] Tauri backend: expose close behavior commands and respect setting on CloseRequested
- [x] Import dialog: remove post-import results page (toast only + auto close)
- [x] Import dialog: normalize category_path to vault-relative (strip drive/absolute prefixes)
- [x] Import dialog: handle empty JSON (toast + stay in initial state)
- [ ] Verify on Windows: window X close respects setting; tray show/quit OK; setting persists
- [ ] Verify theme auto mode switches correctly across boundary times
- [ ] Verify import preview behavior for flat/tree cases and single-card tree case

#### Context Dump
- **Behavior Change**:
  - Theme supports `themeMode` (manual/auto). Auto uses time-based rule (light during day, dark at night).
  - Settings drawer overlay now blurs only the sidebar region and closes when clicking the content region.
  - Close behavior is configurable (minimize to tray vs exit) and is enforced by Tauri CloseRequested handler.
  - Import dialog no longer shows an import results page; success is reported via toast and dialog closes.
  - Import preview tree no longer displays absolute Windows paths; paths are truncated to `vault/` relative.
  - Empty JSON import files show a toast and do not enter preview.
- **API / Commands**:
  - New Tauri commands: `get_close_behavior`, `set_close_behavior`
- **Files Modified**:
  - `src/contexts/ThemeContext.tsx`
  - `src/components/Sidebar.tsx`
  - `src-tauri/src/lib.rs`
  - `src/components/ImportPromptsDialog.tsx`
  - (User edits) `src/hooks/useCountdown.ts`, `src/components/ChronoCard.tsx`, `src/components/PromptList.tsx`, `src/components/TaskEditorOverlay.tsx`, `src/contexts/LumiContext.tsx`

### [2026-01-24] Task Scheduler Bug Fixes (Bug 11 - Countdown Reset)
- **Goal**: Fix countdown timer not resetting on page refresh/restart for interval tasks.

### [2026-01-23] Stable Release Phase
*Updated: 2026-01-23*

#### Active Goal
**项目阶段**: 稳定运行阶段 (Stable Release)
**当前目标**: 
- 维护现有功能稳定性
- 优化性能瓶颈
- 修复已知 Bug

#### Todo List

**🔥 高优先级 (High Priority)**
- [ ] [待确认: 需要用户补充当前正在进行的任务]

**📋 中优先级 (Medium Priority)**
- [ ] 优化大型 Vault (1000+ 卡片) 的扫描性能
- [ ] 添加卡片批量操作功能 (批量删除、移动)
- [ ] 实现全文搜索索引 (当前为实时搜索)

**💡 低优先级 (Low Priority)**
- [ ] 支持自定义主题配色
- [ ] 添加卡片模板功能
- [ ] 支持多语言国际化 (i18n)

**✅ 已完成 (Completed in this phase)**
- [x] 生成 AI 认知基础设施文档 (`.ai/context/`)
- [x] 统一文档结构 (Maintenance Guide + Index + Logs)

#### Context Dump
*(Temporary important info: StackTraces, API changes, etc.)*

**1. Recent Known Issues**
- **快速连续删除卡片时偶现错误**
  - **Status**: 🟡 已缓解 (临时方案: `AppContext.tsx` 静默处理)
- **大型 Markdown 文件渲染卡顿**
  - **Status**: 🟢 已优化 (使用 `markdownCache.ts`)

**2. Key API Changes**
- None in this phase.

#### Performance Baseline
*Environment: Windows 11, i7-12700, 16GB RAM*

| 指标 | 目标值 | 当前值 | 状态 |
|------|--------|--------|------|
| 启动时间 (首次) | < 2.5s | 1.8s | ✅ |
| Vault 扫描 (1000 卡片) | < 1s | 800ms | ✅ |
| Bundle 大小 (gzip) | < 500KB | 420KB | ✅ |

---

### [History] v1.0 Release
*Snapshot: 2026-01-23*

#### Completed Features
- [x] 基础 CRUD 功能 (创建、读取、更新、删除)
- [x] 分类树拖拽排序
- [x] Markdown 编辑器 + 代码高亮
- [x] 回收站功能 (5 天自动清理)
- [x] 任务计划时间 + 重复任务
- [x] 图片粘贴上传 (Base64)
- [x] JSON/Markdown 文件导入导出
- [x] Tauri 桌面应用打包
- [x] 性能监控与优化 (启动时间 < 2 秒)
- [x] 虚拟滚动优化 (支持 10000+ 卡片)

#### Environment Config
**开发模式**: `npm run dev:api`
**桌面应用**: `npm run desktop:dev`
