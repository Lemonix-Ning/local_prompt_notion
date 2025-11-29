/**
 * Local Prompt Notion - 后端服务器
 * 提供 REST API 和文件系统持久化
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3001;

// 默认 Vault 路径
const VAULT_ROOT = process.env.VAULT_PATH || path.join(__dirname, '../sample-vault');

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// 导入路由
const vaultRoutes = require('./routes/vault');
const categoryRoutes = require('./routes/categories');
const promptRoutes = require('./routes/prompts');
const searchRoutes = require('./routes/search');
const trashRoutes = require('./routes/trash');

// 注册路由
app.use('/api/vault', vaultRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/prompts', promptRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/tags', searchRoutes);
app.use('/api/trash', trashRoutes);

// 静态文件服务(图片)
app.use('/api/images', express.static(VAULT_ROOT));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', vault: VAULT_ROOT });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
  });
});

// 启动服务器
async function startServer() {
  try {
    // 确保 Vault 目录存在
    await fs.mkdir(VAULT_ROOT, { recursive: true });
    await fs.mkdir(path.join(VAULT_ROOT, 'trash'), { recursive: true });
    
    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════╗
║   Local Prompt Notion - Backend Server        ║
╠════════════════════════════════════════════════╣
║   Server:  http://localhost:${PORT}             ║
║   API:     http://localhost:${PORT}/api         ║
║   Vault:   ${VAULT_ROOT}
╚════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// 导出 app 和 VAULT_ROOT 供路由使用
module.exports = { app, VAULT_ROOT };
