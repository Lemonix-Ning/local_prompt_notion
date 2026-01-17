/**
 * 完整的导出导入链路测试
 * 测试所有导出方式和导入方式的组合
 */

const http = require('http');

const API_BASE = 'http://localhost:3001/api';

// HTTP 请求工具
function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    console.log(`[HTTP] ${method} ${url.pathname}`);
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
          console.error(`[HTTP ERROR] ${res.statusCode}: ${body}`);
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error(`[HTTP ERROR]`, err);
      reject(err);
    });
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// 扫描 vault
async function scanVault() {
  const result = await request('GET', '/api/vault/scan');
  return result;
}

// 导出提示词
async function exportPrompts(ids, includeContent = true, preserveStructure = false) {
  const result = await request('POST', '/api/prompts/export', { 
    ids, 
    includeContent,
    preserveStructure,
  });
  return result;
}

// 导入提示词
async function importPrompts(prompts, targetCategoryPath = '', conflictStrategy = 'rename') {
  const result = await request('POST', '/api/prompts/import', {
    prompts,
    targetCategoryPath,
    conflictStrategy,
  });
  return result;
}

// 删除提示词（移到回收站）
async function deletePrompt(id) {
  const result = await request('DELETE', `/api/prompts/${id}`);
  return result;
}

// 创建测试分类
async function createCategory(parentPath, name) {
  const result = await request('POST', '/api/categories', { parentPath, name });
  return result;
}

// 删除分类
async function deleteCategory(categoryPath) {
  const result = await request('DELETE', `/api/categories`, { categoryPath });
  return result;
}

// 测试工具函数
function assert(condition, message) {
  if (!condition) {
    throw new Error(`❌ 断言失败: ${message}`);
  }
  console.log(`✅ ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 主测试流程
async function runTests() {
  console.log('🚀 开始完整的导出导入链路测试\n');

  try {
    // ========================================
    // 准备阶段：创建测试分类和提示词
    // ========================================
    console.log('📋 阶段 1: 准备测试数据');
    console.log('----------------------------------------');

    // 创建测试分类
    const testCategoryName = `ExportImportTest_${Date.now()}`;
    await createCategory('', testCategoryName);
    console.log(`✅ 创建测试分类: ${testCategoryName}`);
    await sleep(500);

    // 扫描 vault 获取分类路径
    let vaultData = await scanVault();
    console.log('[DEBUG] vaultData keys:', Object.keys(vaultData));
    console.log('[DEBUG] vaultData.data keys:', vaultData.data ? Object.keys(vaultData.data) : 'no data');
    
    const categories = vaultData.data?.categories || vaultData.categories || [];
    const testCategory = categories.find((c) => c.name === testCategoryName);
    assert(testCategory, `找到测试分类: ${testCategoryName}`);
    const testCategoryPath = testCategory.path;

    // 准备测试数据（导入到测试分类）
    const testPrompts = [
      {
        title: '测试提示词1',
        content: '这是测试内容1\n\n包含**Markdown**格式',
        tags: ['测试', 'Tag1'],
        type: 'NOTE',
        is_favorite: false,
      },
      {
        title: '测试提示词2',
        content: '这是测试内容2\n\n包含`代码`',
        tags: ['测试', 'Tag2'],
        type: 'NOTE',
        is_favorite: true,
      },
      {
        title: '测试任务',
        content: '这是一个测试任务',
        tags: ['任务', '测试'],
        type: 'TASK',
        scheduled_time: new Date(Date.now() + 3600000).toISOString(),
        recurrence: {
          type: 'daily',
          interval: 1,
        },
      },
    ];

    const importResult1 = await importPrompts(testPrompts, testCategoryPath, 'rename');
    console.log('[DEBUG] importResult1:', JSON.stringify(importResult1, null, 2));
    const importSuccess = importResult1.data?.success || importResult1.success;
    assert(importSuccess === 3, `导入 ${importSuccess} 个测试提示词`);
    await sleep(500);

    // 重新扫描获取导入的提示词 ID
    vaultData = await scanVault();
    const allPromptsData = vaultData.data?.allPrompts || vaultData.allPrompts || [];
    const importedPrompts = allPromptsData.filter(
      (p) => p.meta.category_path === testCategoryPath
    );
    assert(importedPrompts.length === 3, `测试分类中有 ${importedPrompts.length} 个提示词`);

    const promptIds = importedPrompts.map((p) => p.meta.id);
    console.log(`✅ 获取到 ${promptIds.length} 个提示词 ID\n`);

    // ========================================
    // 测试 1: 单卡片导出（扁平结构，无 category_path）
    // ========================================
    console.log('📋 测试 1: 单卡片导出（扁平结构）');
    console.log('----------------------------------------');

    const singleExport = await exportPrompts([promptIds[0]], true, false); // preserveStructure=false
    assert(singleExport.data.prompts.length === 1, '导出 1 个提示词');
    const singlePrompt = singleExport.data.prompts[0];
    assert(singlePrompt.title === '测试提示词1', '标题正确');
    assert(singlePrompt.content.includes('Markdown'), '内容正确');
    assert(singlePrompt.tags.includes('测试'), '标签正确');
    assert(!singlePrompt.category_path, '单卡片导出不包含 category_path（扁平结构）');
    console.log('✅ 单卡片导出验证通过（扁平结构）\n');

    // ========================================
    // 测试 2: 批量导出（扁平结构，无 category_path）
    // ========================================
    console.log('📋 测试 2: 批量导出（扁平结构）');
    console.log('----------------------------------------');

    const batchExport = await exportPrompts(promptIds, true, false); // preserveStructure=false
    assert(batchExport.data.prompts.length === 3, '导出 3 个提示词');
    assert(batchExport.data.prompts.every((p) => p.content), '所有提示词都包含内容');
    assert(batchExport.data.prompts.every((p) => !p.category_path), '批量导出不包含 category_path（扁平结构）');
    
    // 验证任务类型字段
    const taskExport = batchExport.data.prompts.find((p) => p.type === 'TASK');
    assert(taskExport, '找到任务类型提示词');
    assert(taskExport.scheduled_time, '任务包含 scheduled_time');
    assert(taskExport.recurrence, '任务包含 recurrence');
    assert(taskExport.recurrence.type === 'daily', '重复类型正确');
    console.log('✅ 批量导出验证通过（扁平结构）\n');

    // ========================================
    // 测试 3: 分类导出（树形结构，包含 category_path）
    // ========================================
    console.log('📋 测试 3: 分类导出（树形结构）');
    console.log('----------------------------------------');

    const categoryExport = await exportPrompts(promptIds, true, true); // preserveStructure=true
    assert(categoryExport.data.prompts.length === 3, '导出 3 个提示词');
    assert(categoryExport.data.prompts.every((p) => p.content), '所有提示词都包含内容');
    assert(categoryExport.data.prompts.every((p) => p.category_path), '分类导出包含 category_path（树形结构）');
    
    // 验证分类路径是相对路径
    const relativePath = categoryExport.data.prompts[0].category_path;
    assert(!relativePath.startsWith('/') && !relativePath.includes(':\\'), '分类路径是相对路径');
    console.log(`✅ 分类导出验证通过（树形结构，相对路径: ${relativePath}）\n`);

    // ========================================
    // 测试 4: 扁平结构导入（对应单卡片/批量导出）
    // ========================================
    console.log('📋 测试 4: 扁平结构导入（对应单卡片/批量导出）');
    console.log('----------------------------------------');

    // 使用之前的扁平导出数据
    const flatExportData = await exportPrompts([promptIds[0], promptIds[1]], true, false);
    const flatImportData = flatExportData.data.prompts;
    
    // 修改标题避免冲突
    flatImportData[0].title = '扁平导入测试1';
    flatImportData[1].title = '扁平导入测试2';

    const flatImportResult = await importPrompts(flatImportData, testCategoryPath, 'rename');
    assert(flatImportResult.success === 2, `扁平导入成功 ${flatImportResult.success} 个`);
    await sleep(500);

    vaultData = await scanVault();
    const flatImported = Array.from(vaultData.allPrompts.values()).filter(
      (p) => p.meta.title.startsWith('扁平导入测试')
    );
    assert(flatImported.length === 2, '扁平导入的提示词数量正确');
    assert(flatImported.every((p) => p.meta.category_path === testCategoryPath), '所有提示词都在目标分类');
    console.log('✅ 扁平结构导入验证通过（对应单卡片/批量导出）\n');

    // ========================================
    // 测试 5: 树形结构导入（对应分类导出）
    // ========================================
    console.log('📋 测试 5: 树形结构导入（对应分类导出）');
    console.log('----------------------------------------');

    const treeImportData = [
      {
        title: '树形导入1',
        content: '树形结构内容1',
        tags: ['树形', 'Import'],
        type: 'NOTE',
        category_path: 'SubCategory1',
      },
      {
        title: '树形导入2',
        content: '树形结构内容2',
        tags: ['树形', 'Import'],
        type: 'NOTE',
        category_path: 'SubCategory1/SubCategory2',
      },
      {
        title: '树形导入3',
        content: '树形结构内容3',
        tags: ['树形', 'Import'],
        type: 'NOTE',
        category_path: 'SubCategory3',
      },
    ];

    const treeImportResult = await importPrompts(treeImportData, testCategoryPath, 'rename');
    assert(treeImportResult.success === 3, `树形导入成功 ${treeImportResult.success} 个`);
    await sleep(500);

    vaultData = await scanVault();
    const treeImported = Array.from(vaultData.allPrompts.values()).filter(
      (p) => p.meta.title.startsWith('树形导入')
    );
    assert(treeImported.length === 3, '树形导入的提示词数量正确');
    
    // 验证子分类结构
    const sub1 = treeImported.find((p) => p.meta.title === '树形导入1');
    assert(sub1.meta.category_path.includes('SubCategory1'), '子分类1路径正确');
    
    const sub2 = treeImported.find((p) => p.meta.title === '树形导入2');
    assert(sub2.meta.category_path.includes('SubCategory2'), '子分类2路径正确');
    
    const sub3 = treeImported.find((p) => p.meta.title === '树形导入3');
    assert(sub3.meta.category_path.includes('SubCategory3'), '子分类3路径正确');
    
    console.log('✅ 树形结构导入验证通过（对应分类导出）\n');

    // ========================================
    // 测试 6: 冲突处理 - 自动重命名
    // ========================================
    console.log('📋 测试 6: 冲突处理 - 自动重命名');
    console.log('----------------------------------------');

    const conflictData = [
      {
        title: '测试提示词1', // 与已存在的提示词同名
        content: '冲突内容',
        tags: ['冲突'],
        type: 'NOTE',
      },
    ];

    const conflictResult = await importPrompts(conflictData, testCategoryPath, 'rename');
    assert(conflictResult.success === 1, '冲突导入成功（自动重命名）');
    await sleep(500);

    vaultData = await scanVault();
    const renamedPrompt = Array.from(vaultData.allPrompts.values()).find(
      (p) => p.meta.title === '测试提示词1_X1'
    );
    assert(renamedPrompt, '找到自动重命名的提示词（_X1）');
    console.log('✅ 冲突处理（自动重命名）验证通过\n');

    // ========================================
    // 测试 7: 冲突处理 - 跳过
    // ========================================
    console.log('📋 测试 7: 冲突处理 - 跳过');
    console.log('----------------------------------------');

    const skipResult = await importPrompts(conflictData, testCategoryPath, 'skip');
    assert(skipResult.skipped === 1, '冲突导入跳过 1 个');
    assert(skipResult.success === 0, '没有新增提示词');
    console.log('✅ 冲突处理（跳过）验证通过\n');

    // ========================================
    // 测试 8: 冲突处理 - 覆盖
    // ========================================
    console.log('📋 测试 8: 冲突处理 - 覆盖');
    console.log('----------------------------------------');

    const overwriteData = [
      {
        title: '测试提示词1',
        content: '覆盖后的新内容',
        tags: ['覆盖'],
        type: 'NOTE',
      },
    ];

    const overwriteResult = await importPrompts(overwriteData, testCategoryPath, 'overwrite');
    assert(overwriteResult.success === 1, '冲突导入覆盖成功');
    await sleep(500);

    vaultData = await scanVault();
    const overwrittenPrompt = Array.from(vaultData.allPrompts.values()).find(
      (p) => p.meta.title === '测试提示词1' && p.meta.category_path === testCategoryPath
    );
    assert(overwrittenPrompt, '找到覆盖后的提示词');
    assert(overwrittenPrompt.content.includes('覆盖后的新内容'), '内容已覆盖');
    console.log('✅ 冲突处理（覆盖）验证通过\n');

    // ========================================
    // 测试 9: 完整循环测试（分类导出 → 树形导入）
    // ========================================
    console.log('📋 测试 9: 完整循环测试（分类导出 → 树形导入）');
    console.log('----------------------------------------');

    // 导出所有测试提示词（树形结构）
    vaultData = await scanVault();
    const allTestPrompts = Array.from(vaultData.allPrompts.values()).filter(
      (p) => p.meta.category_path.includes(testCategoryName)
    );
    const allTestIds = allTestPrompts.map((p) => p.meta.id);
    
    const fullExport = await exportPrompts(allTestIds, true, true); // preserveStructure=true
    console.log(`✅ 导出 ${fullExport.data.prompts.length} 个提示词（树形结构）`);
    
    // 验证导出包含 category_path
    assert(fullExport.data.prompts.every(p => p.category_path), '所有导出的提示词都包含 category_path');

    // 创建新的测试分类
    const newCategoryName = `ImportTarget_${Date.now()}`;
    await createCategory('', newCategoryName);
    await sleep(500);

    vaultData = await scanVault();
    const newCategory = vaultData.categories.find((c) => c.name === newCategoryName);
    const newCategoryPath = newCategory.path;

    // 导入到新分类（保留树形结构）
    const reimportResult = await importPrompts(fullExport.data.prompts, newCategoryPath, 'rename');
    assert(reimportResult.success === fullExport.data.prompts.length, `重新导入 ${reimportResult.success} 个提示词`);
    await sleep(500);

    vaultData = await scanVault();
    const reimported = Array.from(vaultData.allPrompts.values()).filter(
      (p) => p.meta.category_path.includes(newCategoryName)
    );
    assert(reimported.length >= fullExport.data.prompts.length, '重新导入的提示词数量正确');
    
    // 验证子分类结构被保留
    const hasSubCategories = reimported.some(p => {
      const relativePath = p.meta.category_path.replace(newCategoryPath, '');
      return relativePath.includes('/') || relativePath.includes('\\');
    });
    assert(hasSubCategories, '子分类结构被正确保留');
    
    console.log('✅ 完整循环测试通过（分类导出 → 树形导入）\n');

    // ========================================
    // 清理阶段
    // ========================================
    console.log('📋 清理测试数据');
    console.log('----------------------------------------');

    await deleteCategory(testCategoryPath);
    console.log(`✅ 删除测试分类: ${testCategoryName}`);

    await deleteCategory(newCategoryPath);
    console.log(`✅ 删除测试分类: ${newCategoryName}`);

    // ========================================
    // 测试完成
    // ========================================
    console.log('\n========================================');
    console.log('🎉 所有测试通过！');
    console.log('========================================');
    console.log('\n测试覆盖：');
    console.log('✅ 单卡片导出（扁平结构，无 category_path）');
    console.log('✅ 批量导出（扁平结构，无 category_path）');
    console.log('✅ 分类导出（树形结构，包含 category_path）');
    console.log('✅ 扁平结构导入（对应单卡片/批量导出）');
    console.log('✅ 树形结构导入（对应分类导出）');
    console.log('✅ 冲突处理 - 自动重命名');
    console.log('✅ 冲突处理 - 跳过');
    console.log('✅ 冲突处理 - 覆盖');
    console.log('✅ 完整循环（分类导出 → 树形导入）');
    console.log('✅ 任务类型字段保留');
    console.log('✅ 分类路径处理（相对路径）');
    console.log('\n导出导入对应关系：');
    console.log('📤 单卡片导出 → 📥 扁平结构导入');
    console.log('📤 批量导出 → 📥 扁平结构导入');
    console.log('📤 分类导出 → 📥 树形结构导入');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行测试
runTests().catch((error) => {
  console.error('❌ 测试执行失败:', error);
  process.exit(1);
});
