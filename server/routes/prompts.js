/**
 * 提示词管理路由
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const fs = require('fs').promises;
const {
  scanDirectory,
  collectAllPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
  permanentlyDeletePrompt,
  restorePrompt,
  movePrompt,
  readPrompt,
  findPromptPathById,
  loadPromptsInDirectory,
  isPathSafe,
  searchPrompts,
} = require('../utils/fileSystem');

const rawVaultPath = process.env.VAULT_PATH && process.env.VAULT_PATH.trim();
const VAULT_ROOT = rawVaultPath || path.join(__dirname, '../../vault');

// 🚀 Performance: Get API cache instance for invalidation
let apiCache = null;
const getApiCache = () => {
  if (!apiCache) {
    try {
      apiCache = require('./vault').apiCache;
    } catch (error) {
      // Cache not available
    }
  }
  return apiCache;
};

// 配置 multer 用于图片上传
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  },
});

/**
 * GET /api/prompts
 * 获取所有提示词
 * Query: category, search, tags
 */
router.get('/', async (req, res, next) => {
  try {
    const { category, search, tags } = req.query;

    const categories = await scanDirectory(VAULT_ROOT, VAULT_ROOT);
    let prompts = collectAllPrompts(categories);

    // 按分类过滤
    if (category) {
      prompts = prompts.filter(p => p.path.includes(category));
    }

    // 按搜索查询过滤
    if (search) {
      prompts = searchPrompts(prompts, search);
    }

    // 按标签过滤
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      prompts = prompts.filter(p =>
        tagArray.some(tag => p.meta.tags.includes(tag))
      );
    }

    res.json({
      success: true,
      data: prompts,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/prompts/:id
 * 获取单个提示词
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const categories = await scanDirectory(VAULT_ROOT, VAULT_ROOT);
    const promptPath = await findPromptPathById(categories, id, VAULT_ROOT);

    if (!promptPath) {
      return res.status(404).json({
        success: false,
        error: 'Prompt not found',
      });
    }

    const prompt = await readPrompt(promptPath);

    res.json({
      success: true,
      data: prompt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/prompts
 * 创建新提示词
 * Body: { categoryPath, title, content, tags, model_config, ... }
 */
router.post('/', async (req, res, next) => {
  try {
    const { categoryPath, ...promptData } = req.body;

    // 验证输入
    if (!promptData.title || !promptData.title.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Title is required',
      });
    }

    if (!categoryPath) {
      return res.status(400).json({
        success: false,
        error: 'Category path is required',
      });
    }

    // 安全检查
    if (!isPathSafe(categoryPath, VAULT_ROOT)) {
      return res.status(403).json({
        success: false,
        error: 'Invalid category path',
      });
    }

    // 创建提示词
    const prompt = await createPrompt(categoryPath, promptData);

    // 🚀 Performance: Invalidate cache after data modification
    const cache = getApiCache();
    if (cache) {
      cache.invalidate('/api/vault/');
    }

    res.status(201).json({
      success: true,
      data: prompt,
    });
  } catch (error) {
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
});

/**
 * PUT /api/prompts/:id
 * 更新提示词
 * Body: { title, content, tags, model_config, is_favorite, ... }
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // 查找提示词路径
    const categories = await scanDirectory(VAULT_ROOT, VAULT_ROOT);
    const promptPath = await findPromptPathById(categories, id, VAULT_ROOT);

    if (!promptPath) {
      return res.status(404).json({
        success: false,
        error: 'Prompt not found',
      });
    }

    const { categoryPath, ...restUpdates } = updates;

    let workingPath = promptPath;
    if (categoryPath) {
      if (!isPathSafe(categoryPath, VAULT_ROOT)) {
        return res.status(403).json({
          success: false,
          error: 'Invalid category path',
        });
      }

      const current = await readPrompt(promptPath);
      const currentCategoryPath = current.meta.category_path || path.dirname(promptPath);
      if (path.normalize(currentCategoryPath) !== path.normalize(categoryPath)) {
        const moved = await movePrompt(promptPath, categoryPath, VAULT_ROOT);
        workingPath = moved.path;
      }
    }

    const updatedPrompt = await updatePrompt(workingPath, restUpdates);

    // 🚀 Performance: Invalidate cache after data modification
    const cache = getApiCache();
    if (cache) {
      cache.invalidate('/api/vault/');
    }

    res.json({
      success: true,
      data: updatedPrompt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/prompts/:id
 * 删除提示词(移动到 trash)
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query; // 永久删除标志

    // 查找提示词路径
    const categories = await scanDirectory(VAULT_ROOT, VAULT_ROOT);
    const promptPath = await findPromptPathById(categories, id, VAULT_ROOT);

    if (!promptPath) {
      return res.status(404).json({
        success: false,
        error: 'Prompt not found',
      });
    }

    if (permanent === 'true') {
      // 永久删除
      await permanentlyDeletePrompt(promptPath);
      
      // 🚀 Performance: Invalidate cache after data modification
      const cache = getApiCache();
      if (cache) {
        cache.invalidate('/api/vault/');
      }
      
      res.json({
        success: true,
        message: 'Prompt permanently deleted',
      });
    } else {
      // 移动到回收站
      await deletePrompt(promptPath, VAULT_ROOT);
      
      // 🚀 Performance: Invalidate cache after data modification
      const cache = getApiCache();
      if (cache) {
        cache.invalidate('/api/vault/');
      }
      
      res.json({
        success: true,
        message: 'Prompt moved to trash',
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/prompts/batch-delete
 * 批量删除提示词（永久删除）
 * Body: { ids: string[], permanent: boolean }
 */
router.post('/batch-delete', async (req, res, next) => {
  try {
    const { ids, permanent } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: ids must be a non-empty array',
      });
    }

    // 一次性扫描 vault，避免重复扫描
    const categories = await scanDirectory(VAULT_ROOT, VAULT_ROOT);
    
    // 单独加载回收站中的提示词
    const trashPath = path.join(VAULT_ROOT, 'trash');
    let trashPrompts = [];
    try {
      trashPrompts = await loadPromptsInDirectory(trashPath);
    } catch (error) {
      // 回收站可能不存在或为空
    }
    
    const results = {
      success: [],
      failed: [],
    };

    // 串行处理删除，避免并发问题
    for (const id of ids) {
      try {
        // 先在分类中查找
        let promptPath = await findPromptPathById(categories, id, VAULT_ROOT);
        
        // 如果没找到，在回收站中查找
        if (!promptPath && trashPrompts.length > 0) {
          const trashPrompt = trashPrompts.find(p => p.meta.id === id);
          if (trashPrompt) {
            promptPath = trashPrompt.path;
          }
        }
        
        if (!promptPath) {
          results.failed.push({ id, error: 'Prompt not found' });
          continue;
        }

        if (permanent) {
          await permanentlyDeletePrompt(promptPath);
        } else {
          await deletePrompt(promptPath, VAULT_ROOT);
        }
        
        results.success.push(id);
      } catch (error) {
        results.failed.push({ id, error: error.message });
      }
    }

    // 🚀 Performance: Invalidate cache after data modification
    const cache = getApiCache();
    if (cache) {
      cache.invalidate('/api/vault/');
    }

    res.json({
      success: true,
      results,
      message: `Successfully deleted ${results.success.length} prompts, ${results.failed.length} failed`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/prompts/:id/restore
 * 从回收站恢复提示词
 */
router.post('/:id/restore', async (req, res, next) => {
  try {
    const { id } = req.params;

    // 查找提示词路径
    const categories = await scanDirectory(VAULT_ROOT, VAULT_ROOT);
    const promptPath = await findPromptPathById(categories, id, VAULT_ROOT);

    if (!promptPath) {
      return res.status(404).json({
        success: false,
        error: 'Prompt not found',
      });
    }

    // 检查是否在回收站中
    if (!promptPath.includes('trash')) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is not in trash',
      });
    }

    const restoredPath = await restorePrompt(promptPath, VAULT_ROOT);

    // 🚀 Performance: Invalidate cache after data modification
    const cache = getApiCache();
    if (cache) {
      cache.invalidate('/api/vault/');
    }

    res.json({
      success: true,
      message: 'Prompt restored',
      data: { path: restoredPath },
    });
  } catch (error) {
    console.error('[Restore API] Error:', error);
    next(error);
  }
});

/**
 * POST /api/prompts/:id/images
 * 上传图片到提示词
 */
router.post('/:id/images', upload.single('image'), async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided',
      });
    }

    // 查找提示词路径
    const categories = await scanDirectory(VAULT_ROOT, VAULT_ROOT);
    const promptPath = await findPromptPathById(categories, id, VAULT_ROOT);

    if (!promptPath) {
      return res.status(404).json({
        success: false,
        error: 'Prompt not found',
      });
    }

    // 创建 images 目录
    const imagesPath = path.join(promptPath, 'images');
    await fs.mkdir(imagesPath, { recursive: true });

    // 保存文件
    const filename = `${Date.now()}_${req.file.originalname}`;
    const filePath = path.join(imagesPath, filename);
    await fs.writeFile(filePath, req.file.buffer);

    // 获取提示词 slug
    const prompt = await readPrompt(promptPath);

    res.json({
      success: true,
      data: {
        filename,
        path: filePath,
        url: `/api/images/${prompt.meta.slug}/images/${filename}`,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/prompts/import
 * 批量导入提示词
 * Body: { prompts: PromptData[], categoryPath?: string, conflictStrategy?: 'rename' | 'skip' | 'overwrite' }
 */
router.post('/import', async (req, res, next) => {
  try {
    const { prompts, categoryPath, conflictStrategy = 'rename' } = req.body;

    // 验证输入
    if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Prompts array is required and must not be empty',
      });
    }

    // 限制批量导入数量
    const MAX_IMPORT_COUNT = 1000;
    if (prompts.length > MAX_IMPORT_COUNT) {
      return res.status(400).json({
        success: false,
        error: `Cannot import more than ${MAX_IMPORT_COUNT} prompts at once`,
      });
    }

    // 验证分类路径（如果提供）
    let targetCategoryPath = categoryPath;
    if (targetCategoryPath) {
      // 如果是相对路径，转换为绝对路径
      if (!path.isAbsolute(targetCategoryPath)) {
        targetCategoryPath = path.join(VAULT_ROOT, targetCategoryPath);
      }
      
      // 安全检查
      if (!isPathSafe(targetCategoryPath, VAULT_ROOT)) {
        return res.status(403).json({
          success: false,
          error: 'Invalid category path',
        });
      }
    }

    // 批量导入结果
    const results = {
      total: prompts.length,
      success: 0,
      failed: 0,
      skipped: 0,
      details: [],
    };

    // 获取现有提示词列表（用于冲突检测）
    const categories = await scanDirectory(VAULT_ROOT, VAULT_ROOT);
    const existingPrompts = collectAllPrompts(categories);
    const existingTitles = new Map();
    existingPrompts.forEach(p => {
      const key = `${p.meta.category_path || path.dirname(p.path)}:${p.meta.title}`;
      existingTitles.set(key, p);
    });

    // 逐个导入
    for (let i = 0; i < prompts.length; i++) {
      const promptData = prompts[i];
      
      try {
        // 验证必填字段
        if (!promptData.title || !promptData.title.trim()) {
          results.failed++;
          results.details.push({
            index: i,
            title: promptData.title || '(无标题)',
            status: 'failed',
            error: 'Title is required',
          });
          continue;
        }

        // 确定目标分类路径
        let finalCategoryPath;
        
        if (targetCategoryPath) {
          // 用户选择了特定分类
          if (promptData.category_path) {
            // JSON 自带分类结构，将其作为子目录放到用户选择的目录下
            // 例如：用户选择 "测试1"，JSON 中是 "工作/产品管理"
            // 最终路径：vault/测试1/工作/产品管理/
            finalCategoryPath = path.join(targetCategoryPath, promptData.category_path);
          } else {
            // JSON 没有分类结构，直接放到用户选择的目录
            finalCategoryPath = targetCategoryPath;
          }
        } else {
          // 用户选择了根目录
          if (promptData.category_path) {
            // JSON 自带分类结构，放到根目录下的对应路径
            finalCategoryPath = path.join(VAULT_ROOT, promptData.category_path);
          } else {
            // JSON 没有分类结构，放到根目录
            finalCategoryPath = VAULT_ROOT;
          }
        }

        // 安全检查
        if (!isPathSafe(finalCategoryPath, VAULT_ROOT)) {
          results.failed++;
          results.details.push({
            index: i,
            title: promptData.title,
            status: 'failed',
            error: 'Invalid category path',
          });
          continue;
        }

        // 确保目标分类目录存在（自动创建）
        try {
          await fs.mkdir(finalCategoryPath, { recursive: true });
        } catch (mkdirError) {
          results.failed++;
          results.details.push({
            index: i,
            title: promptData.title,
            status: 'failed',
            error: `Failed to create category directory: ${mkdirError.message}`,
          });
          continue;
        }

        // 冲突检测
        const conflictKey = `${finalCategoryPath}:${promptData.title}`;
        const existingPrompt = existingTitles.get(conflictKey);

        if (existingPrompt) {
          if (conflictStrategy === 'skip') {
            results.skipped++;
            results.details.push({
              index: i,
              title: promptData.title,
              status: 'skipped',
              reason: 'Title already exists in target category',
            });
            continue;
          } else if (conflictStrategy === 'rename') {
            // 自动重命名：添加 _X1, _X2, _X3 等后缀
            const baseTitle = promptData.title;
            let counter = 1;
            let newTitle = `${baseTitle}_X${counter}`;
            
            // 检查新标题是否也冲突
            while (existingTitles.has(newTitle.toLowerCase())) {
              counter++;
              newTitle = `${baseTitle}_X${counter}`;
            }
            
            promptData.title = newTitle;
          } else if (conflictStrategy === 'overwrite') {
            // 覆盖：先删除旧的
            await deletePrompt(existingPrompt.path, VAULT_ROOT);
          }
        }

        // 创建提示词
        const newPrompt = await createPrompt(finalCategoryPath, {
          title: promptData.title,
          content: promptData.content || '',
          tags: promptData.tags || [],
          model_config: promptData.model_config || {},
          is_favorite: promptData.is_favorite || false,
          type: promptData.type || 'NOTE',
          scheduled_time: promptData.scheduled_time,
          recurrence: promptData.recurrence,
          author: promptData.author || 'Imported',
          version: promptData.version || '1.0.0',
        });

        results.success++;
        results.details.push({
          index: i,
          title: promptData.title,
          status: 'success',
          id: newPrompt.meta.id,
          path: newPrompt.path,
        });

        // 更新冲突检测 Map
        existingTitles.set(conflictKey, newPrompt);

      } catch (error) {
        results.failed++;
        results.details.push({
          index: i,
          title: promptData.title || '(无标题)',
          status: 'failed',
          error: error.message,
        });
      }
    }

    // 🚀 Performance: Invalidate cache after data modification
    const cache = getApiCache();
    if (cache) {
      cache.invalidate('/api/vault/');
    }

    // 返回结果
    res.status(200).json({
      success: true,
      data: results,
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/prompts/export
 * 导出提示词为 JSON
 * Body: { 
 *   ids: string[],  // 所有要导出的 ID（兼容旧版）
 *   includeContent: boolean,
 *   preserveStructure: boolean,  // 全局标志（兼容旧版）
 *   structuredIds: string[],  // 需要保留结构的 ID（新增）
 *   flatIds: string[]  // 扁平导出的 ID（新增）
 * }
 */
router.post('/export', async (req, res, next) => {
  try {
    const { 
      ids, 
      includeContent = true, 
      preserveStructure = false,
      structuredIds = [],
      flatIds = []
    } = req.body;

    // 兼容旧版：如果没有传递 structuredIds 和 flatIds，使用 ids + preserveStructure
    let idsToExport = [];
    let structuredSet = new Set(structuredIds);
    let flatSet = new Set(flatIds);
    
    if (structuredIds.length === 0 && flatIds.length === 0) {
      // 旧版兼容模式：使用 ids 参数
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request: ids must be a non-empty array',
        });
      }
      
      if (preserveStructure) {
        structuredSet = new Set(ids);
      } else {
        flatSet = new Set(ids);
      }
      idsToExport = ids;
    } else {
      // 新版模式：合并两个列表
      idsToExport = [...structuredIds, ...flatIds];
    }

    // 验证参数
    if (idsToExport.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: must provide ids or (structuredIds + flatIds)',
      });
    }

    if (idsToExport.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Too many prompts: maximum 1000 prompts per export',
      });
    }

    // 扫描 vault 获取分类树
    const categories = await scanDirectory(VAULT_ROOT);

    // 单独扫描回收站
    const trashPath = path.join(VAULT_ROOT, 'trash');
    const trashPrompts = await loadPromptsInDirectory(trashPath);

    // 收集要导出的提示词
    const exportData = [];
    const notFound = [];

    for (const id of idsToExport) {
      try {
        // 先在分类中查找
        let promptPath = await findPromptPathById(categories, id, VAULT_ROOT);

        // 找不到再到回收站查找
        if (!promptPath && trashPrompts.length > 0) {
          const trashPrompt = trashPrompts.find(p => p.meta.id === id);
          if (trashPrompt) {
            promptPath = trashPrompt.path;
          }
        }

        if (!promptPath) {
          notFound.push(id);
          continue;
        }

        // 读取提示词
        const prompt = await readPrompt(promptPath);

        // 构建导出数据
        const exportItem = {
          title: prompt.meta.title,
          tags: prompt.meta.tags || [],
          type: prompt.meta.type || 'NOTE',
          is_favorite: prompt.meta.is_favorite || false,
          author: prompt.meta.author || '',
          version: prompt.meta.version || '1.0.0',
        };

        // 可选：包含内容
        if (includeContent) {
          exportItem.content = prompt.content;
        }

        // 可选：包含分类路径（仅在该 ID 需要保留结构时）
        const shouldPreserveStructure = structuredSet.has(id);
        if (shouldPreserveStructure && prompt.meta.category_path) {
          // 转换为相对路径
          const relativePath = path.relative(VAULT_ROOT, prompt.meta.category_path);
          exportItem.category_path = relativePath.replace(/\\/g, '/');
        }

        // 可选：包含任务相关字段
        if (prompt.meta.type === 'TASK') {
          if (prompt.meta.scheduled_time) {
            exportItem.scheduled_time = prompt.meta.scheduled_time;
          }
          if (prompt.meta.recurrence) {
            exportItem.recurrence = prompt.meta.recurrence;
          }
        }

        // 可选：包含模型配置
        if (prompt.meta.model_config) {
          exportItem.model_config = prompt.meta.model_config;
        }

        exportData.push(exportItem);

      } catch (error) {
        notFound.push(id);
      }
    }

    // 返回结果
    res.status(200).json({
      success: true,
      data: {
        prompts: exportData,
        total: exportData.length,
        notFound: notFound.length > 0 ? notFound : undefined,
      },
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
