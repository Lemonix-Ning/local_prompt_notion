/**
 * EditorPage 组件 - 支持主题切换
 * 全屏编辑页面,双击卡片进入,退出自动保存
 */

import { useState, useEffect, useRef } from 'react';
import {
  X,
  Star,
  Trash2,
  Save,
  Clock,
  FolderOpen,
} from 'lucide-react';
import { useApp } from '../AppContext';
import { PromptData } from '../types';
import { getSmartGradient, getSmartIcon } from '../utils/smartIcon';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useTheme } from '../contexts/ThemeContext';

interface EditorPageProps {
  promptId: string;
  onClose: () => void;
}

export function EditorPage({ promptId, onClose }: EditorPageProps) {
  const { state, savePrompt, deletePrompt } = useApp();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { theme } = useTheme();
  const [formData, setFormData] = useState<PromptData | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // 主题样式辅助函数
  const getThemeStyles = () => {
    if (theme === 'dark') {
      return {
        background: 'bg-[#09090b]',
        text: 'text-zinc-200',
        textMuted: 'text-zinc-500',
        textPlaceholder: 'placeholder:text-zinc-700',
        border: 'border-white/10',
        borderMuted: 'border-white/5',
        hover: 'hover:bg-white/5',
        input: 'bg-zinc-900/50',
        inputFocus: 'focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20',
        card: 'bg-zinc-900/40',
        button: 'bg-white text-black hover:bg-zinc-200',
        buttonDisabled: 'disabled:bg-zinc-700 disabled:text-zinc-400',
        deleteHover: 'hover:bg-red-500/10 hover:text-red-400',
        unsavedBadge: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
        titleInput: 'text-white',
      };
    } else {
      return {
        background: 'bg-white',
        text: 'text-gray-900',
        textMuted: 'text-gray-500',
        textPlaceholder: 'placeholder:text-gray-400',
        border: 'border-gray-200',
        borderMuted: 'border-gray-100',
        hover: 'hover:bg-gray-50',
        input: 'bg-gray-50',
        inputFocus: 'focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20',
        card: 'bg-gray-50',
        button: 'bg-gray-900 text-white hover:bg-gray-800',
        buttonDisabled: 'disabled:bg-gray-300 disabled:text-gray-500',
        deleteHover: 'hover:bg-red-50 hover:text-red-600',
        unsavedBadge: 'bg-amber-50 text-amber-700 border-amber-200',
        titleInput: 'text-gray-900',
      };
    }
  };

  const styles = getThemeStyles();

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
    walk(state.fileSystem.categories);
    return best;
  };

  useEffect(() => {
    const prompt = state.fileSystem?.allPrompts.get(promptId);
    if (prompt) {
      setFormData(prompt);
    }
  }, [promptId, state.fileSystem]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges) {
          handleSave();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasChanges]);

  const handleClose = async () => {
    if (hasChanges) {
      await handleSave();
    }
    onClose();
  };

  const handleSave = async () => {
    if (!formData || !hasChanges) return;
    
    setIsSaving(true);
    try {
      await savePrompt(formData);
      setHasChanges(false);
      showToast('保存成功', 'success');
    } catch (error) {
      showToast('保存失败: ' + (error as Error).message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!formData) return;
    
    const confirmed = await confirm({
      title: '确认删除',
      message: `确定要删除提示词 "${formData.meta.title}" 吗？`,
      type: 'danger'
    });
    
    if (confirmed) {
      try {
        await deletePrompt(promptId);
        onClose();
        showToast('已删除提示词', 'success');
      } catch (error) {
        showToast('删除失败: ' + (error as Error).message, 'error');
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
      <div className={`fixed inset-0 ${styles.background} z-50 flex items-center justify-center ${styles.text}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className={styles.textMuted}>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 ${styles.background} z-50 flex flex-col overflow-hidden ${styles.text}`}>
      {/* Top Navigation Bar */}
      <div className={`h-16 flex items-center justify-between px-6 ${styles.borderMuted} border-b flex-shrink-0 ${styles.background}/50 backdrop-blur-md sticky top-0 z-10`}>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleClose}
            className={`p-2 ${styles.hover} rounded-lg ${styles.textMuted} hover:${styles.text} transition-colors`}
            title="返回 (自动保存)"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-2">
            <span>编辑模式</span>
            {hasChanges && (
              <span className={`text-xs ${styles.unsavedBadge} px-2 py-0.5 rounded border`}>未保存</span>
            )}
            {isSaving && (
              <span className="text-xs text-blue-400">保存中...</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleFavorite}
            className={`p-2 rounded-lg ${styles.hover} transition-colors ${formData.meta.is_favorite ? 'text-yellow-400' : `${styles.textMuted} hover:${styles.text}`}`}
            title="收藏"
          >
            <Star size={18} fill={formData.meta.is_favorite ? 'currentColor' : 'none'} />
          </button>
          <button 
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className={`flex items-center gap-1.5 ${styles.button} ${styles.buttonDisabled} px-3 py-2 rounded-lg text-sm font-medium transition-colors`}
          >
            <Save size={16} /> 保存
          </button>
          <button 
            onClick={handleDelete}
            className={`p-2 rounded-lg ${styles.deleteHover} ${styles.textMuted} transition-colors`}
            title="删除"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-8">
          {/* Header Section */}
          <div className="flex items-start gap-6">
            {(() => {
              const Icon = getSmartIcon(formData.meta.title, formData.meta.tags);
              const [from, to] = getSmartGradient(formData.meta.title, formData.meta.tags);
              return (
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${from} ${to} flex items-center justify-center shadow-lg ${theme === 'dark' ? 'shadow-white/5 border border-white/10' : 'shadow-gray-200 border border-gray-200'} flex-shrink-0`}>
                  <Icon size={26} className="text-black/90" />
                </div>
              );
            })()}
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={formData.meta.title}
                onChange={(e) => updateField('title', e.target.value)}
                className={`text-3xl md:text-4xl font-bold ${styles.titleInput} mb-4 w-full outline-none border-none bg-transparent ${styles.textPlaceholder}`}
                placeholder="无标题"
              />
              
              {/* Category and Tags */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className={`text-xs ${styles.textMuted} block mb-2`}>分类</label>
                  <select
                    value={formData.meta.category || ''}
                    onChange={(e) => {
                      updateField('category', e.target.value);
                      setHasChanges(true);
                    }}
                    className={`w-full px-3 py-2 ${styles.border} border rounded-lg text-sm outline-none ${styles.inputFocus} ${styles.input} ${styles.text}`}
                  >
                    <option value="" className={`${styles.input} ${styles.text}`}>选择分类...</option>
                    {getAllCategories().map(cat => (
                      <option key={cat.path} value={cat.path} className={`${styles.input} ${styles.text}`}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className={`text-xs ${styles.textMuted} block mb-2`}>标签</label>
                  <input
                    type="text"
                    value={formData.meta.tags.join(', ')}
                    onChange={(e) => updateTags(e.target.value)}
                    className={`w-full px-3 py-2 ${styles.border} border rounded-lg text-sm outline-none ${styles.inputFocus} ${styles.input} ${styles.text} ${styles.textPlaceholder}`}
                    placeholder="标签1, 标签2, 标签3"
                  />
                </div>
              </div>

              {/* Author */}
              <div className="mb-6">
                <label className={`text-xs ${styles.textMuted} block mb-2`}>作者</label>
                <input
                  type="text"
                  value={formData.meta.author}
                  onChange={(e) => updateField('author', e.target.value)}
                  className={`w-full px-3 py-2 ${styles.border} border rounded-lg text-sm outline-none ${styles.inputFocus} ${styles.input} ${styles.text} ${styles.textPlaceholder}`}
                  placeholder="作者名称"
                />
              </div>

              {/* Meta Info */}
              <div className="flex items-center gap-6 text-sm">
                <div className={`flex items-center gap-2 ${styles.textMuted}`}>
                  <Clock size={14} />
                  <span>创建: {new Date(formData.meta.created_at).toLocaleDateString()}</span>
                </div>
                <div className={`flex items-center gap-2 ${styles.textMuted}`}>
                  <Clock size={14} />
                  <span>更新: {new Date(formData.meta.updated_at).toLocaleDateString()}</span>
                </div>
                {(() => {
                  const categoryInfo = findCategoryPathForPrompt(formData.path);
                  return categoryInfo ? (
                    <div className={`flex items-center gap-2 ${styles.textMuted}`}>
                      <FolderOpen size={14} />
                      <span>{categoryInfo.name}</span>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="mb-8">
            <label className={`text-xs ${styles.textMuted} block mb-2`}>提示词内容</label>
            <textarea
              ref={contentRef}
              value={formData.content}
              onChange={(e) => updateContent(e.target.value)}
              className={`w-full h-96 px-4 py-3 ${styles.border} border rounded-xl text-sm outline-none ${styles.inputFocus} resize-vertical ${styles.input} ${styles.text} ${styles.textPlaceholder}`}
              placeholder="在此输入提示词内容..."
            />
          </div>

          {/* Model Config Section */}
          <div className={`${styles.card} rounded-xl p-4 ${styles.border} border`}>
            <h3 className={`text-sm font-semibold ${styles.text} mb-3`}>模型配置</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <label className={`text-xs ${styles.textMuted} block mb-2`}>模型</label>
                <input
                  type="text"
                  value={formData.meta.model_config?.default_model || ''}
                  onChange={(e) => {
                    updateField('model_config', { 
                      ...formData.meta.model_config, 
                      default_model: e.target.value 
                    });
                    setHasChanges(true);
                  }}
                  className={`w-full px-3 py-2 ${styles.border} border rounded-lg text-sm outline-none ${styles.inputFocus} ${styles.input} ${styles.text}`}
                  placeholder="gpt-4"
                />
              </div>
              
              <div>
                <label className={`text-xs ${styles.textMuted} block mb-2`}>温度</label>
                <input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={formData.meta.model_config?.temperature || ''}
                  onChange={(e) => {
                    updateField('model_config', { 
                      ...formData.meta.model_config, 
                      temperature: parseFloat(e.target.value) || 0 
                    });
                    setHasChanges(true);
                  }}
                  className={`w-full px-3 py-2 ${styles.border} border rounded-lg text-sm outline-none ${styles.inputFocus} ${styles.input} ${styles.text}`}
                />
              </div>
              
              <div>
                <label className={`text-xs ${styles.textMuted} block mb-2`}>Top P</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formData.meta.model_config?.top_p || ''}
                  onChange={(e) => {
                    updateField('model_config', { 
                      ...formData.meta.model_config, 
                      top_p: parseFloat(e.target.value) || 0 
                    });
                    setHasChanges(true);
                  }}
                  className={`w-full px-3 py-2 ${styles.border} border rounded-lg text-sm outline-none ${styles.inputFocus} ${styles.input} ${styles.text}`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}