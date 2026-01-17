/**
 * ImportPromptsDialog - 批量导入提示词对话框
 * 支持拖拽、文件选择、预览、冲突处理
 */

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { X, Upload, FileJson, AlertCircle, CheckCircle, XCircle, Clock, Plus, ChevronDown, FolderTree, FileText, Folder, FolderOpen } from 'lucide-react';
import { useApp } from '../AppContext';
import { useToast } from '../contexts/ToastContext';
import api from '../api/client';
import type { CategoryNode } from '../types';
import { NewPromptOverlay } from './NewPromptOverlay';

interface ImportPromptData {
  title: string;
  content?: string;
  tags?: string[];
  model_config?: any;
  is_favorite?: boolean;
  type?: 'NOTE' | 'TASK';
  scheduled_time?: string;
  recurrence?: any;
  author?: string;
  version?: string;
  category_path?: string;
}

interface ImportResult {
  index: number;
  title: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  reason?: string;
  id?: string;
  path?: string;
}

interface ImportPromptsDialogProps {
  isOpen: boolean;
  originId: string;
  onClose: () => void;
  onClosed: () => void;
  defaultCategoryPath?: string;
}

export const ImportPromptsDialog: React.FC<ImportPromptsDialogProps> = ({
  isOpen,
  originId,
  onClose,
  onClosed,
  // defaultCategoryPath 暂时不使用，让用户手动输入
}) => {
  const { state, refreshVault, createCategory } = useApp();
  const { showToast } = useToast();

  const [isDragging, setIsDragging] = useState(false);
  const [prompts, setPrompts] = useState<ImportPromptData[]>([]);
  // 分类选择：'root' 表示根目录，其他值为分类路径，'new' 表示新建
  const [selectedCategory, setSelectedCategory] = useState<string>('root');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [conflictStrategy, setConflictStrategy] = useState<'rename' | 'skip' | 'overwrite'>('rename');
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{
    total: number;
    success: number;
    failed: number;
    skipped: number;
    details: ImportResult[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 分析导入数据的结构
  const importStructure = useMemo(() => {
    if (prompts.length === 0) return null;

    // 检查是否有分类路径
    const hasCategories = prompts.some(p => p.category_path);

    if (!hasCategories) {
      // 没有分类，只返回提示词列表
      return {
        type: 'flat' as const,
        prompts: prompts,
      };
    }

    // 有分类，构建树形结构
    interface TreeNode {
      name: string;
      path: string;
      children: Map<string, TreeNode>;
      prompts: ImportPromptData[];
    }

    const root: TreeNode = {
      name: '',
      path: '',
      children: new Map(),
      prompts: [],
    };

    prompts.forEach(prompt => {
      if (!prompt.category_path) {
        // 没有分类路径的放到根目录
        root.prompts.push(prompt);
        return;
      }

      // 分割路径
      const parts = prompt.category_path.split('/').filter(p => p.trim());
      let current = root;

      // 构建树
      parts.forEach((part, index) => {
        if (!current.children.has(part)) {
          current.children.set(part, {
            name: part,
            path: parts.slice(0, index + 1).join('/'),
            children: new Map(),
            prompts: [],
          });
        }
        current = current.children.get(part)!;
      });

      // 添加提示词到叶子节点
      current.prompts.push(prompt);
    });

    return {
      type: 'tree' as const,
      root,
    };
  }, [prompts]);

  // 获取所有分类的扁平列表（过滤掉 trash）
  const allCategories = useMemo(() => {
    if (!state.fileSystem?.categories) return [];
    
    const flattenCategories = (nodes: CategoryNode[], prefix = ''): Array<{ name: string; path: string }> => {
      const result: Array<{ name: string; path: string }> = [];
      
      nodes.forEach(node => {
        // 跳过 trash 分类
        if (node.name.toLowerCase() === 'trash') {
          return;
        }
        
        const fullPath = prefix ? `${prefix}/${node.name}` : node.name;
        result.push({ name: fullPath, path: node.path });
        
        if (node.children && node.children.length > 0) {
          result.push(...flattenCategories(node.children, fullPath));
        }
      });
      
      return result;
    };
    
    return flattenCategories(state.fileSystem.categories);
  }, [state.fileSystem?.categories]);

  // 获取当前选中分类的显示名称
  const selectedCategoryName = useMemo(() => {
    if (selectedCategory === 'root') return '根目录';
    if (selectedCategory === 'new') return '新建分类...';
    
    const category = allCategories.find(c => c.path === selectedCategory);
    return category?.name || '根目录';
  }, [selectedCategory, allCategories]);

  // 处理新建分类
  const handleCreateCategory = useCallback(async () => {
    if (!newCategoryName.trim()) {
      showToast('请输入分类名称', 'error');
      return;
    }

    try {
      await createCategory(state.fileSystem?.root || '', newCategoryName.trim());
      showToast('分类创建成功', 'success');
      
      // 刷新后选择新建的分类
      await refreshVault();
      
      // 找到新建的分类路径
      const newCategoryPath = `${state.fileSystem?.root}/${newCategoryName.trim()}`;
      setSelectedCategory(newCategoryPath);
      setIsCreatingCategory(false);
      setNewCategoryName('');
    } catch (error) {
      showToast('分类创建失败', 'error');
    }
  }, [newCategoryName, createCategory, state.fileSystem?.root, refreshVault, showToast]);

  // 点击外部关闭下拉菜单
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };

    if (showCategoryDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCategoryDropdown]);

  // 解析 JSON 文件
  const parseJsonFile = useCallback(async (file: File): Promise<ImportPromptData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);

          // 支持单个对象或数组
          const prompts = Array.isArray(data) ? data : [data];

          // 验证数据结构
          const validPrompts = prompts.filter((p: any) => {
            if (!p.title || typeof p.title !== 'string') {
              return false;
            }
            return true;
          });

          resolve(validPrompts);
        } catch (error) {
          reject(new Error('Invalid JSON format'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }, []);

  // 处理文件选择
  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const allPrompts: ImportPromptData[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!file.name.endsWith('.json')) {
        showToast('只支持 JSON 格式文件', 'error');
        continue;
      }

      try {
        const filePrompts = await parseJsonFile(file);
        allPrompts.push(...filePrompts);
      } catch (error) {
        showToast(`解析文件失败: ${file.name}`, 'error');
      }
    }

    if (allPrompts.length > 0) {
      setPrompts(allPrompts);
      showToast(`已加载 ${allPrompts.length} 个提示词`, 'success');
    }
  }, [parseJsonFile, showToast]);

  // 拖拽处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  // 执行导入
  const handleImport = useCallback(async () => {
    if (prompts.length === 0) {
      showToast('请先选择要导入的文件', 'error');
      return;
    }

    setIsImporting(true);

    try {
      // 确定目标分类路径（仅用于没有 category_path 的提示词）
      let targetPath: string | undefined;
      if (selectedCategory !== 'root') {
        // 使用选中的分类路径，转换为相对路径
        const category = allCategories.find(c => c.path === selectedCategory);
        if (category) {
          targetPath = category.name; // 使用相对路径，如 "Coding" 或 "Business/Projects"
        }
      }

      // 注意：如果提示词自带 category_path，后端会优先使用提示词的 category_path
      const response = await api.prompts.import({
        prompts,
        categoryPath: targetPath,
        conflictStrategy,
      });

      if (response.success && response.data) {
        setImportResults(response.data);
        
        // 刷新 Vault
        await refreshVault();

        // 显示总结
        const { success, failed, skipped, total } = response.data;
        showToast(
          `导入完成: 成功 ${success}/${total}, 失败 ${failed}, 跳过 ${skipped}`,
          success > 0 ? 'success' : 'error'
        );
      } else {
        showToast(response.error || '导入失败', 'error');
      }
    } catch (error) {
      showToast('导入过程中发生错误', 'error');
    } finally {
      setIsImporting(false);
    }
  }, [prompts, selectedCategory, allCategories, conflictStrategy, refreshVault, showToast]);

  // 重置状态
  const handleReset = useCallback(() => {
    setPrompts([]);
    setImportResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // 渲染树形结构节点
  const renderTreeNode = (node: any, level = 0) => {
    const hasChildren = node.children && node.children.size > 0;
    const hasPrompts = node.prompts && node.prompts.length > 0;
    const FolderIcon = hasChildren ? FolderOpen : Folder;

    return (
      <div key={node.path || 'root'} className="text-sm">
        {node.name && (
          <div
            className="flex items-center gap-2 py-1 text-gray-700 dark:text-gray-300"
            style={{ paddingLeft: `${level * 16}px` }}
          >
            <FolderIcon className="w-4 h-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
            <span className="font-medium">{node.name}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({node.prompts.length})
            </span>
          </div>
        )}

        {/* 渲染当前节点的提示词 */}
        {hasPrompts && (
          <div className="space-y-1" style={{ paddingLeft: `${(level + 1) * 16}px` }}>
            {node.prompts.slice(0, 3).map((prompt: ImportPromptData, index: number) => (
              <div key={index} className="flex items-center gap-2 py-0.5 text-gray-600 dark:text-gray-400">
                <FileText className="w-3 h-3 flex-shrink-0" />
                <span className="truncate text-xs">{prompt.title}</span>
                {prompt.type === 'TASK' && (
                  <Clock className="w-3 h-3 text-rose-500 flex-shrink-0" />
                )}
              </div>
            ))}
            {node.prompts.length > 3 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 pl-5">
                还有 {node.prompts.length - 3} 个...
              </div>
            )}
          </div>
        )}

        {/* 递归渲染子节点 */}
        {hasChildren && (
          <div>
            {Array.from(node.children.values()).map((child: any) =>
              renderTreeNode(child, level + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  const targetState = useMemo(() => ({
    top: '50%',
    left: '50%',
    width: 'min(90%, 750px)',
    height: 'min(80vh, 650px)',
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
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <Upload className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              批量导入提示词
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-zinc-900">
          {/* 文件上传区域 - 只在没有选择文件且没有导入结果时显示 */}
          {!importResults && prompts.length === 0 && (
            <div className="flex items-center justify-center h-full px-4">
              <div className="w-full max-w-3xl">
                <div
                  className={`border-2 border-dashed rounded-2xl py-20 px-16 text-center transition-colors ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-400'
                      : 'border-gray-300 dark:border-zinc-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-gray-50 dark:bg-zinc-950'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <FileJson className="w-24 h-24 mx-auto mb-8 text-gray-400 dark:text-zinc-500" />
                  <p className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-4">
                    拖拽 JSON 文件到此处
                  </p>
                  <p className="text-base text-gray-500 dark:text-gray-400 mb-8">
                    或点击下方按钮选择文件
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    multiple
                    onChange={(e) => handleFileSelect(e.target.files)}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-10 py-3.5 bg-indigo-500 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-sm font-medium text-lg"
                  >
                    选择文件
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 预览区域 - 选择文件后显示 */}
          {!importResults && prompts.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-medium text-gray-900 dark:text-white">
                      待导入提示词 ({prompts.length})
                    </h3>
                    <button
                      onClick={handleReset}
                      className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-3 py-1 rounded hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors"
                    >
                      清空
                    </button>
                  </div>

                  {/* 结构预览 - 只显示分类结构 */}
                  {importStructure && (
                    <div className="bg-gray-50 dark:bg-zinc-950 rounded-lg p-3 border border-gray-200 dark:border-zinc-700">
                      <div className="flex items-center gap-2 mb-2">
                        <FolderTree className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          导入结构预览
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ({prompts.length} 个提示词)
                        </span>
                      </div>

                      <div className="max-h-48 overflow-y-auto bg-white dark:bg-zinc-900 rounded border border-gray-200 dark:border-zinc-700 p-2.5">
                        {importStructure.type === 'flat' ? (
                          // 扁平结构：显示提示词数量
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            <p className="mb-1.5">无分类结构，将导入到选定的目标分类</p>
                            <p className="text-indigo-600 dark:text-indigo-400 font-medium">
                              共 {prompts.length} 个提示词
                            </p>
                          </div>
                        ) : (
                          // 树形结构：显示分类树
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                              包含分类结构，将按照 JSON 中的路径导入
                            </div>
                            {importStructure.root.prompts.length > 0 && (
                              <div className="mb-1.5">
                                <div className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-1">
                                  根目录 ({importStructure.root.prompts.length})
                                </div>
                              </div>
                            )}
                            {Array.from(importStructure.root.children.values()).map((child: any) =>
                              renderTreeNode(child, 0)
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 导入配置 */}
                  <div className="space-y-3 p-3 bg-gray-50 dark:bg-zinc-950 rounded-lg border border-gray-200 dark:border-zinc-700">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                          目标分类
                        </label>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          提示词自带分类时优先使用
                        </span>
                      </div>
                      
                      {/* 分类选择下拉菜单 */}
                      <div className="relative" ref={dropdownRef}>
                        <button
                          type="button"
                          onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                          className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 flex items-center justify-between text-left hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
                        >
                          <span className="text-gray-900 dark:text-white">{selectedCategoryName}</span>
                          <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        </button>

                        {showCategoryDropdown && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-600 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                            {/* 根目录选项 */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCategory('root');
                                setShowCategoryDropdown(false);
                                setIsCreatingCategory(false);
                              }}
                              className={`w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors ${
                                selectedCategory === 'root' ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              根目录
                            </button>

                            {/* 现有分类列表 */}
                            {allCategories.map((category) => (
                              <button
                                key={category.path}
                                type="button"
                                onClick={() => {
                                  setSelectedCategory(category.path);
                                  setShowCategoryDropdown(false);
                                  setIsCreatingCategory(false);
                                }}
                                className={`w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors ${
                                  selectedCategory === category.path ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                {category.name}
                              </button>
                            ))}

                            {/* 新建分类选项 */}
                            <button
                              type="button"
                              onClick={() => {
                                setIsCreatingCategory(true);
                                setShowCategoryDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-indigo-600 dark:text-indigo-400 flex items-center gap-2 border-t border-gray-200 dark:border-zinc-700 font-medium"
                            >
                              <Plus className="w-4 h-4" />
                              新建分类...
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 新建分类输入框 */}
                      {isCreatingCategory && (
                        <div className="mt-2 p-3 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-300 dark:border-indigo-700 rounded-lg">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                            新分类名称
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newCategoryName}
                              onChange={(e) => setNewCategoryName(e.target.value)}
                              placeholder="输入分类名称"
                              className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleCreateCategory();
                                } else if (e.key === 'Escape') {
                                  setIsCreatingCategory(false);
                                  setNewCategoryName('');
                                }
                              }}
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={handleCreateCategory}
                              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-sm"
                            >
                              创建
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsCreatingCategory(false);
                                setNewCategoryName('');
                              }}
                              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                        冲突处理策略
                      </label>
                      <div className="flex gap-2">
                        {[
                          { value: 'rename', label: '自动重命名' },
                          { value: 'skip', label: '跳过' },
                          { value: 'overwrite', label: '覆盖' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            onClick={() => setConflictStrategy(option.value as any)}
                            className={`flex-1 px-4 py-2 rounded-lg border transition-colors font-medium ${
                              conflictStrategy === option.value
                                ? 'bg-indigo-500 text-white border-indigo-500 dark:bg-indigo-600 dark:border-indigo-600 shadow-sm'
                                : 'bg-gray-50 dark:bg-zinc-950 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-zinc-600 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-white dark:hover:bg-zinc-900'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

          {/* 导入结果 */}
          {importResults && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  导入结果
                </h3>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-sm font-medium"
                >
                  继续导入
                </button>
              </div>

              {/* 统计信息 */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 shadow-sm">
                  <p className="text-sm text-gray-500 dark:text-gray-400">总计</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {importResults.total}
                  </p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900/50 shadow-sm">
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">成功</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {importResults.success}
                  </p>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900/50 shadow-sm">
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium">失败</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {importResults.failed}
                  </p>
                </div>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-900/50 shadow-sm">
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">跳过</p>
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {importResults.skipped}
                  </p>
                </div>
              </div>

              {/* 详细结果 */}
              <div className="max-h-96 overflow-y-auto space-y-2 bg-gray-50 dark:bg-zinc-950 rounded-lg p-4 border border-gray-200 dark:border-zinc-700 shadow-sm">
                {importResults.details.map((result, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 bg-white dark:bg-zinc-900 rounded border border-gray-200 dark:border-zinc-700"
                  >
                    {result.status === 'success' && (
                      <CheckCircle className="w-5 h-5 text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    )}
                    {result.status === 'failed' && (
                      <XCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                    {result.status === 'skipped' && (
                      <AlertCircle className="w-5 h-5 text-yellow-500 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {result.title}
                      </p>
                      {(result.error || result.reason) && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {result.error || result.reason}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        {!importResults && prompts.length > 0 && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
            <button
              onClick={onClose}
              className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors font-medium border border-gray-300 dark:border-zinc-600"
            >
              取消
            </button>
            <button
              onClick={handleImport}
              disabled={isImporting}
              className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500 disabled:bg-gray-400 dark:disabled:bg-zinc-700 disabled:text-gray-300 dark:disabled:text-zinc-500 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm font-medium"
            >
              {isImporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  导入中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  开始导入
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </NewPromptOverlay>
  );
};
