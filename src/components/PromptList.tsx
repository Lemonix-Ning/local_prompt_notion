/**
 * PromptList 组件
 * Notion 风格的卡片网格布局
 */

import {
  Plus,
  Copy,
  Star,
  Trash2,
  X,
  Folder,
  FolderOpen,
  RotateCcw,
  Search,
  Minus,
  Square,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useApp } from '../AppContext';
import { useEffect, useRef, useState, type ReactNode } from 'react';
// EditorPage 现在通过 EditorOverlay 系统使用，不再直接导入
import api from '../api/client';
import { getSmartIcon } from '../utils/smartIcon';
import { getIconGradientConfig, getTagStyle } from '../utils/tagColors';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { Button } from './Button';
import { NewPromptOverlay } from './NewPromptOverlay';

function SpotlightCard({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  return (
    <div
      onClick={onClick}
      onMouseMove={(e) => {
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={`relative rounded-xl border border-border bg-card/50 overflow-hidden group transition-colors ${className || ''}`}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(255,255,255,0.06), transparent 40%)`,
        }}
      />
      {/* 浅色模式光效 */}
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100 dark:hidden"
        style={{
          opacity: opacity * 0.3,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(0,0,0,0.04), transparent 40%)`,
        }}
      />
      <div className="relative h-full flex flex-col">{children}</div>
    </div>
  );
}

// 保留旧函数作为备用，现在直接使用新的哈希颜色系统
const getTagColor = (tag: string) => {
  return getTagStyle(tag);
};

export function PromptList() {
  const { state, dispatch, getFilteredPrompts, createPrompt, savePrompt, deletePrompt, restorePrompt, createCategory } = useApp();
  const { searchQuery, selectedCategory, uiState } = state;
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const newPromptDraftKey = 'newPromptDraft';
  const [isSwitchingList, setIsSwitchingList] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');
  const categoryPopoverRef = useRef<HTMLDivElement | null>(null);
  const [dropdownCreatingParentPath, setDropdownCreatingParentPath] = useState<string | null>(null);
  const [dropdownNewCategoryName, setDropdownNewCategoryName] = useState('');
  const dropdownNewCategoryInputRef = useRef<HTMLInputElement | null>(null);
  const [newPrompt, setNewPrompt] = useState({ 
    title: '', 
    content: '', 
    category: '', 
    tags: '' 
  });
  // 现在使用 EditorOverlay 系统，不再需要本地编辑状态
  // const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [trashCounts, setTrashCounts] = useState<Record<string, number>>({});
  const trashThreshold = 10;

  // 窗口控制状态
  const [isMaximized, setIsMaximized] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const prompts = getFilteredPrompts();
  const isModalOpen = uiState.newPromptModal.isOpen;
  const preselectedCategory = uiState.newPromptModal.preselectedCategory;

  const [newPromptOverlayMounted, setNewPromptOverlayMounted] = useState(false);
  const [newPromptOverlayOpen, setNewPromptOverlayOpen] = useState(false);

  const getHasAnyDraftContent = (v: { title: string; content: string; category: string; tags: string }) => {
    return Boolean(v.title.trim() || v.content.trim() || v.category.trim() || v.tags.trim());
  };

  const getIsNewPromptComplete = (v: { title: string; content: string; category: string }) => {
    // 分类可为空（公共），所以“完成”只取决于标题 + 内容
    return Boolean(v.title.trim() && v.content.trim());
  };

  const restoreNewPromptDraft = () => {
    try {
      const raw = localStorage.getItem(newPromptDraftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { title?: string; content?: string; category?: string; tags?: string };
      setNewPrompt((prev) => ({
        ...prev,
        title: typeof parsed.title === 'string' ? parsed.title : prev.title,
        content: typeof parsed.content === 'string' ? parsed.content : prev.content,
        category: typeof parsed.category === 'string' ? parsed.category : prev.category,
        tags: typeof parsed.tags === 'string' ? parsed.tags : prev.tags,
      }));
    } catch {
    }
  };

  const persistNewPromptDraftIfNeeded = () => {
    const hasAny = getHasAnyDraftContent(newPrompt);
    const complete = getIsNewPromptComplete(newPrompt);

    if (!hasAny) {
      try {
        localStorage.removeItem(newPromptDraftKey);
      } catch {
      }
      return;
    }

    if (complete) {
      try {
        localStorage.removeItem(newPromptDraftKey);
      } catch {
      }
      return;
    }

    try {
      localStorage.setItem(newPromptDraftKey, JSON.stringify(newPrompt));
    } catch {
    }
  };

  const clearNewPromptDraft = () => {
    try {
      localStorage.removeItem(newPromptDraftKey);
    } catch {
    }
  };

  const openNewPrompt = () => {
    dispatch({ type: 'OPEN_NEW_PROMPT_MODAL' });
    setNewPromptOverlayMounted(true);
    setNewPromptOverlayOpen(true);
  };

  const requestCloseNewPrompt = () => {
    persistNewPromptDraftIfNeeded();
    setNewPromptOverlayOpen(false);
  };

  useEffect(() => {
    if (isModalOpen) {
      restoreNewPromptDraft();
      setNewPromptOverlayMounted(true);
      setNewPromptOverlayOpen(true);
      return;
    }

    if (!isModalOpen) {
      setIsCategoryOpen(false);
      setCategoryQuery('');
      setDropdownCreatingParentPath(null);
      setDropdownNewCategoryName('');
    }
  }, [isModalOpen]);

  useEffect(() => {
    if (!isCategoryOpen) {
      setDropdownCreatingParentPath(null);
      setDropdownNewCategoryName('');
    }
  }, [isCategoryOpen]);

  useEffect(() => {
    if (isCategoryOpen && dropdownCreatingParentPath && dropdownNewCategoryInputRef.current) {
      dropdownNewCategoryInputRef.current.focus();
      dropdownNewCategoryInputRef.current.select();
    }
  }, [isCategoryOpen, dropdownCreatingParentPath]);

  // 处理预选分类
  useEffect(() => {
    if (isModalOpen && preselectedCategory) {
      // 根据分类路径找到分类名称
      const findCategoryNameByPath = (nodes: any[], path: string): string | null => {
        for (const node of nodes) {
          if (node.path === path) return node.name;
          if (node.children && node.children.length > 0) {
            const found = findCategoryNameByPath(node.children, path);
            if (found) return found;
          }
        }
        return null;
      };
      
      if (state.fileSystem?.categories) {
        const categoryName = findCategoryNameByPath(state.fileSystem.categories, preselectedCategory);
        if (categoryName) {
          setNewPrompt(prev => ({ ...prev, category: categoryName }));
        }
      }
    }
  }, [isModalOpen, preselectedCategory, state.fileSystem]);

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

  // 窗口控制函数
  useEffect(() => {
    // 监听窗口状态变化
    const checkMaximized = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const appWindow = getCurrentWindow();
        const maximized = await appWindow.isMaximized();
        setIsMaximized(maximized);
      } catch (error) {
        // 忽略错误，可能不在Tauri环境中
      }
    };

    checkMaximized();

    // 监听窗口状态变化事件
    let unlisten: (() => void) | undefined;
    
    const setupListener = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const appWindow = getCurrentWindow();
        
        unlisten = await appWindow.onResized(() => {
          checkMaximized();
        });
      } catch (error) {
        // 忽略错误
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const handleMinimize = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();
      await appWindow.minimize();
    } catch (error) {
      console.error('Failed to minimize window:', error);
      showToast('最小化失败: ' + (error instanceof Error ? error.message : String(error)), 'error');
    }
  };

  const handleMaximize = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();
      if (isMaximized) {
        await appWindow.unmaximize();
      } else {
        await appWindow.maximize();
      }
    } catch (error) {
      console.error('Failed to toggle maximize:', error);
      showToast('窗口最大化失败: ' + (error instanceof Error ? error.message : String(error)), 'error');
    }
  };

  const handleDragStart = async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('select')
    ) {
      return;
    }

    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();
      await appWindow.startDragging();
    } catch (error) {
      console.error('Failed to start dragging window:', error);
    }
  };

  const handleClose = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();
      await appWindow.close();
    } catch (error) {
      console.error('Failed to close window:', error);
      showToast('关闭窗口失败: ' + (error instanceof Error ? error.message : String(error)), 'error');
    }
  };

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

  // 扁平化分类树结构，保留层级信息
  interface FlatCategory {
    name: string;
    path: string;
    level: number;
    hasChildren: boolean;
  }

  const getFlatCategories = (): FlatCategory[] => {
    const flatCategories: FlatCategory[] = [];
    
    const traverse = (nodes: any[], level: number = 0) => {
      if (!nodes || !Array.isArray(nodes)) return;
      
      nodes.forEach(node => {
        if (node && node.name && !node.name.toLowerCase().includes('trash')) {
          const hasChildren = node.children && Array.isArray(node.children) && node.children.length > 0;
          
          flatCategories.push({
            name: node.name,
            path: node.path,
            level,
            hasChildren
          });
          
          if (hasChildren) {
            traverse(node.children, level + 1);
          }
        }
      });
    };
    
    if (state.fileSystem?.categories && Array.isArray(state.fileSystem.categories)) {
      traverse(state.fileSystem.categories);
    }
    
    return flatCategories;
  };

  const allFlatCategories = getFlatCategories();
  const filteredCategories = categoryQuery
    ? allFlatCategories.filter((c) => c.name.toLowerCase().includes(categoryQuery.toLowerCase()))
    : allFlatCategories;

  const handleStartCreateSubCategoryFromDropdown = (parentPath: string) => {
    setDropdownCreatingParentPath(parentPath);
    setDropdownNewCategoryName('');
  };

  const handleCancelCreateSubCategoryFromDropdown = () => {
    setDropdownCreatingParentPath(null);
    setDropdownNewCategoryName('');
  };

  const handleSubmitCreateSubCategoryFromDropdown = async () => {
    const name = dropdownNewCategoryName.trim();
    const parentPath = dropdownCreatingParentPath;
    if (!name || !parentPath) {
      handleCancelCreateSubCategoryFromDropdown();
      return;
    }
    if (!state.fileSystem) {
      showToast('尚未加载 Vault，无法创建分类', 'warning');
      return;
    }

    try {
      await createCategory(parentPath, name);
      setNewPrompt((prev) => ({ ...prev, category: name }));
      handleCancelCreateSubCategoryFromDropdown();
      setIsCategoryOpen(false);
      setCategoryQuery('');
      showToast('分类创建成功', 'success');
    } catch (error) {
      showToast(`创建分类失败: ${(error as Error).message}`, 'error');
    }
  };

  const handleDropdownNewCategoryKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmitCreateSubCategoryFromDropdown();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelCreateSubCategoryFromDropdown();
    }
  };

  // 单击进入编辑页面 - 使用动画覆盖层
  const handleCardClick = (promptId: string) => {
    const originCardId = `prompt-card-${promptId}`;
    dispatch({ 
      type: 'OPEN_EDITOR_OVERLAY', 
      payload: { promptId, originCardId } 
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showToast("已复制到剪贴板", 'success'))
      .catch(() => showToast("复制失败", 'error'));
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
      showToast("更新失败", 'error');
    }
  };

  const handleDelete = async (promptId: string) => {
    const isInTrash = selectedCategory === 'trash';
    
    if (isInTrash) {
      // 在回收站中,永久删除
      const confirmed = await confirm({
        title: '永久删除提示词',
        message: '确定要永久删除这个提示词吗？此操作无法撤销！',
        confirmText: '永久删除',
        cancelText: '取消',
        type: 'danger'
      });
      
      if (confirmed) {
        try {
          await deletePrompt(promptId, true); // permanent = true
          showToast("已永久删除", 'success');
        } catch (error) {
          showToast("删除失败", 'error');
        }
      }
    } else {
      // 不在回收站,移动到回收站
      const confirmed = await confirm({
        title: '删除提示词',
        message: '确定要删除这个提示词吗？',
        confirmText: '删除',
        cancelText: '取消',
        type: 'warning'
      });
      
      if (confirmed) {
        try {
          await deletePrompt(promptId, false);
          showToast("已移动到回收站", 'success');
        } catch (error) {
          showToast("删除失败", 'error');
        }
      }
    }
  };

  const handleRestore = async (promptId: string) => {
    try {
      await restorePrompt(promptId);
      showToast("已恢复", 'success');
    } catch (error) {
      showToast("恢复失败", 'error');
    }
  };

  const handleAddPrompt = async () => {
    if (!newPrompt.title || !newPrompt.content) {
      showToast("请填写标题和内容", 'warning');
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

      if (newPrompt.category) {
        if (state.fileSystem?.categories) {
          categoryPath = findCategoryPath(state.fileSystem.categories, newPrompt.category) || '';
        }

        if (!categoryPath) {
          showToast("找不到指定的分类", 'error');
          return;
        }
      } else {
        // 公共（根目录）
        categoryPath = state.fileSystem?.root || '';
        if (!categoryPath) {
          showToast('尚未加载 Vault，无法创建', 'warning');
          return;
        }
      }

      const normalizeTagKey = (t: string) => t.trim().toLowerCase();
      const dedupeTags = (arr: string[]) => {
        const seen = new Set<string>();
        const out: string[] = [];
        for (const raw of arr) {
          const v = (raw || '').trim();
          if (!v) continue;
          const key = normalizeTagKey(v);
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(v);
        }
        return out;
      };

      // 准备标签(分类标签 + 用户标签)
      const userTags = newPrompt.tags ? newPrompt.tags.split(',').map(t => t.trim()).filter(t => t) : [];
      const rawTags = [...(newPrompt.category ? [newPrompt.category] : []), ...userTags];
      const allTags = dedupeTags(rawTags);

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
      clearNewPromptDraft();
      // 创建成功：直接关闭，不走 persist（否则可能把旧值误写回草稿）
      setNewPromptOverlayOpen(false);
      showToast("已创建新提示词", 'success');
    } catch (error) {
      showToast('创建失败: ' + (error as Error).message, 'error');
    }
  };

  // 现在使用全局 EditorOverlay 系统，不再需要本地编辑页面渲染
  // if (editingPromptId) {
  //   return <EditorPage promptId={editingPromptId} onClose={() => setEditingPromptId(null)} />;
  // }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-transparent">
      {/* Top Navigation Bar */}
      <div 
        className="h-16 flex items-center justify-between px-6 border-b border-border flex-shrink-0 bg-background/50 backdrop-blur-md z-10 sticky top-0"
        data-tauri-drag-region="true"
        onMouseDown={handleDragStart}
      >
        {/* 左侧：侧边栏切换按钮 */}
        <div className="flex items-center">
          <button 
            onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
            data-tauri-drag-region={false}
            className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            {uiState.sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
        </div>

        {/* 中间：搜索框 */}
        <div className="flex-1 max-w-lg mx-8">
          <div className={`
            relative flex items-center rounded-lg transition-all duration-200
            ${isSearchFocused 
              ? 'bg-accent ring-2 ring-primary/50' 
              : 'bg-input hover:bg-accent'
            }
          `}>
            <Search 
              size={16} 
              className="ml-3 text-muted-foreground transition-colors" 
            />
            <input
              type="text"
              placeholder="搜索提示词..."
              value={searchQuery}
              onChange={(e) => dispatch({ type: 'SET_SEARCH', payload: e.target.value })}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              data-tauri-drag-region={false}
              className="flex-1 px-3 py-2 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button
                onClick={() => dispatch({ type: 'SET_SEARCH', payload: '' })}
                data-tauri-drag-region={false}
                className="mr-2 p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                title="清除搜索"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* 右侧：窗口控制按钮 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleMinimize}
            data-tauri-drag-region={false}
            className="p-2 rounded-lg transition-colors hover:bg-accent text-muted-foreground hover:text-foreground"
            title="最小化"
          >
            <Minus size={16} />
          </button>
          
          <button
            onClick={handleMaximize}
            data-tauri-drag-region={false}
            className="p-2 rounded-lg transition-colors hover:bg-accent text-muted-foreground hover:text-foreground"
            title={isMaximized ? "还原" : "最大化"}
          >
            {isMaximized ? <Maximize2 size={14} /> : <Square size={14} />}
          </button>
          
          <button
            onClick={handleClose}
            data-tauri-drag-region={false}
            className="p-2 rounded-lg transition-colors hover:bg-red-500 hover:text-white text-muted-foreground"
            title="关闭"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto bg-background/30">
        <div className={`max-w-6xl mx-auto px-6 py-8 pb-20 relative no-scrollbar transition-opacity duration-150 ${isSwitchingList ? 'opacity-70' : 'opacity-100'}`}>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight animate-fade-in mb-6">
            我的提示词库
          </h1>

          {/* Content Toolbar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{prompts.length}</span> 个项目
            </div>
            <Button
              onClick={openNewPrompt}
              className="btn-create px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors shadow-sm"
              id="new-prompt-button"
            >
              <Plus size={16} /> 新建
            </Button>
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
                onClick={() => {
                  if (!isInTrash) {
                    handleCardClick(prompt.meta.id);
                  }
                }}
                className={`p-5 flex flex-col h-64 ${isInTrash ? 'cursor-default opacity-75' : 'cursor-pointer'}`}
              >
                {/* 为动画系统添加唯一ID */}
                <div id={`prompt-card-${prompt.meta.id}`} className="w-full h-full flex flex-col">
                {/* Card Header */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 pr-4 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      {(() => {
                        const Icon = getSmartIcon(prompt.meta.title, prompt.meta.tags);
                        const gradient = getIconGradientConfig(prompt.meta.tags);
                        return (
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                              backgroundImage: gradient.backgroundImage,
                              border: gradient.border,
                              boxShadow: gradient.boxShadow,
                            }}
                            title={(prompt.meta.tags || []).join(', ')}
                          >
                            <Icon size={18} style={{ color: gradient.iconColor }} />
                          </div>
                        );
                      })()}
                      <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors" title={prompt.meta.title}>{prompt.meta.title}</h3>
                      {isInTrash && (
                        <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 bg-muted/50">
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
                      className={`p-1.5 rounded-lg hover:bg-accent transition-colors ${prompt.meta.is_favorite ? 'text-yellow-400' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      <Star size={16} fill={prompt.meta.is_favorite ? "currentColor" : "none"} />
                    </button>
                  )}
                </div>

                {/* Card Content Preview */}
                <div className="flex-1 bg-muted/40 rounded-lg p-2.5 text-xs text-muted-foreground font-mono overflow-y-auto border-0 dark:border dark:border-border mb-3 whitespace-pre-wrap leading-relaxed no-scrollbar">
                  {prompt.content}
                </div>

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <span className="text-[10px] text-muted-foreground font-mono">更新于 {new Date(prompt.meta.updated_at).toLocaleDateString()}</span>
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
                          className="p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-400 rounded-lg transition-colors"
                          title="永久删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(prompt.meta.id); }}
                          className="p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-400 rounded-lg transition-colors"
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleCopy(prompt.content); }}
                          className="flex items-center gap-1 bg-accent border border-border hover:bg-accent/80 px-2 py-1 rounded text-xs font-medium text-foreground transition-all active:scale-95"
                        >
                          <Copy size={12} /> 复制
                        </button>
                      </>
                    )}
                  </div>
                </div>
                </div>
              </SpotlightCard>
            )})}
          </div>

          {/* Empty State */}
          {prompts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground select-none">
              <div className="text-5xl mb-4 grayscale opacity-50">🥥</div>
              <p className="text-sm">没有找到相关内容</p>
              <button 
                onClick={() => { dispatch({ type: 'SELECT_CATEGORY', payload: null }); dispatch({ type: 'SET_SEARCH', payload: '' }); }}
                className="text-primary text-sm mt-3 hover:underline"
              >
                显示全部
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add New Prompt Modal */}
      {newPromptOverlayMounted && (
        <NewPromptOverlay
          isOpen={newPromptOverlayOpen}
          originId="new-prompt-button"
          onRequestClose={requestCloseNewPrompt}
          onClosed={() => {
            dispatch({ type: 'CLOSE_NEW_PROMPT_MODAL' });
            setNewPromptOverlayMounted(false);
          }}
        >
          <div className="bg-background border border-border rounded-2xl shadow-2xl w-full h-full flex flex-col overflow-hidden backdrop-blur-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 create-soft-bg rounded-lg flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="create-accent-text">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="12" y1="18" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="9" y1="15" x2="15" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-foreground">新建页面</h2>
              </div>
              <Button
                onClick={requestCloseNewPrompt}
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground hover:bg-accent"
                aria-label="关闭"
              >
                <X size={20} />
              </Button>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Top Form Section */}
              <div className="px-6 py-6 space-y-6 border-b border-border bg-background">
                {/* 标题 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">标题</label>
                  <input 
                    type="text" 
                    placeholder="输入提示词标题..." 
                    className="w-full px-4 py-3 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 text-foreground placeholder:text-muted-foreground transition-all"
                    value={newPrompt.title}
                    onChange={(e) => setNewPrompt({...newPrompt, title: e.target.value})}
                    autoFocus
                  />
                </div>

                {/* 分类位置 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">分类位置</label>
                  <div className="relative" ref={categoryPopoverRef}>
                    <Button
                      onClick={() => setIsCategoryOpen((v) => !v)}
                      className="w-full flex items-center justify-between bg-input px-4 py-3 rounded-lg border border-border hover:bg-accent focus:outline-none transition-all text-foreground group"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {newPrompt.category ? (
                          <>
                            <FolderOpen size={16} className="notion-sidebar-folder active flex-shrink-0" />
                            <span className="text-foreground truncate font-medium">{newPrompt.category}</span>
                          </>
                        ) : (
                          <>
                            <Folder size={16} className="notion-sidebar-folder flex-shrink-0 opacity-70" />
                            <span className="text-muted-foreground">公共（全部可见）</span>
                          </>
                        )}
                      </div>
                      <div className={`transition-transform duration-200 ${isCategoryOpen ? 'rotate-180' : ''}`}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-muted-foreground">
                          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </Button>

                    {isCategoryOpen && (
                      <div className="absolute left-0 right-0 top-full mt-2 z-[60] rounded-xl border border-border bg-background backdrop-blur-xl shadow-2xl overflow-hidden animate-fade-in">
                        {/* 搜索框 */}
                        <div className="p-3 border-b border-border bg-background">
                          <div className="relative">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                              <path d="M7.333 12.667A5.333 5.333 0 1 0 7.333 2a5.333 5.333 0 0 0 0 10.667ZM14 14l-2.9-2.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <input
                              value={categoryQuery}
                              onChange={(e) => setCategoryQuery(e.target.value)}
                              placeholder="搜索分类..."
                              className="w-full bg-input pl-9 pr-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground text-sm"
                              autoFocus
                            />
                          </div>
                        </div>

                        {/* 分类列表 */}
                        <div className="max-h-60 overflow-y-auto">
                          {/* 公共（无分类） */}
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setNewPrompt({ ...newPrompt, category: '' });
                              setIsCategoryOpen(false);
                              setCategoryQuery('');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setNewPrompt({ ...newPrompt, category: '' });
                                setIsCategoryOpen(false);
                                setCategoryQuery('');
                              }
                            }}
                            className={`w-full text-left py-2.5 text-sm transition-all duration-200 flex items-center group relative cursor-pointer ${
                              !newPrompt.category
                                ? 'bg-accent text-foreground shadow-sm'
                                : 'text-foreground hover:bg-accent hover:shadow-sm'
                            }`}
                            style={{ paddingLeft: '16px', paddingRight: '8px' }}
                          >
                            <div className={`absolute left-0 top-0 bottom-0 w-1 create-accent-bar transition-all duration-200 ${
                              !newPrompt.category
                                ? 'opacity-100'
                                : 'opacity-0 group-hover:opacity-100'
                            }`} />
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                <Folder size={16} className={`flex-shrink-0 ${!newPrompt.category ? 'notion-sidebar-folder active' : 'notion-sidebar-folder'}`} />
                                <span className="truncate font-medium group-hover:font-semibold transition-all">公共（全部可见）</span>
                              </div>
                            </div>
                          </div>

                          {filteredCategories.length === 0 ? (
                            <div className="px-4 py-6 text-center">
                              <div className="text-muted-foreground text-sm">没有匹配的分类</div>
                              <div className="text-muted-foreground text-xs mt-1">尝试使用不同的关键词</div>
                            </div>
                          ) : (
                            filteredCategories.map((cat) => {
                              // 生成层级缩进和引导线
                              const indent = cat.level * 16; // 每层级16px缩进
                              const prefix = cat.level > 0 ? '└ ' : '';
                              
                              return (
                                <div key={cat.path}>
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => {
                                      setNewPrompt({ ...newPrompt, category: cat.name });
                                      setIsCategoryOpen(false);
                                      setCategoryQuery('');
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setNewPrompt({ ...newPrompt, category: cat.name });
                                        setIsCategoryOpen(false);
                                        setCategoryQuery('');
                                      }
                                    }}
                                    className={`w-full text-left py-2.5 text-sm transition-all duration-200 flex items-center group relative cursor-pointer ${
                                      newPrompt.category === cat.name
                                        ? 'bg-accent text-foreground shadow-sm'
                                        : 'text-foreground hover:bg-accent hover:shadow-sm'
                                    }`}
                                    style={{ paddingLeft: `${16 + indent}px`, paddingRight: '8px' }}
                                  >
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 create-accent-bar transition-all duration-200 ${
                                      newPrompt.category === cat.name 
                                        ? 'opacity-100' 
                                        : 'opacity-0 group-hover:opacity-100'
                                    }`} />
                                    
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      {cat.level > 0 && (
                                        <span className="text-muted-foreground text-xs font-mono leading-none group-hover:text-foreground transition-colors">
                                          {prefix}
                                        </span>
                                      )}
                                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                        {cat.hasChildren ? (
                                          <FolderOpen
                                            size={16}
                                            className={`${
                                              newPrompt.category === cat.name
                                                ? 'notion-sidebar-folder active'
                                                : 'notion-sidebar-folder'
                                            } flex-shrink-0`}
                                          />
                                        ) : (
                                          <Folder
                                            size={16}
                                            className={`${
                                              newPrompt.category === cat.name
                                                ? 'notion-sidebar-folder active'
                                                : 'notion-sidebar-folder'
                                            } flex-shrink-0`}
                                          />
                                        )}
                                        <span className="truncate font-medium group-hover:font-semibold transition-all">{cat.name}</span>
                                      </div>
                                    </div>

                                    <Button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleStartCreateSubCategoryFromDropdown(cat.path);
                                      }}
                                      variant="ghost"
                                      size="icon"
                                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-accent"
                                      title="在此分类下新建"
                                      aria-label="在此分类下新建"
                                    >
                                      <Plus size={14} />
                                    </Button>
                                  </div>

                                  {dropdownCreatingParentPath === cat.path && (
                                    <div
                                      className="mx-4 my-1 px-3 py-2 rounded-lg bg-accent border border-border animate-fade-in"
                                      style={{ marginLeft: `${16 + indent + 16}px` }}
                                    >
                                      <input
                                        ref={dropdownNewCategoryInputRef}
                                        type="text"
                                        value={dropdownNewCategoryName}
                                        onChange={(e) => setDropdownNewCategoryName(e.target.value)}
                                        onKeyDown={handleDropdownNewCategoryKeyDown}
                                        onBlur={handleSubmitCreateSubCategoryFromDropdown}
                                        placeholder="输入子分类名称..."
                                        className="w-full bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Content Editor */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 p-6">
                  <textarea 
                    className="w-full h-full resize-none focus:outline-none font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground bg-transparent"
                    placeholder="输入提示词详细内容..."
                    value={newPrompt.content}
                    onChange={(e) => setNewPrompt({...newPrompt, content: e.target.value})}
                  ></textarea>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="px-6 py-4 border-t border-border bg-background flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">标签:</label>
                    <input 
                      type="text" 
                      className="bg-input px-3 py-1.5 rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground text-sm w-48"
                      placeholder="python, react..."
                      value={newPrompt.tags}
                      onChange={(e) => setNewPrompt({...newPrompt, tags: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Button
                    onClick={requestCloseNewPrompt}
                    variant="ghost"
                    className="text-muted-foreground hover:bg-accent"
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleAddPrompt}
                    className="px-6 py-2 font-medium"
                    disabled={!newPrompt.title.trim()}
                  >
                    创建
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </NewPromptOverlay>
      )}
    </div>
  );
}
