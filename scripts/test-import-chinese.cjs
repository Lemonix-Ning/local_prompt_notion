/**
 * 测试中文分类路径导入
 */

const API_BASE = 'http://localhost:3001/api';

async function testChineseCategory() {
  console.log('========================================');
  console.log('测试中文分类路径导入');
  console.log('========================================\n');

  const testPrompts = [
    {
      title: '测试提示词 1',
      content: '这是测试内容',
      tags: ['测试']
    }
  ];

  console.log('🚀 测试导入到中文分类: "导入测试"\n');

  try {
    const response = await fetch(`${API_BASE}/prompts/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompts: testPrompts,
        categoryPath: '导入测试',
        conflictStrategy: 'rename',
      }),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log('✅ 导入成功！\n');
      console.log('📊 统计信息:');
      console.log(`   总计: ${result.data.total}`);
      console.log(`   成功: ${result.data.success}`);
      console.log(`   失败: ${result.data.failed}`);
      console.log(`   跳过: ${result.data.skipped}\n`);
    } else {
      console.error('❌ 导入失败');
      console.error(`   状态码: ${response.status}`);
      console.error(`   错误: ${result.error || '未知错误'}\n`);
      
      console.log('💡 请检查后端控制台的日志输出');
    }
  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    console.log('\n💡 提示: 请确保后端服务器正在运行');
    console.log('   启动命令: cd server && npm start');
  }

  console.log('\n========================================');
}

testChineseCategory();
