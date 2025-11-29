/**
 * EditorPage 组件
 * 全屏编辑页面,双击卡片进入,退出自动保存
 */

import { useState, useEffect, useRef } from 'react';
import {
  X,
  Star,
  Trash2,
  Save,
  Tag,
  Clock,
  User,
  FolderOpen,
} from 'lucide-react';
import { useApp } from '../AppContext';
import { PromptData } from '../types';
import { getSmartGradient, getSmartIcon } from '../utils/smartIcon';

interface EditorPageProps {
  promptId: string;
  onClose: () => void;
}

export function EditorPage({ promptId, onClose }: EditorPageProps) {
  const { state, savePrompt, deletePrompt } = useApp();
  const [formData, setFormData] = useState<PromptData | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const findCategoryPathForPrompt = (promptPath: string): { path: string; name: string } | null => {
    if (!state.fileSystem?.categories) return null;

    let best: { path: string; name: string } | null = null;
    const walk = (nodes: any[]) => {
      nodes.forEach(node => {
        if (node?.path && node?.name && typeof node.path === 'string') {
          if (promptPath.startsWith(node.path)) {
            if (!best || node.path.length > best.path.length) {
              best = { path: node.path, name: node.name };
            }
          }
          if (node.children?.length) {
            walk(node.children);
          }
        }
      });
    };
    walk(state.fileSystem.categories as any);
    return best;
  };

  // 加载提示词数据
  useEffect(() => {
    const prompt = state.fileSystem?.allPrompts.get(promptId);
    if (prompt) {
      const cloned: PromptData = JSON.parse(JSON.stringify(prompt));
      if (!cloned.meta.category_path) {
        const derived = findCategoryPathForPrompt(cloned.path);
        if (derived) {
          cloned.meta.category_path = derived.path;
          if (!cloned.meta.category) {
            cloned.meta.category = derived.name;
          }
        }
      }
      setFormData(cloned);
    }
  }, [promptId, state.fileSystem]);

  // 自动保存功能
  const handleSave = async () => {
    if (!formData || !hasChanges) return;
    
    setIsSaving(true);
    try {
      await savePrompt(formData);
      setHasChanges(false);
    } catch (error) {
      alert('保存失败: ' + (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  // 退出时提示保存
  const handleClose = async () => {
    if (hasChanges) {
      const shouldSave = window.confirm('有未保存的更改，是否保存？\n\n点击"确定"保存更改\n点击"取消"放弃更改');
      if (shouldSave) {
        await handleSave();
      }
    }
    onClose();
  };

  const handleDelete = async () => {
    if (window.confirm('确定要删除这个提示词吗？')) {
      try {
        await deletePrompt(promptId);
        onClose();
      } catch (error) {
        alert('删除失败: ' + (error as Error).message);
      }
    }
  };

  const toggleFavorite = () => {
    if (!formData) return;
    setFormData({
      ...formData,
      meta: { ...formData.meta, is_favorite: !formData.meta.is_favorite }
    });
    setHasChanges(true);
  };

  const updateField = (field: string, value: any) => {
    if (!formData) return;
    setFormData({
      ...formData,
      meta: { ...formData.meta, [field]: value }
    });
    setHasChanges(true);
  };

  const updateContent = (content: string) => {
    if (!formData) return;
    setFormData({ ...formData, content });
    setHasChanges(true);
  };

  const updateTags = (tagsStr: string) => {
    if (!formData) return;
    const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t);
    setFormData({
      ...formData,
      meta: { ...formData.meta, tags }
    });
    setHasChanges(true);
  };

  // 获取所有分类
  const getAllCategories = (): { name: string; path: string }[] => {
    const categories: { name: string; path: string }[] = [];
    if (!state.fileSystem?.categories) {
      return categories;
    }
    const traverse = (nodes: any[]) => {
      if (!nodes || !Array.isArray(nodes)) return;
      nodes.forEach(node => {
        if (node && node.name && !node.name.toLowerCase().includes('trash')) {
          categories.push({ name: node.name, path: node.path });
          if (node.children && Array.isArray(node.children) && node.children.length > 0) {
            traverse(node.children);
          }
        }
      });
    };
    traverse(state.fileSystem.categories);
    return categories;
  };

  if (!formData) {
    return (
      <div className="fixed inset-0 bg-[#09090b] z-50 flex items-center justify-center text-zinc-200">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-zinc-400">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#09090b] z-50 flex flex-col overflow-hidden text-zinc-200">
      {/* Top Navigation Bar */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 flex-shrink-0 bg-[#09090b]/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={handleClose}
            className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-zinc-200 transition-colors"
            title="返回 (自动保存)"
          >
            <X size={18} />
          </button>
          <div className="text-sm text-zinc-500 flex items-center gap-2">
            <span>编辑模式</span>
            {hasChanges && (
              <span className="text-xs bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded border border-amber-500/20">未保存</span>
            )}
            {isSaving && (
              <span className="text-xs text-indigo-300">保存中...</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleFavorite}
            className={`p-2 rounded-lg hover:bg-white/5 transition-colors ${formData.meta.is_favorite ? 'text-yellow-400' : 'text-zinc-600 hover:text-zinc-300'}`}
            title="收藏"
          >
            <Star size={18} fill={formData.meta.is_favorite ? "currentColor" : "none"} />
          </button>
          <button 
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="flex items-center gap-1.5 bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-400 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Save size={16} /> 保存
          </button>
          <button 
            onClick={handleDelete}
            className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
            title="删除"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="max-w-5xl mx-auto px-6 py-8 pb-20 relative">
          <div className="flex items-center gap-4 mb-6">
            {(() => {
              const Icon = getSmartIcon(formData.meta.title, formData.meta.tags);
              const [from, to] = getSmartGradient(formData.meta.title, formData.meta.tags);
              return (
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${from} ${to} flex items-center justify-center shadow-lg shadow-white/5 border border-white/10 flex-shrink-0`}>
                  <Icon size={26} className="text-black/90" />
                </div>
              );
            })()}
            <div className="flex-1">
              <div className="text-xs text-zinc-500 mb-1">编辑提示词</div>
            </div>
          </div>

          {/* Title Editor */}
          <input
            type="text"
            value={formData.meta.title}
            onChange={(e) => updateField('title', e.target.value)}
            className="text-3xl md:text-4xl font-bold text-white mb-4 w-full outline-none border-none bg-transparent placeholder:text-zinc-700"
            placeholder="无标题"
          />

          {/* Metadata Section */}
          <div className="mb-6 pb-6 border-b border-white/5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {/* Category */}
              <div className="flex items-start gap-2">
                <FolderOpen size={16} className="text-zinc-500 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <label className="text-xs text-zinc-500 block mb-1">分类 *</label>
                  <select
                    value={formData.meta.category_path || ''}
                    onChange={(e) => {
                      const newCategoryPath = e.target.value;
                      const selected = getAllCategories().find(c => c.path === newCategoryPath);
                      const newCategory = selected ? selected.name : '';
                      const oldCategory = formData.meta.category;
                      
                      // 更新标签:替换旧分类为新分类
                      const newTags = formData.meta.tags.map(tag =>
                        tag === oldCategory ? newCategory : tag
                      );
                      
                      // 如果之前没有分类,添加新分类到标签
                      if (!oldCategory && newCategory && !newTags.includes(newCategory)) {
                        newTags.unshift(newCategory);
                      }
                      
                      setFormData({
                        ...formData,
                        meta: {
                          ...formData.meta,
                          category: newCategory,
                          category_path: newCategoryPath,
                          tags: newTags,
                        },
                      });
                      setHasChanges(true);
                    }}
                    className="w-full px-3 py-2 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 bg-zinc-900/50 text-zinc-200"
                  >
                    <option value="" className="bg-zinc-900 text-zinc-200">选择分类...</option>
                    {getAllCategories().map(cat => (
                      <option key={cat.path} value={cat.path} className="bg-zinc-900 text-zinc-200">{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div className="flex items-start gap-2">
                <Tag size={16} className="text-zinc-500 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <label className="text-xs text-zinc-500 block mb-1">标签</label>
                  <input
                    type="text"
                    value={formData.meta.tags.join(', ')}
                    onChange={(e) => updateTags(e.target.value)}
                    className="w-full px-3 py-2 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 bg-zinc-900/50 text-zinc-200 placeholder:text-zinc-700"
                    placeholder="标签1, 标签2, 标签3"
                  />
                </div>
              </div>

              {/* Author */}
              <div className="flex items-start gap-2">
                <User size={16} className="text-zinc-500 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <label className="text-xs text-zinc-500 block mb-1">作者</label>
                  <input
                    type="text"
                    value={formData.meta.author}
                    onChange={(e) => updateField('author', e.target.value)}
                    className="w-full px-3 py-2 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 bg-zinc-900/50 text-zinc-200 placeholder:text-zinc-700"
                    placeholder="作者名称"
                  />
                </div>
              </div>

              {/* Created At */}
              <div className="flex items-start gap-2">
                <Clock size={16} className="text-zinc-500 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <label className="text-xs text-zinc-500 block mb-1">创建时间</label>
                  <div className="text-sm text-zinc-400">
                    {new Date(formData.meta.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Updated At */}
              <div className="flex items-start gap-2">
                <Clock size={16} className="text-zinc-500 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <label className="text-xs text-zinc-500 block mb-1">更新时间</label>
                  <div className="text-sm text-zinc-400">
                    {new Date(formData.meta.updated_at).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content Editor */}
          <div className="mb-8">
            <label className="text-xs text-zinc-500 block mb-2">提示词内容</label>
            <textarea
              ref={contentRef}
              value={formData.content}
              onChange={(e) => updateContent(e.target.value)}
              className="w-full min-h-[400px] p-4 border border-white/10 rounded-xl text-sm font-mono leading-relaxed focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 resize-vertical bg-zinc-950/40 text-zinc-200 placeholder:text-zinc-700"
              placeholder="在此输入提示词内容..."
            />
            <div className="mt-2 text-xs text-zinc-500 flex items-center justify-between">
              <span>{formData.content.length} 字符</span>
              <span className="text-zinc-600">支持 Markdown 格式</span>
            </div>
          </div>

          {/* Model Config Section */}
          <div className="bg-zinc-900/40 rounded-xl p-4 border border-white/10">
            <h3 className="text-sm font-semibold text-zinc-200 mb-3">模型配置</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">默认模型</label>
                <input
                  type="text"
                  value={formData.meta.model_config.default_model}
                  onChange={(e) => setFormData({
                    ...formData,
                    meta: {
                      ...formData.meta,
                      model_config: { ...formData.meta.model_config, default_model: e.target.value }
                    }
                  })}
                  className="w-full px-3 py-2 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-indigo-500/50 bg-zinc-900/50 text-zinc-200"
                  placeholder="gpt-4"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Temperature</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={formData.meta.model_config.temperature}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      meta: {
                        ...formData.meta,
                        model_config: { ...formData.meta.model_config, temperature: parseFloat(e.target.value) }
                      }
                    });
                    setHasChanges(true);
                  }}
                  className="w-full px-3 py-2 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-indigo-500/50 bg-zinc-900/50 text-zinc-200"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Top P</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={formData.meta.model_config.top_p}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      meta: {
                        ...formData.meta,
                        model_config: { ...formData.meta.model_config, top_p: parseFloat(e.target.value) }
                      }
                    });
                    setHasChanges(true);
                  }}
                  className="w-full px-3 py-2 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-indigo-500/50 bg-zinc-900/50 text-zinc-200"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
