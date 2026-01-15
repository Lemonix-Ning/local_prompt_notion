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
  loadPromptsInDirectory,
} = require('../utils/fileSystem');

const rawVaultPath = process.env.VAULT_PATH && process.env.VAULT_PATH.trim();
const VAULT_ROOT = rawVaultPath || path.join(__dirname, '../../vault');

/**
 * GET /api/vault/scan
 * 扫描 Vault 目录,返回完整结构
 */
router.get('/scan', async (req, res, next) => {
  try {
    const categories = await scanDirectory(VAULT_ROOT, VAULT_ROOT);
    
    // 收集所有分类中的提示词
    const allPrompts = collectAllPrompts(categories);
    
    // 同时收集根目录中的提示词（没有分类的提示词）
    const rootPrompts = await loadPromptsInDirectory(VAULT_ROOT);
    allPrompts.push(...rootPrompts);

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
