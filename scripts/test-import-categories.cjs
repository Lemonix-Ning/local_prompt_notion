/**
 * 测试导入包含分类结构的 JSON 文件
 */

const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3001/api';

async function testCategoryImport() {
  console.log('========================================');
  console.log('测试分类结构导入');
  console.log('========================================\n');

  // 读取示例文件
  const examplePath = path.join(__dirname, '../docs/import-with-categories.json');
  console.log(`📁 读取示例文件: ${examplePath}`);
  
  if (!fs.existsSync(examplePath)) {
    console.error('❌ 示例文件不存在');
    return;
  }

  const prompts = JSON.parse(fs.readFileSync(examplePath, 'utf-8'));
  console.log(`✅ 成功读取 ${prompts.length} 个提示词\n`);

  // 显示分类结构
  console.log('📊 分类结构预览:');
  const categories = new Set();
  prompts.forEach(p => {
    if (p.category_path) {
      categories.add(p.category_path);
    }
  });
  categories.forEach(cat => {
    console.log(`   - ${cat}`);
  });
  console.log('');

  // 测试导入
  console.log('🚀 开始导入...');
  console.log(`   冲突策略: rename\n`);

  try {
    const response = await fetch(`${API_BASE}/prompts/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompts,
        conflictStrategy: 'rename',
        // 不指定 categoryPath，让每个提示词使用自己的 category_path
      }),
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ 导入完成！\n');
      console.log('📊 统计信息:');
      console.log(`   总计: ${result.data.total}`);
      console.log(`   成功: ${result.data.success}`);
      console.log(`   失败: ${result.data.failed}`);
      console.log(`   跳过: ${result.data.skipped}\n`);

      if (result.data.failed > 0 || result.data.skipped > 0) {
        console.log('📋 详细结果:');
        result.data.details.forEach((detail, index) => {
          if (detail.status !== 'success') {
            console.log(`   [${index + 1}] ${detail.title}`);
            console.log(`       状态: ${detail.status}`);
            if (detail.error) console.log(`       错误: ${detail.error}`);
            if (detail.reason) console.log(`       原因: ${detail.reason}`);
          }
        });
      }

      console.log('\n💡 提示: 请在应用中查看新创建的分类结构');
    } else {
      console.error('❌ 导入失败:', result.error);
    }
  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    console.log('\n💡 提示: 请确保后端服务器正在运行');
    console.log('   启动命令: cd server && npm start');
  }

  console.log('\n========================================');
}

testCategoryImport();
