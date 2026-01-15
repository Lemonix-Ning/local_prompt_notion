/**
 * Smart Icon Matcher (智能图标匹配器)
 * 
 * 基于"语义映射字典"的图标自动匹配系统。
 * 支持多语言（中英文）、同义词和模糊匹配，
 * 能根据卡片的标题或标签自动分配最合适的图标。
 * 
 * 核心原理：
 * 1. 语义分组 (Semantic Grouping): 将意义相近的词汇打包成一个组，映射到同一个图标
 * 2. 混合匹配 (Hybrid Matching): 同时扫描卡片的 title 和 tags
 * 3. 字典遍历 (Dictionary Traversal): 遍历预定义的规则表，命中即返回
 */

import {
  Terminal,
  Code,
  Database,
  PenTool,
  Palette,
  Cpu,
  MessageSquare,
  Mail,
  FileText,
  Shield,
  Sparkles,
  ImageIcon,
  Globe,
  BookOpen,
  Briefcase,
  Calculator,
  Camera,
  Cloud,
  Coffee,
  Cog,
  FileCode,
  Folder,
  GitBranch,
  Heart,
  Home,
  Layers,
  Layout,
  Link,
  List,
  Lock,
  Map,
  Music,
  Package,
  Phone,
  Play,
  Search,
  Server,
  Settings,
  Share,
  ShoppingCart,
  Star,
  Tag,
  Target,
  Trash,
  TrendingUp,
  User,
  Users,
  Video,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export type SmartIconComponent = LucideIcon;

/**
 * 图标规则配置
 * 
 * 扩展性说明：
 * - 添加新词：只需在对应 keywords 数组中追加字符串即可
 * - 优先级：数组越靠前的规则优先级越高
 *   例如，如果想让 "AI Code" 显示为 AI 图标而不是 Code 图标，
 *   应将 AI 规则放在 Code 规则之前
 */
interface IconRule {
  icon: SmartIconComponent;
  keywords: string[];
}

const ICON_RULES: IconRule[] = [
  // ========== AI 与智能 (最高优先级) ==========
  {
    icon: Sparkles,
    keywords: [
      'ai', 'gpt', 'llm', 'chatgpt', 'claude', 'gemini', 'copilot',
      'prompt', 'agent', 'model', 'neural', 'ml', 'machine learning',
      'deep learning', 'transformer', 'embedding',
      '智能', '人工智能', '模型', '提示词', '大模型', '神经网络',
      'animate', 'motion', 'magic', '动效', '动画'
    ],
  },

  // ========== 开发与技术 ==========
  {
    icon: Terminal,
    keywords: [
      'terminal', 'bash', 'shell', 'cli', 'cmd', 'powershell', 'zsh',
      'command', 'console',
      '终端', '命令行', '控制台'
    ],
  },
  {
    icon: Code,
    keywords: [
      'code', 'coding', 'programming', 'dev', 'developer',
      'python', 'javascript', 'typescript', 'java', 'go', 'rust',
      'c++', 'c#', 'php', 'ruby', 'swift', 'kotlin',
      'vue', 'react', 'angular', 'node', 'next', 'nuxt',
      'html', 'css', 'sass', 'less',
      'api', 'sdk', 'framework', 'library',
      '代码', '编程', '开发', '程序', '脚本', '函数', '变量'
    ],
  },
  {
    icon: FileCode,
    keywords: [
      'script', 'snippet', 'template', 'boilerplate',
      '脚本', '模板', '代码片段'
    ],
  },
  {
    icon: GitBranch,
    keywords: [
      'git', 'github', 'gitlab', 'bitbucket', 'version', 'branch',
      'commit', 'merge', 'pull request', 'pr',
      '版本', '分支', '提交', '合并'
    ],
  },
  {
    icon: Database,
    keywords: [
      'sql', 'database', 'db', 'mysql', 'postgres', 'postgresql',
      'sqlite', 'mongodb', 'mongo', 'redis', 'elasticsearch',
      'query', 'table', 'index', 'schema',
      '数据库', '数据', '查询', '索引', '表', '库'
    ],
  },
  {
    icon: Server,
    keywords: [
      'server', 'backend', 'api', 'rest', 'graphql', 'microservice',
      'docker', 'kubernetes', 'k8s', 'nginx', 'apache',
      '服务器', '后端', '服务', '部署', '运维'
    ],
  },
  {
    icon: Cloud,
    keywords: [
      'cloud', 'aws', 'azure', 'gcp', 'aliyun', 'tencent cloud',
      'serverless', 'lambda', 'cdn', 'storage',
      '云', '云服务', '云计算', '存储'
    ],
  },
  {
    icon: Cpu,
    keywords: [
      'cpu', 'performance', 'optimize', 'algorithm', 'benchmark',
      'memory', 'cache', 'thread', 'process',
      '性能', '优化', '算法', '内存', '缓存', '线程'
    ],
  },

  // ========== 设计与视觉 ==========
  {
    icon: Palette,
    keywords: [
      'color', 'design', 'ui', 'ux', 'theme', 'style',
      'css', 'tailwind', 'bootstrap', 'material',
      'figma', 'sketch', 'adobe', 'photoshop',
      '颜色', '设计', '界面', '主题', '样式', '调色', '配色', '美化'
    ],
  },
  {
    icon: ImageIcon,
    keywords: [
      'image', 'photo', 'picture', 'logo', 'icon', 'svg', 'png', 'jpg',
      'draw', 'illustration', 'graphic', 'visual',
      'midjourney', 'stable diffusion', 'dall-e', 'dalle',
      '图', '图片', '图像', '画', '照片', '插画', '绘图', '视觉'
    ],
  },
  {
    icon: Layout,
    keywords: [
      'layout', 'grid', 'flex', 'responsive', 'mobile', 'desktop',
      'wireframe', 'prototype', 'mockup',
      '布局', '排版', '响应式', '原型'
    ],
  },
  {
    icon: Video,
    keywords: [
      'video', 'movie', 'film', 'youtube', 'tiktok', 'stream',
      'animation', 'motion', 'edit',
      '视频', '电影', '影片', '剪辑', '直播'
    ],
  },
  {
    icon: Camera,
    keywords: [
      'camera', 'photography', 'shoot', 'lens',
      '相机', '摄影', '拍摄', '镜头'
    ],
  },
  {
    icon: Music,
    keywords: [
      'music', 'audio', 'sound', 'song', 'podcast', 'voice',
      'spotify', 'apple music',
      '音乐', '音频', '声音', '歌曲', '播客', '语音'
    ],
  },

  // ========== 写作与内容 ==========
  {
    icon: PenTool,
    keywords: [
      'write', 'writing', 'copywriting', 'content', 'article',
      'blog', 'post', 'essay', 'story', 'novel',
      'editor', 'draft', 'publish',
      '写作', '文案', '文章', '博客', '故事', '小说', '编辑', '创作'
    ],
  },
  {
    icon: BookOpen,
    keywords: [
      'book', 'read', 'reading', 'learn', 'study', 'education',
      'course', 'tutorial', 'guide', 'documentation', 'doc',
      '书', '阅读', '学习', '教程', '文档', '指南', '教育'
    ],
  },
  {
    icon: Globe,
    keywords: [
      'translate', 'translation', 'language', 'english', 'chinese',
      'japanese', 'korean', 'spanish', 'french', 'german',
      'i18n', 'localization', 'multilingual',
      '翻译', '语言', '英语', '中文', '日语', '韩语', '多语言', '国际化'
    ],
  },

  // ========== 通讯与社交 ==========
  {
    icon: MessageSquare,
    keywords: [
      'chat', 'message', 'conversation', 'dialog', 'talk',
      'customer service', 'support', 'bot', 'chatbot',
      'slack', 'discord', 'telegram', 'wechat', 'whatsapp',
      '聊天', '对话', '消息', '客服', '沟通', '交流', '机器人'
    ],
  },
  {
    icon: Mail,
    keywords: [
      'mail', 'email', 'newsletter', 'inbox', 'outlook', 'gmail',
      '邮件', '邮箱', '信件', '通知'
    ],
  },
  {
    icon: Phone,
    keywords: [
      'phone', 'call', 'mobile', 'sms', 'text',
      '电话', '手机', '短信', '通话'
    ],
  },
  {
    icon: Share,
    keywords: [
      'share', 'social', 'twitter', 'facebook', 'instagram', 'linkedin',
      'weibo', 'xiaohongshu', 'douyin',
      '分享', '社交', '微博', '小红书', '抖音', '朋友圈'
    ],
  },
  {
    icon: Users,
    keywords: [
      'team', 'group', 'community', 'collaborate', 'meeting',
      'zoom', 'teams', 'conference',
      '团队', '群组', '社区', '协作', '会议'
    ],
  },
  {
    icon: User,
    keywords: [
      'user', 'profile', 'account', 'personal', 'bio', 'resume', 'cv',
      '用户', '个人', '简历', '账户', '档案'
    ],
  },

  // ========== 商业与工作 ==========
  {
    icon: Briefcase,
    keywords: [
      'business', 'work', 'job', 'career', 'office', 'corporate',
      'enterprise', 'company', 'startup',
      '商业', '工作', '职业', '办公', '企业', '公司', '创业'
    ],
  },
  {
    icon: TrendingUp,
    keywords: [
      'marketing', 'seo', 'growth', 'analytics', 'data', 'report',
      'chart', 'graph', 'statistics', 'kpi', 'metric',
      '营销', '增长', '分析', '数据', '报告', '统计', '指标'
    ],
  },
  {
    icon: ShoppingCart,
    keywords: [
      'shop', 'shopping', 'ecommerce', 'store', 'product', 'sell',
      'buy', 'order', 'cart', 'checkout',
      '购物', '电商', '商店', '产品', '销售', '订单'
    ],
  },
  {
    icon: Calculator,
    keywords: [
      'calculate', 'math', 'finance', 'accounting', 'budget', 'tax',
      'invoice', 'payment', 'money', 'price',
      '计算', '数学', '财务', '会计', '预算', '税', '发票', '支付', '金钱'
    ],
  },

  // ========== 安全与系统 ==========
  {
    icon: Shield,
    keywords: [
      'security', 'secure', 'protect', 'privacy', 'auth', 'authentication',
      'permission', 'role', 'access', 'firewall', 'encrypt',
      '安全', '保护', '隐私', '认证', '权限', '加密', '防护'
    ],
  },
  {
    icon: Lock,
    keywords: [
      'lock', 'password', 'credential', 'secret', 'key', 'token',
      '锁', '密码', '密钥', '凭证', '令牌'
    ],
  },
  {
    icon: Settings,
    keywords: [
      'setting', 'config', 'configuration', 'preference', 'option',
      'admin', 'manage', 'control',
      '设置', '配置', '选项', '管理', '控制'
    ],
  },
  {
    icon: Cog,
    keywords: [
      'tool', 'utility', 'helper', 'automation', 'workflow',
      '工具', '实用', '自动化', '工作流'
    ],
  },

  // ========== 其他常用 ==========
  {
    icon: Search,
    keywords: [
      'search', 'find', 'query', 'lookup', 'filter',
      '搜索', '查找', '检索', '过滤'
    ],
  },
  {
    icon: Link,
    keywords: [
      'link', 'url', 'href', 'redirect', 'shortlink',
      '链接', '网址', '跳转', '短链'
    ],
  },
  {
    icon: List,
    keywords: [
      'list', 'todo', 'task', 'checklist', 'agenda',
      '列表', '待办', '任务', '清单', '日程'
    ],
  },
  {
    icon: Target,
    keywords: [
      'goal', 'target', 'objective', 'plan', 'strategy',
      '目标', '计划', '策略', '规划'
    ],
  },
  {
    icon: Star,
    keywords: [
      'favorite', 'star', 'bookmark', 'save', 'collect',
      '收藏', '喜欢', '书签', '保存'
    ],
  },
  {
    icon: Heart,
    keywords: [
      'love', 'like', 'emotion', 'feeling', 'health', 'wellness',
      '爱', '喜欢', '情感', '健康', '心理'
    ],
  },
  {
    icon: Home,
    keywords: [
      'home', 'house', 'family', 'life', 'lifestyle',
      '家', '房子', '家庭', '生活'
    ],
  },
  {
    icon: Map,
    keywords: [
      'map', 'location', 'place', 'travel', 'trip', 'tour',
      'navigation', 'gps',
      '地图', '位置', '地点', '旅行', '旅游', '导航'
    ],
  },
  {
    icon: Coffee,
    keywords: [
      'coffee', 'break', 'rest', 'relax', 'casual',
      '咖啡', '休息', '放松', '休闲'
    ],
  },
  {
    icon: Zap,
    keywords: [
      'fast', 'quick', 'speed', 'instant', 'flash', 'power',
      '快速', '闪电', '极速', '能量'
    ],
  },
  {
    icon: Play,
    keywords: [
      'play', 'game', 'gaming', 'entertainment', 'fun',
      '播放', '游戏', '娱乐', '玩'
    ],
  },
  {
    icon: Package,
    keywords: [
      'package', 'npm', 'yarn', 'pip', 'cargo', 'bundle',
      'dependency', 'module',
      '包', '依赖', '模块', '打包'
    ],
  },
  {
    icon: Layers,
    keywords: [
      'layer', 'stack', 'tier', 'level', 'architecture',
      '层', '堆栈', '架构', '层级'
    ],
  },
  {
    icon: Folder,
    keywords: [
      'folder', 'directory', 'file', 'document', 'archive',
      '文件夹', '目录', '文件', '文档', '归档'
    ],
  },
  {
    icon: Tag,
    keywords: [
      'tag', 'label', 'category', 'classify',
      '标签', '分类', '类别'
    ],
  },
  {
    icon: Trash,
    keywords: [
      'trash', 'delete', 'remove', 'clean', 'clear',
      '回收站', '删除', '清理', '清除'
    ],
  },
];

/**
 * 智能图标匹配函数
 * 
 * @param title - 提示词标题
 * @param tags - 提示词标签数组
 * @returns 匹配的图标组件
 * 
 * @example
 * const Icon = getSmartIcon('Python 调试助手', ['Dev', 'Debug']);
 * // 返回 Terminal 图标
 * 
 * @example
 * const Icon = getSmartIcon('AI 写作助手', ['GPT', 'Writing']);
 * // 返回 Sparkles 图标 (AI 优先级高于 Writing)
 */
export function getSmartIcon(title: string, tags: string[]): SmartIconComponent {
  // 1. 合并标题和标签，转为小写，方便匹配
  // 例如：title="Python助手", tags=["Dev"] -> text="python助手 dev"
  const text = `${title || ''} ${(tags || []).join(' ')}`.toLowerCase();

  // 2. 遍历规则表
  for (const rule of ICON_RULES) {
    // 3. Array.some() 只要命中一个关键词即返回 true
    if (rule.keywords.some(keyword => text.includes(keyword))) {
      return rule.icon;
    }
  }

  // 4. 默认回退图标
  return FileText;
}

/**
 * 文本标准化函数
 */
function normalizeText(value: string): string {
  return (value || '').toLowerCase();
}

/**
 * 哈希函数，用于生成确定性的索引
 */
function hashToIndex(input: string, mod: number): number {
  const str = normalizeText(input);
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h % mod;
}

/**
 * 智能渐变色匹配函数
 * 
 * 根据标题和标签生成确定性的渐变色配置
 * 相同的输入永远返回相同的渐变色
 * 
 * @param title - 提示词标题
 * @param tags - 提示词标签数组
 * @returns 渐变色 Tailwind 类名元组 [from, to]
 */
export function getSmartGradient(title: string, tags: string[]): [string, string] {
  const palette: Array<[string, string]> = [
    ['from-indigo-400', 'to-fuchsia-400'],
    ['from-emerald-400', 'to-cyan-400'],
    ['from-amber-400', 'to-rose-400'],
    ['from-sky-400', 'to-violet-400'],
    ['from-orange-400', 'to-yellow-300'],
    ['from-pink-400', 'to-indigo-400'],
    ['from-teal-400', 'to-blue-400'],
    ['from-rose-400', 'to-orange-400'],
    ['from-violet-400', 'to-purple-400'],
    ['from-lime-400', 'to-emerald-400'],
  ];
  const seed = `${title || ''}|${(tags || []).join('|')}`;
  const idx = hashToIndex(seed, palette.length);
  return palette[idx];
}

/**
 * 导出图标规则配置，供外部扩展使用
 */
export { ICON_RULES };
export type { IconRule };
