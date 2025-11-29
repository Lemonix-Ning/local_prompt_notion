/**
 * PromptList 组件
 * Notion 风格的卡片网格布局
 */

import {
  Plus,
  Search,
  Copy,
  Star,
  Trash2,
  Menu,
  MoreHorizontal,
  X,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../AppContext';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EditorPage } from './EditorPage';
import api from '../api/client';
import { getSmartGradient, getSmartIcon } from '../utils/smartIcon';

function SpotlightCard({
  children,
  className,
  onDoubleClick,
}: {
  children: ReactNode;
  className?: string;
  onDoubleClick?: () => void;
}) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  return (
    <div
      onDoubleClick={onDoubleClick}
      onMouseMove={(e) => {
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={`relative rounded-xl border border-white/10 bg-zinc-900/50 overflow-hidden group transition-colors ${className || ''}`}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(255,255,255,0.06), transparent 40%)`,
        }}
      />
      <div className="relative h-full flex flex-col">{children}</div>
    </div>
  );
}

const getTagColor = (tag: string) => {
  const colors: Record<string, string> = {
    coding: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
    python: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
    react: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
    art: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
    writing: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    business: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20',
  };
  const key = tag.toLowerCase();
  return colors[key] || 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50';
};

export function PromptList() {
  const { state, dispatch, getFilteredPrompts, createPrompt, savePrompt, deletePrompt, restorePrompt } = useApp();
  const { searchQuery, selectedCategory } = state;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSwitchingList, setIsSwitchingList] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');
  const categoryPopoverRef = useRef<HTMLDivElement | null>(null);
  const [newPrompt, setNewPrompt] = useState({ 
    title: '', 
    content: '', 
    category: '', 
    tags: '' 
  });
  const [toast, setToast] = useState<string | null>(null);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [trashCounts, setTrashCounts] = useState<Record<string, number>>({});
  const trashThreshold = 10;

  const prompts = getFilteredPrompts();

  useEffect(() => {
    if (!isModalOpen) {
      setIsCategoryOpen(false);
      setCategoryQuery('');
    }
  }, [isModalOpen]);

  useEffect(() => {
    if (!isCategoryOpen) return;

    const onMouseDown = (e: MouseEvent) => {
      const el = categoryPopoverRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setIsCategoryOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCategoryOpen(false);
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isCategoryOpen]);

  useEffect(() => {
    setIsSwitchingList(true);
    const t = window.setTimeout(() => setIsSwitchingList(false), 120);
    return () => window.clearTimeout(t);
  }, [selectedCategory, searchQuery, state.filterTags, state.sortBy]);

  useEffect(() => {
    if (selectedCategory !== 'trash') {
      return;
    }
    if (state.fileSystem?.root === '/vault') {
      return;
    }

    let cancelled = false;
    (async () => {
      const response = await api.trash.status(trashThreshold);
      if (cancelled) return;
      if (!response.success || !response.data) {
        setTrashCounts({});
        return;
      }
      setTrashCounts((response.data as any).counts || {});
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCategory, state.fileSystem?.root]);

  const getTrashItemName = (promptPath: string): string | null => {
    const unixIdx = promptPath.lastIndexOf('/trash/');
    if (unixIdx >= 0) {
      const rest = promptPath.substring(unixIdx + '/trash/'.length);
      return rest.split('/')[0] || null;
    }
    const winIdx = promptPath.toLowerCase().lastIndexOf('\\trash\\');
    if (winIdx >= 0) {
      const rest = promptPath.substring(winIdx + '\\trash\\'.length);
      return rest.split('\\')[0] || null;
    }
    return null;
  };

  // 获取所有分类列表
  const getAllCategories = (): string[] => {
    const categories: string[] = [];
    const traverse = (nodes: any[]) => {
      if (!nodes || !Array.isArray(nodes)) return;
      nodes.forEach(node => {
        if (node && node.name && !node.name.toLowerCase().includes('trash')) {
          categories.push(node.name);
          if (node.children && Array.isArray(node.children) && node.children.length > 0) {
            traverse(node.children);
          }
        }
      });
    };
    if (state.fileSystem?.categories && Array.isArray(state.fileSystem.categories)) {
      traverse(state.fileSystem.categories);
    }
    return categories;
  };

  const allCategories = getAllCategories();
  const filteredCategories = categoryQuery
    ? allCategories.filter((c) => c.toLowerCase().includes(categoryQuery.toLowerCase()))
    : allCategories;

  // 双击进入编辑页面
  const handleDoubleClick = (promptId: string) => {
    setEditingPromptId(promptId);
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showToast("已复制到剪贴板"))
      .catch(() => showToast("复制失败"));
  };

  const toggleFavorite = async (promptId: string) => {
    const prompt = state.fileSystem?.allPrompts.get(promptId);
    if (!prompt) return;
    
    const updated = {
      ...prompt,
      meta: { ...prompt.meta, is_favorite: !prompt.meta.is_favorite }
    };
    
    try {
      await savePrompt(updated);
    } catch (error) {
      showToast("更新失败");
    }
  };

  const handleDelete = async (promptId: string) => {
    const isInTrash = selectedCategory === 'trash';
    
    if (isInTrash) {
      // 在回收站中,永久删除
      if (window.confirm('确定要永久删除这个提示词吗？此操作无法撤销！')) {
        try {
          await deletePrompt(promptId, true); // permanent = true
          showToast("已永久删除");
        } catch (error) {
          showToast("删除失败");
        }
      }
    } else {
      // 不在回收站,移动到回收站
      if (window.confirm('确定要删除这个提示词吗？')) {
        try {
          await deletePrompt(promptId, false);
          showToast("已移动到回收站");
        } catch (error) {
          showToast("删除失败");
        }
      }
    }
  };

  const handleRestore = async (promptId: string) => {
    try {
      await restorePrompt(promptId);
      showToast("已恢复");
    } catch (error) {
      showToast("恢复失败");
    }
  };

  const handleAddPrompt = async () => {
    if (!newPrompt.title || !newPrompt.content || !newPrompt.category) {
      showToast("请填写标题、分类和内容");
      return;
    }

    try {
      // 找到分类路径
      let categoryPath = '';
      const findCategoryPath = (nodes: any[], name: string): string | null => {
        for (const node of nodes) {
          if (node.name === name) return node.path;
          if (node.children && node.children.length > 0) {
            const found = findCategoryPath(node.children, name);
            if (found) return found;
          }
        }
        return null;
      };
      
      if (state.fileSystem?.categories) {
        categoryPath = findCategoryPath(state.fileSystem.categories, newPrompt.category) || '';
      }
      
      if (!categoryPath) {
        showToast("找不到指定的分类");
        return;
      }

      // 准备标签(分类标签 + 用户标签)
      const userTags = newPrompt.tags ? newPrompt.tags.split(',').map(t => t.trim()).filter(t => t) : [];
      const allTags = [newPrompt.category, ...userTags];

      // 创建提示词并立即更新内容和标签
      const created = await createPrompt(categoryPath, newPrompt.title);
      
      const updated = {
        ...created,
        content: newPrompt.content,
        meta: {
          ...created.meta,
          tags: allTags,
          category: newPrompt.category,
          category_path: categoryPath,
        }
      };
      await savePrompt(updated);
      
      setNewPrompt({ title: '', content: '', category: '', tags: '' });
      setIsModalOpen(false);
      showToast("已创建新提示词");
    } catch (error) {
      showToast('创建失败: ' + (error as Error).message);
    }
  };

  // 如果正在编辑某个提示词，显示编辑页面
  if (editingPromptId) {
    return <EditorPage promptId={editingPromptId} onClose={() => setEditingPromptId(null)} />;
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-transparent">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-zinc-900/80 text-zinc-100 px-4 py-2 rounded-lg shadow-xl z-50 text-sm border border-white/10 backdrop-blur">
          {toast}
        </div>
      )}

      {/* Top Navigation Bar */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 flex-shrink-0 bg-[#09090b]/50 backdrop-blur-md z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
            className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            {state.uiState.sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="text-sm text-zinc-500 flex items-center gap-2">
            <span className="hover:text-zinc-300 cursor-pointer transition-colors">Workspace</span>
            <span className="text-white/10">/</span>
            <span className="text-zinc-200 font-medium">提示词库</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="pl-9 pr-3 py-2 text-sm border border-white/10 rounded-lg w-60 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-zinc-600 bg-zinc-900/50 text-zinc-200"
              value={searchQuery}
              onChange={(e) => dispatch({ type: 'SET_SEARCH', payload: e.target.value })}
            />
          </div>
          <button className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-zinc-200">
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto bg-[#09090b]/30">
        <div className={`max-w-6xl mx-auto px-6 py-8 pb-20 relative no-scrollbar transition-opacity duration-150 ${isSwitchingList ? 'opacity-70' : 'opacity-100'}`}>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight animate-fade-in mb-6">
            我的提示词库
          </h1>

          {/* Content Toolbar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <span className="font-medium text-zinc-200">{prompts.length}</span> 个项目
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-white text-black hover:bg-zinc-200 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.10)]"
            >
              <Plus size={16} /> 新建
            </button>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {prompts.map(prompt => {
              const isInTrash = selectedCategory === 'trash';
              const trashItemName = isInTrash ? getTrashItemName(prompt.path) : null;
              const visitCount = trashItemName ? (trashCounts[trashItemName] ?? 0) : 0;
              
              return (
              <SpotlightCard
                key={prompt.meta.id}
                onDoubleClick={() => !isInTrash && handleDoubleClick(prompt.meta.id)}
                className={`p-5 flex flex-col h-64 ${isInTrash ? 'cursor-default opacity-75' : 'cursor-pointer'}`}
              >
                {/* Card Header */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 pr-4 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      {(() => {
                        const Icon = getSmartIcon(prompt.meta.title, prompt.meta.tags);
                        const [from, to] = getSmartGradient(prompt.meta.title, prompt.meta.tags);
                        return (
                          <div
                            className={`w-9 h-9 rounded-lg bg-gradient-to-br ${from} ${to} flex items-center justify-center shadow-sm shadow-white/5 border border-white/10 flex-shrink-0`}
                            title={(prompt.meta.tags || []).join(', ')}
                          >
                            <Icon size={18} className="text-black/90" />
                          </div>
                        );
                      })()}
                      <h3 className="font-semibold text-zinc-200 truncate group-hover:text-indigo-300 transition-colors" title={prompt.meta.title}>{prompt.meta.title}</h3>
                      {isInTrash && (
                        <span className="text-[10px] text-zinc-400 border border-white/10 rounded px-1.5 py-0.5 bg-white/5">
                          {visitCount}/{trashThreshold}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {prompt.meta.tags.map(tag => (
                        <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded border ${getTagColor(tag)}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  {!isInTrash && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(prompt.meta.id); }}
                      className={`p-1.5 rounded-lg hover:bg-white/5 transition-colors ${prompt.meta.is_favorite ? 'text-yellow-400' : 'text-zinc-600 hover:text-zinc-300'}`}
                    >
                      <Star size={16} fill={prompt.meta.is_favorite ? "currentColor" : "none"} />
                    </button>
                  )}
                </div>

                {/* Card Content Preview */}
                <div className="flex-1 bg-zinc-950/40 rounded-lg p-2.5 text-xs text-zinc-400 font-mono overflow-y-auto border border-white/5 mb-3 whitespace-pre-wrap leading-relaxed no-scrollbar">
                  {prompt.content}
                </div>

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <span className="text-[10px] text-zinc-600 font-mono">更新于 {new Date(prompt.meta.updated_at).toLocaleDateString()}</span>
                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    {isInTrash ? (
                      <>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleRestore(prompt.meta.id); }}
                          className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 text-emerald-300 px-2 py-1 rounded text-xs font-medium transition-all active:scale-95"
                          title="恢复"
                        >
                          <RotateCcw size={12} /> 恢复
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(prompt.meta.id); }}
                          className="p-1.5 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 rounded-lg transition-colors"
                          title="永久删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(prompt.meta.id); }}
                          className="p-1.5 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 rounded-lg transition-colors"
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleCopy(prompt.content); }}
                          className="flex items-center gap-1 bg-white/5 border border-white/10 hover:bg-white/10 px-2 py-1 rounded text-xs font-medium text-zinc-300 transition-all active:scale-95"
                        >
                          <Copy size={12} /> 复制
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </SpotlightCard>
            )})}
          </div>

          {/* Empty State */}
          {prompts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-zinc-500 select-none">
              <div className="text-5xl mb-4 grayscale opacity-50">🥥</div>
              <p className="text-sm">没有找到相关内容</p>
              <button 
                onClick={() => { dispatch({ type: 'SELECT_CATEGORY', payload: null }); dispatch({ type: 'SET_SEARCH', payload: '' }); }}
                className="text-indigo-300 text-sm mt-3 hover:underline"
              >
                显示全部
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add New Prompt Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#09090b]/80 border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden backdrop-blur-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-3 px-4 border-b border-white/10 bg-[#09090b]/60 sticky top-0 z-10">
              <div className="flex items-center gap-2 text-zinc-500 text-sm">
                <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/10 text-xs text-zinc-400">新建页面</span>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Fixed Metadata Section */}
            <div className="px-8 pt-6 pb-4 bg-[#09090b]/40 border-b border-white/10 sticky top-14 z-9 space-y-3">
              <div className="flex items-center gap-4 text-sm">
                <div className="w-20 text-zinc-500 text-xs uppercase tracking-wide font-semibold">分类 *</div>
                <div className="flex-1 relative" ref={categoryPopoverRef}>
                  <button
                    type="button"
                    onClick={() => setIsCategoryOpen((v) => !v)}
                    className="w-full flex items-center justify-between bg-zinc-900 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-colors text-zinc-200"
                  >
                    <span className={newPrompt.category ? 'text-zinc-200' : 'text-zinc-500'}>
                      {newPrompt.category || '选择分类...'}
                    </span>
                    <span className="text-zinc-500">▾</span>
                  </button>

                  {isCategoryOpen && (
                    <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-xl border border-white/10 bg-zinc-950/80 backdrop-blur-xl shadow-2xl overflow-hidden">
                      <div className="p-2 border-b border-white/10">
                        <input
                          value={categoryQuery}
                          onChange={(e) => setCategoryQuery(e.target.value)}
                          placeholder="搜索分类..."
                          className="w-full bg-zinc-900/60 px-3 py-2 rounded-lg border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 text-zinc-200 placeholder:text-zinc-600"
                          autoFocus
                        />
                      </div>

                      <div className="max-h-56 overflow-y-auto no-scrollbar">
                        {filteredCategories.length === 0 ? (
                          <div className="px-3 py-3 text-sm text-zinc-500">没有匹配的分类</div>
                        ) : (
                          filteredCategories.map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => {
                                setNewPrompt({ ...newPrompt, category: cat });
                                setIsCategoryOpen(false);
                                setCategoryQuery('');
                              }}
                              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                newPrompt.category === cat
                                  ? 'bg-white/10 text-white'
                                  : 'text-zinc-300 hover:bg-white/5'
                              }`}
                            >
                              {cat}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="w-20 text-zinc-500 text-xs uppercase tracking-wide font-semibold">其他标签</div>
                <input 
                  type="text" 
                  className="flex-1 bg-zinc-900/50 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-zinc-600 text-zinc-200"
                  placeholder="python, react..."
                  value={newPrompt.tags}
                  onChange={(e) => setNewPrompt({...newPrompt, tags: e.target.value})}
                />
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-8 overflow-y-auto flex-1">
              <div className="mb-6 text-5xl hover:opacity-80 cursor-pointer w-fit">✨</div>
              <input 
                type="text" 
                placeholder="无标题" 
                className="text-3xl font-bold w-full placeholder:text-zinc-700 focus:outline-none mb-6 text-white bg-transparent"
                value={newPrompt.title}
                onChange={(e) => setNewPrompt({...newPrompt, title: e.target.value})}
                autoFocus
              />
              
              <textarea 
                className="w-full min-h-[300px] text-zinc-200 resize-none focus:outline-none font-mono text-sm leading-relaxed p-0 placeholder:text-zinc-700 bg-transparent"
                placeholder="输入提示词详细内容..."
                value={newPrompt.content}
                onChange={(e) => setNewPrompt({...newPrompt, content: e.target.value})}
              ></textarea>
            </div>
            
            <div className="p-3 border-t border-white/10 flex justify-end gap-2 bg-[#09090b]/60">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 rounded-lg transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleAddPrompt}
                className="px-4 py-2 text-sm bg-white text-black hover:bg-zinc-200 rounded-lg shadow-sm transition-colors font-medium"
              >
                保存页面
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
