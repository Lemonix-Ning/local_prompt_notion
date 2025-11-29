/**
 * 搜索和标签路由
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const {
  scanDirectory,
  collectAllPrompts,
  searchPrompts,
  getAllTags,
} = require('../utils/fileSystem');

const VAULT_ROOT = process.env.VAULT_PATH || path.join(__dirname, '../../sample-vault');

/**
 * GET /api/search
 * 搜索提示词
 * Query: q (query), tags, category
 */
router.get('/', async (req, res, next) => {
  try {
    const { q, tags, category } = req.query;

    const categories = await scanDirectory(VAULT_ROOT, VAULT_ROOT);
    let prompts = collectAllPrompts(categories);

    // 按分类过滤
    if (category) {
      prompts = prompts.filter(p => p.path.includes(category));
    }

    // 按标签过滤
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      prompts = prompts.filter(p =>
        tagArray.some(tag => p.meta.tags.includes(tag))
      );
    }

    // 搜索
    if (q) {
      prompts = searchPrompts(prompts, q);
    }

    res.json({
      success: true,
      data: prompts,
      query: { q, tags, category },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/tags
 * 获取所有标签
 */
router.get('/tags', async (req, res, next) => {
  try {
    const categories = await scanDirectory(VAULT_ROOT, VAULT_ROOT);
    const prompts = collectAllPrompts(categories);
    const tags = getAllTags(prompts);

    res.json({
      success: true,
      data: tags,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
