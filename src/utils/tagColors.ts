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

interface ColorStyleWithHex extends ColorStyle {
  hex: string;
}

// 精心挑选的颜色盘 - 符合 Pro Max 设计规范
const COLOR_PALETTE: ColorStyleWithHex[] = [
  // 蓝色系 - 技术、编程相关
  { bg: 'bg-blue-500/10', text: 'text-blue-300', border: 'border-blue-500/20', hex: '#3B82F6' },
  { bg: 'bg-indigo-500/10', text: 'text-indigo-300', border: 'border-indigo-500/20', hex: '#6366F1' },
  { bg: 'bg-sky-500/10', text: 'text-sky-300', border: 'border-sky-500/20', hex: '#0EA5E9' },
  
  // 绿色系 - 成功、自然相关
  { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/20', hex: '#10B981' },
  { bg: 'bg-teal-500/10', text: 'text-teal-300', border: 'border-teal-500/20', hex: '#14B8A6' },
  { bg: 'bg-green-500/10', text: 'text-green-300', border: 'border-green-500/20', hex: '#22C55E' },
  
  // 紫色系 - 创意、设计相关
  { bg: 'bg-purple-500/10', text: 'text-purple-300', border: 'border-purple-500/20', hex: '#A855F7' },
  { bg: 'bg-violet-500/10', text: 'text-violet-300', border: 'border-violet-500/20', hex: '#8B5CF6' },
  { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-300', border: 'border-fuchsia-500/20', hex: '#D946EF' },
  
  // 暖色系 - 警告、重要相关
  { bg: 'bg-orange-500/10', text: 'text-orange-300', border: 'border-orange-500/20', hex: '#F97316' },
  { bg: 'bg-amber-500/10', text: 'text-amber-300', border: 'border-amber-500/20', hex: '#F59E0B' },
  { bg: 'bg-yellow-500/10', text: 'text-yellow-300', border: 'border-yellow-500/20', hex: '#EAB308' },
  
  // 红色系 - 错误、紧急相关
  { bg: 'bg-red-500/10', text: 'text-red-300', border: 'border-red-500/20', hex: '#EF4444' },
  { bg: 'bg-rose-500/10', text: 'text-rose-300', border: 'border-rose-500/20', hex: '#F43F5E' },
  { bg: 'bg-pink-500/10', text: 'text-pink-300', border: 'border-pink-500/20', hex: '#EC4899' },
  
  // 青色系 - 信息、数据相关
  { bg: 'bg-cyan-500/10', text: 'text-cyan-300', border: 'border-cyan-500/20', hex: '#06B6D4' },
  
  // 中性色系 - 通用、其他
  { bg: 'bg-slate-500/10', text: 'text-slate-300', border: 'border-slate-500/20', hex: '#64748B' },
  { bg: 'bg-gray-500/10', text: 'text-gray-300', border: 'border-gray-500/20', hex: '#6B7280' },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = (hex || '').trim().replace('#', '');
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function mixHex(a: string, b: string, t: number): string {
  const ar = hexToRgb(a);
  const br = hexToRgb(b);
  if (!ar || !br) return a;
  const k = clamp01(t);
  const r = Math.round(ar.r + (br.r - ar.r) * k);
  const g = Math.round(ar.g + (br.g - ar.g) * k);
  const bl = Math.round(ar.b + (br.b - ar.b) * k);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const toLinear = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function pickIconForeground(stops: string[]): string {
  if (!stops.length) return 'rgba(0,0,0,0.9)';
  const avg = stops.map(relativeLuminance).reduce((a, b) => a + b, 0) / stops.length;
  return avg > 0.55 ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.92)';
}

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

export function getTagBaseHex(tag: string): string {
  if (!tag || typeof tag !== 'string') return '#64748B';
  const hash = hashString(tag);
  const colorIndex = hash % COLOR_PALETTE.length;
  return COLOR_PALETTE[colorIndex].hex;
}

export function getIconGradientConfig(tags: string[]): {
  backgroundImage: string;
  border: string;
  boxShadow: string;
  iconColor: string;
} {
  const safeTags = (tags || []).filter(Boolean);
  const baseColors = safeTags.slice(0, 3).map(getTagBaseHex);

  let stops: string[] = [];

  if (baseColors.length === 0) {
    // 无标签：保持“黑色图标”语义，背景用轻微的中性渐变
    stops = ['#F1F5F9', '#CBD5E1'];
  } else if (baseColors.length === 1) {
    const base = baseColors[0];
    const lum = relativeLuminance(base);
    const lighter = mixHex(base, '#FFFFFF', lum > 0.72 ? 0.08 : 0.22);
    const darker = mixHex(base, '#000000', lum < 0.18 ? 0.08 : 0.18);
    stops = lum > 0.78 ? [base, darker] : lum < 0.14 ? [lighter, base] : [lighter, darker];
  } else {
    stops = baseColors;
  }

  const backgroundImage =
    stops.length >= 3
      ? `linear-gradient(120deg, ${stops[0]} 0%, ${stops[1]} 50%, ${stops[2]} 100%)`
      : `linear-gradient(120deg, ${stops[0]} 0%, ${stops[1]} 100%)`;

  const main = stops[0];
  const iconColor = baseColors.length === 0 ? 'rgba(15,23,42,0.9)' : pickIconForeground(stops);
  const border = '1px solid rgba(255,255,255,0.12)';
  const boxShadow = `0 10px 24px ${mixHex(main, '#000000', 0.2)}66, 0 2px 6px ${main}40, inset 0 1px 1px rgba(255,255,255,0.28)`;

  return { backgroundImage, border, boxShadow, iconColor };
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