/**
 * Vault 管理路由
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const {
  scanDirectory,
  collectAllPrompts,
  normalizePromptsCategoryPath,
} = require('../utils/fileSystem');

// 获取 VAULT_ROOT
const VAULT_ROOT = process.env.VAULT_PATH || path.join(__dirname, '../../sample-vault');

/**
 * GET /api/vault/scan
 * 扫描 Vault 目录,返回完整结构
 */
router.get('/scan', async (req, res, next) => {
  try {
    const categories = await scanDirectory(VAULT_ROOT, VAULT_ROOT);
    const allPrompts = collectAllPrompts(categories);

    // 转换为 Map 格式
    const promptsMap = {};
    allPrompts.forEach(prompt => {
      promptsMap[prompt.meta.id] = prompt;
    });

    res.json({
      success: true,
      data: {
        root: VAULT_ROOT,
        categories,
        allPrompts: promptsMap,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/normalize', async (req, res, next) => {
  try {
    const categories = await scanDirectory(VAULT_ROOT, VAULT_ROOT);
    const result = await normalizePromptsCategoryPath(categories, VAULT_ROOT);

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
    const categories = await scanDirectory(VAULT_ROOT, VAULT_ROOT);
    const allPrompts = collectAllPrompts(categories);

    res.json({
      success: true,
      data: {
        root: VAULT_ROOT,
        categoryCount: categories.length,
        promptCount: allPrompts.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
