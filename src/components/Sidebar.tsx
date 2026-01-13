/**
 * Sidebar 组件
 * 显示分类树形结构
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, Plus, Star, Book, Trash2, Folder, FolderOpen, Edit2, Settings, Sun, Moon, Check, X, FileText } from 'lucide-react';
import { CategoryNode } from '../types';
import { useApp } from '../AppContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';

// 快速主题切换按钮组件
function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <button
      onClick={toggleTheme}
      className="w-full flex items-center justify-between px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg transition-all duration-200 group border border-transparent hover:border-border/50"
      title={`切换到${theme === 'dark' ? '浅色' : '深色'}主题`}
    >
      <div className="flex items-center gap-2">
        {theme === 'dark' ? (
          <Moon size={16} className="text-blue-400 group-hover:text-blue-300 transition-colors" />
        ) : (
          <Sun size={16} className="text-yellow-500 group-hover:text-yellow-400 transition-colors" />
        )}
        <span className="font-medium">{theme === 'dark' ? '深色主题' : '浅色主题'}</span>
      </div>
      <div className="text-xs opacity-60 group-hover:opacity-80 transition-opacity">
        {theme === 'dark' ? '☀️' : '🌙'}
      </div>
    </button>
  );
}

const SidebarItem = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick, 
  count 
}: { 
  icon: any; 
  label: string; 
  active?: boolean; 
  onClick?: () => void; 
  count?: number;
}) => (
  <div 
    onClick={onClick}
    className={`group flex items-center justify-between px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${
      active ? 'bg-accent text-foreground font-medium' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
    }`}
  >
    <div className="flex items-center gap-2">
      <Icon size={18} className={active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"} />
      <span className="truncate">{label}</span>
    </div>
    {count !== undefined && (
      <span className="text-xs text-muted-foreground group-hover:text-foreground">{count}</span>
    )}
  </div>
);

// 现代风格确认对话框
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning' | 'info';
}

function ConfirmDialog({ 
  isOpen, 
  title, 
  message, 
  confirmText = '确认', 
  cancelText = '取消', 
  onConfirm, 
  onCancel,
  type = 'danger'
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return 'bg-destructive hover:bg-destructive/90 text-destructive-foreground';
      case 'warning':
        return 'bg-yellow-500 hover:bg-yellow-600 text-white';
      default:
        return 'bg-primary hover:bg-primary/90 text-primary-foreground';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-popover/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">{message}</p>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 pb-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent rounded-lg transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${getTypeStyles()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// 设置面板
interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { theme, setTheme } = useTheme();

  if (!isOpen) return null;

  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
  };

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-popover/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">设置</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded-lg transition-colors"
          >
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">主题</h4>
            <div className="space-y-2">
              <button
                onClick={() => handleThemeChange('dark')}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  theme === 'dark' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:bg-accent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Moon size={16} className="text-muted-foreground" />
                  <span className="text-sm text-foreground">深色主题</span>
                </div>
                {theme === 'dark' && <Check size={16} className="text-primary" />}
              </button>
              
              <button
                onClick={() => handleThemeChange('light')}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  theme === 'light' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:bg-accent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Sun size={16} className="text-muted-foreground" />
                  <span className="text-sm text-foreground">浅色主题</span>
                </div>
                {theme === 'light' && <Check size={16} className="text-primary" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 右键菜单组件
interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  onNewSubCategory: () => void;
  onNewPrompt: () => void;
}

function ContextMenu({ x, y, onClose, onRename, onDelete, onNewSubCategory, onNewPrompt }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-popover/95 backdrop-blur-xl border border-border rounded-lg shadow-2xl py-1 min-w-[160px]"
      style={{ left: x, top: y }}
    >
      <button
        onClick={onNewPrompt}
        className="w-full px-3 py-2 text-sm text-foreground hover:bg-accent flex items-center gap-2 transition-colors"
      >
        <FileText size={14} />
        新建提示词
      </button>
      <div className="h-px bg-border my-1" />
      <button
        onClick={onNewSubCategory}
        className="w-full px-3 py-2 text-sm text-foreground hover:bg-accent flex items-center gap-2 transition-colors"
      >
        <Plus size={14} />
        新建子分类
      </button>
      <button
        onClick={onRename}
        className="w-full px-3 py-2 text-sm text-foreground hover:bg-accent flex items-center gap-2 transition-colors"
      >
        <Edit2 size={14} />
        重命名
      </button>
      <div className="h-px bg-border my-1" />
      <button
        onClick={onDelete}
        className="w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2 transition-colors"
      >
        <Trash2 size={14} />
        删除
      </button>
    </div>
  );
}

export function Sidebar() {
  const { state, dispatch, createCategory, deleteCategory, renameCategory } = useApp();
  const { fileSystem, selectedCategory, uiState } = state;
  const { showToast } = useToast();
  const [viewMode, setViewMode] = useState<'all' | 'favorites' | 'trash'>('all');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryParent, setNewCategoryParent] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rootContextMenu, setRootContextMenu] = useState<{ x: number; y: number } | null>(null);
  const newCategoryInputRef = useRef<HTMLInputElement>(null);

  // 自动聚焦到新建分类输入框
  useEffect(() => {
    if (isCreatingCategory && newCategoryInputRef.current) {
      newCategoryInputRef.current.focus();
    }
  }, [isCreatingCategory]);

  // 根目录右键菜单
  const handleLibraryContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRootContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleCloseRootContextMenu = () => {
    setRootContextMenu(null);
  };

  const handleStartCreateCategory = (parentPath?: string) => {
    setIsCreatingCategory(true);
    setNewCategoryName('');
    setNewCategoryParent(parentPath || null);
    setRootContextMenu(null);
  };

  const handleNewPromptFromCategory = (categoryPath: string) => {
    // 触发新建提示词模态框，并预选分类
    dispatch({ type: 'OPEN_NEW_PROMPT_MODAL', payload: categoryPath });
  };

  const handleCreateCategory = async () => {
    if (!fileSystem || !newCategoryName.trim()) {
      setIsCreatingCategory(false);
      setNewCategoryName('');
      setNewCategoryParent(null);
      return;
    }

    const parentPath = newCategoryParent || selectedCategory || fileSystem.root;

    try {
      await createCategory(parentPath, newCategoryName.trim());
      setIsCreatingCategory(false);
      setNewCategoryName('');
      setNewCategoryParent(null);
      showToast('分类创建成功', 'success');
    } catch (error) {
      showToast(`创建分类失败: ${(error as Error).message}`, 'error');
    }
  };

  const handleCancelCreateCategory = () => {
    setIsCreatingCategory(false);
    setNewCategoryName('');
    setNewCategoryParent(null);
  };

  const handleNewCategoryKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateCategory();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelCreateCategory();
    }
  };

  const handleDeleteWithConfirm = (categoryPath: string, categoryName: string, hasContent: boolean) => {
    if (hasContent) {
      setConfirmDialog({
        isOpen: true,
        title: '无法删除分类',
        message: '此分类中还有提示词或子分类，请先移动或删除分类中的所有内容。',
        onConfirm: () => setConfirmDialog(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: '删除分类',
      message: `确定要删除分类"${categoryName}"吗？此操作无法撤销。`,
      onConfirm: async () => {
        try {
          await deleteCategory(categoryPath);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          showToast('分类删除成功', 'success');
        } catch (error) {
          showToast('删除失败: ' + (error as Error).message, 'error');
        }
      }
    });
  };

  const handleViewAll = () => {
    setViewMode('all');
    dispatch({ type: 'SELECT_CATEGORY', payload: null });
  };

  const handleViewFavorites = () => {
    setViewMode('favorites');
    dispatch({ type: 'SELECT_CATEGORY', payload: 'favorites' });
  };

  const handleViewTrash = () => {
    setViewMode('trash');
    dispatch({ type: 'SELECT_CATEGORY', payload: 'trash' });
  };

  if (!uiState.sidebarOpen) {
    return null;
  }

  const allPrompts = Array.from(fileSystem?.allPrompts.values() || []);
  const isInTrash = (path: string) => path.includes('/trash/') || path.includes('\\trash\\');
  const normalPrompts = allPrompts.filter(p => !isInTrash(p.path));
  const favoriteCount = normalPrompts.filter(p => p.meta.is_favorite).length;
  const trashCount = allPrompts.filter(p => isInTrash(p.path)).length;

  return (
    <>
      <div className="w-64 bg-background/80 backdrop-blur-xl border-r border-border flex flex-col transition-all duration-300">
        {/* Workspace Header */}
        <div className="p-3 mx-2 mt-2 hover:bg-accent rounded-lg cursor-pointer transition-colors flex items-center gap-2 mb-2">
          <div className="w-5 h-5 bg-gradient-to-br from-foreground to-muted-foreground rounded flex items-center justify-center text-background text-xs font-bold shadow-sm">P</div>
          <span className="text-sm font-medium text-foreground truncate">Prompt Workspace</span>
          <div className="ml-auto text-muted-foreground"><Settings size={12}/></div>
        </div>

        {/* Navigation */}
        <div 
          className="flex-1 overflow-y-auto px-2 space-y-0.5 flex flex-col min-h-0"
          onContextMenu={handleLibraryContextMenu}
        >
          <SidebarItem 
            icon={Book} 
            label="全部" 
            active={viewMode === 'all' && selectedCategory === null} 
            onClick={handleViewAll} 
            count={normalPrompts.length}
          />
          <SidebarItem 
            icon={Star} 
            label="收藏" 
            active={viewMode === 'favorites'}
            onClick={handleViewFavorites}
            count={favoriteCount}
          />
          <SidebarItem 
            icon={Trash2} 
            label="回收站" 
            active={viewMode === 'trash'}
            onClick={handleViewTrash}
            count={trashCount}
          />
          
          <div 
            className="mt-6 px-3 text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider"
          >
            LIBRARY
          </div>
          
          {/* 分类列表容器 - 使用 flex-1 撑满剩余空间，确保右键区域覆盖 */}
          <div 
            className="flex-1 space-y-0.5 min-h-0"
            onContextMenu={handleLibraryContextMenu}
          >
            {/* 分类列表 */}
            {fileSystem?.categories
              .filter(category => !category.name.toLowerCase().includes('trash'))
              .map(category => (
                <CategoryItem
                  key={category.path}
                  category={category}
                  selectedPath={selectedCategory}
                  onSelect={(path) => dispatch({ type: 'SELECT_CATEGORY', payload: path })}
                  onRename={renameCategory}
                  onDelete={handleDeleteWithConfirm}
                  onCreateSubCategory={handleStartCreateCategory}
                  onNewPrompt={handleNewPromptFromCategory}
                  isCreatingCategory={isCreatingCategory}
                  newCategoryParent={newCategoryParent}
                  newCategoryName={newCategoryName}
                  setNewCategoryName={setNewCategoryName}
                  onCreateCategory={handleCreateCategory}
                  onCancelCreateCategory={handleCancelCreateCategory}
                  onNewCategoryKeyDown={handleNewCategoryKeyDown}
                  newCategoryInputRef={newCategoryInputRef}
                  showToast={showToast}
                />
              ))
            }

            {/* 根目录新建分类输入框 */}
            {isCreatingCategory && !newCategoryParent && (
              <div className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md bg-accent border border-border">
                <div className="w-4" /> {/* 箭头占位 */}
                <Folder size={16} className="text-muted-foreground flex-shrink-0" />
                <input
                  ref={newCategoryInputRef}
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={handleNewCategoryKeyDown}
                  onBlur={handleCreateCategory}
                  placeholder="输入分类名称..."
                  className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
                />
              </div>
            )}
          </div>
        </div>
        
        <div className="p-2 border-t border-border bg-background/60 space-y-2">
          {/* 快速主题切换按钮 */}
          <ThemeToggleButton />
          
          <button 
            onClick={() => setSettingsOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg transition-colors"
          >
            <Settings size={16} />
            设置
          </button>
        </div>
      </div>

      {/* 根目录右键菜单 */}
      {rootContextMenu && (
        <div
          className="fixed z-50 bg-popover/95 backdrop-blur-xl border border-border rounded-lg shadow-2xl py-1 min-w-[160px]"
          style={{ left: rootContextMenu.x, top: rootContextMenu.y }}
        >
          <button
            onClick={() => handleStartCreateCategory()}
            className="w-full px-3 py-2 text-sm text-foreground hover:bg-accent flex items-center gap-2 transition-colors"
          >
            <Plus size={14} />
            新建分类
          </button>
        </div>
      )}

      {/* 点击外部关闭根目录菜单 */}
      {rootContextMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={handleCloseRootContextMenu}
        />
      )}

      {/* 确认对话框 */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />

      {/* 设置面板 */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}

/**
 * 分类项组件
 */
interface CategoryItemProps {
  category: CategoryNode;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onRename?: (path: string, newName: string) => Promise<void>;
  onDelete?: (categoryPath: string, categoryName: string, hasContent: boolean) => void;
  onCreateSubCategory?: (parentPath: string) => void;
  onNewPrompt?: (categoryPath: string) => void;
  level?: number;
  isCreatingCategory?: boolean;
  newCategoryParent?: string | null;
  newCategoryName?: string;
  setNewCategoryName?: (name: string) => void;
  onCreateCategory?: () => void;
  onCancelCreateCategory?: () => void;
  onNewCategoryKeyDown?: (e: React.KeyboardEvent) => void;
  newCategoryInputRef?: React.RefObject<HTMLInputElement>;
  showToast?: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

function CategoryItem({ 
  category, 
  selectedPath, 
  onSelect, 
  onRename, 
  onDelete, 
  onCreateSubCategory,
  onNewPrompt,
  level = 0,
  isCreatingCategory,
  newCategoryParent,
  newCategoryName,
  setNewCategoryName,
  onCreateCategory,
  onCancelCreateCategory,
  onNewCategoryKeyDown,
  newCategoryInputRef,
  showToast
}: CategoryItemProps) {
  const [isExpanded, setIsExpanded] = useState(true); // 默认展开
  const [isRenaming, setIsRenaming] = useState(false);
  const [renamingValue, setRenamingValue] = useState(category.name);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const isSelected = selectedPath === category.path;
  const hasChildren = category.children.length > 0;

  // 自动聚焦到重命名输入框
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const getTotalPromptCount = (node: CategoryNode): number => {
    return node.prompts.length + node.children.reduce((sum, child) => sum + getTotalPromptCount(child), 0);
  };

  const totalPromptCount = getTotalPromptCount(category);

  // 点击箭头切换展开/折叠
  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  // 点击文字选中分类
  const handleSelectCategory = (e: React.MouseEvent) => {
    if (isRenaming) return;
    e.stopPropagation();
    onSelect(category.path);
  };

  // 双击重命名
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleStartRename();
  };

  // 右键菜单
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleStartRename = () => {
    setIsRenaming(true);
    setRenamingValue(category.name);
    setContextMenu(null);
  };

  const handleRename = async () => {
    if (!renamingValue.trim() || renamingValue === category.name) {
      setIsRenaming(false);
      setRenamingValue(category.name);
      return;
    }

    if (onRename) {
      try {
        await onRename(category.path, renamingValue.trim());
        setIsRenaming(false);
        showToast?.('重命名成功', 'success');
      } catch (error) {
        showToast?.('重命名失败: ' + (error as Error).message, 'error');
        setRenamingValue(category.name);
      }
    }
  };

  const handleCancelRename = () => {
    setIsRenaming(false);
    setRenamingValue(category.name);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelRename();
    }
  };

  const handleDelete = () => {
    setContextMenu(null);
    const hasContent = totalPromptCount > 0 || hasChildren;
    if (onDelete) {
      onDelete(category.path, category.name, hasContent);
    }
  };

  const handleNewSubCategory = () => {
    setContextMenu(null);
    if (onCreateSubCategory) {
      onCreateSubCategory(category.path);
    }
  };

  const handleNewPrompt = () => {
    setContextMenu(null);
    if (onNewPrompt) {
      onNewPrompt(category.path);
    }
  };

  // 根据层级和状态确定文件夹图标颜色
  const getFolderColor = () => {
    if (isSelected) return 'text-primary';
    if (hasChildren && isExpanded) return 'text-blue-400';
    if (hasChildren) return 'text-muted-foreground';
    return 'text-muted-foreground';
  };

  const getFolderIcon = () => {
    if (hasChildren && isExpanded) return FolderOpen;
    return Folder;
  };

  const FolderIcon = getFolderIcon();

  // 检查是否应该在此分类下显示新建输入框
  const shouldShowNewCategoryInput = isCreatingCategory && newCategoryParent === category.path;

  return (
    <div>
      <div
        onClick={handleSelectCategory}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        className={`group flex items-center justify-between px-2 py-1.5 text-sm rounded-md cursor-pointer transition-all duration-150 ${
          isSelected
            ? 'bg-primary/10 text-foreground font-medium border-l-2 border-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        } ${isRenaming ? 'bg-accent' : ''}`}
        style={{ paddingLeft: `${8 + level * 16}px` }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* 展开/折叠箭头 */}
          <div 
            onClick={handleToggleExpand}
            className="flex items-center justify-center w-4 h-4 hover:bg-accent rounded transition-colors"
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown size={12} className="text-muted-foreground" />
              ) : (
                <ChevronRight size={12} className="text-muted-foreground" />
              )
            ) : (
              <div className="w-3" /> // 占位符，保持对齐
            )}
          </div>

          {/* 文件夹图标 */}
          <FolderIcon size={16} className={getFolderColor()} />
          
          {/* 分类名称或输入框 */}
          {isRenaming ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renamingValue}
              onChange={(e) => setRenamingValue(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={handleRename}
              className="flex-1 bg-transparent text-foreground outline-none border-b border-border focus:border-primary px-1"
            />
          ) : (
            <span className="truncate select-none">{category.name}</span>
          )}
        </div>
        
        {/* 提示词数量和操作按钮 */}
        {!isRenaming && (
          <div className="flex items-center gap-1">
            {totalPromptCount > 0 && (
              <span className="text-xs text-muted-foreground group-hover:text-foreground px-1.5 py-0.5 bg-muted rounded">
                {totalPromptCount}
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNewSubCategory();
              }}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded transition-all"
              title="新建子分类"
            >
              <Plus size={12} className="text-muted-foreground" />
            </button>
          </div>
        )}
      </div>

      {/* 新建子分类输入框 - 显示在当前分类下 */}
      {shouldShowNewCategoryInput && (
        <div 
          className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md bg-accent border border-border ml-2"
          style={{ paddingLeft: `${8 + (level + 1) * 16}px` }}
        >
          <div className="w-4" /> {/* 箭头占位 */}
          <Folder size={16} className="text-muted-foreground flex-shrink-0" />
          <input
            ref={newCategoryInputRef}
            type="text"
            value={newCategoryName || ''}
            onChange={(e) => setNewCategoryName?.(e.target.value)}
            onKeyDown={onNewCategoryKeyDown}
            onBlur={onCreateCategory}
            placeholder="输入分类名称..."
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
      )}

      {/* 子分类 */}
      {isExpanded && hasChildren && (
        <div className="ml-2">
          {category.children.map(child => (
            <CategoryItem
              key={child.path}
              category={child}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onCreateSubCategory={onCreateSubCategory}
              onNewPrompt={onNewPrompt}
              level={level + 1}
              isCreatingCategory={isCreatingCategory}
              newCategoryParent={newCategoryParent}
              newCategoryName={newCategoryName}
              setNewCategoryName={setNewCategoryName}
              onCreateCategory={onCreateCategory}
              onCancelCreateCategory={onCancelCreateCategory}
              onNewCategoryKeyDown={onNewCategoryKeyDown}
              newCategoryInputRef={newCategoryInputRef}
              showToast={showToast}
            />
          ))}
        </div>
      )}

      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={handleCloseContextMenu}
          onRename={handleStartRename}
          onDelete={handleDelete}
          onNewSubCategory={handleNewSubCategory}
          onNewPrompt={handleNewPrompt}
        />
      )}
    </div>
  );
}
