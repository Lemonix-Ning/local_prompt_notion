/**
 * 测试 isPathSafe 函数逻辑
 */

const path = require('path');

function isPathSafe(targetPath, vaultRoot) {
  // 使用 path.resolve 获取绝对路径并规范化
  const normalizedTarget = path.resolve(targetPath);
  const normalizedRoot = path.resolve(vaultRoot);
  
  console.log(`[isPathSafe] Checking path safety:`);
  console.log(`  - Target: ${normalizedTarget}`);
  console.log(`  - Root: ${normalizedRoot}`);
  
  // 在 Windows 上，路径可能有大小写差异，统一转为小写比较
  const targetLower = normalizedTarget.toLowerCase();
  const rootLower = normalizedRoot.toLowerCase();
  
  // 检查目标路径是否以根路径开头
  const isStartsWith = targetLower.startsWith(rootLower);
  
  // 额外检查：确保不是根路径的前缀（例如 C:\vault2 不应该匹配 C:\vault）
  const isSafe = isStartsWith && (
    targetLower === rootLower || 
    targetLower.charAt(rootLower.length) === path.sep
  );
  
  console.log(`  - Starts with (case-insensitive): ${isStartsWith}`);
  console.log(`  - Is safe: ${isSafe}`);
  
  return isSafe;
}

// 测试场景
const vaultRoot = path.join(process.cwd(), 'vault');
console.log('========================================');
console.log('测试 isPathSafe 函数');
console.log('========================================\n');
console.log(`Vault Root: ${vaultRoot}\n`);

// 测试 1: 相对路径
console.log('测试 1: 相对路径 "导入测试"');
const test1 = path.join(vaultRoot, '导入测试');
console.log(`Input: "导入测试"`);
console.log(`Resolved: ${test1}`);
const result1 = isPathSafe(test1, vaultRoot);
console.log(`Result: ${result1 ? '✅ PASS' : '❌ FAIL'}\n`);

// 测试 2: 已存在的分类
console.log('测试 2: 已存在的分类 "Coding"');
const test2 = path.join(vaultRoot, 'Coding');
const result2 = isPathSafe(test2, vaultRoot);
console.log(`Result: ${result2 ? '✅ PASS' : '❌ FAIL'}\n`);

// 测试 3: 根目录本身
console.log('测试 3: 根目录本身');
const result3 = isPathSafe(vaultRoot, vaultRoot);
console.log(`Result: ${result3 ? '✅ PASS' : '❌ FAIL'}\n`);

// 测试 4: 路径遍历攻击
console.log('测试 4: 路径遍历攻击 "../../../etc"');
const test4 = path.join(vaultRoot, '../../../etc');
const result4 = isPathSafe(test4, vaultRoot);
console.log(`Result: ${result4 ? '❌ FAIL (应该拒绝)' : '✅ PASS (正确拒绝)'}\n`);

console.log('========================================');
