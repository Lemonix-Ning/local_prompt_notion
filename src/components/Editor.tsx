/**
 * Editor 组件
 * 编辑和预览提示词
 */

import { useState, useEffect } from 'react';
import {
  Save,
  Copy,
  Trash2,
  Star,
  Layout,
  Tag,
  Settings,
  Menu,
} from 'lucide-react';
import { useApp } from '../AppContext';
import { PromptData } from '../types';

export function Editor() {
  const { state, dispatch, getCurrentPrompt, savePrompt, deletePrompt } = useApp();
  const { isEditing } = state;

  const currentPrompt = getCurrentPrompt();
  const [formData, setFormData] = useState<PromptData | null>(null);

  // 获取所有分类
  const getAllCategories = (): string[] => {
    const categories: string[] = [];
    if (!state.fileSystem?.categories) {
      console.warn('Categories not loaded yet');
      return categories;
    }
    const traverse = (nodes: any[]) => {
      if (!nodes || !Array.isArray(nodes)) return;
      nodes.forEach(node => {
        if (node && node.name && !node.name.toLowerCase().includes('trash')) {
          categories.push(node.name);
          if (node.children && node.children.length > 0) {
            traverse(node.children);
          }
        }
      });
    };
    traverse(state.fileSystem.categories);
    return categories;
  };

  // 同步当前提示词到表单
  useEffect(() => {
    if (currentPrompt) {
      setFormData(JSON.parse(JSON.stringify(currentPrompt)));
    } else {
      setFormData(null);
    }
  }, [currentPrompt]);

  if (!currentPrompt || !formData) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 text-gray-400">
        <div className="text-center">
          <Layout size={48} className="mx-auto mb-4 opacity-50" />
          <p>选择一个提示词开始编辑</p>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    try {
      await savePrompt(formData);
      dispatch({ type: 'SET_EDITING', payload: false });
      alert('保存成功!');
    } catch (error) {
      alert('保存失败: ' + (error as Error).message);
    }
  };

  const handleDelete = async () => {
    if (confirm('确定要删除这个提示词吗?')) {
      try {
        await deletePrompt(formData.meta.id);
        alert('已移动到回收站');
      } catch (error) {
        alert('删除失败: ' + (error as Error).message);
      }
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(formData.content);
    alert('已复制到剪贴板!');
  };

  const handleToggleFavorite = () => {
    setFormData({
      ...formData,
      meta: {
        ...formData.meta,
        is_favorite: !formData.meta.is_favorite,
      },
    });
  };

  const handleAddTag = () => {
    const tag = prompt('输入新标签:');
    if (tag && !formData.meta.tags.includes(tag) && tag !== formData.meta.category) {
      setFormData({
        ...formData,
        meta: {
          ...formData.meta,
          tags: [...formData.meta.tags, tag],
        },
      });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    // 处理删除分类标签
    if (tagToRemove === formData.meta.category) {
      if (confirm('确定要删除分类吗?删除后需要重新选择分类。')) {
        setFormData({
          ...formData,
          meta: {
            ...formData.meta,
            category: '',
            tags: formData.meta.tags.filter(tag => tag !== tagToRemove),
          },
        });
      }
      return;
    }
    
    // 处理删除普通标签
    setFormData({
      ...formData,
      meta: {
        ...formData.meta,
        tags: formData.meta.tags.filter(tag => tag !== tagToRemove),
      },
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden">
      {/* Header */}
      <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
            className="text-gray-400 hover:text-gray-600"
          >
            <Menu size={20} />
          </button>

          {isEditing ? (
            <input
              type="text"
              value={formData.meta.title}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  meta: { ...formData.meta, title: e.target.value },
                })
              }
              className="text-lg font-semibold text-gray-800 border-b-2 border-blue-500 focus:outline-none bg-transparent"
            />
          ) : (
            <h1 className="text-lg font-semibold text-gray-800">{formData.meta.title}</h1>
          )}

          <button
            onClick={handleToggleFavorite}
            className={`${formData.meta.is_favorite ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-500`}
          >
            <Star size={18} fill={formData.meta.is_favorite ? 'currentColor' : 'none'} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <select
                value={formData.meta.category || ''}
                onChange={(e) => {
                  const newCategory = e.target.value;
                  const oldCategory = formData.meta.category;
                  
                  const newTags = formData.meta.tags.map(tag =>
                    tag === oldCategory ? newCategory : tag
                  );
                  
                  if (!oldCategory && newCategory && !newTags.includes(newCategory)) {
                    newTags.unshift(newCategory);
                  }
                  
                  setFormData({
                    ...formData,
                    meta: {
                      ...formData.meta,
                      category: newCategory,
                      tags: newTags,
                    },
                  });
                }}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 bg-white hover:bg-gray-50"
              >
                <option value="">选择分类...</option>
                {getAllCategories().map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                <Save size={16} />
                保存
              </button>
              <button
                onClick={() => {
                  setFormData(JSON.parse(JSON.stringify(currentPrompt)));
                  dispatch({ type: 'SET_EDITING', payload: false });
                }}
                className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-md text-sm"
              >
                取消
              </button>
            </>
          ) : (
            <>
              <div className="px-3 py-1.5 bg-gray-50 rounded-md text-sm text-gray-700 border border-gray-300">
                分类: <span className="font-semibold text-gray-900">{formData.meta.category || '未分类'}</span>
              </div>
              <button
                onClick={() => dispatch({ type: 'SET_EDITING', payload: true })}
                className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-md text-sm"
              >
                编辑
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-md text-sm"
              >
                <Copy size={16} />
                复制
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-md text-sm"
              >
                <Trash2 size={16} />
                删除
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Metadata Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Settings size={16} />
              元数据配置
            </h2>

            <div className="space-y-4">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">分类</label>
                {isEditing ? (
                  <select
                    value={formData.meta.category || ''}
                    onChange={(e) => {
                      const newCategory = e.target.value;
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
                          tags: newTags,
                        },
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">选择分类...</option>
                    {getAllCategories().map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                ) : (
                  <div className="px-3 py-2 bg-gray-50 rounded-md text-sm text-gray-700">
                    {formData.meta.category || '未分类'}
                  </div>
                )}
              </div>
              
              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">标签</label>
                <div className="flex flex-wrap gap-2">
                  {formData.meta.tags.map(tag => {
                    const isCategory = tag === formData.meta.category;
                    return (
                      <span
                        key={tag}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm ${
                          isCategory
                            ? 'bg-purple-50 text-purple-700 font-semibold'
                            : 'bg-blue-50 text-blue-700'
                        }`}
                        title={isCategory ? '分类标签(由分类字段自动生成,点击×删除分类)' : ''}
                      >
                        <Tag size={12} />
                        {tag}
                        {isEditing && (
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className={`ml-1 hover:opacity-70 ${
                              isCategory ? 'text-purple-400 hover:text-purple-600' : 'text-blue-400 hover:text-blue-600'
                            }`}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    );
                  })}
                  {isEditing && (
                    <button
                      onClick={handleAddTag}
                      className="px-2 py-1 border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 rounded-md text-sm"
                    >
                      + 添加标签
                    </button>
                  )}
                </div>
              </div>

              {/* Model Config */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">模型</label>
                  {isEditing ? (
                    <select
                      value={formData.meta.model_config.default_model}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          meta: {
                            ...formData.meta,
                            model_config: {
                              ...formData.meta.model_config,
                              default_model: e.target.value,
                            },
                          },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="gpt-4">GPT-4</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo</option>
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      <option value="claude-3-opus">Claude 3 Opus</option>
                      <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                    </select>
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 rounded-md text-sm text-gray-700">
                      {formData.meta.model_config.default_model}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Temperature
                  </label>
                  {isEditing ? (
                    <input
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={formData.meta.model_config.temperature}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          meta: {
                            ...formData.meta,
                            model_config: {
                              ...formData.meta.model_config,
                              temperature: parseFloat(e.target.value),
                            },
                          },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 rounded-md text-sm text-gray-700">
                      {formData.meta.model_config.temperature}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Top P</label>
                  {isEditing ? (
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={formData.meta.model_config.top_p}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          meta: {
                            ...formData.meta,
                            model_config: {
                              ...formData.meta.model_config,
                              top_p: parseFloat(e.target.value),
                            },
                          },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 rounded-md text-sm text-gray-700">
                      {formData.meta.model_config.top_p}
                    </div>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                <div>
                  <span className="text-xs text-gray-500">创建时间:</span>
                  <div className="text-sm text-gray-700 mt-1">
                    {new Date(formData.meta.created_at).toLocaleString('zh-CN')}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">更新时间:</span>
                  <div className="text-sm text-gray-700 mt-1">
                    {new Date(formData.meta.updated_at).toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">提示词内容</h2>
            {isEditing ? (
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full h-96 px-4 py-3 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:border-blue-500 resize-y"
                placeholder="在此输入提示词内容..."
              />
            ) : (
              <div className="prose max-w-none">
                <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded-md border border-gray-200">
                  {formData.content}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
