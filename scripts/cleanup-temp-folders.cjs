/**
 * 清理临时和恢复的文件夹
 * 
 * 这个脚本会删除以下内容：
 * 1. 根目录下的 *_restored_* 文件夹
 * 2. sample-vault 下的测试和恢复文件夹
 * 
 * 使用方法：
 * node scripts/cleanup-temp-folders.cjs
 */

const fs = require('fs');
const path = require('path');

// 项目根目录
const rootDir = path.join(__dirname, '..');

// 需要删除的根目录文件夹模式
const rootFoldersToDelete = [
  'sample-vault_restored_1',
  'sample-vault_restored_2',
];

// 需要删除的 sample-vault 子文件夹
const sampleVaultFoldersToDelete = [
  '123',
  'Coding_restored_1',
  'dasdas_moved',
  'sql_optimizer',
  'test_prompt',
  'test_prompt_restored',
  '项目',
];

/**
 * 递归删除目录
 */
function deleteFolderRecursive(folderPath) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const curPath = path.join(folderPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(folderPath);
    console.log(`✓ 已删除: ${folderPath}`);
  } else {
    console.log(`⊘ 不存在: ${folderPath}`);
  }
}

console.log('开始清理临时文件夹...\n');

// 清理根目录
console.log('1. 清理根目录的恢复文件夹:');
rootFoldersToDelete.forEach((folder) => {
  const folderPath = path.join(rootDir, folder);
  deleteFolderRecursive(folderPath);
});

// 清理 sample-vault
console.log('\n2. 清理 sample-vault 的临时文件夹:');
const sampleVaultDir = path.join(rootDir, 'sample-vault');
sampleVaultFoldersToDelete.forEach((folder) => {
  const folderPath = path.join(sampleVaultDir, folder);
  deleteFolderRecursive(folderPath);
});

console.log('\n清理完成！');
console.log('\n建议的项目结构:');
console.log('local_prompt_notion/');
console.log('├── sample-vault/          # 示例数据（保留）');
console.log('│   ├── Business/');
console.log('│   ├── Coding/');
console.log('│   ├── Creative Writing/');
console.log('│   └── trash/');
console.log('├── vault/                 # 本地数据（.gitignore）');
console.log('├── test-vault/            # 测试数据（.gitignore）');
console.log('└── ...');
