# 项目问题及解决方案汇总

本文档记录了 Local Prompt Notion 项目开发过程中遇到的所有问题及其解决方案。

## 目录

1. [路径分隔符问题](#路径分隔符问题)
2. [创建提示词返回空对象](#创建提示词返回空对象)
3. [编辑器缺少分类选择器](#编辑器缺少分类选择器)
4. [编辑模式自动保存问题](#编辑模式自动保存问题)
5. [Windows 文件重命名权限错误](#windows-文件重命名权限错误)
6. [分类重命名失败 EPERM 错误](#分类重命名失败-eperm-错误)
7. [前端数据未及时同步](#前端数据未及时同步)

---

## 路径分隔符问题

### 问题描述
Windows 和 Unix 系统使用不同的路径分隔符:
- Windows: `\` (反斜杠)
- Unix/Mac/Linux: `/` (正斜杠)

删除提示词后,检查是否在回收站时使用了硬编码的 `/trash/` 路径,在 Windows 上无法匹配 `\trash\`,导致回收站功能失效。

### 根本原因
后端生成的文件路径使用 `path.join()` 返回系统特定的分隔符,但前端代码中硬编码了 Unix 风格的路径检查。

### 解决方案

**文件**: `src/AppContext.tsx`

在所有地方检查是否在回收站时,同时检查两种分隔符:

```typescript
// ❌ 错误做法
const isInTrash = (path: string) => path.includes('/trash/');

// ✅ 正确做法
const isInTrash = (path: string) => 
  path.includes('/trash/') || path.includes('\\trash\\');
```

**应用场景**:
- `AppContext.tsx` - `getFilteredPrompts()` 函数
- `PromptList.tsx` - 过滤显示时
- 其他所有需要检查回收站的地方

### 测试验证
- 在 Windows 上删除提示词 → 检查是否出现在回收站
- 在 Unix 系统上测试相同功能

---

## 创建提示词返回空对象

### 问题描述
新建的提示词在列表中显示为空卡片(没有标题)。

### 根本原因
后端创建提示词时没有返回创建的对象。前端代码期望:
```typescript
// API 返回格式
{ success: true, data: promptData }
```

但后端只返回了成功状态,没有包含新建的提示词数据,导致前端无法更新列表。

### 解决方案

**文件**: `server/routes/prompts.js`

修改创建提示词的路由,返回完整的提示词数据:

```javascript
// ❌ 之前
res.json({ success: true });

// ✅ 之后
res.json({ 
  success: true, 
  data: prompt  // 返回创建的提示词对象
});
```

**完整代码**:
```javascript
router.post('/', async (req, res, next) => {
  try {
    const { categoryPath, title } = req.body;
    
    // ... 验证逻辑 ...
    
    const prompt = await createPrompt(categoryPath, title.trim());
    
    // 返回创建的提示词数据
    res.json({
      success: true,
      data: prompt
    });
  } catch (error) {
    // ... 错误处理 ...
  }
});
```

### 验证步骤
1. 创建新提示词
2. 检查返回的 API 响应中是否包含完整的提示词对象
3. 前端应正确显示新提示词的标题

---

## 编辑器缺少分类选择器

### 问题描述
编辑提示词时,编辑器没有分类选择下拉菜单,用户无法修改提示词所在的分类。

### 根本原因
`EditorPage.tsx` 组件在渲染元数据时缺少分类选择器 UI。虽然后台存储了 `category` 信息,但用户界面没有提供修改方式。

### 解决方案

**文件**: `src/components/EditorPage.tsx`

在元数据编辑部分添加分类选择器:

```tsx
// 获取所有分类
const getAllCategories = (nodes: CategoryNode[]): string[] => {
  let categories: string[] = [];
  nodes.forEach(node => {
    categories.push(node.path);
    if (node.children?.length) {
      categories = categories.concat(getAllCategories(node.children));
    }
  });
  return categories;
};

// 在元数据部分添加分类选择
<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    <FolderOpen size={16} className="inline mr-2" />
    分类
  </label>
  <select
    value={formData.meta.category || ''}
    onChange={(e) => setFormData({
      ...formData,
      meta: { ...formData.meta, category: e.target.value }
    })}
    className="w-full px-3 py-2 border border-gray-300 rounded-md"
  >
    <option value="">无分类</option>
    {getAllCategories(fileSystem?.categories || []).map(cat => (
      <option key={cat} value={cat}>{cat}</option>
    ))}
  </select>
</div>
```

### 验证步骤
1. 打开提示词编辑模式
2. 查看元数据部分是否有分类下拉菜单
3. 尝试修改分类
4. 保存后检查提示词是否移动到新分类

---

## 编辑模式自动保存问题

### 问题描述
用户编辑提示词后关闭编辑器,发现更改被自动保存了,没有机会放弃修改。

### 根本原因
`EditorPage.tsx` 的 `handleClose()` 函数在关闭时无条件地保存所有更改:

```typescript
// ❌ 错误的自动保存行为
const handleClose = () => {
  if (hasChanges) {
    await handleSave();  // 直接保存,没有提示
  }
};
```

### 解决方案

**文件**: `src/components/EditorPage.tsx`

改为显示确认对话框让用户选择:

```typescript
// ✅ 正确的确认逻辑
const handleClose = async () => {
  if (hasChanges) {
    const shouldSave = window.confirm(
      '有未保存的更改,是否保存?\n\n' +
      '取消 = 放弃更改\n' +
      '确定 = 保存更改'
    );
    if (shouldSave) {
      await handleSave();
    }
  }
  // 关闭编辑器...
};
```

### 用户体验流程
1. 用户编辑提示词并修改内容
2. 点击关闭按钮 (X)
3. 系统弹出确认对话框
4. 用户选择"确定"(保存) 或 "取消"(放弃)

### 验证步骤
1. 编辑提示词内容
2. 不保存就尝试关闭
3. 应该显示确认对话框
4. 点击"取消"时修改应该被放弃

---

## Windows 文件重命名权限错误

### 问题描述
在 Windows 上尝试重命名分类时出错:
```
EPERM: operation not permitted, rename 'D:\...\sample-vault\132' -> 'D:\...\sample-vault\312'
```

### 根本原因
Windows 文件系统的特殊性:
1. **Vite 文件监视器**: 开发服务器持续监控 `sample-vault/` 目录
2. **文件句柄占用**: 当尝试重命名时,文件监视器仍在读取目录
3. **并发冲突**: 操作系统拒绝重命名被占用的文件

### 解决方案

**分层次处理**:

#### 1. 后端延迟处理 (500ms 预热)

**文件**: `server/routes/categories.js`

```javascript
router.put('/rename', async (req, res, next) => {
  try {
    // ... 验证逻辑 ...
    
    // 给 Vite 文件监视器时间来释放文件锁
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await renameCategory(categoryPath, newName.trim());
    // ...
  } catch (error) {
    // ...
  }
});
```

#### 2. 前端延迟刷新 (300ms 同步)

**文件**: `src/AppContext.tsx`

```typescript
const renameCategory = async (categoryPath: string, newName: string) => {
  try {
    await adapter.renameCategory(categoryPath, newName);
    
    // 等待后端完成文件操作
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // 刷新数据
    await refreshVault();
  } catch (error) {
    console.error('Error renaming category:', error);
    throw error;
  }
};
```

#### 3. 后端文件删除重试机制

**文件**: `server/utils/fileSystem.js`

```javascript
async function safeRemoveDirectory(dirPath, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      // 先删除子文件和目录
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await safeRemoveDirectory(fullPath, 1);
        } else {
          await fs.unlink(fullPath);
        }
      }
      
      // 删除空目录
      await fs.rmdir(dirPath);
      return;
    } catch (error) {
      if (i < retries - 1) {
        // 指数退避重试: 300ms, 600ms, 900ms, ...
        const waitTime = 300 * (i + 1);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        throw error;
      }
    }
  }
}
```

### 关键优化点
- **直接 rename 尝试**: 首先尝试快速的 `fs.rename()`
- **降级方案**: 如果失败则使用复制+删除
- **重试机制**: 每次失败后等待更长时间再试
- **精细删除**: 逐个删除文件而不是一次性删除整个目录

### 验证步骤
1. 在 Windows 上运行前端和后端
2. 尝试重命名顶级分类
3. 检查是否成功(不再出现 EPERM 错误)
4. 验证文件系统中分类名称已变更

---

## 分类重命名失败 EPERM 错误

### 问题描述
用户在前端点击重命名分类后,显示错误:
```
重命名失败: EPERM: operation not permitted, rename 'D:\...\sample-vault\312' -> 'D:\...\sample-vault\123'
```

### 根本原因
同时有多个进程访问同一个文件夹:
1. Vite 文件监视器正在监控目录变化
2. 后端 Node.js 进程正在执行重命名
3. 可能还有操作系统的索引服务或防病毒软件

这些并发访问导致 Windows 文件系统拒绝重命名操作。

### 解决方案

实现**备用重命名策略** - 当 `fs.rename()` 失败时使用复制+删除:

**文件**: `server/utils/fileSystem.js`

```javascript
async function renameCategory(categoryPath, newName) {
  // 检查路径有效性
  if (!(await exists(categoryPath))) {
    throw new Error('Not found');
  }

  const parentPath = path.dirname(categoryPath);
  const newPath = path.join(parentPath, newName);

  if (await exists(newPath)) {
    throw new Error(`Category "${newName}" already exists`);
  }

  try {
    // 方案 1: 尝试直接重命名 (快速)
    console.log(`[RENAME] Attempting direct rename: ${categoryPath} -> ${newPath}`);
    await fs.rename(categoryPath, newPath);
    console.log(`[RENAME] Direct rename successful`);
  } catch (error) {
    // 方案 2: 直接重命名失败,使用备用方案
    if (error.code === 'EPERM' || error.code === 'EBUSY') {
      console.log(`[RENAME] Direct rename failed (${error.code}), using copy+delete fallback`);
      
      try {
        // 复制到新位置
        await copyDirectory(categoryPath, newPath);
        
        // 等待确保所有文件写入
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 删除原目录 (使用重试机制)
        await safeRemoveDirectory(categoryPath);
      } catch (fallbackError) {
        // 回滚: 删除新创建的目录
        if (await exists(newPath)) {
          await safeRemoveDirectory(newPath);
        }
        throw new Error('Failed to rename category: ' + fallbackError.message);
      }
    } else {
      throw error;
    }
  }

  return {
    name: newName,
    path: newPath,
  };
}
```

### 流程图
```
重命名请求
    ↓
[等待 500ms]  ← 给 Vite 释放文件句柄
    ↓
尝试 fs.rename()
    ↓
成功? ─→ 返回新路径
    ↓ (失败,EPERM/EBUSY)
复制目录到新位置
    ↓
[等待 100ms]  ← 确保文件写入完成
    ↓
删除原目录 (最多重试 5 次)
    ↓
成功? ─→ 返回新路径
    ↓ (失败)
回滚: 删除新目录
    ↓
抛出错误
```

### 验证步骤
1. 启动前端和后端
2. 尝试重命名包含多个文件的分类
3. 应该显示成功消息
4. 刷新后前端应显示新名称
5. 文件系统中应该看到重命名后的文件夹

---

## 前端数据未及时同步

### 问题描述
后端成功完成重命名/删除操作,但前端界面没有更新,仍然显示旧数据。

### 根本原因
**Race Condition** (竞态条件):
1. 前端发送重命名请求
2. 后端接收请求并开始操作
3. 前端立即调用 `refreshVault()` 刷新数据
4. 但后端的文件操作还未完成
5. 前端读到的仍是旧数据

### 解决方案

**文件**: `src/AppContext.tsx`

在 API 调用后和 `refreshVault()` 前添加延迟:

```typescript
const renameCategory = async (categoryPath: string, newName: string) => {
  try {
    // 1. 发送 API 请求
    await adapter.renameCategory(categoryPath, newName);
    
    // 2. 等待后端完成文件操作
    // 后端路由中已有 500ms 延迟,前端再等 300ms 确保完全完成
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // 3. 刷新前端数据
    await refreshVault();
  } catch (error) {
    console.error('Error renaming category:', error);
    throw error;
  }
};

const deleteCategory = async (categoryPath: string) => {
  try {
    await adapter.deleteCategory(categoryPath);
    
    // 等待后端完成文件操作
    await new Promise(resolve => setTimeout(resolve, 300));
    
    await refreshVault();
  } catch (error) {
    console.error('Error deleting category:', error);
    throw error;
  }
};
```

### 时间线
```
时间    前端                后端                文件系统
────────────────────────────────────────────────────
T0     发送请求 ──────────→
T100                    收到请求
T100                    [等待 500ms]
T200   [等待 300ms]
T300   发送刷新请求 ──→
T500                    完成重命名 ──────────→ ✓ 文件已改名
T500                    返回成功响应
T500   刷新完成           
       显示新数据
```

### 验证步骤
1. 重命名一个分类
2. 等待 1-2 秒观察界面
3. 前端应自动更新显示新名称
4. 手动刷新浏览器,数据应保持一致

---

## 通用排查步骤

### 问题诊断流程
1. **查看浏览器控制台**: F12 → Console 标签,查看 JavaScript 错误
2. **查看网络请求**: F12 → Network 标签,检查 API 请求状态
3. **查看后端日志**: 终端中的后端进程输出
4. **检查文件系统**: 使用文件浏览器验证文件是否实际被修改
5. **清理缓存**: Ctrl+Shift+Delete 清理浏览器缓存并重新加载

### 常见错误代码

| 错误 | 含义 | 常见原因 |
|------|------|--------|
| EPERM | 操作不允许 | 权限不足或文件被占用 |
| EBUSY | 资源忙碌 | 文件正在被其他进程使用 |
| ENOENT | 文件不存在 | 路径错误或文件已被删除 |
| EEXIST | 文件已存在 | 目标路径已经存在 |

### 重启步骤
```bash
# 终止所有 Node.js 进程
pkill -f node

# 重启后端
cd server && npm start

# 重启前端 (新终端)
npm run dev

# 清理浏览器缓存并硬刷新
# F12 → Settings → Application → Clear Site Data
# 然后按 Ctrl+Shift+R 硬刷新
```

---

## 总结表

| 问题 | 症状 | 解决时间 | 难度 |
|------|------|--------|------|
| 路径分隔符 | 删除功能失效 | 10 分钟 | ⭐ 简单 |
| 空提示词 | 新建后显示为空 | 15 分钟 | ⭐ 简单 |
| 缺少分类选择 | 无法修改分类 | 20 分钟 | ⭐ 简单 |
| 自动保存 | 误保存修改 | 5 分钟 | ⭐ 简单 |
| EPERM 错误 | 重命名失败 | 2 小时 | ⭐⭐⭐ 困难 |
| 数据不同步 | 界面未更新 | 30 分钟 | ⭐⭐ 中等 |

---

**最后更新**: 2025 年 11 月 29 日  
**遇到新问题?** 请提交 Issue 或 Pull Request
