/**
 * Vault 管理路由
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const ApiCache = require('../utils/apiCache');
const {
  scanDirectory,
  collectAllPrompts,
  normalizePromptsCategoryPath,
  loadPromptsInDirectory,
} = require('../utils/fileSystem');

const rawVaultPath = process.env.VAULT_PATH && process.env.VAULT_PATH.trim();
const VAULT_ROOT = rawVaultPath || path.join(__dirname, '../../vault');

// 🚀 Performance: Create API cache with 5s TTL
const apiCache = new ApiCache(5000);

// Cleanup expired cache entries every minute
setInterval(() => {
  apiCache.cleanup();
}, 60000);

/**
 * GET /api/vault/scan
 * 扫描 Vault 目录,返回完整结构
 */
router.get('/scan', async (req, res, next) => {
  try {
    // 🚀 Performance: Check cache first
    const cacheKey = apiCache.generateKey('GET', '/api/vault/scan', req.query);
    const cached = apiCache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const categories = await scanDirectory(VAULT_ROOT, VAULT_ROOT);
    
    // 收集所有分类中的提示词
    const allPrompts = collectAllPrompts(categories);
    
    // 同时收集根目录中的提示词（没有分类的提示词）
    const rootPrompts = await loadPromptsInDirectory(VAULT_ROOT);
    allPrompts.push(...rootPrompts);

    // 🔥 单独扫描回收站目录
    const trashPath = path.join(VAULT_ROOT, 'trash');
    const trashPrompts = await loadPromptsInDirectory(trashPath);
    allPrompts.push(...trashPrompts);

    // 转换为 Map 格式
    const promptsMap = {};
    allPrompts.forEach(prompt => {
      promptsMap[prompt.meta.id] = prompt;
    });

    const response = {
      success: true,
      data: {
        root: VAULT_ROOT,
        categories,
        allPrompts: promptsMap,
      },
    };

    // 🚀 Performance: Cache the response
    apiCache.set(cacheKey, response);

    res.json(response);
  } catch (error) {
    next(error);
  }
});

router.post('/normalize', async (req, res, next) => {
  try {
    const categories = await scanDirectory(VAULT_ROOT, VAULT_ROOT);
    const result = await normalizePromptsCategoryPath(categories, VAULT_ROOT);

    // 🚀 Performance: Invalidate cache after data modification
    apiCache.invalidate('/api/vault/scan');

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/vault/info
 * 获取 Vault 信息
 */
router.get('/info', async (req, res, next) => {
  try {
    // 🚀 Performance: Check cache first
    const cacheKey = apiCache.generateKey('GET', '/api/vault/info', req.query);
    const cached = apiCache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const categories = await scanDirectory(VAULT_ROOT, VAULT_ROOT);
    const allPrompts = collectAllPrompts(categories);

    const response = {
      success: true,
      data: {
        root: VAULT_ROOT,
        categoryCount: categories.length,
        promptCount: allPrompts.length,
      },
    };

    // 🚀 Performance: Cache the response
    apiCache.set(cacheKey, response);

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Export cache for use in other routes
module.exports = router;
module.exports.apiCache = apiCache;
