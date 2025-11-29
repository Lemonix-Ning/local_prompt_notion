/**
 * Sidebar 组件
 * 显示分类树形结构
 */

import { useState } from 'react';
import { ChevronRight, ChevronDown, Plus, Star, Book, Trash2, Code, Edit2 } from 'lucide-react';
import { CategoryNode } from '../types';
import { useApp } from '../AppContext';

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
      active ? 'bg-white/5 text-white font-medium' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
    }`}
  >
    <div className="flex items-center gap-2">
      <Icon size={18} className={active ? "text-indigo-300" : "text-zinc-500 group-hover:text-zinc-300"} />
      <span className="truncate">{label}</span>
    </div>
    {count !== undefined && (
      <span className="text-xs text-zinc-500 group-hover:text-zinc-300">{count}</span>
    )}
  </div>
);

export function Sidebar() {
  const { state, dispatch, createCategory, deleteCategory, renameCategory } = useApp();
  const { fileSystem, selectedCategory, uiState } = state;
  const [viewMode, setViewMode] = useState<'all' | 'favorites' | 'trash'>('all');

  const handleCreateCategory = async () => {
    if (!fileSystem) {
      alert('尚未加载 Vault');
      return;
    }

    const name = prompt('输入新分类名称:');
    if (!name) return;

    const parentPath = selectedCategory || fileSystem.root;

    try {
      await createCategory(parentPath, name.trim());
    } catch (error) {
      alert(`创建分类失败: ${(error as Error).message}`);
    }
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
    <div className="w-64 bg-[#09090b]/80 backdrop-blur-xl border-r border-white/5 flex flex-col transition-all duration-300">
      {/* Workspace Header */}
      <div className="p-3 mx-2 mt-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors flex items-center gap-2 mb-2">
        <div className="w-5 h-5 bg-gradient-to-br from-white to-zinc-400 rounded flex items-center justify-center text-black text-xs font-bold shadow-sm shadow-white/5">P</div>
        <span className="text-sm font-medium text-zinc-100 truncate">Prompt Workspace</span>
        <div className="ml-auto text-zinc-500"><Code size={12}/></div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        <SidebarItem 
          icon={Book} 
          label="全部提示词" 
          active={viewMode === 'all' && selectedCategory === null} 
          onClick={handleViewAll} 
          count={normalPrompts.length}
        />
        <SidebarItem 
          icon={Star} 
          label="收藏夹" 
          active={viewMode === 'favorites'}
          onClick={handleViewFavorites}
          count={favoriteCount}
        />
        
        <div className="mt-6 px-3 text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider flex items-center justify-between">
          <span>分类标签</span>
          <Plus size={12} className="cursor-pointer hover:text-zinc-200" onClick={handleCreateCategory}/>
        </div>
        {fileSystem?.categories
          .filter(category => !category.name.toLowerCase().includes('trash'))
          .map(category => (
            <CategoryItem
              key={category.path}
              category={category}
              selectedPath={selectedCategory}
              onSelect={(path) => dispatch({ type: 'SELECT_CATEGORY', payload: path })}
              onRename={renameCategory}
              onDelete={deleteCategory}
            />
          ))
        }

        <div className="mt-6 px-3 text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">
          系统
        </div>
        <SidebarItem 
          icon={Trash2} 
          label="回收站" 
          active={viewMode === 'trash'}
          onClick={handleViewTrash}
          count={trashCount}
        />
      </div>
      
      <div className="p-2 border-t border-white/5 bg-[#09090b]/60">
        <button 
          onClick={handleCreateCategory}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:bg-white/5 hover:text-zinc-200 rounded-lg transition-colors"
        >
          <Plus size={16} />
          新建页面
        </button>
      </div>
    </div>
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
  onDelete?: (path: string) => Promise<void>;
  level?: number;
}

function CategoryItem({ category, selectedPath, onSelect, onRename, onDelete, level = 0 }: CategoryItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const isSelected = selectedPath === category.path;
  const hasChildren = category.children.length > 0;

  const getTotalPromptCount = (node: CategoryNode): number => {
    return node.prompts.length + node.children.reduce((sum, child) => sum + getTotalPromptCount(child), 0);
  };

  const totalPromptCount = getTotalPromptCount(category);

  const handleCategoryClick = () => {
    onSelect(category.path);
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleRename = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    const newName = prompt('输入新的分类名称:', category.name);
    if (newName && newName.trim() && newName !== category.name && onRename) {
      try {
        await onRename(category.path, newName.trim());
      } catch (error) {
        alert('重命名失败: ' + (error as Error).message);
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    if (totalPromptCount > 0) {
      alert('此分类中还有提示词，无法删除。请先移动或删除分类中的所有提示词。');
      return;
    }
    if (hasChildren) {
      alert('此分类中还有子分类，无法删除。请先删除所有子分类。');
      return;
    }
    if (window.confirm(`确定要删除分类"${category.name}"吗？`)) {
      if (onDelete) {
        try {
          await onDelete(category.path);
        } catch (error) {
          alert('删除失败: ' + (error as Error).message);
        }
      }
    }
  };

  return (
    <div>
      <div
        onClick={handleCategoryClick}
        onMouseEnter={() => setShowMenu(true)}
        onMouseLeave={() => setShowMenu(false)}
        className={`group flex items-center justify-between px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${
          isSelected
            ? 'bg-white/5 text-white font-medium'
            : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
        }`}
        style={{ paddingLeft: `${12 + level * 16}px` }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )
          ) : (
            <Code size={14} />
          )}
          <span className="truncate">{category.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-zinc-500 group-hover:text-zinc-300">{totalPromptCount}</span>
          {showMenu && (
            <div className="flex items-center gap-0.5 ml-1">
              <button
                onClick={handleRename}
                className="p-0.5 hover:bg-white/10 rounded"
                title="重命名"
              >
                <Edit2 size={12} />
              </button>
              <button
                onClick={handleDelete}
                className="p-0.5 hover:bg-red-500/10 hover:text-red-400 rounded"
                title="删除"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>
      </div>

      {isExpanded && hasChildren && (
        <div>
          {category.children.map(child => (
            <CategoryItem
              key={child.path}
              category={child}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
