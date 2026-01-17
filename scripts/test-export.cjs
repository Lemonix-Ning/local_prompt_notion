/**
 * 测试导出功能
 * 导出指定的提示词为 JSON 文件
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3001';

/**
 * 发送 HTTP 请求
 */
function request(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * 测试导出功能
 */
async function testExport() {
  console.log('========================================');
  console.log('测试导出功能');
  console.log('========================================\n');

  try {
    // 1. 扫描 vault 获取所有提示词
    console.log('1. 扫描 vault...');
    const scanResult = await request('GET', '/api/vault/scan');
    
    if (!scanResult.success) {
      throw new Error(`扫描失败: ${scanResult.error}`);
    }

    const allPrompts = scanResult.data.allPrompts || [];
    console.log(`   找到 ${allPrompts.length} 个提示词\n`);

    if (allPrompts.length === 0) {
      console.log('❌ 没有可导出的提示词');
      return;
    }

    // 2. 选择前 5 个提示词导出（或全部，如果少于 5 个）
    const exportCount = Math.min(5, allPrompts.length);
    const exportIds = allPrompts.slice(0, exportCount).map(p => p.meta.id);

    console.log(`2. 导出前 ${exportCount} 个提示词...`);
    console.log('   导出的提示词:');
    allPrompts.slice(0, exportCount).forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.meta.title} (${p.meta.type || 'NOTE'})`);
    });
    console.log('');

    // 3. 调用导出 API
    console.log('3. 调用导出 API...');
    const exportResult = await request('POST', '/api/prompts/export', {
      ids: exportIds,
      includeContent: true,
    });

    if (!exportResult.success) {
      throw new Error(`导出失败: ${exportResult.error}`);
    }

    const { prompts, total, notFound } = exportResult.data;
    console.log(`   ✅ 导出成功: ${total} 个提示词`);
    
    if (notFound && notFound.length > 0) {
      console.log(`   ⚠️  未找到: ${notFound.length} 个提示词`);
    }
    console.log('');

    // 4. 保存到文件
    const outputPath = path.join(__dirname, '../test-export-output.json');
    fs.writeFileSync(outputPath, JSON.stringify(prompts, null, 2), 'utf-8');
    console.log(`4. 保存到文件: ${outputPath}`);
    console.log('');

    // 5. 显示导出数据预览
    console.log('5. 导出数据预览:');
    console.log('----------------------------------------');
    prompts.forEach((p, i) => {
      console.log(`\n提示词 ${i + 1}:`);
      console.log(`  标题: ${p.title}`);
      console.log(`  类型: ${p.type || 'NOTE'}`);
      console.log(`  标签: ${p.tags?.join(', ') || '无'}`);
      console.log(`  分类: ${p.category_path || '根目录'}`);
      console.log(`  收藏: ${p.is_favorite ? '是' : '否'}`);
      console.log(`  内容长度: ${p.content?.length || 0} 字符`);
      
      if (p.type === 'TASK') {
        console.log(`  任务时间: ${p.scheduled_time || '未设置'}`);
        if (p.recurrence) {
          console.log(`  重复: ${p.recurrence.type} (${p.recurrence.enabled ? '启用' : '禁用'})`);
        }
      }
    });
    console.log('\n----------------------------------------');

    console.log('\n✅ 导出测试完成！');
    console.log(`📁 导出文件: ${outputPath}`);

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    process.exit(1);
  }
}

// 运行测试
testExport();
