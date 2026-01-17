/**
 * 文件系统工具函数
 */

const fs = require('fs').promises;
const fssync = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * 检查文件或目录是否存在
 */
async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function movePrompt(promptPath, newCategoryPath, vaultRoot) {
  if (!isPathSafe(newCategoryPath, vaultRoot)) {
    throw new Error('Invalid category path');
  }

  await fs.mkdir(newCategoryPath, { recursive: true });

  const baseName = path.basename(promptPath);
  let candidate = path.join(newCategoryPath, baseName);
  let counter = 1;
  while (await exists(candidate)) {
    candidate = path.join(newCategoryPath, `${baseName}_moved_${counter}`);
    counter++;
  }

  await fs.rename(promptPath, candidate);

  const moved = await readPrompt(candidate);
  moved.meta.category_path = newCategoryPath;
  
  // 如果移动到根目录，category 应该为空字符串
  if (path.normalize(newCategoryPath) === path.normalize(vaultRoot)) {
    moved.meta.category = '';
  } else {
    moved.meta.category = path.basename(newCategoryPath);
  }
  
  await writePrompt(candidate, moved);
  return moved;
}

/**
 * 标题转 slug
 * 支持中文、英文、数字
 * 注意：不转换大小写，保留原始大小写以支持区分
 */
function titleToSlug(title) {
  return title
    .trim()
    // 保留中文、英文、数字、空格、连字符
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s-]/g, '')
    // 空格和连字符替换为下划线
    .replace(/[\s-]+/g, '_')
    // 限制长度
    .substring(0, 100); // 增加到 100 以支持中文标题
}

/**
 * 验证路径是否在 Vault 内(防止路径遍历攻击)
 */
function isPathSafe(targetPath, vaultRoot) {
  // 使用 path.resolve 获取绝对路径并规范化
  const normalizedTarget = path.resolve(targetPath);
  const normalizedRoot = path.resolve(vaultRoot);
  
  // 在 Windows 上，路径可能有大小写差异，统一转为小写比较
  const targetLower = normalizedTarget.toLowerCase();
  const rootLower = normalizedRoot.toLowerCase();
  
  // 检查目标路径是否以根路径开头
  const isStartsWith = targetLower.startsWith(rootLower);
  
  // 额外检查：确保不是根路径的前缀（例如 C:\vault2 不应该匹配 C:\vault）
  const isSafe = isStartsWith && (
    targetLower === rootLower || 
    targetLower.charAt(rootLower.length) === path.sep
  );
  
  return isSafe;
}

/**
 * 递归扫描目录
 */
async function scanDirectory(dirPath, rootPath) {
  const nodes = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // 跳过隐藏文件夹和 trash 目录
      if (entry.name.startsWith('.') || entry.name === 'trash') {
        continue;
      }

      if (entry.isDirectory()) {
        const fullPath = path.join(dirPath, entry.name);
        const hasMeta = await exists(path.join(fullPath, 'meta.json'));

        if (hasMeta) {
          // 这是一个提示词目录，但在根目录扫描时我们不在这里处理
          // 提示词会在 loadPromptsInDirectory 中处理
          continue;
        } else {
          // 这是一个分类文件夹
          const categoryNode = {
            name: entry.name,
            path: fullPath,
            children: await scanDirectory(fullPath, rootPath),
            prompts: await loadPromptsInDirectory(fullPath),
          };
          nodes.push(categoryNode);
        }
      }
    }
  } catch (error) {
    // Error scanning directory
  }

  return nodes;
}

/**
 * 加载目录中的所有提示词
 */
async function loadPromptsInDirectory(dirPath) {
  const prompts = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(dirPath, entry.name);
        const hasMeta = await exists(path.join(fullPath, 'meta.json'));

        if (hasMeta) {
          try {
            const prompt = await readPrompt(fullPath);
            prompts.push(prompt);
          } catch (error) {
            // Error reading prompt
          }
        }
      }
    }
  } catch (error) {
    // Error loading prompts
  }

  return prompts;
}

/**
 * 读取单个提示词
 */
async function readPrompt(promptPath) {
  const metaPath = path.join(promptPath, 'meta.json');
  const contentPath = path.join(promptPath, 'prompt.md');

  // 读取元数据
  const metaContent = await fs.readFile(metaPath, 'utf-8');
  const meta = JSON.parse(metaContent);

  // 读取内容
  let content = '';
  try {
    content = await fs.readFile(contentPath, 'utf-8');
  } catch (error) {
    // Content file not found
  }

  return {
    meta,
    content,
    path: promptPath,
  };
}

/**
 * 写入提示词
 */
async function writePrompt(promptPath, data, options = {}) {
  // 确保目录存在
  await fs.mkdir(promptPath, { recursive: true });

  // 更新时间戳
  const touchUpdatedAt = options.touchUpdatedAt !== false;
  if (touchUpdatedAt) {
    data.meta.updated_at = new Date().toISOString();
  }

  // 写入元数据
  const metaPath = path.join(promptPath, 'meta.json');
  await fs.writeFile(metaPath, JSON.stringify(data.meta, null, 2), 'utf-8');

  // 写入内容
  const contentPath = path.join(promptPath, 'prompt.md');
  await fs.writeFile(contentPath, data.content || '', 'utf-8');

  return data;
}

/**
 * 创建新提示词
 */
async function createPrompt(categoryPath, promptData) {
  const baseSlug = titleToSlug(promptData.title);
  
  let slug = baseSlug;
  let promptPath = path.join(categoryPath, slug);
  let counter = 1;

  // 如果已存在，自动添加数字后缀
  while (await exists(promptPath)) {
    slug = `${baseSlug}_${counter}`;
    promptPath = path.join(categoryPath, slug);
    counter++;
  }

  // 从路径中提取分类名称
  const categoryName = path.basename(categoryPath);

  // 创建元数据
  const meta = {
    id: uuidv4(),
    title: promptData.title,
    slug,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: promptData.tags || [],
    version: promptData.version || '1.0.0',
    author: promptData.author || 'User',
    model_config: promptData.model_config || {
      default_model: 'gpt-4',
      temperature: 0.7,
      top_p: 1.0,
    },
    is_favorite: promptData.is_favorite || false,
    is_pinned: promptData.is_pinned || false,
    category: promptData.category || categoryName,
    category_path: categoryPath,
    type: promptData.type || 'NOTE',
  };
  
  // 任务相关字段（只在提供时才添加）
  if (promptData.scheduled_time) {
    meta.scheduled_time = promptData.scheduled_time;
  }
  if (promptData.recurrence) {
    meta.recurrence = promptData.recurrence;
  }
  if (promptData.last_notified) {
    meta.last_notified = promptData.last_notified;
  }

  const data = {
    meta,
    content: promptData.content || '',
    path: promptPath,
  };

  await writePrompt(promptPath, data);

  return data;
}

/**
 * 更新提示词
 */
async function updatePrompt(promptPath, updates) {
  // 读取现有数据
  const existing = await readPrompt(promptPath);

  // 重要：必须做快照，否则 beforeMeta 与 existing.meta 指向同一对象，比较会失效
  const beforeMeta = JSON.parse(JSON.stringify(existing.meta || {}));
  const beforeContent = existing.content;

  // 更新元数据
  if (updates.title !== undefined) existing.meta.title = updates.title;
  if (updates.tags !== undefined) existing.meta.tags = updates.tags;
  if (updates.model_config !== undefined) existing.meta.model_config = updates.model_config;
  if (updates.is_favorite !== undefined) existing.meta.is_favorite = updates.is_favorite;
  if (updates.is_pinned !== undefined) existing.meta.is_pinned = updates.is_pinned;
  if (updates.author !== undefined) existing.meta.author = updates.author;
  if (updates.type !== undefined) existing.meta.type = updates.type;
  
  // 🔥 scheduled_time 和 recurrence 需要支持清除（传 null 表示删除）
  if ('scheduled_time' in updates) {
    if (updates.scheduled_time === null || updates.scheduled_time === undefined) {
      delete existing.meta.scheduled_time;
    } else {
      existing.meta.scheduled_time = updates.scheduled_time;
    }
  }
  if ('recurrence' in updates) {
    if (updates.recurrence === null || updates.recurrence === undefined) {
      delete existing.meta.recurrence;
    } else {
      existing.meta.recurrence = updates.recurrence;
    }
  }
  if (updates.last_notified !== undefined) existing.meta.last_notified = updates.last_notified;

  // 更新内容
  if (updates.content !== undefined) existing.content = updates.content;

  // 写入
  const changedFavorite = beforeMeta.is_favorite !== existing.meta.is_favorite;
  const changedPinned = beforeMeta.is_pinned !== existing.meta.is_pinned;
  const changedTitle = beforeMeta.title !== existing.meta.title;
  const changedAuthor = (beforeMeta.author || '') !== (existing.meta.author || '');
  const changedTags = JSON.stringify(beforeMeta.tags || []) !== JSON.stringify(existing.meta.tags || []);
  const changedModel = JSON.stringify(beforeMeta.model_config || {}) !== JSON.stringify(existing.meta.model_config || {});
  const changedContent = (beforeContent || '') !== (existing.content || '');

  const onlyFavoriteOrPinnedChanged = (changedFavorite || changedPinned) && !changedTitle && !changedAuthor && !changedTags && !changedModel && !changedContent;
  await writePrompt(promptPath, existing, { touchUpdatedAt: !onlyFavoriteOrPinnedChanged });

  return existing;
}

/**
 * 删除提示词(移动到 trash)
 */
async function deletePrompt(promptPath, vaultRoot) {
  const trashPath = path.join(vaultRoot, 'trash');
  await fs.mkdir(trashPath, { recursive: true });

  // 保存原始路径到 meta.json
  const metaPath = path.join(promptPath, 'meta.json');
  try {
    const metaContent = await fs.readFile(metaPath, 'utf-8');
    const meta = JSON.parse(metaContent);
    meta.original_path = promptPath;
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  } catch (error) {
    // Failed to save original path
  }

  const promptName = path.basename(promptPath);
  const targetPath = path.join(trashPath, `${promptName}_${Date.now()}`);

  try {
    // 尝试直接重命名（最快）
    await fs.rename(promptPath, targetPath);
  } catch (error) {
    // 如果重命名失败（Windows 文件锁定），使用 copy+delete 回退
    if (error.code === 'EPERM' || error.code === 'EBUSY' || error.code === 'EACCES') {
      try {
        // 复制到回收站
        await fs.cp(promptPath, targetPath, { recursive: true });
        // 删除原文件
        await fs.rm(promptPath, { recursive: true, force: true });
      } catch (fallbackError) {
        // 如果回退也失败，抛出原始错误
        throw error;
      }
    } else {
      throw error;
    }
  }
}

/**
 * 永久删除提示词
 */
async function permanentlyDeletePrompt(promptPath) {
  await fs.rm(promptPath, { recursive: true, force: true });
}

/**
 * 清理过期的回收站项目
 * @param {string} vaultRoot - Vault 根目录
 * @param {number} maxAgeDays - 最大保留天数，默认 5 天
 * @returns {Promise<{deletedCount: number, deletedItems: string[]}>}
 */
async function cleanupTrash(vaultRoot, maxAgeDays = 5) {
  const trashPath = path.join(vaultRoot, 'trash');
  const deletedItems = [];
  
  // 检查回收站是否存在
  if (!await exists(trashPath)) {
    return { deletedCount: 0, deletedItems: [] };
  }
  
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000; // 转换为毫秒
  const now = Date.now();
  
  try {
    const entries = await fs.readdir(trashPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const itemPath = path.join(trashPath, entry.name);
      
      // 从文件夹名称中提取时间戳 (格式: name_timestamp)
      const match = entry.name.match(/_(\d+)$/);
      if (!match) continue;
      
      const timestamp = parseInt(match[1], 10);
      const age = now - timestamp;
      
      // 如果超过最大保留时间，删除
      if (age > maxAgeMs) {
        try {
          await fs.rm(itemPath, { recursive: true, force: true });
          deletedItems.push(entry.name);
        } catch (error) {
          // Failed to delete expired item
        }
      }
    }
  } catch (error) {
    // Error scanning trash
  }
  
  return { deletedCount: deletedItems.length, deletedItems };
}

/**
 * 从回收站恢复提示词
 */
async function restorePrompt(promptPath, vaultRoot) {
  // 读取 meta.json 获取原始路径
  const metaPath = path.join(promptPath, 'meta.json');
  let targetPath;
  
  try {
    const metaContent = await fs.readFile(metaPath, 'utf-8');
    const meta = JSON.parse(metaContent);
    
    // 优先使用保存的原始路径，但只有当原始分类仍然存在时
    if (meta.original_path && await exists(path.dirname(meta.original_path))) {
      const trashItemName = path.basename(promptPath);
      const originalName = trashItemName.replace(/_\d+$/, '');
      const originalDir = path.dirname(meta.original_path);
      targetPath = path.join(originalDir, originalName);
    } else if (meta.original_category_path && await exists(meta.original_category_path)) {
      // 如果原始分类路径存在，恢复到那里
      const trashItemName = path.basename(promptPath);
      const originalName = trashItemName.replace(/_\d+$/, '');
      targetPath = path.join(meta.original_category_path, originalName);
    } else {
      // 原始分类不存在，恢复到根目录（这样在"全部"中就能看到）
      const trashItemName = path.basename(promptPath);
      const originalName = trashItemName.replace(/_\d+$/, '');
      targetPath = path.join(vaultRoot, originalName);
      
      // 更新元数据中的分类信息 - 清空分类，表示在根目录
      meta.category = '';
      meta.category_path = vaultRoot;
    }
    
    // 如果目标路径已存在，添加后缀
    let finalPath = targetPath;
    let counter = 1;
    while (await exists(finalPath)) {
      const dir = path.dirname(targetPath);
      const name = path.basename(targetPath);
      finalPath = path.join(dir, `${name}_restored_${counter}`);
      counter++;
    }
    
    // 清除恢复相关的临时字段
    delete meta.original_path;
    delete meta.original_category;
    delete meta.original_category_path;
    
    // 更新时间戳
    meta.updated_at = new Date().toISOString();
    
    // 写入更新后的元数据
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    
    // 移动文件
    await fs.rename(promptPath, finalPath);
    
    return finalPath;
  } catch (error) {
    throw error;
  }
}

/**
 * 创建分类
 */
async function createCategory(parentPath, name) {
  const categoryPath = path.join(parentPath, name);

  // 检查是否已存在
  if (await exists(categoryPath)) {
    throw new Error(`Category "${name}" already exists`);
  }

  await fs.mkdir(categoryPath, { recursive: true });

  return {
    name,
    path: categoryPath,
  };
}

/**
 * 递归复制目录
 */
async function copyDirectory(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * 安全删除目录(处理 Windows 锁定问题)
 */
async function safeRemoveDirectory(dirPath, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      // 先尝试删除所有子文件和目录
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await safeRemoveDirectory(fullPath, 1); // 递归删除子目录
        } else {
          try {
            await fs.unlink(fullPath);
          } catch (unlinkError) {
            // Could not unlink, will retry
          }
        }
      }
      
      // 最后删除空目录
      await fs.rmdir(dirPath);
      return;
    } catch (error) {
      if (i < retries - 1) {
        // 等待后重试
        const waitTime = 300 * (i + 1);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        throw error;
      }
    }
  }
}

/**
 * 重命名分类
 */
async function renameCategory(categoryPath, newName) {
  // 检查原路径是否存在
  if (!(await exists(categoryPath))) {
    throw new Error('Not found');
  }

  const parentPath = path.dirname(categoryPath);
  const newPath = path.join(parentPath, newName);

  // 检查新名称是否已存在
  if (await exists(newPath)) {
    throw new Error(`Category "${newName}" already exists`);
  }

  // Windows 上 fs.rename 对于被监视的目录经常失败
  // 使用复制+删除的方式更可靠
  let usedFallback = false;
  
  try {
    // 先尝试直接重命名
    await fs.rename(categoryPath, newPath);
  } catch (error) {
    // 如果失败(通常是 EPERM),使用复制+删除
    if (error.code === 'EPERM' || error.code === 'EBUSY') {
      usedFallback = true;
      
      try {
        // 复制到新位置
        await copyDirectory(categoryPath, newPath);
        
        // 等待一下,确保所有文件都写入完成
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 删除原目录
        await safeRemoveDirectory(categoryPath);
      } catch (fallbackError) {
        // 如果复制+删除失败,尝试回滚
        try {
          if (await exists(newPath)) {
            await safeRemoveDirectory(newPath);
          }
        } catch (rollbackError) {
          // Rollback failed
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

/**
 * 移动分类到新的父目录下（用于拖拽改变归属）
 */
async function moveCategory(categoryPath, targetParentPath, vaultRoot) {
  if (!(await exists(categoryPath))) {
    throw new Error('Not found');
  }

  if (!isPathSafe(categoryPath, vaultRoot)) {
    throw new Error('Invalid category path');
  }

  if (!isPathSafe(targetParentPath, vaultRoot)) {
    throw new Error('Invalid target parent path');
  }

  // 禁止移动到自身或自身子目录下
  const normalizedSource = path.normalize(categoryPath);
  const normalizedTargetParent = path.normalize(targetParentPath);
  if (normalizedTargetParent === normalizedSource || normalizedTargetParent.startsWith(normalizedSource + path.sep)) {
    throw new Error('Cannot move category into itself');
  }

  // 检查是否移动到相同的父目录（即实际上没有移动）
  const sourceParent = path.normalize(path.dirname(categoryPath));
  if (sourceParent === normalizedTargetParent) {
    // 相同位置，不执行任何操作，直接返回原始信息
    const name = path.basename(categoryPath);
    return { name, path: categoryPath, usedFallback: false };
  }

  const name = path.basename(categoryPath);
  let destPath = path.join(targetParentPath, name);
  let counter = 1;
  while (await exists(destPath)) {
    destPath = path.join(targetParentPath, `${name}_moved_${counter}`);
    counter++;
  }

  let usedFallback = false;
  try {
    // 尝试重命名 (最快)
    await fs.rename(categoryPath, destPath);
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EBUSY') {
      usedFallback = true;
      
      // 🔥🔥🔥 优化：使用 Node 原生 fs.cp (Node 16.7+)
      // 相比手写的递归复制，性能提升显著
      await fs.cp(categoryPath, destPath, { 
        recursive: true, 
        force: true,
        preserveTimestamps: true // 保留时间戳
      });

      // 稍微等待一下确保句柄释放 (Windows 特性)
      await new Promise(r => setTimeout(r, 50)); 

      // 使用原生 fs.rm 删除源目录 (Node 14.14+)
      await fs.rm(categoryPath, { recursive: true, force: true });
    } else {
      throw error;
    }
  }

  // 🔥🔥🔥 性能优化：跳过元数据更新
  // 元数据将在下次 vault 扫描时自动修正，避免大量 I/O 操作

  return { name, path: destPath, usedFallback };
}

/**
 * 递归处理分类内的提示词，为删除做准备
 */
async function preparePromptsForCategoryDeletion(categoryPath, vaultRoot) {
  const prompts = [];
  
  async function collectPrompts(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const fullPath = path.join(dirPath, entry.name);
          const hasMeta = await exists(path.join(fullPath, 'meta.json'));
          
          if (hasMeta) {
            // 这是一个提示词目录
            try {
              const prompt = await readPrompt(fullPath);
              prompts.push(prompt);
              
              // 更新提示词的元数据，保存原始路径信息
              const metaPath = path.join(fullPath, 'meta.json');
              const meta = { ...prompt.meta };
              meta.original_path = fullPath;
              meta.original_category = path.basename(categoryPath);
              meta.original_category_path = categoryPath;
              await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
            } catch (error) {
              // Error processing prompt
            }
          } else {
            // 这是一个子分类，递归处理
            await collectPrompts(fullPath);
          }
        }
      }
    } catch (error) {
      // Error collecting prompts
    }
  }
  
  await collectPrompts(categoryPath);
  return prompts;
}

/**
 * 删除分类(移动到 trash)
 */
async function deleteCategory(categoryPath, vaultRoot) {
  const trashPath = path.join(vaultRoot, 'trash');
  await fs.mkdir(trashPath, { recursive: true });

  // 先处理分类内的提示词，保存原始路径信息
  await preparePromptsForCategoryDeletion(categoryPath, vaultRoot);

  const categoryName = path.basename(categoryPath);
  const targetPath = path.join(trashPath, `${categoryName}_${Date.now()}`);

  let usedFallback = false;
  try {
    // 先尝试直接重命名
    await fs.rename(categoryPath, targetPath);
  } catch (error) {
    // 如果失败(通常是 EPERM 或 EBUSY),使用复制+删除
    if (error.code === 'EPERM' || error.code === 'EBUSY') {
      usedFallback = true;
      try {
        // 复制到回收站
        await copyDirectory(categoryPath, targetPath);
        
        // 等待一下,确保所有文件都写入完成
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 删除原目录
        await safeRemoveDirectory(categoryPath);
      } catch (fallbackError) {
        // 如果复制+删除失败,尝试回滚
        try {
          if (await exists(targetPath)) {
            await safeRemoveDirectory(targetPath);
          }
        } catch (rollbackError) {
          // Rollback failed
        }
        throw new Error('Failed to delete category: ' + fallbackError.message);
      }
    } else {
      throw error;
    }
  }

  return { name: categoryName, path: targetPath, usedFallback };
}

/**
 * 搜索提示词
 */
function searchPrompts(prompts, query) {
  if (!query || !query.trim()) {
    return prompts;
  }

  const lowerQuery = query.toLowerCase();

  return prompts.filter(prompt => {
    // 搜索标题
    if (prompt.meta.title.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // 搜索标签
    if (prompt.meta.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) {
      return true;
    }

    // 搜索内容
    if (prompt.content.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    return false;
  });
}

/**
 * 获取所有标签
 */
function getAllTags(prompts) {
  const tagSet = new Set();

  prompts.forEach(prompt => {
    prompt.meta.tags.forEach(tag => tagSet.add(tag));
  });

  return Array.from(tagSet).sort();
}

/**
 * 收集所有提示词
 */
function collectAllPrompts(categories) {
  const prompts = [];

  function collect(nodes) {
    nodes.forEach(node => {
      prompts.push(...node.prompts);
      if (node.children && node.children.length > 0) {
        collect(node.children);
      }
    });
  }

  collect(categories);
  return prompts;
}

/**
 * 通过 ID 查找提示词路径
 */
async function findPromptPathById(categories, promptId, vaultRoot) {
  function search(nodes) {
    for (const node of nodes) {
      for (const prompt of node.prompts) {
        if (prompt.meta.id === promptId) {
          return prompt.path;
        }
      }
      if (node.children && node.children.length > 0) {
        const result = search(node.children);
        if (result) return result;
      }
    }
    return null;
  }

  // 首先在分类中搜索
  const categoryResult = search(categories);
  if (categoryResult) return categoryResult;

  // 如果在分类中没找到，搜索根目录
  try {
    const rootPrompts = await loadPromptsInDirectory(vaultRoot);
    for (const prompt of rootPrompts) {
      if (prompt.meta.id === promptId) {
        return prompt.path;
      }
    }
  } catch (error) {
    // Error searching root directory prompts
  }

  return null;
}

async function normalizePromptsCategoryPath(categories, vaultRoot) {
  const updated = [];

  async function walk(nodes) {
    for (const node of nodes) {
      for (const prompt of node.prompts) {
        const promptPath = prompt.path;
        const categoryPath = node.path;
        const categoryName = node.name;

        try {
          const current = await readPrompt(promptPath);
          const nextMeta = { ...current.meta };
          let changed = false;

          if (nextMeta.category_path !== categoryPath) {
            nextMeta.category_path = categoryPath;
            changed = true;
          }
          if (nextMeta.category !== categoryName) {
            nextMeta.category = categoryName;
            changed = true;
          }

          if (changed) {
            current.meta = nextMeta;
            await writePrompt(promptPath, current);
            updated.push({ id: nextMeta.id, path: promptPath });
          }
        } catch (error) {
          // Error normalizing prompt
        }
      }
      if (node.children && node.children.length > 0) {
        await walk(node.children);
      }
    }
  }

  await walk(categories);
  return { updatedCount: updated.length, updated };
}

module.exports = {
  exists,
  titleToSlug,
  isPathSafe,
  scanDirectory,
  loadPromptsInDirectory,
  readPrompt,
  writePrompt,
  createPrompt,
  updatePrompt,
  deletePrompt,
  permanentlyDeletePrompt,
  cleanupTrash,
  restorePrompt,
  movePrompt,
  createCategory,
  renameCategory,
  moveCategory,
  deleteCategory,
  searchPrompts,
  getAllTags,
  collectAllPrompts,
  findPromptPathById,
  normalizePromptsCategoryPath,
};
