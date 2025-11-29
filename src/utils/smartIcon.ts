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
} from 'lucide-react';

export type SmartIconComponent = typeof Terminal;

function normalizeText(value: string) {
  return (value || '').toLowerCase();
}

export function getSmartIcon(title: string, tags: string[]): SmartIconComponent {
  const haystack = `${title || ''} ${(tags || []).join(' ')}`.toLowerCase();
  if (/(python|py\b|debug|终端|terminal|shell|cmd)/i.test(haystack)) return Terminal;
  if (/(sql|database|db|mysql|postgres|sqlite|索引|查询)/i.test(haystack)) return Database;
  if (/(design|ui|ux|figma|画|绘|设计|视觉)/i.test(haystack)) return Palette;
  if (/(write|writing|copywriting|文案|写作|essay|blog)/i.test(haystack)) return PenTool;
  if (/(mail|email|邮件)/i.test(haystack)) return Mail;
  if (/(chat|message|客服|对话)/i.test(haystack)) return MessageSquare;
  if (/(system|安全|security|auth|权限)/i.test(haystack)) return Shield;
  if (/(ai|llm|prompt|模型|gpt|agent)/i.test(haystack)) return Sparkles;
  if (/(cpu|性能|optimize|优化|算法)/i.test(haystack)) return Cpu;
  if (/(code|coding|js|ts|java|go|rust|c\+\+|c#|vue|react|node)/i.test(haystack)) return Code;
  return FileText;
}

function hashToIndex(input: string, mod: number) {
  const str = normalizeText(input);
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h % mod;
}

export function getSmartGradient(title: string, tags: string[]): [string, string] {
  const palette: Array<[string, string]> = [
    ['from-indigo-400', 'to-fuchsia-400'],
    ['from-emerald-400', 'to-cyan-400'],
    ['from-amber-400', 'to-rose-400'],
    ['from-sky-400', 'to-violet-400'],
    ['from-orange-400', 'to-yellow-300'],
    ['from-pink-400', 'to-indigo-400'],
  ];
  const seed = `${title || ''}|${(tags || []).join('|')}`;
  const idx = hashToIndex(seed, palette.length);
  return palette[idx];
}
