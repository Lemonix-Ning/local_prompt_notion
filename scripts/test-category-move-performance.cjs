/**
 * 分类移动性能测试脚本
 * 用于验证优化效果
 */

const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');

// 导入文件系统工具
const { 
  moveCategory, 
  createCategory, 
  scanDirectory,
  exists 
} = require('../server/utils/fileSystem.js');

/**
 * 创建测试环境
 */
async function setupTestEnvironment(testRoot) {
  // 创建测试目录结构
  const testCategories = [
    'test-source',
    'test-target',
    'test-source/subcategory1',
    'test-source/subcategory2'
  ];

  for (const category of testCategories) {
    const categoryPath = path.join(testRoot, category);
    await fs.mkdir(categoryPath, { recursive: true });
  }

  // 创建一些测试提示词
  for (let i = 1; i <= 5; i++) {
    const promptPath = path.join(testRoot, 'test-source', `test-prompt-${i}`);
    await fs.mkdir(promptPath, { recursive: true });
    
    // 创建 meta.json
    const meta = {
      id: `test-${i}`,
      title: `Test Prompt ${i}`,
      slug: `test-prompt-${i}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: ['test'],
      version: '1.0.0',
      author: 'Test',
      model_config: {
        default_model: 'gpt-4',
        temperature: 0.7,
        top_p: 1.0
      },
      is_favorite: false,
      category: 'test-source',
      category_path: path.join(testRoot, 'test-source')
    };
    
    await fs.writeFile(
      path.join(promptPath, 'meta.json'), 
      JSON.stringify(meta, null, 2)
    );
    
    // 创建 prompt.md
    await fs.writeFile(
      path.join(promptPath, 'prompt.md'), 
      `This is test prompt ${i} content.`
    );
  }

  console.log('✅ Test environment created');
}

/**
 * 清理测试环境
 */
async function cleanupTestEnvironment(testRoot) {
  try {
    await fs.rm(testRoot, { recursive: true, force: true });
    console.log('✅ Test environment cleaned up');
  } catch (error) {
    console.warn('⚠️ Cleanup warning:', error.message);
  }
}

/**
 * 测试分类移动性能
 */
async function testCategoryMovePerformance() {
  const testRoot = path.join(__dirname, '..', 'test-performance');
  
  try {
    console.log('🚀 Starting category move performance test...\n');
    
    // 设置测试环境
    await setupTestEnvironment(testRoot);
    
    const sourcePath = path.join(testRoot, 'test-source');
    const targetPath = path.join(testRoot, 'test-target');
    
    // 验证源目录存在
    if (!(await exists(sourcePath))) {
      throw new Error('Source directory not found');
    }
    
    console.log(`📁 Source: ${sourcePath}`);
    console.log(`📁 Target: ${targetPath}`);
    console.log('');
    
    // 执行性能测试
    console.log('⏱️ Measuring move operation performance...');
    const startTime = performance.now();
    
    const result = await moveCategory(sourcePath, targetPath, testRoot);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // 输出结果
    console.log('');
    console.log('📊 Performance Test Results:');
    console.log('================================');
    console.log(`⏱️ Duration: ${duration.toFixed(2)}ms`);
    console.log(`📦 Result: ${JSON.stringify(result, null, 2)}`);
    console.log(`🔄 Used Fallback: ${result.usedFallback ? 'Yes' : 'No'}`);
    
    // 性能评估
    if (duration < 500) {
      console.log('🎉 EXCELLENT: Move completed in under 500ms');
    } else if (duration < 1000) {
      console.log('✅ GOOD: Move completed in under 1 second');
    } else if (duration < 2000) {
      console.log('⚠️ ACCEPTABLE: Move completed in under 2 seconds');
    } else {
      console.log('❌ SLOW: Move took more than 2 seconds');
    }
    
    // 验证移动结果
    const newPath = result.path;
    if (await exists(newPath)) {
      console.log('✅ Move verification: Target directory exists');
      
      // 检查提示词是否正确移动
      const entries = await fs.readdir(newPath);
      const promptCount = entries.filter(entry => entry.startsWith('test-prompt-')).length;
      console.log(`✅ Prompts moved: ${promptCount}/5`);
    } else {
      console.log('❌ Move verification: Target directory not found');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    // 清理测试环境
    await cleanupTestEnvironment(testRoot);
  }
}

/**
 * 测试无效操作的前端拦截
 */
async function testInvalidOperationInterception() {
  console.log('\n🛡️ Testing invalid operation interception...\n');
  
  const testRoot = path.join(__dirname, '..', 'test-interception');
  
  try {
    await setupTestEnvironment(testRoot);
    
    const sourcePath = path.join(testRoot, 'test-source');
    const sourceParentPath = testRoot; // 父目录
    
    console.log('Testing same-location move (should be intercepted)...');
    const result = await moveCategory(sourcePath, sourceParentPath, testRoot);
    
    // 这应该返回原始路径，表示没有实际移动
    if (result.path === sourcePath) {
      console.log('✅ Same-location move correctly handled');
    } else {
      console.log('❌ Same-location move not handled correctly');
    }
    
  } catch (error) {
    console.error('❌ Interception test failed:', error.message);
  } finally {
    await cleanupTestEnvironment(testRoot);
  }
}

// 运行测试
async function runTests() {
  console.log('🧪 Category Move Performance Test Suite');
  console.log('=======================================\n');
  
  await testCategoryMovePerformance();
  await testInvalidOperationInterception();
  
  console.log('\n🏁 All tests completed!');
}

// 如果直接运行此脚本
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testCategoryMovePerformance,
  testInvalidOperationInterception,
  runTests
};