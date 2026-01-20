/**
 * 分类管理路由
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const {
  scanDirectory,
  createCategory,
  renameCategory,
  moveCategory,
  deleteCategory,
  isPathSafe,
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

/**
 * GET /api/categories
 * 获取所有分类
 */
router.get('/', async (req, res, next) => {
  try {
    const categories = await scanDirectory(VAULT_ROOT, VAULT_ROOT);

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/categories/move
 * 移动分类到新的父目录（拖拽改变归属）
 * Body: { categoryPath, targetParentPath }
 */
router.put('/move', async (req, res, next) => {
  try {
    const { categoryPath, targetParentPath } = req.body;

    if (!categoryPath || !targetParentPath) {
      return res.status(400).json({
        success: false,
        error: 'Category path and target parent path are required',
      });
    }

    if (!isPathSafe(categoryPath, VAULT_ROOT) || !isPathSafe(targetParentPath, VAULT_ROOT)) {
      return res.status(403).json({
        success: false,
        error: 'Invalid path',
      });
    }

    if (categoryPath === VAULT_ROOT) {
      return res.status(403).json({
        success: false,
        error: 'Cannot move vault root',
      });
    }

    // 给 Vite 文件监视器时间来释放文件锁
    await new Promise(resolve => setTimeout(resolve, 500));

    const moved = await moveCategory(categoryPath, targetParentPath, VAULT_ROOT);

    // 🚀 Performance: Invalidate cache after data modification
    const cache = getApiCache();
    if (cache) {
      cache.invalidate('/api/vault/');
    }

    res.json({
      success: true,
      data: moved,
    });
  } catch (error) {
    if (error.message && (error.message.includes('already exists') || error.message.includes('Cannot move'))) {
      return res.status(409).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
});

/**
 * POST /api/categories
 * 创建新分类
 * Body: { parentPath, name }
 */
router.post('/', async (req, res, next) => {
  try {
    const { parentPath, name } = req.body;

    // 验证输入
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Category name is required',
      });
    }

    // 确定父路径
    const actualParentPath = parentPath || VAULT_ROOT;

    // 安全检查
    if (!isPathSafe(actualParentPath, VAULT_ROOT)) {
      return res.status(403).json({
        success: false,
        error: 'Invalid parent path',
      });
    }

    // 创建分类
    const category = await createCategory(actualParentPath, name.trim());

    // 🚀 Performance: Invalidate cache after data modification
    const cache = getApiCache();
    if (cache) {
      cache.invalidate('/api/vault/');
    }

    res.json({
      success: true,
      data: category,
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
 * PUT /api/categories/rename
 * 重命名分类
 * Body: { categoryPath, newName }
 */
router.put('/rename', async (req, res, next) => {
  try {
    const { categoryPath, newName } = req.body;

    // 验证输入
    if (!categoryPath || !newName || !newName.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Category path and new name are required',
      });
    }

    // 安全检查
    if (!isPathSafe(categoryPath, VAULT_ROOT)) {
      return res.status(403).json({
        success: false,
        error: 'Invalid category path',
      });
    }

    // 防止重命名根目录
    if (categoryPath === VAULT_ROOT) {
      return res.status(403).json({
        success: false,
        error: 'Cannot rename vault root',
      });
    }
    
    // 给 Vite 文件监视器时间来释放文件锁
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await renameCategory(categoryPath, newName.trim());

    // 🚀 Performance: Invalidate cache after data modification
    const cache = getApiCache();
    if (cache) {
      cache.invalidate('/api/vault/');
    }

    res.json({
      success: true,
      message: 'Category renamed successfully',
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
 * DELETE /api/categories
 * 删除分类(移动到 trash)
 * Query: path
 */
router.delete('/', async (req, res, next) => {
  try {
    const { path: categoryPath } = req.query;

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

    // 防止删除根目录
    if (categoryPath === VAULT_ROOT) {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete vault root',
      });
    }

    await deleteCategory(categoryPath, VAULT_ROOT);

    // 🚀 Performance: Invalidate cache after data modification
    const cache = getApiCache();
    if (cache) {
      cache.invalidate('/api/vault/');
    }

    res.json({
      success: true,
      message: 'Category moved to trash',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
