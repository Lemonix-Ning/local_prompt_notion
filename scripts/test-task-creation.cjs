#!/usr/bin/env node

/**
 * 测试任务创建流程
 * 验证 type 和 scheduled_time 字段是否正确保存
 */

const fs = require('fs').promises;
const path = require('path');

async function testTaskCreation() {
  const vaultPath = process.env.VAULT_PATH || path.join(__dirname, '../vault');
  
  console.log('🧪 开始测试任务创建流程...\n');
  console.log(`📁 Vault 路径: ${vaultPath}\n`);

  try {
    // 1. 查找最近创建的提示词
    console.log('📋 步骤 1: 扫描 Vault 查找最近创建的提示词...');
    
    const scanDir = async (dir) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const prompts = [];
      
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== 'trash') {
          const subPath = path.join(dir, entry.name);
          const subEntries = await fs.readdir(subPath, { withFileTypes: true });
          
          for (const subEntry of subEntries) {
            if (subEntry.isDirectory()) {
              const promptPath = path.join(subPath, subEntry.name);
              const metaPath = path.join(promptPath, 'meta.json');
              
              try {
                const metaContent = await fs.readFile(metaPath, 'utf-8');
                const meta = JSON.parse(metaContent);
                prompts.push({
                  path: promptPath,
                  meta,
                  createdAt: new Date(meta.created_at).getTime(),
                });
              } catch (e) {
                // 忽略无效的提示词
              }
            }
          }
        }
      }
      
      return prompts;
    };
    
    const allPrompts = await scanDir(vaultPath);
    
    if (allPrompts.length === 0) {
      console.log('❌ 未找到任何提示词\n');
      return;
    }
    
    // 按创建时间排序，获取最新的
    allPrompts.sort((a, b) => b.createdAt - a.createdAt);
    const latestPrompt = allPrompts[0];
    
    console.log(`✅ 找到最新提示词: ${latestPrompt.meta.title}\n`);
    
    // 2. 检查 type 字段
    console.log('📋 步骤 2: 检查 type 字段...');
    
    if (latestPrompt.meta.type === undefined) {
      console.log('❌ type 字段缺失！');
      console.log(`   期望: 'NOTE' 或 'TASK'`);
      console.log(`   实际: undefined\n`);
    } else if (latestPrompt.meta.type === 'TASK') {
      console.log(`✅ type 字段正确: ${latestPrompt.meta.type}\n`);
    } else if (latestPrompt.meta.type === 'NOTE') {
      console.log(`✅ type 字段正确: ${latestPrompt.meta.type}\n`);
    } else {
      console.log(`❌ type 字段值无效: ${latestPrompt.meta.type}\n`);
    }
    
    // 3. 检查 scheduled_time 字段
    console.log('📋 步骤 3: 检查 scheduled_time 字段...');
    
    if (latestPrompt.meta.type === 'TASK') {
      if (latestPrompt.meta.scheduled_time === undefined) {
        console.log('⚠️  scheduled_time 字段缺失（任务应该有时间）');
        console.log(`   期望: ISO 8601 时间字符串`);
        console.log(`   实际: undefined\n`);
      } else {
        const scheduledTime = new Date(latestPrompt.meta.scheduled_time);
        if (isNaN(scheduledTime.getTime())) {
          console.log(`❌ scheduled_time 格式无效: ${latestPrompt.meta.scheduled_time}\n`);
        } else {
          console.log(`✅ scheduled_time 正确: ${latestPrompt.meta.scheduled_time}`);
          console.log(`   解析为: ${scheduledTime.toLocaleString()}\n`);
        }
      }
    } else {
      if (latestPrompt.meta.scheduled_time === undefined) {
        console.log(`✅ scheduled_time 字段正确（NOTE 类型不需要）\n`);
      } else {
        console.log(`⚠️  NOTE 类型不应该有 scheduled_time: ${latestPrompt.meta.scheduled_time}\n`);
      }
    }
    
    // 4. 显示完整的 meta.json
    console.log('📋 步骤 4: 完整的 meta.json 内容:');
    console.log(JSON.stringify(latestPrompt.meta, null, 2));
    console.log();
    
    // 5. 总结
    console.log('📊 测试总结:');
    const hasType = latestPrompt.meta.type !== undefined;
    const hasScheduledTime = latestPrompt.meta.scheduled_time !== undefined;
    const isTask = latestPrompt.meta.type === 'TASK';
    
    if (isTask && hasScheduledTime) {
      console.log('✅ 任务创建成功！type 和 scheduled_time 字段都已正确保存');
    } else if (!isTask && !hasScheduledTime) {
      console.log('✅ 普通提示词创建成功！');
    } else if (isTask && !hasScheduledTime) {
      console.log('⚠️  任务类型正确，但缺少 scheduled_time 字段');
    } else {
      console.log('⚠️  字段状态异常');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

testTaskCreation();
