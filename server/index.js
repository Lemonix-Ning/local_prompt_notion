/**
 * Local Prompt Notion - 后端服务器
 * 提供 REST API 和文件系统持久化
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { cleanupTrash } = require('./utils/fileSystem');
const TaskScheduler = require('./utils/intervalTaskScheduler');
const RequestQueue = require('./utils/requestQueue');
const { createQueueMiddleware } = require('./utils/requestQueue');

const app = express();
const PORT = process.env.PORT || 3001;
const rawVaultPath = process.env.VAULT_PATH && process.env.VAULT_PATH.trim();
const VAULT_ROOT = rawVaultPath || path.join(__dirname, '../vault');

// 回收站保留天数
const TRASH_RETENTION_DAYS = 5;

// 创建任务调度器
const scheduler = new TaskScheduler(VAULT_ROOT);

// 🚀 Performance: Create request queue with max 10 concurrent requests
const requestQueue = new RequestQueue(10);

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' })); // 🔥 增加 JSON body 大小限制以支持图片上传
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // 🔥 同时增加 URL encoded 限制

// 🚀 Performance: Apply request queue middleware to API routes
app.use('/api', createQueueMiddleware(requestQueue));

// 导入路由
const vaultRoutes = require('./routes/vault');
const categoryRoutes = require('./routes/categories');
const promptRoutes = require('./routes/prompts');
const searchRoutes = require('./routes/search');
const trashRoutes = require('./routes/trash');
const intervalTaskRoutes = require('./routes/intervalTasks');
const imageRoutes = require('./routes/images');

// 注册路由
app.use('/api/vault', vaultRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/prompts', promptRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/tags', searchRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/trash', trashRoutes);
app.use('/api/interval-tasks', intervalTaskRoutes);

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
    
    // 🚀 Performance Optimization: Start HTTP server immediately
    // Move vault scanning and cleanup to background after server is ready
    app.listen(PORT, () => {
      console.log(`✓ Lumina Backend Ready - http://localhost:${PORT} | Vault: ${VAULT_ROOT}`);
      
      // Background initialization after server is ready
      setImmediate(async () => {
        try {
          // Cleanup expired trash items in background
          const cleanupResult = await cleanupTrash(VAULT_ROOT, TRASH_RETENTION_DAYS);
          if (cleanupResult.deletedCount > 0) {
            console.log(`[STARTUP] Cleaned ${cleanupResult.deletedCount} trash items`);
          }
          
          // Start interval task scheduler
          scheduler.start();
        } catch (error) {
          console.error('[STARTUP] Init error:', error);
        }
      });
    });
    
    // Schedule periodic trash cleanup (every hour)
    setInterval(async () => {
      const result = await cleanupTrash(VAULT_ROOT, TRASH_RETENTION_DAYS);
      if (result.deletedCount > 0) {
        console.log(`[SCHEDULED] Cleaned up ${result.deletedCount} expired trash items`);
      }
    }, 60 * 60 * 1000); // 1 hour
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// 导出 app、VAULT_ROOT 和 scheduler 供路由使用
module.exports = { app, VAULT_ROOT, scheduler };
