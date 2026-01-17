/**
 * 测试置顶功能
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testPinFeature() {
  try {
    console.log('🧪 测试置顶功能...\n');

    // 1. 扫描 vault
    console.log('1️⃣ 扫描 vault...');
    const scanRes = await axios.get(`${API_BASE}/vault/scan`, {
      params: { path: './vault' }
    });
    
    const allPrompts = Array.from(Object.values(scanRes.data.allPrompts || {}));
    if (allPrompts.length === 0) {
      console.log('❌ 没有找到提示词');
      return;
    }

    const testPrompt = allPrompts[0];
    console.log(`✅ 找到测试提示词: ${testPrompt.meta.title} (ID: ${testPrompt.meta.id})`);
    console.log(`   当前置顶状态: ${testPrompt.meta.is_pinned || false}\n`);

    // 2. 读取提示词
    console.log('2️⃣ 读取提示词详情...');
    const readRes = await axios.get(`${API_BASE}/prompts/${testPrompt.meta.id}`);
    console.log(`✅ 读取成功`);
    console.log(`   is_pinned: ${readRes.data.meta.is_pinned}\n`);

    // 3. 切换置顶状态
    const newPinnedState = !readRes.data.meta.is_pinned;
    console.log(`3️⃣ 切换置顶状态: ${readRes.data.meta.is_pinned} → ${newPinnedState}...`);
    
    const updateData = {
      ...readRes.data,
      meta: {
        ...readRes.data.meta,
        is_pinned: newPinnedState
      }
    };

    const updateRes = await axios.put(`${API_BASE}/prompts/${testPrompt.meta.id}`, updateData);
    console.log(`✅ 更新成功`);
    console.log(`   新的 is_pinned: ${updateRes.data.meta.is_pinned}\n`);

    // 4. 再次读取验证
    console.log('4️⃣ 验证更新...');
    const verifyRes = await axios.get(`${API_BASE}/prompts/${testPrompt.meta.id}`);
    console.log(`✅ 验证成功`);
    console.log(`   is_pinned: ${verifyRes.data.meta.is_pinned}`);

    if (verifyRes.data.meta.is_pinned === newPinnedState) {
      console.log('\n✅ 置顶功能测试通过！');
    } else {
      console.log('\n❌ 置顶状态未正确保存');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error.response?.data || error.message);
  }
}

testPinFeature();
