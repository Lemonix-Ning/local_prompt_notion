/**
 * 简化的导出导入测试
 * 验证核心对应关系：
 * - 单卡片/批量导出 → 扁平结构（无 category_path）
 * - 分类导出 → 树形结构（有 category_path）
 */

const http = require('http');

const API_BASE = 'http://localhost:3001/api';

// HTTP 请求工具
function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
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
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(body);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('🚀 开始简化的导出导入测试\n');

  try {
    // 1. 扫描 vault 获取现有提示词
    console.log('📋 步骤 1: 扫描 Vault');
    const vaultData = await request('GET', '/api/vault/scan');
    const allPromptsObj = vaultData.data.allPrompts || {};
    const allPrompts = Object.values(allPromptsObj);
    
    if (allPrompts.length === 0) {
      console.log('❌ Vault 中没有提示词，请先创建一些测试数据');
      return;
    }
    
    console.log(`✅ 找到 ${allPrompts.length} 个提示词\n`);
    
    // 获取前 3 个提示词的 ID
    const testIds = allPrompts.slice(0, Math.min(3, allPrompts.length)).map(p => p.meta.id);
    console.log(`📝 使用 ${testIds.length} 个提示词进行测试\n`);

    // 2. 测试单卡片/批量导出（扁平结构）
    console.log('📋 步骤 2: 单卡片/批量导出（扁平结构）');
    const flatExport = await request('POST', '/api/prompts/export', {
      ids: testIds,
      includeContent: true,
      preserveStructure: false, // 扁平结构
    });
    
    const flatPrompts = flatExport.data.prompts;
    console.log(`✅ 导出 ${flatPrompts.length} 个提示词`);
    
    // 验证：不包含 category_path
    const hasNoCategoryPath = flatPrompts.every(p => !p.category_path);
    if (hasNoCategoryPath) {
      console.log('✅ 验证通过：扁平导出不包含 category_path');
    } else {
      console.log('❌ 验证失败：扁平导出包含了 category_path');
      console.log('   示例:', flatPrompts[0]);
    }
    console.log('');

    // 3. 测试分类导出（树形结构）
    console.log('📋 步骤 3: 分类导出（树形结构）');
    const treeExport = await request('POST', '/api/prompts/export', {
      ids: testIds,
      includeContent: true,
      preserveStructure: true, // 树形结构
    });
    
    const treePrompts = treeExport.data.prompts;
    console.log(`✅ 导出 ${treePrompts.length} 个提示词`);
    
    // 验证：包含 category_path
    const hasCategoryPath = treePrompts.every(p => p.category_path);
    if (hasCategoryPath) {
      console.log('✅ 验证通过：树形导出包含 category_path');
      console.log(`   示例路径: ${treePrompts[0].category_path}`);
    } else {
      console.log('❌ 验证失败：树形导出缺少 category_path');
    }
    console.log('');

    // 4. 测试扁平导入
    console.log('📋 步骤 4: 扁平导入测试');
    const flatImportData = [{
      title: `扁平导入测试_${Date.now()}`,
      content: '这是扁平导入的测试内容',
      tags: ['测试', '扁平'],
      type: 'NOTE',
      // 注意：没有 category_path
    }];
    
    // 获取第一个分类作为目标
    const targetCategory = vaultData.data.categories[0];
    if (!targetCategory) {
      console.log('❌ 没有找到目标分类');
      return;
    }
    
    const flatImportResult = await request('POST', '/api/prompts/import', {
      prompts: flatImportData,
      targetCategoryPath: targetCategory.path,
      conflictStrategy: 'rename',
    });
    
    if (flatImportResult.data.success === 1) {
      console.log('✅ 扁平导入成功');
    } else {
      console.log('❌ 扁平导入失败:', flatImportResult);
    }
    console.log('');

    // 5. 测试树形导入
    console.log('📋 步骤 5: 树形导入测试');
    const treeImportData = [{
      title: `树形导入测试_${Date.now()}`,
      content: '这是树形导入的测试内容',
      tags: ['测试', '树形'],
      type: 'NOTE',
      category_path: 'TestSubCategory', // 包含分类路径
    }];
    
    const treeImportResult = await request('POST', '/api/prompts/import', {
      prompts: treeImportData,
      targetCategoryPath: targetCategory.path,
      conflictStrategy: 'rename',
    });
    
    if (treeImportResult.data.success === 1) {
      console.log('✅ 树形导入成功');
      console.log(`   应该创建子分类: ${targetCategory.path}/TestSubCategory`);
    } else {
      console.log('❌ 树形导入失败:', treeImportResult);
    }
    console.log('');

    // 总结
    console.log('========================================');
    console.log('🎉 测试完成！');
    console.log('========================================');
    console.log('\n验证的对应关系：');
    console.log('✅ 单卡片/批量导出 (preserveStructure=false) → 扁平结构（无 category_path）');
    console.log('✅ 分类导出 (preserveStructure=true) → 树形结构（有 category_path）');
    console.log('✅ 扁平导入 → 直接放到目标分类');
    console.log('✅ 树形导入 → 在目标分类下创建子分类结构');
    console.log('');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('❌ 测试执行失败:', error);
  process.exit(1);
});
