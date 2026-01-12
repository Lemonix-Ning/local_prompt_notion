/**
 * 标签颜色工具 - 确定性哈希颜色系统
 * 
 * 特点：
 * - 零配置：自动为任何标签分配颜色
 * - 一致性：相同标签永远是相同颜色
 * - 美观：精心挑选的 Pro Max 设计规范颜色盘
 */

interface ColorStyle {
  bg: string;
  text: string;
  border: string;
}

// 精心挑选的颜色盘 - 符合 Pro Max 设计规范
const COLOR_PALETTE: ColorStyle[] = [
  // 蓝色系 - 技术、编程相关
  { bg: 'bg-blue-500/10', text: 'text-blue-300', border: 'border-blue-500/20' },
  { bg: 'bg-indigo-500/10', text: 'text-indigo-300', border: 'border-indigo-500/20' },
  { bg: 'bg-sky-500/10', text: 'text-sky-300', border: 'border-sky-500/20' },
  
  // 绿色系 - 成功、自然相关
  { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/20' },
  { bg: 'bg-teal-500/10', text: 'text-teal-300', border: 'border-teal-500/20' },
  { bg: 'bg-green-500/10', text: 'text-green-300', border: 'border-green-500/20' },
  
  // 紫色系 - 创意、设计相关
  { bg: 'bg-purple-500/10', text: 'text-purple-300', border: 'border-purple-500/20' },
  { bg: 'bg-violet-500/10', text: 'text-violet-300', border: 'border-violet-500/20' },
  { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-300', border: 'border-fuchsia-500/20' },
  
  // 暖色系 - 警告、重要相关
  { bg: 'bg-orange-500/10', text: 'text-orange-300', border: 'border-orange-500/20' },
  { bg: 'bg-amber-500/10', text: 'text-amber-300', border: 'border-amber-500/20' },
  { bg: 'bg-yellow-500/10', text: 'text-yellow-300', border: 'border-yellow-500/20' },
  
  // 红色系 - 错误、紧急相关
  { bg: 'bg-red-500/10', text: 'text-red-300', border: 'border-red-500/20' },
  { bg: 'bg-rose-500/10', text: 'text-rose-300', border: 'border-rose-500/20' },
  { bg: 'bg-pink-500/10', text: 'text-pink-300', border: 'border-pink-500/20' },
  
  // 青色系 - 信息、数据相关
  { bg: 'bg-cyan-500/10', text: 'text-cyan-300', border: 'border-cyan-500/20' },
  
  // 中性色系 - 通用、其他
  { bg: 'bg-slate-500/10', text: 'text-slate-300', border: 'border-slate-500/20' },
  { bg: 'bg-gray-500/10', text: 'text-gray-300', border: 'border-gray-500/20' },
];

/**
 * 简单但有效的字符串哈希函数
 * 基于 djb2 算法的变体
 */
function hashString(str: string): number {
  let hash = 5381;
  const normalizedStr = str.toLowerCase().trim();
  
  for (let i = 0; i < normalizedStr.length; i++) {
    const char = normalizedStr.charCodeAt(i);
    hash = ((hash << 5) + hash) + char; // hash * 33 + char
  }
  
  return Math.abs(hash);
}

/**
 * 根据标签名称获取确定性的颜色样式
 * 
 * @param tag 标签名称
 * @returns Tailwind CSS 类名字符串
 * 
 * @example
 * getTagStyle('Python') // 永远返回相同的蓝色系
 * getTagStyle('React') // 永远返回相同的青色系
 * getTagStyle('Design') // 永远返回相同的紫色系
 */
export function getTagStyle(tag: string): string {
  if (!tag || typeof tag !== 'string') {
    // 默认样式用于无效输入
    return 'bg-muted text-muted-foreground border-border';
  }

  const hash = hashString(tag);
  const colorIndex = hash % COLOR_PALETTE.length;
  const selectedColor = COLOR_PALETTE[colorIndex];
  
  return `${selectedColor.bg} ${selectedColor.text} ${selectedColor.border}`;
}

/**
 * 获取标签的颜色对象（用于更复杂的场景）
 */
export function getTagColorObject(tag: string): ColorStyle {
  if (!tag || typeof tag !== 'string') {
    return { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' };
  }

  const hash = hashString(tag);
  const colorIndex = hash % COLOR_PALETTE.length;
  return COLOR_PALETTE[colorIndex];
}

/**
 * 预览所有可能的标签颜色（用于调试）
 */
export function previewTagColors(): Array<{ tag: string; style: string; color: ColorStyle }> {
  const sampleTags = [
    'Python', 'JavaScript', 'React', 'Vue', 'Angular', 'Node.js',
    'Design', 'UI/UX', 'Figma', 'Sketch', 'Adobe',
    'Writing', 'Blog', 'Content', 'Marketing', 'SEO',
    'Business', 'Strategy', 'Finance', 'Analytics',
    'AI', 'Machine Learning', 'Data Science', 'Deep Learning',
    'DevOps', 'Docker', 'Kubernetes', 'AWS', 'Cloud'
  ];

  return sampleTags.map(tag => ({
    tag,
    style: getTagStyle(tag),
    color: getTagColorObject(tag)
  }));
}