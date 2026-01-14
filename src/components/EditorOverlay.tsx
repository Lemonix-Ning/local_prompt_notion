/**
 * EditorOverlay 组件
 * 实现 Mac 风格共享元素过渡动画 + 沉浸式编辑器UI
 */

import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useApp } from '../AppContext';
import { 
  X, 
  Star, 
  Calendar, 
  Hash, 
  Copy,
  Trash2,
  ChevronDown,
  Folder,
  FolderOpen
} from 'lucide-react';
import { getSmartIcon } from '../utils/smartIcon';
import { getIconGradientConfig, getTagStyle } from '../utils/tagColors';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';

interface EditorOverlayProps {
  promptId: string;
  originCardId: string;
  onClose: () => void;
}

interface AnimationState {
  top: string | number;
  left: string | number;
  width: string | number;
  height: string | number;
  borderRadius: string;
  opacity: number;
  transform?: string;
  isOpen: boolean;
  backdropBlur?: number; // 添加背景模糊控制
}

// 分类选择器组件
interface CategorySelectorProps {
  currentCategory: string;
  onCategoryChange: (category: string) => void;
  theme: string;
  vaultRoot: string;
}

function CategorySelector({ currentCategory, onCategoryChange, theme, vaultRoot }: CategorySelectorProps) {
  const { state } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const selectorRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 扁平化分类列表
  const flattenCategories = (categories: any[], level = 0): any[] => {
    const result: any[] = [];
    
    categories.forEach(category => {
      // 实时计算分类下的提示词总数（包括子分类）
      const getTotalPromptCount = (cat: any): number => {
        if (!state.fileSystem?.allPrompts) return 0;
        
        // 从 allPrompts 中实时计算该分类的提示词数量
        const allPromptsArray = Array.from(state.fileSystem.allPrompts.values());
        let count = 0;
        
        // 递归计算该分类及其子分类的提示词数量
        const countPromptsInCategory = (categoryPath: string): number => {
          return allPromptsArray.filter(prompt => {
            const promptCategoryPath = prompt.meta.category_path || '';
            // 检查提示词是否在该分类或其子分类中
            return promptCategoryPath === categoryPath || promptCategoryPath.startsWith(categoryPath + '/');
          }).length;
        };
        
        count = countPromptsInCategory(cat.path);
        return count;
      };

      result.push({
        name: category.name,
        path: category.path,
        level,
        hasChildren: category.children.length > 0,
        promptCount: getTotalPromptCount(category)
      });
      
      if (category.children.length > 0) {
        result.push(...flattenCategories(category.children, level + 1));
      }
    });
    
    return result;
  };

  const allCategories = state.fileSystem?.categories ? 
    flattenCategories(state.fileSystem.categories.filter(cat => cat.name !== 'trash')) : [];
  
  // 过滤分类
  const filteredCategories = allCategories.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div ref={selectorRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '8px 12px',
          backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
          borderRadius: '6px',
          color: theme === 'dark' ? '#ffffff' : '#000000',
          cursor: 'pointer',
          fontSize: '14px',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
          e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
          e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {currentCategory ? (
            <FolderOpen size={14} className="notion-sidebar-folder active" />
          ) : (
            <Folder size={14} className="notion-sidebar-folder" />
          )}
          <span style={{ color: currentCategory ? (theme === 'dark' ? '#ffffff' : '#000000') : (theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)') }}>
            {currentCategory || '选择分类...'}
          </span>
        </div>
        <ChevronDown 
          size={14} 
          style={{ 
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            color: theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'
          }} 
        />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          backgroundColor: theme === 'dark' ? '#000000' : '#ffffff',
          border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          borderRadius: '8px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)',
          zIndex: 1000,
          maxHeight: '300px',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {/* 搜索框 */}
          <div style={{ padding: '12px', borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
            <input
              type="text"
              placeholder="搜索分类..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                padding: '6px 8px',
                backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
                borderRadius: '4px',
                color: theme === 'dark' ? '#ffffff' : '#000000',
                fontSize: '12px',
                outline: 'none'
              }}
            />
          </div>

          {/* 分类列表 */}
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {/* 无分类选项 */}
            <button
              onClick={() => {
                onCategoryChange('');
                setIsOpen(false);
                setSearchQuery('');
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                textAlign: 'left',
                backgroundColor: !currentCategory ? (theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') : 'transparent',
                border: 'none',
                color: theme === 'dark' ? '#ffffff' : '#000000',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (currentCategory) {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
                }
              }}
              onMouseLeave={(e) => {
                if (currentCategory) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Folder size={14} className="notion-sidebar-folder" />
                <span style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>无分类</span>
              </div>
              {/* 显示根目录提示词数量 */}
              {state.fileSystem && (() => {
                // 实时计算根目录提示词数量
                const allPrompts = Array.from(state.fileSystem.allPrompts.values());
                const rootPrompts = allPrompts.filter(prompt => {
                  const categoryPath = prompt.meta.category_path || '';
                  // 根目录提示词的 category_path 应该等于 vaultRoot
                  return categoryPath === vaultRoot || (!prompt.meta.category || prompt.meta.category === '');
                });
                return rootPrompts.length > 0 ? (
                  <span style={{ 
                    fontSize: '10px', 
                    color: theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                    backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    padding: '2px 6px',
                    borderRadius: '10px'
                  }}>
                    {rootPrompts.length}
                  </span>
                ) : null;
              })()}
            </button>

            {filteredCategories.length === 0 && searchQuery ? (
              <div style={{ 
                padding: '16px', 
                textAlign: 'center', 
                color: theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                fontSize: '12px'
              }}>
                没有匹配的分类
              </div>
            ) : (
              filteredCategories.map((cat) => {
                const indent = cat.level * 16;
                const prefix = cat.level > 0 ? '└ ' : '';
                
                return (
                  <button
                    key={cat.path}
                    onClick={() => {
                      onCategoryChange(cat.name);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      paddingLeft: `${12 + indent}px`,
                      textAlign: 'left',
                      backgroundColor: currentCategory === cat.name ? (theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') : 'transparent',
                      border: 'none',
                      color: theme === 'dark' ? '#ffffff' : '#000000',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (currentCategory !== cat.name) {
                        e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (currentCategory !== cat.name) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {cat.level > 0 && (
                        <span style={{ 
                          color: theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                          fontSize: '10px',
                          fontFamily: 'monospace'
                        }}>
                          {prefix}
                        </span>
                      )}
                      {cat.hasChildren ? (
                        <FolderOpen size={14} className={currentCategory === cat.name ? "notion-sidebar-folder active" : "notion-sidebar-folder"} />
                      ) : (
                        <Folder size={14} className={currentCategory === cat.name ? "notion-sidebar-folder active" : "notion-sidebar-folder"} />
                      )}
                      <span>{cat.name}</span>
                    </div>
                    {/* 显示分类提示词数量 */}
                    {cat.promptCount > 0 && (
                      <span style={{ 
                        fontSize: '10px', 
                        color: theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                        backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        padding: '2px 6px',
                        borderRadius: '10px'
                      }}>
                        {cat.promptCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function EditorOverlay({ promptId, originCardId, onClose }: EditorOverlayProps) {
  const { theme } = useTheme();
  const { state, savePrompt, deletePrompt } = useApp();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [animationState, setAnimationState] = useState<AnimationState | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const scrollableRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 获取提示词数据
  const prompt = state.fileSystem?.allPrompts.get(promptId);
  const [title, setTitle] = useState(prompt?.meta.title || '');
  const [content, setContent] = useState(prompt?.content || '');
  const [tags, setTags] = useState(prompt?.meta.tags || []);
  const [category, setCategory] = useState('');
  const [newTag, setNewTag] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [tagInputWidth, setTagInputWidth] = useState(28);
  const [isTagCommitting, setIsTagCommitting] = useState(false);
  const [pendingTagToAdd, setPendingTagToAdd] = useState<string | null>(null);
  const tagInputRef = useRef<HTMLInputElement | null>(null);
  const measureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const normalizeTagKey = (t: string) => (t || '').trim().toLowerCase();
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

  const measureTagTextPx = (text: string) => {
    if (typeof document === 'undefined') return 0;
    if (!measureCanvasRef.current) {
      measureCanvasRef.current = document.createElement('canvas');
    }
    const ctx = measureCanvasRef.current.getContext('2d');
    if (!ctx) return 0;
    ctx.font = '12px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif';
    return ctx.measureText(text).width;
  };

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const calcInputWidth = (text: string) => {
    const t = (text || '').trim();
    const base = measureTagTextPx(t || '标签');
    // 右侧不再有按钮，只需要留出少量内边距空间
    return clamp(Math.ceil(base + 32), 110, 220);
  };

  const calcPillWidth = (text: string) => {
    const t = (text || '').trim();
    const base = measureTagTextPx(t || '');
    // padding + close icon space
    return clamp(Math.ceil(base + 46), 64, 180);
  };


  // 根据提示词路径获取实际分类
  const getActualCategory = (promptPath: string, vaultRoot: string) => {
    if (!promptPath || !vaultRoot) return '';
    
    // 标准化路径
    const normalizedPath = promptPath.replace(/\\/g, '/');
    const normalizedRoot = vaultRoot.replace(/\\/g, '/');
    
    // 移除根路径前缀，确保以 / 结尾的根路径也能正确处理
    const rootWithSlash = normalizedRoot.endsWith('/') ? normalizedRoot : normalizedRoot + '/';
    const pathWithoutRoot = normalizedPath.startsWith(rootWithSlash) 
      ? normalizedPath.substring(rootWithSlash.length)
      : normalizedPath.replace(normalizedRoot, '').replace(/^\/+/, '');
    
    // 如果路径为空或者只包含提示词文件夹名（没有分类路径），说明在根目录
    if (!pathWithoutRoot || !pathWithoutRoot.includes('/')) {
      return ''; // 无分类
    }
    
    // 提取分类路径（去掉最后的提示词文件夹名）
    const pathParts = pathWithoutRoot.split('/');
    pathParts.pop(); // 移除提示词文件夹名
    
    // 返回最后一级分类名
    return pathParts.length > 0 ? pathParts[pathParts.length - 1] : '';
  };

  // 当 prompt 数据加载后，更新本地状态
  useEffect(() => {
    if (prompt && state.fileSystem?.root) {
      setTitle(prompt.meta.title || '');
      setContent(prompt.content || '');
      setTags(prompt.meta.tags || []);
      
      // 根据路径获取实际分类
      const actualCategory = getActualCategory(prompt.path, state.fileSystem.root);
      setCategory(actualCategory);

      // 切换提示词时重置新增标签交互
      setIsAddingTag(false);
      setIsTagCommitting(false);
      setPendingTagToAdd(null);
      setNewTag('');
      setTagInputWidth(28);
    }
  }, [prompt, state.fileSystem?.root]);

  useEffect(() => {
    if (!isAddingTag) return;
    if (isTagCommitting) return;
    setTagInputWidth(calcInputWidth(newTag));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newTag, isAddingTag, isTagCommitting]);

  const openAddTag = () => {
    if (isAddingTag) return;
    setIsAddingTag(true);
    setIsTagCommitting(false);
    setPendingTagToAdd(null);
    setNewTag('');
    setTagInputWidth(28);
    requestAnimationFrame(() => {
      setTagInputWidth(140);
      setTimeout(() => {
        tagInputRef.current?.focus();
        tagInputRef.current?.select();
      }, 60);
    });
  };

  const cancelAddTag = () => {
    if (!isAddingTag) return;
    setIsTagCommitting(false);
    setPendingTagToAdd(null);
    setTagInputWidth(28);
    setTimeout(() => {
      setIsAddingTag(false);
      setNewTag('');
    }, 160);
  };

  const commitAddTag = async () => {
    const name = (newTag || '').trim();
    if (!name) {
      cancelAddTag();
      return;
    }

    if (!prompt) return;

    const exists = tags.some((t) => normalizeTagKey(t) === normalizeTagKey(name));
    if (exists) {
      cancelAddTag();
      return;
    }

    setIsTagCommitting(true);
    setPendingTagToAdd(name);
    setTagInputWidth(calcPillWidth(name));
  };

  // 关闭动画
  const handleClose = async () => {
    if (isClosing) return;
    
    // 保存更改（分类更改已经实时保存，这里只保存其他更改）
    if (prompt && (title !== prompt.meta.title || content !== prompt.content || JSON.stringify(tags) !== JSON.stringify(prompt.meta.tags))) {
      try {
        const updated = {
          ...prompt,
          meta: { ...prompt.meta, title, tags },
          content,
        };
        await savePrompt(updated);
        showToast("已保存更改", 'success');
      } catch (error) {
        showToast("保存失败", 'error');
      }
    }

    setIsClosing(true);

    const originCard = document.getElementById(originCardId);

    // 执行回到原卡片位置的关闭动画
    if (animationState) {
      const originRect = originCard ? originCard.getBoundingClientRect() : null;

      const closeState: AnimationState = originRect
        ? {
            top: originRect.top,
            left: originRect.left,
            width: originRect.width,
            height: originRect.height,
            borderRadius: '12px',
            opacity: 1,
            transform: 'none',
            isOpen: false,
            backdropBlur: 0,
          }
        : {
            ...animationState,
            opacity: 0,
            transform: `${animationState.transform || ''} scale(0)`,
            isOpen: false,
            backdropBlur: 0,
          };

      setAnimationState(closeState);

      // 在动画进行到70%时显示原卡片
      if (originCard) {
        setTimeout(() => {
          originCard.style.opacity = '1';
        }, 200); // 280ms * 0.7 ≈ 200ms
      }
    }

    // 动画完成后清理
    setTimeout(() => {
      onClose();
    }, 280);
  };

  // 处理滚动条显示/隐藏
  useEffect(() => {
    const scrollableElement = scrollableRef.current;
    if (!scrollableElement) return;

    const handleScroll = () => {
      // 添加滚动中的类
      scrollableElement.classList.add('scrolling');
      
      // 清除之前的定时器
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // 设置新的定时器，滚动停止后隐藏滚动条
      scrollTimeoutRef.current = setTimeout(() => {
        scrollableElement.classList.remove('scrolling');
      }, 800); // 0.8秒后隐藏，更快的响应
    };

    scrollableElement.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      scrollableElement.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // 处理 ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 初始化动画状态
  useEffect(() => {
    const originCard = document.getElementById(originCardId);
    
    if (originCard) {
      const rect = originCard.getBoundingClientRect();
      
      // 隐藏原卡片
      originCard.style.opacity = '0';
      
      // 设置初始状态（从原卡片位置开始）
      setAnimationState({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        borderRadius: '12px',
        opacity: 1,
        isOpen: false,
        backdropBlur: 0,
      });
      
      // 延迟一帧后开始动画到全屏
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const padding = 80;
          const maxWidth = 1400;
          const maxHeight = window.innerHeight - padding * 2;
          
          const finalWidth = Math.min(window.innerWidth - padding * 2, maxWidth);
          const finalHeight = maxHeight;
          const finalLeft = (window.innerWidth - finalWidth) / 2;
          const finalTop = padding;
          
          setAnimationState({
            top: finalTop,
            left: finalLeft,
            width: finalWidth,
            height: finalHeight,
            borderRadius: '16px',
            opacity: 1,
            isOpen: true,
            backdropBlur: 12,
          });
        });
      });
    } else {
      // 如果找不到原卡片，直接显示在中心
      const padding = 80;
      const maxWidth = 1400;
      const maxHeight = window.innerHeight - padding * 2;
      
      const finalWidth = Math.min(window.innerWidth - padding * 2, maxWidth);
      const finalHeight = maxHeight;
      const finalLeft = (window.innerWidth - finalWidth) / 2;
      const finalTop = padding;
      
      setAnimationState({
        top: finalTop,
        left: finalLeft,
        width: finalWidth,
        height: finalHeight,
        borderRadius: '16px',
        opacity: 1,
        isOpen: true,
        backdropBlur: 12,
      });
    }
  }, [originCardId]);

  // 处理收藏
  const handleToggleFavorite = async () => {
    if (!prompt) return;
    
    const updated = {
      ...prompt,
      meta: { ...prompt.meta, is_favorite: !prompt.meta.is_favorite }
    };
    
    try {
      await savePrompt(updated);
      showToast(updated.meta.is_favorite ? "已添加到收藏" : "已取消收藏", 'success');
    } catch (error) {
      showToast("操作失败", 'error');
    }
  };

  // 处理删除
  const handleDelete = async () => {
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
        onClose();
      } catch (error) {
        showToast("删除失败", 'error');
      }
    }
  };

  // 处理复制
  const handleCopy = () => {
    navigator.clipboard.writeText(content)
      .then(() => showToast("已复制到剪贴板", 'success'))
      .catch(() => showToast("复制失败", 'error'));
  };

  // 处理标签
  const handleRemoveTag = (tagToRemove: string) => {
    const key = normalizeTagKey(tagToRemove);
    setTags(tags.filter(tag => normalizeTagKey(tag) !== key));
  };

  if (!animationState) return null;

  // 如果没有 prompt 数据，显示加载状态
  if (!prompt) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)',
        backdropFilter: `blur(${animationState?.backdropBlur || 12}px)`,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'backdrop-filter 0.3s ease, background-color 0.3s ease',
      }}>
        <div style={{
          backgroundColor: theme === 'dark' ? '#000000' : '#ffffff',
          border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          borderRadius: '16px',
          padding: '40px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          textAlign: 'center'
        }}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p style={{ color: theme === 'dark' ? '#ffffff' : '#000000' }}>加载中...</p>
        </div>
      </div>
    );
  }

  const Icon = getSmartIcon(prompt.meta.title, prompt.meta.tags);
  const gradient = getIconGradientConfig(prompt.meta.tags);

  return (
    <>
      {/* CSS 动画样式 */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        /* 自定义滚动条样式 */
        .editor-scrollable {
          scrollbar-width: thin;
          scrollbar-color: transparent transparent;
          transition: scrollbar-color 0.3s ease;
        }

        .editor-scrollable::-webkit-scrollbar {
          width: 4px;
        }

        .editor-scrollable::-webkit-scrollbar-track {
          background: transparent;
        }

        .editor-scrollable::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 2px;
          transition: background 0.3s ease, opacity 0.3s ease;
          opacity: 0;
        }

        /* 滚动时显示滚动条 - 添加渐变过渡 */
        .editor-scrollable.scrolling::-webkit-scrollbar-thumb {
          background: ${theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'};
          opacity: 1;
        }

        .editor-scrollable.scrolling::-webkit-scrollbar-thumb:hover {
          background: ${theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'};
        }

        /* Firefox 滚动条 */
        .editor-scrollable.scrolling {
          scrollbar-color: ${theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'} transparent;
        }
      `}</style>

      {/* 背景遮罩 */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)',
          backdropFilter: `blur(${animationState.backdropBlur || 0}px)`,
          zIndex: 99999,
          transition: isClosing 
            ? 'backdrop-filter 0.28s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.28s ease'
            : 'backdrop-filter 0.4s ease, background-color 0.4s ease',
        }}
        onClick={handleClose}
      />
      
      {/* 动画卡片 */}
      <div
        className="editor-overlay-card"
        style={{
          position: 'fixed',
          backgroundColor: theme === 'dark' ? '#000000' : '#ffffff',
          border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          transformOrigin: 'center center', // 默认从中心缩放
          // 使用统一的平滑动画曲线
          transition: isClosing 
            ? 'all 0.28s cubic-bezier(0.4, 0, 0.2, 1)'
            : 'top 0.4s cubic-bezier(0.19, 1, 0.22, 1), left 0.4s cubic-bezier(0.19, 1, 0.22, 1), width 0.4s cubic-bezier(0.19, 1, 0.22, 1), height 0.4s cubic-bezier(0.19, 1, 0.22, 1), transform 0.4s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.3s ease',
          top: animationState.top,
          left: animationState.left,
          width: animationState.width,
          height: animationState.height,
          borderRadius: animationState.borderRadius,
          opacity: animationState.opacity,
          transform: animationState.transform || 'none',
          zIndex: 100000,
        }}
      >
        {/* 编辑器内容 */}
        <div 
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            opacity: animationState.isOpen ? 1 : 0,
            transition: `opacity 0.3s ease ${animationState.isOpen ? '0.1s' : '0s'}`,
            color: theme === 'dark' ? '#ffffff' : '#000000'
          }}
        >
          {/* 悬浮操作栏 */}
          <div style={{
            position: 'absolute',
            top: '24px',
            right: '24px',
            zIndex: 20,
            display: 'flex',
            gap: '8px'
          }}>
            <button 
              onClick={handleToggleFavorite}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: prompt.meta.is_favorite ? 'rgba(251, 191, 36, 0.1)' : 'rgba(0,0,0,0.05)',
                color: prompt.meta.is_favorite ? '#fbbf24' : theme === 'dark' ? '#ffffff' : '#000000',
                cursor: 'pointer'
              }}
            >
              <Star size={18} fill={prompt.meta.is_favorite ? "currentColor" : "none"} />
            </button>
            <button 
              onClick={handleCopy}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'rgba(0,0,0,0.05)',
                color: theme === 'dark' ? '#ffffff' : '#000000',
                cursor: 'pointer'
              }}
            >
              <Copy size={18} />
            </button>
            <button 
              onClick={handleDelete}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                cursor: 'pointer'
              }}
            >
              <Trash2 size={18} />
            </button>
            <button 
              onClick={handleClose}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'rgba(0,0,0,0.05)',
                color: theme === 'dark' ? '#ffffff' : '#000000',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* 滚动内容区 */}
          <div 
            ref={scrollableRef}
            className="editor-scrollable"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '48px 48px 48px 48px'
            }}
          >
            {/* 头部信息区 */}
            <div style={{ marginBottom: '32px' }}>
              {/* 大图标 */}
              <div 
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '16px',
                  backgroundImage: gradient.backgroundImage,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  alignSelf: 'flex-start',
                  boxShadow: gradient.boxShadow,
                  border: gradient.border,
                  marginBottom: '24px'
                }}
              >
                <Icon size={32} style={{ color: gradient.iconColor }} />
              </div>

              {/* 无边框大标题 */}
              <input 
                style={{
                  fontSize: '2.25rem',
                  fontWeight: 700,
                  lineHeight: 1.2,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  width: '100%',
                  color: theme === 'dark' ? '#ffffff' : '#000000',
                  marginBottom: '32px'
                }}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="无标题"
              />

              {/* 属性列表 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                {/* 更新时间 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ 
                    color: theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                    width: '100px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Calendar size={14} />
                    <span>Updated</span>
                  </div>
                  <div>
                    {new Date(prompt.meta.updated_at).toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                </div>

                {/* 分类 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ 
                    color: theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                    width: '100px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Folder size={14} />
                    <span>Category</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <CategorySelector 
                      currentCategory={category}
                      onCategoryChange={async (newCategoryName) => {
                        if (!prompt || !state.fileSystem) return;
                        
                        try {
                          let newCategoryPath = state.fileSystem.root; // 默认为根目录（无分类）
                          const prevCategoryName = category;
                          
                          if (newCategoryName) {
                            // 有分类：递归查找分类路径
                            const findCategoryPath = (categories: any[], targetName: string): string | null => {
                              for (const cat of categories) {
                                if (cat.name === targetName) {
                                  return cat.path;
                                }
                                if (cat.children && cat.children.length > 0) {
                                  const found = findCategoryPath(cat.children, targetName);
                                  if (found) return found;
                                }
                              }
                              return null;
                            };
                            const foundPath = findCategoryPath(state.fileSystem.categories, newCategoryName);
                            if (foundPath) {
                              newCategoryPath = foundPath;
                            } else {
                              throw new Error('分类不存在');
                            }
                          }
                          // 如果 newCategoryName 为空，newCategoryPath 已经是根目录，表示"无分类"

                          // 同步 tags：分类视为一个系统标签（与“新建”一致）
                          const currentTags = Array.isArray(prompt.meta.tags) ? prompt.meta.tags : [];
                          const preserved = currentTags.filter((t) => {
                            if (!t) return false;
                            if (prevCategoryName && normalizeTagKey(t) === normalizeTagKey(prevCategoryName)) return false;
                            if (newCategoryName && normalizeTagKey(t) === normalizeTagKey(newCategoryName)) return false;
                            return true;
                          });
                          const nextTags = newCategoryName ? dedupeTags([newCategoryName, ...preserved]) : dedupeTags(preserved);
                          
                          // 更新提示词，包括分类路径
                          const updated = {
                            ...prompt,
                            meta: { 
                              ...prompt.meta, 
                              category: newCategoryName || '', // 无分类时为空字符串
                              category_path: newCategoryPath,
                              tags: nextTags,
                            }
                          };
                          
                          await savePrompt(updated);
                          setCategory(newCategoryName || ''); // 更新本地状态
                          setTags(nextTags); // 标签栏同步更新
                          
                          const message = newCategoryName ? `已移动到"${newCategoryName}"分类` : '已移动到根目录（无分类）';
                          showToast(message, 'success');
                        } catch (error) {
                          showToast(`更新失败: ${(error as Error).message}`, 'error');
                        }
                      }}
                      theme={theme}
                      vaultRoot={state.fileSystem?.root || ''}
                    />
                  </div>
                </div>

                {/* 标签栏 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{ 
                    color: theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                    width: '100px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    paddingTop: '4px'
                  }}>
                    <Hash size={14} />
                    <span>Tags</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                      {/* 现有标签 */}
                      {tags.map(tag => (
                        <span 
                          key={tag} 
                          className={`${getTagStyle(tag)}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            userSelect: 'none',
                            maxWidth: '180px'
                          }}
                          onClick={() => handleRemoveTag(tag)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(0.95)';
                            e.currentTarget.style.opacity = '0.8';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.opacity = '1';
                          }}
                        >
                          <span style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '140px'
                          }}>{tag}</span>
                          <X size={10} style={{ opacity: 0.7 }} />
                        </span>
                      ))}
                      
                      {/* 添加标签区域 */}
                      {isAddingTag ? (
                        /* 输入状态 */
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                            border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
                            borderRadius: '6px',
                            height: '28px',
                            overflow: 'hidden',
                            width: `${tagInputWidth}px`,
                            transition: 'width 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
                          }}
                          onTransitionEnd={async (e) => {
                            if (e.propertyName !== 'width') return;
                            if (!isTagCommitting) return;
                            if (!pendingTagToAdd) return;
                            if (!prompt) return;

                            const name = pendingTagToAdd;
                            // 去重（大小写不敏感）+ 分类标签置顶
                            const key = normalizeTagKey(name);
                            const exists = tags.some((t) => normalizeTagKey(t) === key);
                            if (exists) {
                              setIsTagCommitting(false);
                              setPendingTagToAdd(null);
                              setTagInputWidth(28);
                              setTimeout(() => {
                                setIsAddingTag(false);
                                setNewTag('');
                              }, 160);
                              return;
                            }

                            const nextTags = dedupeTags([...tags, name]);
                            if (category) {
                              nextTags.sort((a, b) => {
                                if (normalizeTagKey(a) === normalizeTagKey(category)) return -1;
                                if (normalizeTagKey(b) === normalizeTagKey(category)) return 1;
                                return 0;
                              });
                            }
                            const updated = {
                              ...prompt,
                              meta: {
                                ...prompt.meta,
                                tags: nextTags,
                              },
                            };
                            try {
                              await savePrompt(updated);
                              setTags(nextTags);
                            } catch (error) {
                              showToast(`添加标签失败: ${(error as Error).message}`, 'error');
                            }

                            setIsTagCommitting(false);
                            setPendingTagToAdd(null);
                            setTagInputWidth(28);
                            setTimeout(() => {
                              setIsAddingTag(false);
                              setNewTag('');
                            }, 160);
                          }}
                        >
                          {/* 左侧 + 按钮（固定） */}
                          <button
                            onClick={() => {
                              if (isTagCommitting) return;
                              cancelAddTag();
                            }}
                            style={{
                              width: '28px',
                              height: '28px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: 'none',
                              background: 'transparent',
                              cursor: isTagCommitting ? 'default' : 'pointer',
                              color: theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)',
                              flexShrink: 0,
                            }}
                            aria-label="取消新增标签"
                          >
                            +
                          </button>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '8px' }}>
                            {isTagCommitting ? (
                              <span
                                style={{
                                  fontSize: '12px',
                                  color: theme === 'dark' ? '#ffffff' : '#000000',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: '140px',
                                }}
                              >
                                {(pendingTagToAdd || '').trim()}
                              </span>
                            ) : (
                              <input
                                ref={tagInputRef}
                                type="text"
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    commitAddTag();
                                  } else if (e.key === 'Escape') {
                                    cancelAddTag();
                                  }
                                }}
                                onBlur={() => {
                                  // mac 风格：失焦自动提交（有内容则创建，无内容则收起）
                                  commitAddTag();
                                }}
                                placeholder="标签名"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  outline: 'none',
                                  fontSize: '12px',
                                  color: theme === 'dark' ? '#ffffff' : '#000000',
                                  width: '100%',
                                  minWidth: '60px',
                                }}
                              />
                            )}
                          </div>
                        </div>
                      ) : (
                        /* 添加按钮状态 */
                        <button
                          onClick={openAddTag}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            border: `1px dashed ${theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}`,
                            backgroundColor: 'transparent',
                            color: theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            transition: 'all 0.18s ease',
                            userSelect: 'none'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
                            e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
                            e.currentTarget.style.color = theme === 'dark' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
                          }}
                          aria-label="新增标签"
                        >
                          +
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 分割线 */}
            <div style={{
              height: '1px',
              width: '100%',
              backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              marginBottom: '32px'
            }} />

            {/* 正文编辑区 */}
            <div style={{ maxWidth: '1200px' }}>
              <textarea 
                style={{
                  fontSize: '1.125rem',
                  lineHeight: 1.7,
                  resize: 'none',
                  minHeight: '500px',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  width: '100%',
                  color: theme === 'dark' ? '#ffffff' : '#000000'
                }}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="开始写作..."
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}