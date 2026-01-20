/**
 * 图片上传路由
 * 处理编辑器中粘贴的图片
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { existsSync } = require('fs');

// 获取 vault 根目录
const rawVaultPath = process.env.VAULT_PATH && process.env.VAULT_PATH.trim();
const VAULT_ROOT = rawVaultPath || path.join(__dirname, '../../vault');

/**
 * POST /api/images/upload
 * 上传图片（从剪贴板粘贴）
 * 
 * Body:
 * - imageData: base64 编码的图片数据
 * - promptId: 提示词 ID（用于确定保存位置）
 * - fileName: 文件名（可选）
 */
router.post('/upload', async (req, res) => {
  try {
    const { imageData, promptId, fileName } = req.body;
    
    if (!imageData) {
      return res.status(400).json({ error: '缺少图片数据' });
    }
    
    if (!promptId) {
      return res.status(400).json({ error: '缺少提示词 ID' });
    }
    
    // 解析 base64 数据
    // 格式: data:image/png;base64,iVBORw0KG...
    const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: '无效的图片数据格式' });
    }
    
    const imageType = matches[1]; // png, jpeg, etc.
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    
    // 生成唯一文件名
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const finalFileName = fileName || `image-${timestamp}-${randomStr}.${imageType}`;
    
    // 确定保存路径：vault/assets/promptId/
    const assetsDir = path.join(VAULT_ROOT, 'assets', promptId);
    
    // 确保目录存在
    if (!existsSync(assetsDir)) {
      await fs.mkdir(assetsDir, { recursive: true });
    }
    
    // 保存文件
    const filePath = path.join(assetsDir, finalFileName);
    await fs.writeFile(filePath, buffer);
    
    // 返回相对路径（相对于 vault 根目录）
    const relativePath = `assets/${promptId}/${finalFileName}`;
    
    res.json({
      success: true,
      path: relativePath,
      fileName: finalFileName,
    });
    
  } catch (error) {
    console.error('图片上传失败:', error);
    res.status(500).json({ error: '图片上传失败', details: error.message });
  }
});

/**
 * GET /api/images/:promptId/:fileName
 * 获取图片文件
 */
router.get('/:promptId/:fileName', async (req, res) => {
  try {
    const { promptId, fileName } = req.params;
    const filePath = path.join(VAULT_ROOT, 'assets', promptId, fileName);
    
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: '图片不存在' });
    }
    
    // 发送文件
    res.sendFile(filePath);
    
  } catch (error) {
    console.error('获取图片失败:', error);
    res.status(500).json({ error: '获取图片失败', details: error.message });
  }
});

module.exports = router;
