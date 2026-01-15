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
  isPathSafe,
  searchPrompts,
} = require('../utils/fileSystem');

const rawVaultPath = process.env.VAULT_PATH && process.env.VAULT_PATH.trim();
const VAULT_ROOT = rawVaultPath || path.join(__dirname, '../../vault');

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
      res.json({
        success: true,
        message: 'Prompt permanently deleted',
      });
    } else {
      // 移动到回收站
      await deletePrompt(promptPath, VAULT_ROOT);
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

    res.json({
      success: true,
      message: 'Prompt restored',
      data: { path: restoredPath },
    });
  } catch (error) {
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

module.exports = router;
