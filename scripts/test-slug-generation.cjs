/**
 * 测试 slug 生成逻辑
 */

function titleToSlug(title) {
  return title
    .trim()
    // 保留中文、英文、数字、空格、连字符
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s-]/g, '')
    // 空格和连字符替换为下划线
    .replace(/[\s-]+/g, '_')
    // 限制长度
    .substring(0, 100);
}

const titles = [
  "Python 代码审查助手",
  "React 组件设计师",
  "SQL 查询优化专家",
  "API 文档生成器",
  "每日站会提醒",
  "周报撰写",
  "技术博客写作助手",
  "Git 提交信息生成器",
  "面试题准备助手",
  "代码重构建议"
];

console.log('========================================');
console.log('Slug 生成测试');
console.log('========================================\n');

const slugs = new Map();

titles.forEach((title, index) => {
  const slug = titleToSlug(title);
  console.log(`[${index + 1}] "${title}"`);
  console.log(`    → "${slug}"`);
  
  if (slugs.has(slug)) {
    console.log(`    ⚠️  冲突！与 "${slugs.get(slug)}" 相同`);
  } else {
    slugs.set(slug, title);
  }
  console.log();
});

console.log('========================================');
console.log(`总计: ${titles.length} 个标题`);
console.log(`唯一 slug: ${slugs.size} 个`);
console.log(`冲突: ${titles.length - slugs.size} 个`);
console.log('========================================');
