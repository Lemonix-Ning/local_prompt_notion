/**
 * ExportPromptsDialog - 批量导出提示词对话框
 * 支持选择提示词、配置导出选项、下载 JSON 文件
 */

import React, { useState, useMemo, useCallback } from 'react';
import { X, Download, FileJson, CheckCircle, Loader, Folder, FolderOpen } from 'lucide-react';
import { useApp } from '../AppContext';
import { useToast } from '../contexts/ToastContext';
import api from '../api/client';
import { NewPromptOverlay } from './NewPromptOverlay';

interface ExportPromptsDialogProps {
  isOpen: boolean;
  originId: string;
  onClose: () => void;
  onClosed: () => void;
  preSelectedIds?: string[]; // 预选的提示词 ID
  categoryPath?: string; // 导出指定分类（包含子分类）- 单个分类
  categoryPaths?: string[]; // 导出多个分类（包含子分类）- 多个分类
  preserveStructure?: boolean; // 是否保留分类结构（树形导出）
}

export const ExportPromptsDialog: React.FC<ExportPromptsDialogProps> = ({
  isOpen,
  originId,
  onClose,
  onClosed,
  preSelectedIds = [],
  categoryPath,
  categoryPaths = [],
  preserveStructure = false, // 默认扁平结构
}) => {
  const { state } = useApp();
  const { showToast } = useToast();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(preSelectedIds));
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(categoryPaths.length > 0 ? categoryPaths : categoryPath ? [categoryPath] : [])
  );
  // 固定包含内容，不再提供选项
  const includeContent = true;
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 预选的分类路径（从 Sidebar 右键或选中分类后导出）
  const preSelectedCategoryPaths = useMemo(() => {
    if (categoryPaths.length > 0) return categoryPaths;
    if (categoryPath) return [categoryPath];
    return [];
  }, [categoryPath, categoryPaths]);

  // 将绝对路径转换为相对于 vault 根目录的路径
  const getRelativePath = (absolutePath: string): string => {
    if (!state.fileSystem?.root) return absolutePath;
    
    const vaultRoot = state.fileSystem.root.replace(/\\/g, '/');
    const normalizedPath = absolutePath.replace(/\\/g, '/');
    
    // 移除 vault 根路径前缀
    if (normalizedPath.startsWith(vaultRoot)) {
      const relativePath = normalizedPath.substring(vaultRoot.length);
      // 移除开头的斜杠
      return relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
    }
    
    return absolutePath;
  };

  // 合并选中的分类路径
  const targetCategoryPaths = useMemo(() => {
    return Array.from(selectedCategories);
  }, [selectedCategories]);

  // 获取所有分类（保持树形结构），排除预选分类的子分类
  const categoryTree = useMemo(() => {
    if (!state.fileSystem?.categories) return [];
    
    // 递归过滤子分类
    const filterTree = (nodes: any[]): any[] => {
      return nodes.map(node => {
        // 检查是否是预选分类的子分类
        const isSubCategory = preSelectedCategoryPaths.some(preSelectedPath => {
          const normalizedNodePath = node.path.replace(/\\/g, '/');
          const normalizedPrePath = preSelectedPath.replace(/\\/g, '/');
          return normalizedNodePath !== normalizedPrePath && 
                 normalizedNodePath.startsWith(normalizedPrePath + '/');
        });
        
        // 如果是子分类，返回 null
        if (isSubCategory) return null;
        
        // 递归处理子节点
        const filteredChildren = node.children ? filterTree(node.children).filter(Boolean) : [];
        
        return {
          ...node,
          children: filteredChildren
        };
      }).filter(Boolean);
    };
    
    return filterTree(state.fileSystem.categories);
  }, [state.fileSystem?.categories, preSelectedCategoryPaths]);

  // 获取分类的所有子分类路径（递归）
  const getAllChildPaths = (node: any): string[] => {
    const paths: string[] = [];
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        paths.push(child.path);
        paths.push(...getAllChildPaths(child));
      }
    }
    return paths;
  };

  // 切换分类选中状态（预选分类不可取消，选中父分类自动选中子分类）
  const toggleCategory = useCallback((categoryPath: string, node?: any) => {
    // 如果是预选分类，不允许取消
    if (preSelectedCategoryPaths.includes(categoryPath)) {
      return;
    }
    
    setSelectedCategories(prev => {
      const newSelected = new Set(prev);
      const isCurrentlySelected = newSelected.has(categoryPath);
      
      if (isCurrentlySelected) {
        // 取消选中：移除该分类及其所有子分类
        newSelected.delete(categoryPath);
        if (node) {
          const childPaths = getAllChildPaths(node);
          childPaths.forEach(path => newSelected.delete(path));
        }
      } else {
        // 选中：添加该分类及其所有子分类
        newSelected.add(categoryPath);
        if (node) {
          const childPaths = getAllChildPaths(node);
          childPaths.forEach(path => newSelected.add(path));
        }
      }
      
      return newSelected;
    });
  }, [preSelectedCategoryPaths]);

  // 递归渲染分类树
  const renderCategoryTree = (nodes: any[], level: number = 0) => {
    return nodes.map((node) => {
      const isPreSelected = preSelectedCategoryPaths.includes(node.path);
      const hasChildren = node.children && node.children.length > 0;
      const FolderIcon = hasChildren ? FolderOpen : Folder;
      
      return (
        <div key={node.path}>
          <label
            className={`flex items-center gap-2 p-2 rounded transition-colors ${
              isPreSelected 
                ? 'bg-indigo-50 dark:bg-indigo-950/30 cursor-not-allowed' 
                : 'hover:bg-white dark:hover:bg-zinc-900 cursor-pointer'
            }`}
            style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
          >
            <input
              type="checkbox"
              checked={selectedCategories.has(node.path)}
              onChange={() => toggleCategory(node.path, node)}
              disabled={isPreSelected}
              className="w-4 h-4 rounded border-2 border-gray-300 dark:border-zinc-600 
                         checked:bg-indigo-600 checked:border-indigo-600 
                         focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0 
                         disabled:opacity-50 disabled:cursor-not-allowed
                         appearance-none cursor-pointer
                         bg-white dark:bg-zinc-800
                         checked:bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOSIgdmlld0JveD0iMCAwIDEyIDkiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xMC42NjY3IDFMNC4wMDAwNCA3LjY2NjY3TDEuMzMzMzcgNSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')]
                         checked:bg-center checked:bg-no-repeat"
            />
            <FolderIcon 
              size={14} 
              className={isPreSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}
            />
            <span className={`text-sm flex-1 ${isPreSelected ? 'font-medium text-indigo-700 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}>
              {node.name}
              {isPreSelected && ' (已选中，包含子分类)'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({node.prompts?.length || 0})
            </span>
          </label>
          {hasChildren && renderCategoryTree(node.children, level + 1)}
        </div>
      );
    });
  };

  // 获取所有提示词（排除回收站和已通过分类选择器选中的卡片）
  const allPrompts = useMemo(() => {
    if (!state.fileSystem?.allPrompts) return [];
    
    let prompts = Array.from(state.fileSystem.allPrompts.values()).filter(
      prompt => !prompt.path.includes('/trash/') && !prompt.path.includes('\\trash\\')
    );

    // 排除已通过分类选择器选中的分类下的所有卡片
    if (selectedCategories.size > 0) {
      prompts = prompts.filter(prompt => {
        const promptCategory = prompt.meta.category_path || '';
        // 检查是否在任一已选分类或其子分类下
        const isInSelectedCategory = Array.from(selectedCategories).some(catPath => 
          promptCategory === catPath || 
          promptCategory.startsWith(catPath + '/') || 
          promptCategory.startsWith(catPath + '\\')
        );
        // 只保留不在已选分类下的提示词
        return !isInSelectedCategory;
      });
    }

    return prompts;
  }, [state.fileSystem?.allPrompts, selectedCategories]);

  // 计算通过分类选择器选中的提示词数量
  const categorySelectedCount = useMemo(() => {
    if (selectedCategories.size === 0 || !state.fileSystem?.allPrompts) return 0;
    
    let count = 0;
    Array.from(state.fileSystem.allPrompts.values()).forEach(prompt => {
      const promptCategory = prompt.meta.category_path || '';
      const isInSelectedCategory = Array.from(selectedCategories).some(catPath => 
        promptCategory === catPath || 
        promptCategory.startsWith(catPath + '/') || 
        promptCategory.startsWith(catPath + '\\')
      );
      if (isInSelectedCategory) {
        count++;
      }
    });
    
    return count;
  }, [selectedCategories, state.fileSystem?.allPrompts]);

  // 过滤提示词
  const filteredPrompts = useMemo(() => {
    if (!searchQuery.trim()) return allPrompts;
    
    const query = searchQuery.toLowerCase();
    return allPrompts.filter(prompt =>
      prompt.meta.title.toLowerCase().includes(query) ||
      prompt.meta.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  }, [allPrompts, searchQuery]);

  // 切换选中状态
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredPrompts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPrompts.map(p => p.meta.id)));
    }
  };

  // 执行导出
  const handleExport = async () => {
    // 收集通过分类选择器选中的所有提示词 ID
    const categorySelectedIds = new Set<string>();
    if (selectedCategories.size > 0 && state.fileSystem?.allPrompts) {
      Array.from(state.fileSystem.allPrompts.values()).forEach(prompt => {
        const promptCategory = prompt.meta.category_path || '';
        const isInSelectedCategory = Array.from(selectedCategories).some(catPath => 
          promptCategory === catPath || 
          promptCategory.startsWith(catPath + '/') || 
          promptCategory.startsWith(catPath + '\\')
        );
        if (isInSelectedCategory) {
          categorySelectedIds.add(prompt.meta.id);
        }
      });
    }
    
    // 手动选择的卡片 ID
    const manualSelectedIds = Array.from(selectedIds);
    
    if (categorySelectedIds.size === 0 && manualSelectedIds.length === 0) {
      showToast('请至少选择一个提示词或分类', 'error');
      return;
    }

    setIsExporting(true);

    try {
      const response = await api.prompts.export({
        structuredIds: Array.from(categorySelectedIds), // 通过分类选择器选中的 → 保留结构
        flatIds: manualSelectedIds, // 手动选择的 → 扁平结构
        includeContent,
      });

      if (response.success && response.data) {
        const { prompts, total, notFound } = response.data;

        // 创建 JSON 文件并下载
        const jsonContent = JSON.stringify(prompts, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `prompts_export_${new Date().getTime()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // 显示结果
        if (notFound && notFound.length > 0) {
          showToast(`导出完成: ${total} 个成功, ${notFound.length} 个未找到`, 'warning');
        } else {
          showToast(`成功导出 ${total} 个提示词`, 'success');
        }

        onClose();
      } else {
        showToast(response.error || '导出失败', 'error');
      }
    } catch (error) {
      showToast('导出过程中发生错误', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const targetState = useMemo(() => ({
    top: '50%',
    left: '50%',
    width: 'min(92%, 900px)',
    height: 'min(85vh, 720px)',
    borderRadius: '12px',
    transform: 'translate(-50%, -50%)',
    backdropBlur: 8,
  }), []);

  return (
    <NewPromptOverlay
      isOpen={isOpen}
      originId={originId}
      targetState={targetState}
      onRequestClose={onClose}
      onClosed={onClosed}
    >
      <div className="h-full flex flex-col bg-white dark:bg-zinc-900 rounded-lg shadow-2xl overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-800">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <Download className="w-6 h-6 text-indigo-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                导出提示词
              </h2>
            </div>
            {targetCategoryPaths.length > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 ml-9">
                {targetCategoryPaths.length === 1 ? (
                  <>导出分类: {getRelativePath(targetCategoryPaths[0])}（包含子分类）</>
                ) : (
                  <>导出 {targetCategoryPaths.length} 个分类（包含子分类）</>
                )}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 分类选择器（树形导出模式且没有预选单个提示词时显示） */}
          {preserveStructure && preSelectedIds.length === 0 && (
            <div className="space-y-3 p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {preSelectedCategoryPaths.length > 0 ? '已选分类（自动包含子分类）+ 可选其他分类' : '选择要导出的分类'}
                </h3>
                <button
                  onClick={() => {
                    // 获取所有可选分类（扁平化，排除预选分类）
                    const flattenCategories = (nodes: any[], result: any[] = []): any[] => {
                      for (const node of nodes) {
                        if (!preSelectedCategoryPaths.includes(node.path)) {
                          result.push(node.path);
                        }
                        if (node.children && node.children.length > 0) {
                          flattenCategories(node.children, result);
                        }
                      }
                      return result;
                    };
                    
                    const allSelectablePaths = flattenCategories(categoryTree);
                    const currentNonPreSelected = Array.from(selectedCategories).filter(p => !preSelectedCategoryPaths.includes(p));
                    
                    if (currentNonPreSelected.length === allSelectablePaths.length) {
                      // 取消全选（保留预选分类）
                      setSelectedCategories(new Set(preSelectedCategoryPaths));
                    } else {
                      // 全选（包括预选分类）
                      setSelectedCategories(new Set([...preSelectedCategoryPaths, ...allSelectablePaths]));
                    }
                  }}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                >
                  全选/取消
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-0.5">
                {renderCategoryTree(categoryTree)}
              </div>
            </div>
          )}

          {/* 搜索栏 */}
          <div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索提示词..."
              className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* 统计信息 */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-lg">
            <div className="flex items-center gap-4">
              {categorySelectedCount > 0 && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  通过分类选中: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{categorySelectedCount}</span>
                </span>
              )}
              <span className="text-sm text-gray-600 dark:text-gray-400">
                手动选中: <span className="font-semibold text-gray-900 dark:text-white">{selectedIds.size}</span> / {filteredPrompts.length}
              </span>
              {(categorySelectedCount > 0 || selectedIds.size > 0) && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  总计: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{categorySelectedCount + selectedIds.size}</span>
                </span>
              )}
            </div>
            <button
              onClick={toggleSelectAll}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
            >
              {selectedIds.size === filteredPrompts.length ? '取消全选' : '全选'}
            </button>
          </div>

          {/* 提示词列表 */}
          <div className="max-h-96 overflow-y-auto space-y-2 bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-4">
            {filteredPrompts.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                {searchQuery ? '没有找到匹配的提示词' : '没有可导出的提示词'}
              </div>
            ) : (
              filteredPrompts.map((prompt) => (
                <div
                  key={prompt.meta.id}
                  onClick={() => toggleSelect(prompt.meta.id)}
                  className={`flex items-start gap-3 p-3 bg-white dark:bg-zinc-900 rounded border cursor-pointer transition-colors ${
                    selectedIds.has(prompt.meta.id)
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20'
                      : 'border-gray-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                  }`}
                >
                  {/* 复选框 */}
                  <div className="flex-shrink-0 mt-0.5">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        selectedIds.has(prompt.meta.id)
                          ? 'bg-indigo-500 border-indigo-500'
                          : 'border-gray-300 dark:border-zinc-600'
                      }`}
                    >
                      {selectedIds.has(prompt.meta.id) && (
                        <CheckCircle className="w-4 h-4 text-white" />
                      )}
                    </div>
                  </div>

                  {/* 提示词信息 */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {prompt.meta.title}
                    </p>
                    {prompt.meta.category && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate flex items-center gap-1">
                        <Folder className="w-3 h-3" />
                        {prompt.meta.category}
                      </p>
                    )}
                    {prompt.meta.tags && prompt.meta.tags.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {prompt.meta.tags.slice(0, 3).map((tag, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        {prompt.meta.tags.length > 3 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            +{prompt.meta.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 类型标识 */}
                  {prompt.meta.type === 'TASK' && (
                    <div className="flex-shrink-0">
                      <span className="text-xs px-2 py-1 bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded">
                        任务
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* 导出说明 */}
          <div className="p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              导出的 JSON 文件将包含标题、标签、分类路径等元数据，以及完整的提示词内容
            </p>
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || (selectedIds.size === 0 && categorySelectedCount === 0)}
            className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                导出中...
              </>
            ) : (
              <>
                <FileJson className="w-4 h-4" />
                导出 JSON ({categorySelectedCount + selectedIds.size})
              </>
            )}
          </button>
        </div>
      </div>
    </NewPromptOverlay>
  );
};
