/**
 * 测试脚本：生成 100 个测试卡片并移动到回收站
 * 用于测试批量删除功能的性能和 UI 反馈
 */

const API_BASE = 'http://localhost:3001/api';

async function createTestPrompts() {
  console.log('🚀 开始创建 100 个测试卡片...\n');
  
  // 先获取 vault 根路径
  let vaultRoot = 'vault';
  try {
    const infoResponse = await fetch(`${API_BASE}/vault/info`);
    if (infoResponse.ok) {
      const infoData = await infoResponse.json();
      if (infoData.success && infoData.data.root) {
        vaultRoot = infoData.data.root;
      }
    }
  } catch (error) {
    // 静默处理
  }
  
  const createdIds = [];
  
  // 创建 100 个测试卡片
  for (let i = 1; i <= 100; i++) {
    try {
      const response = await fetch(`${API_BASE}/prompts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categoryPath: `${vaultRoot}/TestBatchDelete`,
          title: `批量删除测试 ${i}`,
          content: `这是第 ${i} 个测试卡片，用于测试批量删除功能的性能和 UI 反馈。\n\n创建时间: ${new Date().toISOString()}`,
          tags: ['测试', '批量删除', `编号${i}`],
          type: 'NOTE',
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error(`❌ 创建第 ${i} 个卡片失败: HTTP ${response.status} - ${errorData.error || '未知错误'}`);
        if (i === 1) {
          console.error('\n⚠️  提示：请确保后端服务器正在运行！');
          console.error('   启动命令: cd server && npm start\n');
        }
        continue;
      }
      
      const data = await response.json();
      
      if (data.success) {
        createdIds.push(data.data.meta.id);
      } else {
        console.error(`❌ 创建第 ${i} 个卡片失败:`, data.error);
      }
    } catch (error) {
      console.error(`❌ 创建第 ${i} 个卡片失败:`, error.message);
      if (i === 1) {
        console.error('\n⚠️  提示：请确保后端服务器正在运行！');
        console.error('   启动命令: cd server && npm start\n');
      }
    }
  }
  
  console.log(`\n✅ 成功创建 ${createdIds.length} 个测试卡片\n`);
  
  return createdIds;
}

async function moveToTrash(ids) {
  console.log('🗑️  开始移动到回收站...\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < ids.length; i++) {
    try {
      const response = await fetch(`${API_BASE}/prompts/${ids[i]}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        successCount++;
      }
    } catch (error) {
      failCount++;
      console.error(`❌ 移动第 ${i + 1} 个卡片失败:`, error.message);
    }
  }
  
  console.log(`✅ 成功移动 ${successCount} 个卡片到回收站`);
  if (failCount > 0) {
    console.log(`❌ 失败 ${failCount} 个`);
  }
  console.log('');
}

async function main() {
  console.log('========================================');
  console.log('批量删除测试脚本');
  console.log('========================================\n');
  
  try {
    // 1. 创建 100 个测试卡片
    const ids = await createTestPrompts();
    
    if (ids.length === 0) {
      console.error('❌ 没有创建任何卡片，退出');
      process.exit(1);
    }
    
    // 2. 移动到回收站
    await moveToTrash(ids);
    
    console.log('\n========================================');
    console.log('✅ 测试数据准备完成！');
    console.log('========================================');
    console.log('\n📋 下一步操作：');
    console.log('1. 打开应用，进入回收站');
    console.log('2. 点击"批量选择"按钮');
    console.log('3. 点击"全选"按钮');
    console.log('4. 点击"永久删除"按钮');
    console.log('5. 观察删除动画和进度提示\n');
    
  } catch (error) {
    console.error('❌ 脚本执行失败:', error.message);
    process.exit(1);
  }
}

main();
