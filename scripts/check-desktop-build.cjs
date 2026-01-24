/**
 * 桌面应用构建检查脚本
 * 
 * 检查桌面应用构建所需的所有文件和配置
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

console.log('========================================');
console.log('桌面应用构建检查');
console.log('========================================\n');

let allGood = true;

// 检查项列表
const checks = [
  {
    name: '.env.tauri 配置文件',
    path: '.env.tauri',
    required: true,
    fix: '创建 .env.tauri 文件，内容参考 .env.tauri.example'
  },
  {
    name: 'Tauri 配置文件',
    path: 'src-tauri/tauri.conf.json',
    required: true,
    fix: '检查 tauri.conf.json 是否存在'
  },
  {
    name: 'sample-vault 示例数据',
    path: 'sample-vault',
    required: true,
    fix: '确保 sample-vault 目录存在'
  }
];

// 执行检查
checks.forEach((check, index) => {
  const fullPath = path.join(rootDir, check.path);
  const exists = fs.existsSync(fullPath);
  
  const status = exists ? '✓' : (check.required ? '✗' : '⚠');
  const color = exists ? '\x1b[32m' : (check.required ? '\x1b[31m' : '\x1b[33m');
  const reset = '\x1b[0m';
  
  console.log(`${index + 1}. ${check.name}`);
  console.log(`   ${color}${status}${reset} ${exists ? '存在' : '不存在'}: ${check.path}`);
  
  if (!exists && check.required) {
    allGood = false;
    console.log(`   修复方法: ${check.fix}`);
  }
  
  console.log();
});

// 检查 .env.tauri 内容
console.log('配置检查:');
const envTauriPath = path.join(rootDir, '.env.tauri');
if (fs.existsSync(envTauriPath)) {
  const content = fs.readFileSync(envTauriPath, 'utf-8');
  
  // 检查 MOCK 配置
  if (content.includes('VITE_USE_MOCK=true')) {
    console.log('   ✓ MOCK 模式已启用');
  } else {
    console.log('   ⚠ 未检测到 VITE_USE_MOCK=true');
  }
} else {
  console.log('   ✗ .env.tauri 文件不存在');
  allGood = false;
}

console.log();
console.log('========================================');

if (allGood) {
  console.log('✓ 所有检查通过！可以开始构建桌面应用');
  console.log('\n运行以下命令构建:');
  console.log('  npm run desktop:build');
} else {
  console.log('✗ 发现问题，请先修复上述问题再构建');
  console.log('\n修复后重新运行检查:');
  console.log('  npm run check:desktop');
}

console.log('========================================');

process.exit(allGood ? 0 : 1);
