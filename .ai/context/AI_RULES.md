# AI 协作协议 (AI_RULES.md)

> **用途**: 粘贴到 Cursor Rules 或作为 System Prompt 的一部分

---

## 🤖 元指令 (Meta Instructions)

### 强制性工作流程 (Mandatory Workflow)

#### 1️⃣ 开始编码前 (Before Coding)
```
✅ 必须先阅读 .ai/context/CURRENT_STATE.md
✅ 检查 Todo List 中是否有相关任务
✅ 确认当前目标与你的任务一致
```

#### 2️⃣ 编码过程中 (During Coding)
```
✅ 遵守 ARCHITECTURE.md 中的 Constraints (禁止事项)
✅ 参考 PROJECT_MAP.md 快速定位文件
✅ 保持代码风格与现有代码一致
```

#### 3️⃣ 完成任务后 (After Coding)
```
✅ 运行测试 (如果有)
✅ 更新 CURRENT_STATE.md 中的任务状态
✅ 如果添加了新文件，同步更新 PROJECT_MAP.md
✅ 如果新增/变更了公共接口，同步更新 AI_CONTEXT.md
```

---

## 📋 Definition of Done (DoD)

**只有当以下所有条件满足时，任务才算完成**:

### ✅ 代码质量
- [ ] 代码通过 TypeScript 类型检查 (`npm run build`)
- [ ] 无 ESLint 错误 (如果配置了 ESLint)
- [ ] 代码风格与现有代码一致

### ✅ 功能验证
- [ ] 功能在开发模式下正常运行 (`npm run dev:api`)
- [ ] 功能在桌面模式下正常运行 (`npm run desktop:dev`)
- [ ] 边界情况已测试 (空数据、大数据、错误输入)

### ✅ 文档更新
- [ ] **CURRENT_STATE.md** 中的任务状态已更新 ([ ] → [x])
- [ ] 如果添加了新文件，**PROJECT_MAP.md** 已更新
- [ ] 如果修改了架构，**ARCHITECTURE.md** 已更新
- [ ] 如果有新的已知问题，已记录到 **CURRENT_STATE.md::Context Dump**

### ✅ 性能检查
- [ ] 无明显性能退化 (启动时间、渲染速度)
- [ ] 大数据场景下无卡顿 (1000+ 卡片)
- [ ] 内存占用无异常增长

---

## 🚫 禁止事项 (Forbidden Actions)

### ❌ 代码层面
1. **禁止在组件中直接调用 `adapter` 方法**
   - 必须通过 `AppContext` 提供的封装方法
   - 例如: 使用 `savePrompt()` 而非 `adapter.savePrompt()`

2. **禁止直接修改 `state` 对象**
   - 必须通过 `dispatch(action)` 触发状态变更
   - 例如: `dispatch({ type: 'SELECT_CATEGORY', payload: 'new' })`

3. **禁止在生产环境使用 Mock Adapter**
   - 检查 `VITE_USE_MOCK` 环境变量
   - 桌面应用构建时必须设置为 `false`

4. **禁止在 Markdown 内容中注入未过滤的 HTML**
   - 使用 `rehype-sanitize` 插件
   - 配置在 `MarkdownRenderer.tsx`

5. **禁止阻塞主线程的长时间操作**
   - 使用 `setTimeout(..., 0)` 或 `async/await`
   - 文件扫描、图片处理必须异步

6. **禁止在 JSX 中遗漏闭合标签**
   - 每个 `<div>` 必须有对应的 `</div>`
   - 使用 IDE 的括号匹配功能检查
   - 提交前运行 `npm run build` 验证

### ❌ 文档层面
1. **禁止修改代码后不更新文档**
   - 新增文件 → 更新 `PROJECT_MAP.md`
   - 完成任务 → 更新 `CURRENT_STATE.md`
   - 架构变更 → 更新 `ARCHITECTURE.md`

2. **禁止在文档中使用模糊表述**
   - ❌ "可能需要优化"
   - ✅ "在 1000+ 卡片场景下，扫描时间超过 2 秒，需要优化"

---

## 🎯 编码规范 (Coding Standards)

### TypeScript 规范
```typescript
// ✅ 正确: 明确的类型定义
interface PromptData {
  meta: PromptMetadata;
  content: string;
  path: string;
}

// ❌ 错误: 使用 any 类型
const data: any = fetchData();
```

### React 组件规范
```typescript
// ✅ 正确: 函数组件 + TypeScript
interface MyComponentProps {
  title: string;
  onSave: (data: PromptData) => void;
}

export function MyComponent({ title, onSave }: MyComponentProps) {
  // ...
}

// ❌ 错误: 缺少类型定义
export function MyComponent({ title, onSave }) {
  // ...
}
```

### 状态管理规范
```typescript
// ✅ 正确: 通过 dispatch 更新状态
const { dispatch } = useApp();
dispatch({ type: 'SELECT_CATEGORY', payload: 'new-category' });

// ❌ 错误: 直接修改 state
state.selectedCategory = 'new-category';
```

### 异步操作规范
```typescript
// ✅ 正确: 使用 async/await + 错误处理
const handleSave = async () => {
  try {
    await savePrompt(data);
    showToast('保存成功', 'success');
  } catch (error) {
    showToast('保存失败', 'error');
    console.error(error);
  }
};

// ❌ 错误: 未处理错误
const handleSave = async () => {
  await savePrompt(data);
};
```

---

## 🔍 代码审查清单 (Code Review Checklist)

### 提交前自查 (Self-Review)
- [ ] 代码中无 `console.log` (除非是必要的日志)
- [ ] 代码中无 `TODO` 或 `FIXME` 注释 (或已记录到 CURRENT_STATE.md)
- [ ] 代码中无硬编码的路径或 URL
- [ ] 代码中无敏感信息 (API Key、密码等)
- [ ] 代码格式化已完成 (使用 Prettier 或 ESLint)

### 性能检查 (Performance Check)
- [ ] 无不必要的重新渲染 (使用 `React.memo` 或 `useMemo`)
- [ ] 无内存泄漏 (清理 `useEffect` 中的订阅)
- [ ] 大数据场景下无性能问题 (使用虚拟滚动)

### 安全检查 (Security Check)
- [ ] 用户输入已验证和过滤
- [ ] Markdown 渲染已使用 `rehype-sanitize`
- [ ] 文件路径已验证 (防止路径遍历攻击)

### JSX 结构检查 (JSX Structure Check)
- [ ] 所有 JSX 标签已正确闭合
- [ ] 使用 IDE 的括号匹配功能验证嵌套结构
- [ ] 复杂的条件渲染中检查每个分支的闭合标签
- [ ] 运行 `npm run build` 确保无 Babel 解析错误

---

## 📚 常用命令速查 (Quick Reference)

### 开发命令
```bash
# 启动开发服务器 (前端 + 后端)
npm run dev:api

# 启动桌面应用开发模式
npm run desktop:dev

# 构建生产版本
npm run build

# 构建桌面应用
npm run desktop:build
```

### 调试命令
```bash
# 分析 Bundle 体积
npm run build:analyze

# 测量性能基线
npm run perf:baseline

# 清理临时文件
npm run cleanup

# 验证桌面构建
npm run check:desktop
```

### 数据管理
```bash
# 生成测试数据
npm run seed:vault
```

---

## 🤝 协作流程 (Collaboration Workflow)

### 接手新任务时
1. 阅读 `CURRENT_STATE.md` 了解当前进度
2. 在 `CURRENT_STATE.md::Todo List` 中找到任务
3. 阅读 `ARCHITECTURE.md` 了解架构约束
4. 使用 `PROJECT_MAP.md` 快速定位相关文件

### 完成任务时
1. 确保代码通过所有检查 (见 Definition of Done)
2. 更新 `CURRENT_STATE.md` 中的任务状态
3. 如果有新文件，更新 `PROJECT_MAP.md`
4. 如果有新问题，记录到 `CURRENT_STATE.md::Context Dump`

### 遇到问题时
1. 检查 `CURRENT_STATE.md::已知问题` 是否有相关记录
2. 检查 `CURRENT_STATE.md::常见错误排查`
3. 如果是新问题，记录到 `Context Dump` 并标注状态 (🔴 未解决 / 🟡 进行中 / 🟢 已解决)

---

## 🎓 学习资源 (Learning Resources)

### 项目相关
- **Tauri 文档**: https://tauri.app/
- **React 文档**: https://react.dev/
- **Vite 文档**: https://vitejs.dev/
- **Tailwind CSS**: https://tailwindcss.com/

### 代码风格
- **TypeScript 最佳实践**: https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html
- **React 性能优化**: https://react.dev/learn/render-and-commit

---

## 📝 文档维护协议 (Documentation Maintenance)

### 更新频率
- **CURRENT_STATE.md**: 每次任务完成后必须更新
- **PROJECT_MAP.md**: 新增/删除文件时必须更新
- **ARCHITECTURE.md**: 架构变更时必须更新
- **AI_RULES.md**: 协作流程变更时必须更新

### 更新格式
```markdown
**最后更新**: YYYY-MM-DD
**更新者**: [你的名字或 AI 标识]
**变更内容**: [简要描述]
```

---

## 🚀 快速开始 (Quick Start for AI)

**如果你是第一次接触这个项目，请按以下顺序阅读**:

1. **ARCHITECTURE.md** (5 分钟) - 了解技术栈和架构约束
2. **PROJECT_MAP.md** (3 分钟) - 熟悉文件结构
3. **CURRENT_STATE.md** (2 分钟) - 了解当前进度和已知问题
4. **AI_RULES.md** (当前文件, 5 分钟) - 学习协作规范

**总计**: 15 分钟即可上手开发

---

**最后更新**: 2026-01-24  
**维护者**: AI Context Architect  
**版本**: 1.1.0
