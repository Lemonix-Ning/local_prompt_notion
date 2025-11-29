import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, Plus, Star, Trash2, MoreHorizontal, 
  ChevronRight, ChevronDown, Folder, Hash, 
  Layout, Settings, FileText, Clock, 
  Terminal, PenTool, Database, Mail, Code, 
  Sparkles, Copy, Check, Filter, Command
} from 'lucide-react';

/**
 * =================================================================
 * CUSTOM CSS & ANIMATIONS
 * 升级点：添加 Spotlight 聚光灯支持 & 网格背景
 * =================================================================
 */
const CustomStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    
    body {
      font-family: 'Inter', sans-serif;
      background-color: #09090b; /* Zinc 950 */
      color: #e4e4e7; /* Zinc 200 */
    }

    /* 1. 网格背景 (Grid Pattern) - 取代原本的噪点，增加工程秩序感 */
    .bg-grid {
      background-size: 40px 40px;
      background-image: linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
      mask-image: linear-gradient(to bottom, black 40%, transparent 100%);
    }

    /* 极光背景 - 更加柔和 */
    .aurora-bg {
      background: 
        radial-gradient(circle at 15% 50%, rgba(79, 70, 229, 0.08) 0%, transparent 40%),
        radial-gradient(circle at 85% 30%, rgba(236, 72, 153, 0.08) 0%, transparent 40%);
    }

    /* 隐藏滚动条 */
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

    /* 进场动画 */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in { animation: fadeIn 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
  `}</style>
);

/**
 * =================================================================
 * 核心组件：Spotlight Card (鼠标跟随发光卡片)
 * =================================================================
 */
const SpotlightCard = ({ children, className = "", onClick, style }) => {
  const divRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseEnter = () => setOpacity(1);
  const handleMouseLeave = () => setOpacity(0);

  return (
    <div
      ref={divRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative rounded-xl border border-white/10 bg-zinc-900/50 overflow-hidden group cursor-pointer transition-colors ${className}`}
      style={style}
    >
      {/* Spotlight Gradient Layer */}
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(255,255,255,0.06), transparent 40%)`,
        }}
      />
      {/* Content Layer */}
      <div className="relative h-full flex flex-col">
        {children}
      </div>
    </div>
  );
};

/**
 * 按钮组件 (保持不变)
 */
const Button = ({ variant = 'primary', size = 'md', className = '', children, icon: Icon, ...props }) => {
  const baseStyle = "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#09090b] focus:ring-indigo-500 disabled:opacity-50";
  const variants = {
    primary: "bg-white text-black hover:bg-zinc-200 shadow-[0_0_15px_rgba(255,255,255,0.1)]",
    ghost: "text-zinc-400 hover:text-white hover:bg-white/5",
    outline: "border border-white/10 text-zinc-300 hover:border-white/20 hover:bg-white/5",
  };
  const sizes = { sm: "text-xs px-2.5 py-1.5 h-8", md: "text-sm px-4 py-2 h-10", icon: "p-2 h-10 w-10" };
  return (
    <button className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {Icon && <Icon size={16} className={children ? "mr-2" : ""} />}
      {children}
    </button>
  );
};

const Tag = ({ label, color = 'zinc' }) => {
  const colors = {
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    zinc: "bg-zinc-800/50 text-zinc-400 border-zinc-700/50",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${colors[color] || colors.zinc} backdrop-blur-sm`}>
      {label}
    </span>
  );
};

/**
 * =================================================================
 * MOCK DATA
 * =================================================================
 */
const CATEGORIES = [
  { id: 'c1', name: 'Coding', count: 9 },
  { id: 'c2', name: 'Business', count: 1 },
  { id: 'c3', name: 'Creative Writing', count: 2 },
  { id: 'c4', name: 'System', count: 4 },
];

const PROMPTS = [
  { 
    id: 1, 
    title: 'Python 调试助手', 
    desc: '帮助快速定位 Python 代码中的 Bug，分析 Traceback 并给出修复建议。',
    tags: ['Coding', 'Python'], 
    color: 'blue',
    icon: Terminal,
    date: '2026/1/10',
    isFavorite: true
  },
  { 
    id: 2, 
    title: '小红书文案生成', 
    desc: '生成吸引眼球的小红书标题和正文，包含 Emoji 和常用的种草关键词。',
    tags: ['Business', 'Writing'], 
    color: 'purple',
    icon: PenTool,
    date: '2026/1/10',
    isFavorite: true
  },
  { 
    id: 3, 
    title: 'SQL 优化专家', 
    desc: '分析 SQL 语句的执行计划，检查索引覆盖情况，并提供优化重写方案。',
    tags: ['Coding', 'Database'], 
    color: 'orange',
    icon: Database,
    date: '2025/12/29',
    isFavorite: false
  },
  { 
    id: 4, 
    title: '英文邮件润色', 
    desc: '让商务邮件听起来更专业、礼貌且地道，修正语法错误。',
    tags: ['English', 'Business'], 
    color: 'green',
    icon: Mail,
    date: '2025/11/29',
    isFavorite: false
  },
  { 
    id: 5, 
    title: 'Vue3 组件模板', 
    desc: '生成标准的 Vue3 Composition API 组件结构，包含 TypeScript 定义。',
    tags: ['Coding', 'Vue'], 
    color: 'blue',
    icon: Code,
    date: '2025/11/29',
    isFavorite: false
  },
];

export default function ProMaxSpotlight() {
  const [selectedNav, setSelectedNav] = useState('all');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const handleCopy = (id, e) => {
    e.stopPropagation();
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex h-screen w-full bg-[#09090b] text-zinc-200 overflow-hidden relative selection:bg-indigo-500/30">
      <CustomStyles />
      
      {/* 2. 背景升级：工程网格 + 极光 */}
      <div className="absolute inset-0 bg-grid pointer-events-none z-0 opacity-20"></div>
      <div className="absolute inset-0 aurora-bg pointer-events-none z-0"></div>

      {/* --- Sidebar --- */}
      <aside className={`
        relative z-10 flex flex-col border-r border-white/5 bg-[#09090b]/80 backdrop-blur-xl transition-all duration-300
        ${sidebarCollapsed ? 'w-20 items-center' : 'w-64'}
      `}>
        <div className={`h-16 flex items-center px-5 ${sidebarCollapsed ? 'justify-center px-0' : 'justify-between'}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white to-zinc-400 flex items-center justify-center shadow-lg shadow-white/5">
              <span className="font-bold text-black text-sm">P</span>
            </div>
            {!sidebarCollapsed && <span className="font-semibold text-zinc-100 tracking-tight">Prompt Notion</span>}
          </div>
          {!sidebarCollapsed && (
             <button onClick={() => setSidebarCollapsed(true)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
               <ChevronDown className="rotate-90 w-4 h-4" />
             </button>
          )}
        </div>

        <div className="flex-1 py-4 px-3 space-y-6 overflow-y-auto no-scrollbar">
          <div className="space-y-1">
            <NavItem icon={Layout} label="全部提示词" active={selectedNav === 'all'} collapsed={sidebarCollapsed} onClick={() => setSelectedNav('all')} count={16} />
            <NavItem icon={Star} label="收藏夹" active={selectedNav === 'fav'} collapsed={sidebarCollapsed} onClick={() => setSelectedNav('fav')} count={6} />
            <NavItem icon={Trash2} label="回收站" active={selectedNav === 'trash'} collapsed={sidebarCollapsed} onClick={() => setSelectedNav('trash')} />
          </div>

          <div className="space-y-1">
             {!sidebarCollapsed && (
               <div className="px-3 pb-2 pt-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider font-mono flex items-center justify-between group">
                 <span>Categories</span>
                 <Plus className="w-3 h-3 cursor-pointer hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity" />
               </div>
             )}
             {CATEGORIES.map(cat => (
               <NavItem key={cat.id} icon={Hash} label={cat.name} active={selectedNav === cat.id} collapsed={sidebarCollapsed} onClick={() => setSelectedNav(cat.id)} count={cat.count} isCategory />
             ))}
          </div>
        </div>

        <div className="p-4 border-t border-white/5">
          <NavItem icon={Settings} label="设置" collapsed={sidebarCollapsed} />
        </div>

        {sidebarCollapsed && (
          <button onClick={() => setSidebarCollapsed(false)} className="absolute top-6 -right-3 w-6 h-6 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-500 transition-all z-50">
            <ChevronRight size={12} />
          </button>
        )}
      </aside>

      {/* --- Main --- */}
      <main className="flex-1 flex flex-col relative z-0 overflow-hidden">
        
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#09090b]/50 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
             <span className="hover:text-zinc-300 cursor-pointer transition-colors">Workspace</span>
             <ChevronRight size={14} />
             <span className="text-zinc-200 font-medium">
               {selectedNav === 'all' ? '全部提示词' : selectedNav === 'fav' ? '收藏夹' : selectedNav === 'trash' ? '回收站' : CATEGORIES.find(c => c.id === selectedNav)?.name}
             </span>
          </div>

          <div className="flex items-center gap-4">
            {/* 3. 搜索框升级：增加 Command 图标，视觉上模仿 ⌘K 菜单 */}
            <div className="relative group w-64 hidden sm:block">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
              <input 
                type="text" 
                placeholder="搜索..." 
                className="block w-full pl-9 pr-10 py-1.5 bg-zinc-900/50 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-zinc-600 border border-white/5 rounded px-1.5 py-0.5 bg-white/5 pointer-events-none">
                <Command size={10} />
                <span className="text-[10px] font-sans">K</span>
              </div>
            </div>
            <div className="h-4 w-[1px] bg-white/10 hidden sm:block"></div>
            <Button variant="primary" size="sm" icon={Plus}>新建页面</Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8 no-scrollbar scroll-smooth">
          <div className="max-w-6xl mx-auto space-y-6">
            
            <div className="flex items-center justify-between pb-4">
               <h1 className="text-2xl font-bold text-white tracking-tight animate-fade-in">
                 {selectedNav === 'all' ? '我的提示词库' : selectedNav === 'fav' ? '我的收藏' : '分类浏览'}
               </h1>
               <div className="flex items-center gap-2 text-zinc-500 text-xs hover:text-zinc-300 cursor-pointer transition-colors">
                 <Filter size={14} />
                 <span>排序与筛选</span>
               </div>
            </div>

            {/* 4. 网格升级：使用 SpotlightCard 替换普通 Div */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {PROMPTS.map((prompt, idx) => (
                <SpotlightCard 
                  key={prompt.id} 
                  className="flex flex-col h-[200px] p-5"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex justify-between items-start relative z-10 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`
                        w-10 h-10 rounded-lg border border-white/10 flex items-center justify-center
                        bg-zinc-800/50 text-zinc-400 group-hover:text-white group-hover:border-white/20 transition-all
                      `}>
                        <prompt.icon size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-zinc-200 truncate group-hover:text-indigo-300 transition-colors">
                          {prompt.title}
                        </h3>
                      </div>
                    </div>
                    <button className={`transition-colors relative z-20 ${prompt.isFavorite ? 'text-yellow-400' : 'text-zinc-600 hover:text-zinc-400'}`}>
                      <Star size={16} fill={prompt.isFavorite ? "currentColor" : "none"} />
                    </button>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3 mb-4 flex-1">
                    {prompt.desc}
                  </p>

                  <div className="pt-4 border-t border-white/5 flex items-end justify-between mt-auto">
                     <div className="flex flex-wrap gap-1.5">
                        {prompt.tags.slice(0, 2).map(tag => (
                          <Tag key={tag} label={tag} color={prompt.color} />
                        ))}
                     </div>
                     <div className="flex flex-col items-end gap-1 relative z-20">
                       <span className="text-[10px] text-zinc-600 font-mono">{prompt.date}</span>
                       <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                          <button onClick={(e) => handleCopy(prompt.id, e)} className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-200" title="复制">
                             {copiedId === prompt.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                          </button>
                          <button className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-red-400" title="删除"><Trash2 size={12} /></button>
                       </div>
                     </div>
                  </div>
                </SpotlightCard>
              ))}

              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.01] flex flex-col items-center justify-center text-zinc-600 hover:text-zinc-300 hover:border-white/20 hover:bg-white/[0.03] transition-all cursor-pointer h-[200px] group">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                   <Plus size={20} />
                </div>
                <span className="text-xs font-medium">创建新提示词</span>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

const NavItem = ({ icon: Icon, label, active, collapsed, count, onClick, isCategory }) => (
  <div onClick={onClick} className={`group flex items-center px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 relative select-none ${active ? 'bg-white/5 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'} ${collapsed ? 'justify-center' : 'justify-between'}`}>
    <div className="flex items-center gap-3 overflow-hidden">
      <Icon size={isCategory ? 16 : 18} className={`flex-shrink-0 transition-colors ${active ? 'text-indigo-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
      {!collapsed && <span className={`text-sm truncate ${isCategory ? 'font-normal' : 'font-medium'}`}>{label}</span>}
    </div>
    {!collapsed && count !== undefined && <span className={`text-[10px] px-1.5 py-0.5 rounded ${active ? 'bg-indigo-500/20 text-indigo-300' : 'bg-zinc-800 text-zinc-500'}`}>{count}</span>}
    {collapsed && <div className="absolute left-14 bg-zinc-800 text-zinc-200 text-xs px-2 py-1 rounded border border-white/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl">{label}</div>}
  </div>
);