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
  moved.meta.category = path.basename(newCategoryPath);
  await writePrompt(candidate, moved);
  return moved;
}

/**
 * 标题转 slug
 */
function titleToSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_')
    .substring(0, 50);
}

/**
 * 验证路径是否在 Vault 内(防止路径遍历攻击)
 */
function isPathSafe(targetPath, vaultRoot) {
  const normalizedTarget = path.normalize(targetPath);
  const normalizedRoot = path.normalize(vaultRoot);
  return normalizedTarget.startsWith(normalizedRoot);
}

/**
 * 递归扫描目录
 */
async function scanDirectory(dirPath, rootPath) {
  const nodes = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // 跳过隐藏文件夹 (但不跳过 trash)
      if (entry.name.startsWith('.')) {
        continue;
      }

      if (entry.isDirectory()) {
        const fullPath = path.join(dirPath, entry.name);
        const hasMeta = await exists(path.join(fullPath, 'meta.json'));

        if (!hasMeta) {
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
    console.error(`Error scanning directory ${dirPath}:`, error);
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
            console.error(`Error reading prompt at ${fullPath}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error loading prompts in ${dirPath}:`, error);
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
    console.warn(`Content file not found for ${promptPath}`);
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
async function writePrompt(promptPath, data) {
  // 确保目录存在
  await fs.mkdir(promptPath, { recursive: true });

  // 更新时间戳
  data.meta.updated_at = new Date().toISOString();

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
  const slug = titleToSlug(promptData.title);
  const promptPath = path.join(categoryPath, slug);

  // 检查是否已存在
  if (await exists(promptPath)) {
    throw new Error(`Prompt with slug "${slug}" already exists`);
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
    category: promptData.category || categoryName,
    category_path: promptData.category_path || categoryPath,
  };

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

  // 更新元数据
  if (updates.title !== undefined) existing.meta.title = updates.title;
  if (updates.tags !== undefined) existing.meta.tags = updates.tags;
  if (updates.model_config !== undefined) existing.meta.model_config = updates.model_config;
  if (updates.is_favorite !== undefined) existing.meta.is_favorite = updates.is_favorite;
  if (updates.author !== undefined) existing.meta.author = updates.author;

  // 更新内容
  if (updates.content !== undefined) existing.content = updates.content;

  // 写入
  await writePrompt(promptPath, existing);

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
    console.error('保存原始路径失败:', error);
  }

  const promptName = path.basename(promptPath);
  const targetPath = path.join(trashPath, `${promptName}_${Date.now()}`);

  await fs.rename(promptPath, targetPath);
}

/**
 * 永久删除提示词
 */
async function permanentlyDeletePrompt(promptPath) {
  await fs.rm(promptPath, { recursive: true, force: true });
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
    
    if (meta.original_path && await exists(path.dirname(meta.original_path))) {
      // 使用保存的原始路径
      const trashItemName = path.basename(promptPath);
      const originalName = trashItemName.replace(/_\d+$/, '');
      const originalDir = path.dirname(meta.original_path);
      targetPath = path.join(originalDir, originalName);
    } else {
      const categoryPath = meta.category_path;
      const category = meta.category || 'Coding';
      const trashItemName = path.basename(promptPath);
      const originalName = trashItemName.replace(/_\d+$/, '');
      if (categoryPath && await exists(categoryPath) && isPathSafe(categoryPath, vaultRoot)) {
        targetPath = path.join(categoryPath, originalName);
      } else {
        const categoriesPath = path.join(vaultRoot, category);
        await fs.mkdir(categoriesPath, { recursive: true });
        targetPath = path.join(categoriesPath, originalName);
      }
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
    
    // 清除 original_path 字段
    delete meta.original_path;
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    
    await fs.rename(promptPath, finalPath);
    return finalPath;
  } catch (error) {
    console.error('恢复提示词失败:', error);
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
            console.log(`[RENAME] Could not unlink ${fullPath}, will retry`);
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
        console.log(`[RENAME] Retry deleting ${dirPath}, attempt ${i + 1}/${retries}, waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.error(`[RENAME] Failed to delete ${dirPath} after ${retries} retries:`, error.message);
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
    console.log(`[RENAME] Attempting direct rename: ${categoryPath} -> ${newPath}`);
    await fs.rename(categoryPath, newPath);
    console.log(`[RENAME] Direct rename successful`);
  } catch (error) {
    // 如果失败(通常是 EPERM),使用复制+删除
    if (error.code === 'EPERM' || error.code === 'EBUSY') {
      console.log(`[RENAME] Direct rename failed (${error.code}), using copy+delete fallback`);
      usedFallback = true;
      
      try {
        // 复制到新位置
        console.log(`[RENAME] Copying ${categoryPath} to ${newPath}`);
        await copyDirectory(categoryPath, newPath);
        console.log(`[RENAME] Copy successful`);
        
        // 等待一下,确保所有文件都写入完成
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 删除原目录
        console.log(`[RENAME] Deleting original directory ${categoryPath}`);
        await safeRemoveDirectory(categoryPath);
        console.log(`[RENAME] Delete successful`);
      } catch (fallbackError) {
        // 如果复制+删除失败,尝试回滚
        console.error('[RENAME] Copy+delete failed:', fallbackError);
        try {
          if (await exists(newPath)) {
            console.log(`[RENAME] Rolling back - deleting ${newPath}`);
            await safeRemoveDirectory(newPath);
          }
        } catch (rollbackError) {
          console.error('[RENAME] Rollback failed:', rollbackError);
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
 * 删除分类(移动到 trash)
 */
async function deleteCategory(categoryPath, vaultRoot) {
  const trashPath = path.join(vaultRoot, 'trash');
  await fs.mkdir(trashPath, { recursive: true });

  const categoryName = path.basename(categoryPath);
  const targetPath = path.join(trashPath, `${categoryName}_${Date.now()}`);

  await fs.rename(categoryPath, targetPath);
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
function findPromptPathById(categories, promptId) {
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

  return search(categories);
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
          console.error(`Error normalizing prompt at ${promptPath}:`, error.message || error);
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
  restorePrompt,
  movePrompt,
  createCategory,
  renameCategory,
  deleteCategory,
  searchPrompts,
  getAllTags,
  collectAllPrompts,
  findPromptPathById,
  normalizePromptsCategoryPath,
};
