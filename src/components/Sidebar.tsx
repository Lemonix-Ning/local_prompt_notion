/**
 * Sidebar 组件
 * 显示分类树形结构
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Plus, Star, Book, Trash2, Folder, FolderOpen, Edit2, Settings, Sun, Moon, FileText, Download } from 'lucide-react';
import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from '@tauri-apps/plugin-autostart';
import { CategoryNode } from '../types';
import { useApp } from '../AppContext';
import { ExportPromptsDialog } from './ExportPromptsDialog';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useLumi } from '../contexts/LumiContext';
import { ElasticScroll } from './ElasticScroll';
import { saveRecentCategory } from '../utils/recentCategory';
import { analyzeCategoryContent, CategoryContentInfo } from '../utils/categoryContentAnalyzer';
import { DeleteCategoryDialog, DeleteOptions } from './DeleteCategoryDialog';

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
    className={`group flex items-center justify-between px-3 py-2 text-sm rounded-lg cursor-pointer notion-sidebar-item ${
      active ? 'active' : ''
    }`}
  >
    <div className="flex items-center gap-2">
      <Icon size={18} className={active ? "notion-sidebar-folder active" : "notion-sidebar-folder"} />
      <span className="truncate">{label}</span>
    </div>
    {count !== undefined && (
      <span className="text-xs notion-sidebar-text-muted">{count}</span>
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
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-[100000] flex items-center justify-center p-4">
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

// 设置抽屉 (Settings Drawer)
interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sidebarWidth: number;
}

function SettingsPanel({
  isOpen,
  onClose,
  sidebarWidth,
}: SettingsPanelProps) {
  const { showToast } = useToast();
  const { themeMode, setThemeMode } = useTheme();
  const [closeBehavior, setCloseBehavior] = useState<'minimize' | 'exit'>('minimize');
  const [autostartEnabled, setAutostartEnabled] = useState<boolean>(false);
  const [autostartLoading, setAutostartLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;

    const savedClosePreference = localStorage.getItem('closePreference');
    if (savedClosePreference === 'exit' || savedClosePreference === 'minimize') {
      setCloseBehavior(savedClosePreference);
    }

    (async () => {
      try {
        const enabled = await isAutostartEnabled();
        if (mounted) setAutostartEnabled(enabled);
      } catch {
        if (mounted) setAutostartEnabled(false);
      }
    })();

    (async () => {
      try {
        if (typeof window !== 'undefined' && window.location.port === '1420') {
          const { invoke } = await import('@tauri-apps/api/core');
          const behavior = await invoke<string>('get_close_behavior');
          if (mounted && (behavior === 'exit' || behavior === 'minimize')) {
            setCloseBehavior(behavior);
          }
        }
      } catch {
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  const handleToggleCloseBehavior = async () => {
    if (!isOpen) return;
    const next: 'minimize' | 'exit' = closeBehavior === 'minimize' ? 'exit' : 'minimize';
    setCloseBehavior(next);
    localStorage.setItem('closePreferenceVersion', '2');
    localStorage.setItem('closePreference', next);

    try {
      if (typeof window !== 'undefined' && window.location.port === '1420') {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('set_close_behavior', { behavior: next });
      }
    } catch {
    }
  };

  const handleToggleAutostart = async () => {
    if (!isOpen) return;
    if (autostartLoading) return;

    setAutostartLoading(true);
    try {
      if (autostartEnabled) {
        await disableAutostart();
        setAutostartEnabled(false);
        showToast('已关闭开机自启动', 'success');
      } else {
        await enableAutostart();
        setAutostartEnabled(true);
        showToast('已开启开机自启动', 'success');
      }
    } catch {
      showToast('设置开机自启动失败', 'error');
      try {
        const enabled = await isAutostartEnabled();
        setAutostartEnabled(enabled);
      } catch {
      }
    } finally {
      setAutostartLoading(false);
    }
  };

  return (
    <>
      {/* 遮罩层 */}
      {isOpen && createPortal(
        <>
          {/* 仅侧边栏区域模糊（不拦截点击） */}
          <div
            className="fixed top-0 bottom-0 left-0 z-[50] bg-black/5 dark:bg-black/20 backdrop-blur-sm pointer-events-none"
            style={{ width: `${sidebarWidth}px` }}
          />

          {/* 内容区点击关闭（不做模糊） */}
          <div
            className="fixed top-0 bottom-0 z-[50]"
            style={{ left: `${sidebarWidth}px`, right: 0 }}
            onClick={onClose}
          />
        </>,
        document.body
      )}
      
      {/* 抽屉本体 - 使用 Portal 渲染到 body，确保在遮罩层之上 */}
      {createPortal(
        <div
          className={`fixed z-[60] bg-background/95 dark:bg-zinc-900/95 backdrop-blur-xl border-t border-border/50 shadow-[0_-10px_40px_rgba(0,0,0,0.3)] ${
            isOpen ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-[110%] opacity-0 pointer-events-none'
          }`}
          style={{
            left: 0,
            bottom: '72px',
            transformOrigin: 'bottom',
            transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease',
            maxHeight: 'calc(100vh - 140px)',
            width: `${sidebarWidth}px`,
          }}
          onClick={(e) => e.stopPropagation()} // 防止点击抽屉内部关闭
        >
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">设置</h3>
        </div>

        <div className="p-3 space-y-3" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
          {/* 主题 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <div className="w-1 h-3 bg-primary rounded-full" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">主题</h4>
            </div>

            <button
              onClick={() => setThemeMode(themeMode === 'auto' ? 'manual' : 'auto')}
              className={`w-full group relative overflow-hidden rounded-lg transition-all duration-200 ${
                themeMode === 'auto'
                  ? 'bg-primary/10 hover:bg-primary/15 border border-primary/30'
                  : 'bg-accent/50 hover:bg-accent border border-border'
              } cursor-pointer`}
              title={themeMode === 'auto' ? '已开启：白天浅色，夜晚深色' : '开启自动切换：白天浅色，夜晚深色'}
            >
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg transition-colors ${
                    themeMode === 'auto' ? 'bg-primary/20' : 'bg-muted'
                  }`}
                  >
                    <Sun size={16} className={themeMode === 'auto' ? 'text-primary' : 'text-muted-foreground'} />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium text-foreground">自动切换主题</span>
                    <span className="text-xs text-muted-foreground">白天浅色，夜晚深色</span>
                  </div>
                </div>

                {/* Toggle Switch */}
                <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                  themeMode === 'auto' ? 'bg-primary' : 'bg-muted'
                }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                    themeMode === 'auto' ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </div>
              </div>

              {/* Shine effect on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </div>
            </button>
          </div>

          {/* 窗口关闭行为 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <div className="w-1 h-3 bg-primary rounded-full" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">窗口</h4>
            </div>

            <button
              onClick={handleToggleCloseBehavior}
              className={`w-full group relative overflow-hidden rounded-lg transition-all duration-200 ${
                closeBehavior === 'minimize'
                  ? 'bg-primary/10 hover:bg-primary/15 border border-primary/30'
                  : 'bg-accent/50 hover:bg-accent border border-border'
              } cursor-pointer`}
              title={closeBehavior === 'minimize' ? '关闭窗口时最小化到托盘' : '关闭窗口时直接退出程序'}
            >
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg transition-colors ${
                    closeBehavior === 'minimize' ? 'bg-primary/20' : 'bg-muted'
                  }`}
                  >
                    <Settings size={16} className={closeBehavior === 'minimize' ? 'text-primary' : 'text-muted-foreground'} />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium text-foreground">关闭窗口行为</span>
                    <span className="text-xs text-muted-foreground">
                      {closeBehavior === 'minimize' ? '最小化到托盘' : '直接退出程序'}
                    </span>
                  </div>
                </div>

                {/* Toggle Switch */}
                <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                  closeBehavior === 'minimize' ? 'bg-primary' : 'bg-muted'
                }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                    closeBehavior === 'minimize' ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </div>
              </div>

              {/* Shine effect on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </div>
            </button>
          </div>

          {/* 启动配置 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <div className="w-1 h-3 bg-primary rounded-full" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">启动</h4>
            </div>
            
            <button
              onClick={handleToggleAutostart}
              disabled={autostartLoading}
              className={`w-full group relative overflow-hidden rounded-lg transition-all duration-200 ${
                autostartEnabled
                  ? 'bg-primary/10 hover:bg-primary/15 border border-primary/30'
                  : 'bg-accent/50 hover:bg-accent border border-border'
              } ${autostartLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg transition-colors ${
                    autostartEnabled ? 'bg-primary/20' : 'bg-muted'
                  }`}>
                    <Settings size={16} className={autostartEnabled ? 'text-primary' : 'text-muted-foreground'} />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium text-foreground">开机自启动</span>
                    <span className="text-xs text-muted-foreground">随系统启动应用</span>
                  </div>
                </div>
                
                {/* Toggle Switch */}
                <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                  autostartEnabled ? 'bg-primary' : 'bg-muted'
                }`}>
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                    autostartEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </div>
              </div>
              
              {/* Shine effect on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </div>
            </button>
          </div>
        </div>
        </div>,
        document.body
      )}
    </>
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
  onMoveToRoot?: () => void;
  onExport?: () => void;
}

function ContextMenu({ x, y, onClose, onRename, onDelete, onNewSubCategory, onNewPrompt, onMoveToRoot, onExport }: ContextMenuProps) {
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

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[200000] bg-popover/95 backdrop-blur-xl border border-border rounded-lg shadow-2xl py-1 min-w-[160px]"
      style={{ left: x, top: y }}
    >
      <button
        onClick={onMoveToRoot}
        className="w-full px-3 py-2 text-sm text-foreground hover:bg-accent flex items-center gap-2 transition-colors"
      >
        <FolderOpen size={14} />
        移动到根目录
      </button>
      <div className="h-px bg-border my-1" />
      <button
        onClick={onNewPrompt}
        className="w-full px-3 py-2 text-sm text-foreground hover:bg-accent flex items-center gap-2 transition-colors"
      >
        <FileText size={14} />
        新建提示词
      </button>
      <div className="h-px bg-border my-1" />
      {onExport && (
        <>
          <button
            onClick={onExport}
            className="w-full px-3 py-2 text-sm text-foreground hover:bg-accent flex items-center gap-2 transition-colors"
          >
            <Download size={14} />
            导出分类
          </button>
          <div className="h-px bg-border my-1" />
        </>
      )}
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
    </div>,
    document.body
  );
}

export function Sidebar() {
  const { state, dispatch, createCategory, deleteCategory, renameCategory, moveCategory, refreshVault } = useApp();
  const { fileSystem, selectedCategory, uiState } = state;
  const { showToast } = useToast();
  const { triggerAction } = useLumi();
  const [viewMode, setViewMode] = useState<'all' | 'favorites' | 'trash'>('all');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryParent, setNewCategoryParent] = useState<string | null>(null);
  const [isDroppingToRoot, setIsDroppingToRoot] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    originId: string;
    categoryPath: string;
    categoryName: string;
    contentInfo: CategoryContentInfo | null;
  }>({ isOpen: false, originId: '', categoryPath: '', categoryName: '', contentInfo: null });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rootContextMenu, setRootContextMenu] = useState<{ x: number; y: number } | null>(null);
  
  // 导出对话框状态（完整动画支持 - 与删除对话框相同的模式）
  const [exportDialog, setExportDialog] = useState<{
    isOpen: boolean;
    originId: string;
    categoryPath: string | null;
  }>({ isOpen: false, originId: '', categoryPath: null });
  
  const newCategoryInputRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Resizable Sidebar State
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing = useCallback(() => setIsResizing(false), []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = Math.max(160, Math.min(600, e.clientX));
      setSidebarWidth(newWidth);
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  const [pinnedOpenPaths, setPinnedOpenPaths] = useState<Set<string>>(new Set());
  const [userCollapsedPaths, setUserCollapsedPaths] = useState<Set<string>>(new Set());
  const parentPathMapRef = useRef<Map<string, string | null>>(new Map());

  const normalizeForCompare = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '');

  const buildParentPathMap = (nodes: CategoryNode[], parentPath: string | null) => {
    for (const node of nodes) {
      parentPathMapRef.current.set(normalizeForCompare(node.path), parentPath ? normalizeForCompare(parentPath) : null);
      if (node.children.length > 0) {
        buildParentPathMap(node.children, node.path);
      }
    }
  };

  const getAncestorPaths = (path: string): string[] => {
    const out: string[] = [];
    let current: string | null = normalizeForCompare(path);
    while (current) {
      out.unshift(current);
      const parentPath: string | null = parentPathMapRef.current.get(current) ?? null;
      current = parentPath;
    }
    return out;
  };

  const handlePinChain = (path: string) => {
    const chain = getAncestorPaths(path);
    setUserCollapsedPaths((prev) => {
      const copy = new Set(prev);
      for (const p of chain) {
        copy.delete(normalizeForCompare(p));
      }
      return copy;
    });
    setPinnedOpenPaths(new Set(chain));
  };

  const handleTogglePinnedExpand = (path: string) => {
    const key = normalizeForCompare(path);
    const isCurrentlyExpanded = isPathExpanded(path);
    if (isCurrentlyExpanded) {
      // 强制折叠
      setUserCollapsedPaths((prev) => {
        const copy = new Set(prev);
        copy.add(key);
        return copy;
      });
      setPinnedOpenPaths((prev) => {
        const copy = new Set(prev);
        copy.delete(key);
        return copy;
      });
      return;
    }

    // 强制展开：移除手动折叠标记，并固定展开
    setUserCollapsedPaths((prev) => {
      const copy = new Set(prev);
      copy.delete(key);
      return copy;
    });
    setPinnedOpenPaths((prev) => {
      const copy = new Set(prev);
      copy.add(key);
      return copy;
    });
  };

  const isPathExpanded = (path: string) => {
    const key = normalizeForCompare(path);
    if (userCollapsedPaths.has(key)) return false;
    return pinnedOpenPaths.has(key);
  };

  useEffect(() => {
    parentPathMapRef.current.clear();
    if (fileSystem?.categories) {
      buildParentPathMap(fileSystem.categories, null);
    }
  }, [fileSystem?.categories]);

  useEffect(() => {
    if (selectedCategory && selectedCategory !== 'favorites' && selectedCategory !== 'trash') {
      handlePinChain(selectedCategory);
    }
  }, [selectedCategory]);

  // 全局拖拽结束监听器，确保所有拖拽状态都被清除
  useEffect(() => {
    const handleDragEnd = () => {
      setIsDroppingToRoot(false);
    };

    const handleDrop = () => {
      setIsDroppingToRoot(false);
    };

    document.addEventListener('dragend', handleDragEnd);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragend', handleDragEnd);
      document.removeEventListener('drop', handleDrop);
    };
  }, []);

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

    // 只有明确指定了 parentPath（从某个分类上“新建子分类”）才创建到该分类下。
    // 否则一律创建在根目录，避免“在空白处右键新建却跑到当前选中分类下面”。
    const parentPath = newCategoryParent || fileSystem.root;

    try {
      await createCategory(parentPath, newCategoryName.trim());
      triggerAction('create_folder');

      if (newCategoryParent) {
        handlePinChain(newCategoryParent);
      }

      setIsCreatingCategory(false);
      setNewCategoryName('');
      setNewCategoryParent(null);
      showToast('分类创建成功', 'success');
    } catch (error) {
      showToast(`创建分类失败: ${(error as Error).message}`, 'error');
    }
  };

  const handleRenameCategory = useCallback(async (path: string, newName: string) => {
    await renameCategory(path, newName);
    triggerAction('rename');
  }, [renameCategory, triggerAction]);

  const handleCancelCreateCategory = () => {
    setIsCreatingCategory(false);
    setNewCategoryName('');
    setNewCategoryParent(null);
  };

  const handleExportCategory = (categoryPath: string, originId: string) => {
    setExportDialog({
      isOpen: true,
      originId,
      categoryPath,
    });
  };

  const handleExportClose = () => {
    setExportDialog((prev) => ({ ...prev, isOpen: false }));
  };

  const handleExportClosed = () => {
    setExportDialog({ isOpen: false, originId: '', categoryPath: null });
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

  const handleMoveCategory = async (categoryPath: string, targetParentPath: string) => {
    if (!fileSystem) return;

    // 优化的路径标准化函数
    const normalizePath = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '');
    
    const sourcePath = normalizePath(categoryPath);
    const targetPath = normalizePath(targetParentPath);
    
    // 计算源文件的父目录
    const sourceParentPath = sourcePath.substring(0, sourcePath.lastIndexOf('/')) || normalizePath(fileSystem.root);

    // 性能优化：前端拦截无效操作，避免不必要的网络请求

    // 拖拽到相同位置 - 静默返回
    if (sourceParentPath === targetPath) {
      return;
    }

    // 拖拽到自己 - 静默返回  
    if (sourcePath === targetPath) {
      return;
    }

    // 拖拽到子目录 - 显示警告
    if (targetPath.startsWith(sourcePath + '/')) {
      showToast('无法将分类移动到其子分类中', 'warning');
      return;
    }

    try {
      // 🚀 前端乐观更新：立即执行服务器操作，不显示加载提示
      await moveCategory(categoryPath, targetParentPath);
      
      // 延迟刷新，确保数据一致性，但不影响用户体验
      setTimeout(async () => {
        try {
          await refreshVault();
        } catch (error) {
          // Background refresh failed
        }
      }, 1000);
      
    } catch (error) {
      showToast('移动失败: ' + (error as Error).message, 'error');
    }
  };

  const handleDeleteWithConfirm = (categoryPath: string, categoryName: string, _hasContent: boolean, originId: string) => {
    // 找到对应的分类节点来分析内容（Windows 下可能存在 \\ 与 / 混用）
    const normalize = (p: string) => p.replace(/\\/g, '/');

    const findCategoryNode = (nodes: CategoryNode[], path: string): CategoryNode | null => {
      const target = normalize(path);
      for (const node of nodes) {
        if (normalize(node.path) === target) return node;
        if (node.children.length > 0) {
          const found = findCategoryNode(node.children, path);
          if (found) return found;
        }
      }
      return null;
    };

    const categoryNode = fileSystem ? findCategoryNode(fileSystem.categories, categoryPath) : null;

    const contentInfo = categoryNode
      ? analyzeCategoryContent(categoryNode)
      : {
          promptCount: 0,
          subcategoryCount: 0,
          totalSize: 0,
          isEmpty: true,
          hasPrompts: false,
          hasSubcategories: false,
        };

    // 始终使用增强的删除对话框（带共享元素动画）
    setDeleteDialog({
      isOpen: true,
      originId,
      categoryPath,
      categoryName,
      contentInfo,
    });
  };

  const handleDeleteConfirm = async (categoryPath: string, _options: DeleteOptions) => {
    try {
      await deleteCategory(categoryPath);
      setDeleteDialog((prev) => ({ ...prev, isOpen: false }));
      showToast('分类已移动到回收站', 'success');
    } catch (error) {
      showToast('删除失败: ' + (error as Error).message, 'error');
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialog((prev) => ({ ...prev, isOpen: false }));
  };

  const handleDeleteClosed = () => {
    setDeleteDialog({ isOpen: false, originId: '', categoryPath: '', categoryName: '', contentInfo: null });
  };

  const handleViewAll = () => {
    setViewMode('all');
    dispatch({ type: 'SELECT_CATEGORY', payload: null });
    saveRecentCategory('all'); // 🚀 Performance: Save recent category
  };

  const handleViewFavorites = () => {
    setViewMode('favorites');
    dispatch({ type: 'SELECT_CATEGORY', payload: 'favorites' });
    saveRecentCategory('favorites'); // 🚀 Performance: Save recent category
  };

  const handleViewTrash = () => {
    setViewMode('trash');
    dispatch({ type: 'SELECT_CATEGORY', payload: 'trash' });
    saveRecentCategory('trash'); // 🚀 Performance: Save recent category
  };

  const isSidebarOpen = uiState.sidebarOpen;

  const allPrompts = Array.from(fileSystem?.allPrompts.values() || []);
  const isInTrash = (path: string) => path.includes('/trash/') || path.includes('\\trash\\');
  const normalPrompts = allPrompts.filter(p => !isInTrash(p.path));
  const favoriteCount = normalPrompts.filter(p => p.meta.is_favorite).length;
  const trashCount = allPrompts.filter(p => isInTrash(p.path)).length;

  return (
    <>
      <div
        ref={sidebarRef}
        className="notion-sidebar backdrop-blur-xl flex flex-col relative"
        data-tauri-drag-region={false}
        style={{
          width: isSidebarOpen ? `${sidebarWidth}px` : '0px',
          transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-24px)',
          opacity: isSidebarOpen ? 1 : 0,
          overflow: isResizing ? 'hidden' : 'hidden', // Keep hidden to avoid scrollbars during resize if content overflows
          flexShrink: 0,
          pointerEvents: isSidebarOpen ? 'auto' : 'none',
          borderRight: isSidebarOpen ? '1px solid var(--border)' : '1px solid transparent',
          transition: isResizing 
            ? 'opacity 0.18s ease' // Disable width/transform transition during resize
            : 'width 0.26s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.26s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.18s ease',
        }}
      >
        {/* Workspace Header */}
        <div className="p-3 mx-2 mt-2 hover:bg-accent rounded-lg cursor-pointer transition-colors flex items-center gap-2 mb-2">
          <div className="w-5 h-5 bg-gradient-to-br from-foreground to-muted-foreground rounded flex items-center justify-center text-background text-xs font-bold shadow-sm">L</div>
          <span className="text-sm font-medium text-foreground truncate">Lumina</span>
          <div className="ml-auto text-muted-foreground"><Settings size={12}/></div>
        </div>

        {/* Navigation */}
        <ElasticScroll
          className="flex-1 px-2 space-y-0.5 flex flex-col min-h-0"
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
                className="mt-6 px-3 text-xs font-semibold notion-sidebar-text-muted mb-2 uppercase tracking-wider"
              >
                资源库
              </div>
              
              {/* 分类列表容器 - 使用 flex-1 撑满剩余空间，确保右键区域覆盖 */}
              <div 
                className={`flex-1 space-y-0.5 min-h-0 ${isDroppingToRoot ? 'ring-2 ring-primary/30 rounded-lg' : ''}`}
                onContextMenu={handleLibraryContextMenu}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!fileSystem) return;
                  setIsDroppingToRoot(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // 只有当鼠标真正离开根目录区域时才清除状态
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX;
                  const y = e.clientY;
                  
                  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                    setIsDroppingToRoot(false);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDroppingToRoot(false); // 立即清除状态
                  if (!fileSystem) return;
                  const sourcePath = e.dataTransfer.getData('text/plain');
                  if (!sourcePath) return;
                  handleMoveCategory(sourcePath, fileSystem.root);
                }}
                data-tauri-drag-region={false}
              >
                {/* 分类列表 */}
                {fileSystem?.categories
                  .filter(category => !category.name.toLowerCase().includes('trash'))
                  .map(category => (
                    <CategoryItem
                      key={category.path}
                      category={category}
                      selectedPath={selectedCategory}
                      onSelect={(path) => {
                        handlePinChain(path);
                        dispatch({ type: 'SELECT_CATEGORY', payload: path });
                        saveRecentCategory(path); // 🚀 Performance: Save recent category
                      }}
                      onRename={handleRenameCategory}
                      onDelete={handleDeleteWithConfirm}
                      onCreateSubCategory={handleStartCreateCategory}
                      onNewPrompt={handleNewPromptFromCategory}
                      onMove={handleMoveCategory}
                      onExport={(categoryPath, originId) => handleExportCategory(categoryPath, originId)}
                      rootPath={fileSystem.root}
                      isCreatingCategory={isCreatingCategory}
                      newCategoryParent={newCategoryParent}
                      newCategoryName={newCategoryName}
                      setNewCategoryName={setNewCategoryName}
                      onCreateCategory={handleCreateCategory}
                      onCancelCreateCategory={handleCancelCreateCategory}
                      onNewCategoryKeyDown={handleNewCategoryKeyDown}
                      newCategoryInputRef={newCategoryInputRef}
                      showToast={showToast}
                      isExpanded={isPathExpanded(category.path)}
                      isPathExpanded={isPathExpanded}
                      onTogglePinnedExpand={handleTogglePinnedExpand}
                    />
                  ))
                }

                {/* 根目录新建分类输入框 */}
                {isCreatingCategory && !newCategoryParent && (
                  <div className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md bg-accent border border-border">
                    <div className="w-4" /> {/* 箭头占位 */}
                    <Folder size={16} className="notion-sidebar-folder flex-shrink-0" />
                    <input
                      ref={newCategoryInputRef}
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={handleNewCategoryKeyDown}
                      onBlur={handleCreateCategory}
                      placeholder="输入分类名称..."
                      className="flex-1 bg-transparent notion-sidebar-text-primary placeholder:notion-sidebar-text-muted outline-none"
                    />
                  </div>
                )}
              </div>
            </ElasticScroll>
            
        <div className="p-2 border-t border-border space-y-2">
          {/* 快速主题切换按钮 */}
          <ThemeToggleButton />
          
          <button 
            onClick={() => {
              setSettingsOpen(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg transition-colors"
          >
            <Settings size={16} />
            设置
          </button>
        </div>

        {/* 设置抽屉 - 从底部滑出 */}
        <SettingsPanel
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          sidebarWidth={sidebarWidth}
        />

        {/* Resize Handle */}
        <div 
          className={`resize-handle ${isResizing ? 'resizing' : ''}`} 
          onMouseDown={startResizing} 
          onDoubleClick={() => setSidebarWidth(256)} 
        />
      </div>

      {/* 根目录右键菜单 */}
      {rootContextMenu && createPortal(
        <div
          className="fixed z-[200000] bg-popover/95 backdrop-blur-xl border border-border rounded-lg shadow-2xl py-1 min-w-[160px]"
          style={{ left: rootContextMenu.x, top: rootContextMenu.y }}
        >
          <button
            onClick={() => handleStartCreateCategory()}
            className="w-full px-3 py-2 text-sm text-foreground hover:bg-accent flex items-center gap-2 transition-colors"
          >
            <Plus size={14} />
            新建分类
          </button>
        </div>,
        document.body
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

      {/* 增强的删除确认对话框 */}
      <DeleteCategoryDialog
        isOpen={deleteDialog.isOpen}
        originId={deleteDialog.originId}
        categoryName={deleteDialog.categoryName}
        contentInfo={deleteDialog.contentInfo || { promptCount: 0, subcategoryCount: 0, totalSize: 0, isEmpty: true, hasPrompts: false, hasSubcategories: false }}
        onConfirm={(options) => handleDeleteConfirm(deleteDialog.categoryPath, options)}
        onCancel={handleDeleteCancel}
        onClosed={handleDeleteClosed}
      />

      {/* 导出对话框 - 独立实现，与删除对话框使用相同的动画模式 */}
      {exportDialog.categoryPath && (
        <ExportPromptsDialog
          isOpen={exportDialog.isOpen}
          originId={exportDialog.originId}
          onClose={handleExportClose}
          onClosed={handleExportClosed}
          categoryPath={exportDialog.categoryPath}
          preserveStructure={true}
        />
      )}

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
  onDelete?: (categoryPath: string, categoryName: string, hasContent: boolean, originId: string) => void;
  onCreateSubCategory?: (parentPath: string) => void;
  onNewPrompt?: (categoryPath: string) => void;
  onMove?: (categoryPath: string, targetParentPath: string) => void;
  onExport?: (categoryPath: string, originId: string) => void;
  rootPath?: string;
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
  isExpanded: boolean;
  isPathExpanded: (path: string) => boolean;
  onTogglePinnedExpand: (path: string) => void;
}

function CategoryItem({ 
  category, 
  selectedPath, 
  onSelect, 
  onRename, 
  onDelete, 
  onCreateSubCategory,
  onNewPrompt,
  onMove,
  onExport,
  rootPath,
  level = 0,
  isCreatingCategory,
  newCategoryParent,
  newCategoryName,
  setNewCategoryName,
  onCreateCategory,
  onCancelCreateCategory,
  onNewCategoryKeyDown,
  newCategoryInputRef,
  showToast,
  isExpanded,
  isPathExpanded,
  onTogglePinnedExpand
}: CategoryItemProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renamingValue, setRenamingValue] = useState(category.name);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const isSelected = selectedPath === category.path;
  const hasChildren = category.children.length > 0;

  // 全局拖拽结束监听器，确保拖拽状态被清除
  useEffect(() => {
    const handleDragEnd = () => {
      setIsDragOver(false);
    };

    const handleDrop = () => {
      setIsDragOver(false);
    };

    document.addEventListener('dragend', handleDragEnd);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragend', handleDragEnd);
      document.removeEventListener('drop', handleDrop);
    };
  }, []);

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
      onTogglePinnedExpand(category.path);
    }
  };

  // 点击文字选中分类
  const handleSelectCategory = (e: React.MouseEvent) => {
    if (isRenaming) return;
    e.stopPropagation();
    onSelect(category.path);
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    e.stopPropagation();
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
      const originId = `category-row-${category.path.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      onDelete(category.path, category.name, hasContent, originId);
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

  const handleExport = () => {
    setContextMenu(null);
    if (onExport) {
      const originId = `category-row-${category.path.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      onExport(category.path, originId);
    }
  };

  const normalizeForCompare = (p: string) => p.replace(/\\/g, '/');

  const handleDragStart = (e: React.DragEvent) => {
    if (isRenaming) return;
    e.dataTransfer.setData('text/plain', category.path);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation(); // 防止事件冒泡
    setIsDragOver(true);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation(); // 防止事件冒泡
    // 只有当鼠标真正离开当前元素时才清除状态
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false); // 立即清除拖拽状态

    const sourcePath = e.dataTransfer.getData('text/plain');
    if (!sourcePath || !onMove) return;

    // 优化的路径标准化
    const normalizePath = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '');
    
    const source = normalizePath(sourcePath);
    const target = normalizePath(category.path);
    
    // 计算源的父目录
    const sourceParent = source.substring(0, source.lastIndexOf('/')) || normalizePath(rootPath || '');

    // 前端拦截无效操作
    if (sourceParent === target) return; // 相同位置
    if (source === target) return; // 拖拽到自己
    if (target.startsWith(source + '/')) { // 拖拽到子目录
      showToast?.('无法将分类移动到其子分类中', 'warning');
      return;
    }

    onMove(sourcePath, category.path);
  };

  const handleMoveToRoot = () => {
    if (!onMove || !rootPath) return;
    const source = normalizeForCompare(category.path);
    const targetParent = normalizeForCompare(rootPath);
    if (source === targetParent) {
      showToast?.('已在根目录', 'info');
      return;
    }
    if (targetParent.startsWith(source + '/')) {
      showToast?.('无法移动到自身子分类中', 'warning');
      return;
    }
    onMove(category.path, rootPath);
  };

  // 根据层级和状态确定文件夹图标颜色
  const getFolderColor = () => {
    if (isSelected) return 'notion-sidebar-folder active';
    return 'notion-sidebar-folder';
  };

  const getFolderIcon = () => {
    if (hasChildren && isExpanded) return FolderOpen;
    return Folder;
  };

  const FolderIcon = getFolderIcon();

  // 检查是否应该在此分类下显示新建输入框
  const shouldShowNewCategoryInput = isCreatingCategory && newCategoryParent === category.path;

  return (
    <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <div
        id={`category-row-${category.path.replace(/[^a-zA-Z0-9_-]/g, '_')}`}
        onClick={handleSelectCategory}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`group relative flex items-center justify-between px-2 py-1.5 text-sm rounded-md cursor-pointer notion-sidebar-item transition-colors duration-200 ${
          isSelected ? 'active' : ''
        } ${isRenaming ? 'bg-accent' : ''} ${isDragOver ? 'ring-2 ring-primary/30 bg-accent' : ''}`}
        style={{ paddingLeft: `${8 + level * 16}px` }}
        data-tauri-drag-region={false}
      >
        <div className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-primary transition-opacity duration-200" style={{ opacity: isSelected ? 1 : 0 }} />
        <div className="flex items-center gap-2 flex-1 min-w-0 transition-transform duration-150 group-hover:translate-x-0.5">
          {/* 展开/折叠箭头 */}
          <div 
            onClick={handleToggleExpand}
            className="flex items-center justify-center w-4 h-4 hover:bg-accent rounded transition-colors"
          >
            {hasChildren ? (
              <ChevronRight
                size={12}
                className={`notion-sidebar-text-muted transition-transform duration-200 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
              />
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
              className="flex-1 bg-transparent notion-sidebar-text-primary outline-none border-b border-border focus:border-primary px-1"
            />
          ) : (
            <span className="truncate select-none">{category.name}</span>
          )}
        </div>
        
        {/* 提示词数量和操作按钮 */}
        {!isRenaming && (
          <div className="flex items-center gap-1">
            {totalPromptCount > 0 && (
              <span className="text-xs notion-sidebar-text-muted px-1.5 py-0.5 bg-muted rounded">
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
              <Plus size={12} className="notion-sidebar-text-muted" />
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
          <Folder size={16} className="notion-sidebar-folder flex-shrink-0" />
          <input
            ref={newCategoryInputRef}
            type="text"
            value={newCategoryName || ''}
            onChange={(e) => setNewCategoryName?.(e.target.value)}
            onKeyDown={onNewCategoryKeyDown}
            onBlur={onCreateCategory}
            placeholder="输入分类名称..."
            className="flex-1 bg-transparent notion-sidebar-text-primary placeholder:notion-sidebar-text-muted outline-none"
          />
        </div>
      )}

      {/* 子分类 */}
      {hasChildren && (
        <div
          className="ml-2"
          style={{
            maxHeight: isExpanded ? '1600px' : '0px',
            opacity: isExpanded ? 1 : 0,
            overflow: 'hidden',
            transition: 'max-height 0.28s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.2s ease',
            pointerEvents: isExpanded ? 'auto' : 'none',
          }}
        >
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
              onMove={onMove}
              onExport={onExport}
              rootPath={rootPath}
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
              isExpanded={isPathExpanded(child.path)}
              isPathExpanded={isPathExpanded}
              onTogglePinnedExpand={onTogglePinnedExpand}
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
          onMoveToRoot={handleMoveToRoot}
          onExport={handleExport}
        />
      )}
    </div>
  );
}
