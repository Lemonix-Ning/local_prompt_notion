/**
 * EditorOverlay 组件
 * 实现 Mac 风格共享元素过渡动画 + 沉浸式编辑器UI
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  FolderOpen,
  Maximize2,
  Minimize2
} from 'lucide-react';

import { getSmartIcon } from '../utils/smartIcon';
import { getIconGradientConfig, getTagStyle } from '../utils/tagColors';
import { useToast } from '../contexts/ToastContext';
import { useLumi } from '../contexts/LumiContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { ContentSearchBar, type SearchMatch } from './ContentSearchBar';
import { lazy, Suspense } from 'react';

// Lazy load MarkdownRenderer to reduce initial bundle size
const MarkdownRenderer = lazy(() => import('./MarkdownRenderer').then(module => ({ default: module.MarkdownRenderer })));

interface EditorOverlayProps {
  promptId: string;
  originCardId: string;
  onClose: () => void;
  // 卡片导航支持
  promptIds?: string[]; // 当前视图的所有卡片 ID 列表
  onNavigate?: (promptId: string, originCardId: string) => void; // 导航到其他卡片
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });

  const updateMenuPos = () => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const minWidth = 240;
    const width = Math.max(rect.width, minWidth);
    const nextLeft = (() => {
      if (typeof window === 'undefined') return rect.left;
      const maxLeft = Math.max(8, window.innerWidth - width - 8);
      return Math.max(8, Math.min(rect.left, maxLeft));
    })();
    const nextTop = (() => {
      if (typeof window === 'undefined') return rect.bottom + 4;
      const gap = 4;
      const menuMaxHeight = 300;
      const preferDown = rect.bottom + gap;
      const preferUp = rect.top - gap - menuMaxHeight;
      const fitsDown = preferDown + menuMaxHeight <= window.innerHeight - 8;
      const t = fitsDown ? preferDown : preferUp;
      return Math.max(8, Math.min(t, window.innerHeight - 8 - menuMaxHeight));
    })();

    setMenuPos({
      top: nextTop,
      left: nextLeft,
      width,
    });
  };

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideTrigger = !!(selectorRef.current && selectorRef.current.contains(target));
      const insideMenu = !!(menuRef.current && menuRef.current.contains(target));
      if (!insideTrigger && !insideMenu) {
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

  useEffect(() => {
    if (!isOpen) return;
    // 首帧 rect 可能不稳定，延迟到下一帧计算位置，避免 width=0/坐标错误
    const raf = requestAnimationFrame(() => updateMenuPos());

    const handle = () => updateMenuPos();
    window.addEventListener('resize', handle);
    window.addEventListener('scroll', handle, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', handle);
      window.removeEventListener('scroll', handle, true);
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
        ref={buttonRef}
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          if (next) updateMenuPos();
        }}
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

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed',
          top: `${menuPos.top || 8}px`,
          left: `${menuPos.left || 8}px`,
          width: `${menuPos.width || 240}px`,
          zIndex: 1000001,
          pointerEvents: 'auto',
        }}>
          <div ref={menuRef} style={{
            backgroundColor: theme === 'dark' ? '#000000' : '#ffffff',
            border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)',
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
      </div>,
      document.body
    )}
  </div>
  );
}

export function EditorOverlay({ promptId, originCardId, onClose, promptIds, onNavigate }: EditorOverlayProps) {
  const { theme } = useTheme();
  const { state, savePrompt, deletePrompt } = useApp();
  const { showToast } = useToast();
  const { triggerAction } = useLumi();

  useConfirm(); // 保留 hook 调用以维持 Context 订阅
  const [animationState, setAnimationState] = useState<AnimationState | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  
  // 搜索功能状态
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // 编辑模式：默认显示渲染后的 Markdown
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const markdownContainerRef = useRef<HTMLDivElement>(null);
  
  // 双击检测：区分单击进入编辑 vs 双击进入专注模式
  const clickTimerRef = useRef<number | null>(null);
  const clickCountRef = useRef<number>(0);
  
  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const scrollableRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 添加 firework 效果状态
  const [isBursting, setIsBursting] = useState(false);
  const [burstAnchor, setBurstAnchor] = useState<{ x: number; y: number } | null>(null);
  const burstTimerRef = useRef<number | null>(null);

  // 图片粘贴状态
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  /**
   * 处理图片粘贴
   */
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    // 检查是否有图片
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (item.type.startsWith('image/')) {
        e.preventDefault(); // 阻止默认粘贴行为
        
        const file = item.getAsFile();
        if (!file || !prompt) return;
        
        try {
          setIsUploadingImage(true);
          
          // 在光标位置插入占位符
          const textarea = contentTextareaRef.current;
          if (!textarea) return;
          
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const loadingId = `loading-${Date.now()}`;
          const placeholder = `![正在上传图片...](${loadingId})`;
          
          const newContent = content.substring(0, start) + placeholder + content.substring(end);
          setContent(newContent);
          
          // 将图片转换为 base64
          const reader = new FileReader();
          reader.onload = async () => {
            try {
              const base64Data = reader.result as string;
              
              // 上传图片
              const apiBaseUrl = 'http://localhost:3001';
              
              const response = await fetch(`${apiBaseUrl}/api/images/upload`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  imageData: base64Data,
                  promptId: prompt.meta.id,
                }),
              });
              
              if (!response.ok) {
                throw new Error('图片上传失败');
              }
              
              const result = await response.json();
              
              // 使用引用式链接：找到下一个可用的引用编号
              const existingRefs = newContent.match(/\[(\d+)\]:/g) || [];
              const maxRef = existingRefs.length > 0 
                ? Math.max(...existingRefs.map(r => parseInt(r.match(/\d+/)?.[0] || '0')))
                : 0;
              const refNum = maxRef + 1;
              
              // 正文使用简短的引用标记
              const imageMd = `![图片][${refNum}]`;
              
              // 在文档末尾添加引用定义
              const refDefinition = `\n[${refNum}]: ${result.path}`;
              const contentWithoutPlaceholder = newContent.replace(placeholder, imageMd);
              const finalContent = contentWithoutPlaceholder + refDefinition;
              
              setContent(finalContent);
              
              // 恢复光标位置
              requestAnimationFrame(() => {
                if (textarea) {
                  const newCursorPos = start + imageMd.length;
                  textarea.selectionStart = textarea.selectionEnd = newCursorPos;
                  textarea.focus();
                }
              });
              
              showToast('图片上传成功', 'success');
              
            } catch (error) {
              console.error('图片上传失败:', error);
              // 移除占位符
              setContent(newContent.replace(placeholder, ''));
              showToast('图片上传失败', 'error');
            } finally {
              setIsUploadingImage(false);
            }
          };
          
          reader.onerror = () => {
            showToast('图片读取失败', 'error');
            setIsUploadingImage(false);
            // 移除占位符
            setContent(newContent.replace(placeholder, ''));
          };
          
          reader.readAsDataURL(file);
          
        } catch (error) {
          console.error('处理图片粘贴失败:', error);
          showToast('处理图片失败', 'error');
          setIsUploadingImage(false);
        }
        
        break; // 只处理第一张图片
      }
    }
  };

  const fireworkParticles = useMemo(() => {
    return Array.from({ length: 8 }).map((_, i) => {
      const angle = (i * 45) * (Math.PI / 180);
      const distance = 24;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;
      return {
        tx: `${tx}px`,
        ty: `${ty}px`,
        color: i % 2 === 0 ? '#facc15' : '#fb923c',
      };
    });
  }, []);
  
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
        triggerAction('update');
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
    }

    // 修复：在关闭动画完成后恢复原卡片显示并调用 onClose
    // 使用 setTimeout 而不是 transitionend 事件，因为更可靠
    setTimeout(() => {
      if (originCard) {
        // 恢复为空字符串，让 CSS 控制 opacity
        originCard.style.opacity = '';
      }
      // 延迟调用 onClose，确保动画完成
      requestAnimationFrame(() => {
        onClose();
      });
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

  // 处理 ESC 键关闭 和 Ctrl+F 搜索
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F 打开搜索
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearchVisible(true);
        return;
      }
      
      // 左右箭头：切换卡片
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // 如果正在编辑文本，不拦截箭头键
        if (isEditing) return;
        
        // 如果有卡片列表和导航回调
        if (promptIds && promptIds.length > 1 && onNavigate) {
          e.preventDefault();
          const currentIndex = promptIds.indexOf(promptId);
          
          if (e.key === 'ArrowLeft' && currentIndex > 0) {
            // 上一张卡片
            const prevId = promptIds[currentIndex - 1];
            const prevOriginCardId = `prompt-card-${prevId}`;
            onNavigate(prevId, prevOriginCardId);
          } else if (e.key === 'ArrowRight' && currentIndex < promptIds.length - 1) {
            // 下一张卡片
            const nextId = promptIds[currentIndex + 1];
            const nextOriginCardId = `prompt-card-${nextId}`;
            onNavigate(nextId, nextOriginCardId);
          }
        }
        return;
      }
      
      // 上下箭头：滚动内容
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        // 如果正在编辑文本，不拦截箭头键
        if (isEditing) return;
        
        // 如果有滚动容器
        if (scrollableRef.current) {
          e.preventDefault();
          const scrollAmount = 100; // 每次滚动 100px
          const direction = e.key === 'ArrowUp' ? -1 : 1;
          scrollableRef.current.scrollBy({
            top: scrollAmount * direction,
            behavior: 'smooth'
          });
        }
        return;
      }
      
      // 空格键：循环切换 正常 → 扩大 → 专注 → 正常
      if (e.key === ' ') {
        e.preventDefault();
        
        // 状态机：正常(未扩大且未专注) → 扩大 → 专注 → 正常
        if (!isExpanded && !isFocusMode) {
          // 正常 → 扩大
          toggleExpanded();
        } else if (isExpanded && !isFocusMode) {
          // 扩大 → 专注
          toggleFocusMode();
        } else if (isFocusMode) {
          // 专注 → 正常（退出专注模式，同时退出扩大模式）
          setIsFocusMode(false);
          if (isExpanded) {
            toggleExpanded();
          }
        }
        return;
      }
      
      // ESC 关闭搜索或编辑器
      if (e.key === 'Escape') {
        if (isSearchVisible) {
          setIsSearchVisible(false);
        } else {
          handleClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchVisible, handleClose, isExpanded, isFocusMode, isEditing, promptId, promptIds, onNavigate]); 
  
  // 右键菜单：点击外部关闭
  useEffect(() => {
    if (!contextMenu) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu]);

  // 搜索高亮回调
  const handleSearchHighlight = useCallback((_matches: SearchMatch[], _currentIndex: number) => {
    // 预留：将来可以用于高亮显示匹配文本
  }, []);

  // 初始化动画状态
  useEffect(() => {
    const originCard = document.getElementById(originCardId);
    
    if (originCard) {
      const rect = originCard.getBoundingClientRect();
      
      // 修复：在隐藏新卡片之前，先恢复所有之前被隐藏的卡片
      // 这样可以确保在导航时，之前的卡片会被正确恢复显示
      const allCards = document.querySelectorAll('[id^="prompt-card-"]');
      allCards.forEach((card) => {
        if (card.id !== originCardId && (card as HTMLElement).style.opacity === '0') {
          (card as HTMLElement).style.opacity = '';
        }
      });
      
      // 隐藏当前卡片
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
          setIsExpanded(false);
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
      setIsExpanded(false);
    }
  }, [originCardId]);

  const toggleExpanded = () => {
    if (!animationState) return;

    if (!isExpanded) {
      const topInset = 8;
      const sideInset = 8;
      const bottomInset = 8;
      setAnimationState({
        ...animationState,
        top: topInset,
        left: sideInset,
        width: `calc(100vw - ${sideInset * 2}px)`,
        height: `calc(100vh - ${topInset + bottomInset}px)`,
        borderRadius: '12px',
      });
      setIsExpanded(true);
      return;
    }

    const padding = 80;
    const maxWidth = 1400;
    const maxHeight = window.innerHeight - padding * 2;
    const finalWidth = Math.min(window.innerWidth - padding * 2, maxWidth);
    const finalHeight = maxHeight;
    const finalLeft = (window.innerWidth - finalWidth) / 2;
    const finalTop = padding;

    setAnimationState({
      ...animationState,
      top: finalTop,
      left: finalLeft,
      width: finalWidth,
      height: finalHeight,
      borderRadius: '16px',
    });
    setIsExpanded(false);
  };

  const toggleFocusMode = () => {
    const next = !isFocusMode;
    setIsFocusMode(next);
    if (!next) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = scrollableRef.current;
        if (!el) return;
        el.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  };

  // 处理收藏
  const handleToggleFavorite = async (e: React.MouseEvent) => {
    if (!prompt) return;
    
    // 添加 firework 效果
    if (!prompt.meta.is_favorite) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setIsBursting(true);
      setBurstAnchor({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
      if (burstTimerRef.current) {
        window.clearTimeout(burstTimerRef.current);
      }
      burstTimerRef.current = window.setTimeout(() => {
        setIsBursting(false);
        setBurstAnchor(null);
        burstTimerRef.current = null;
      }, 600);
    }
    
    const updated = {
      ...prompt,
      meta: { ...prompt.meta, is_favorite: !prompt.meta.is_favorite }
    };
    
    try {
      await savePrompt(updated);
      triggerAction('favorite');
      showToast("已保存更改", 'success');
    } catch (error) {
      showToast("操作失败", 'error');
    }
  };

  // 处理删除
  const handleDelete = async () => {
    try {
      await deletePrompt(promptId, false);
      triggerAction('delete');
      showToast("已移动到回收站，可从回收站恢复", 'success');
      onClose();
    } catch (error) {
      showToast("删除失败", 'error');
    }
  };

  // 处理复制
  const handleCopy = () => {
    navigator.clipboard.writeText(content)
      .then(() => {
        showToast("已复制到剪贴板", 'success');
        triggerAction('clipboard');
      })
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
              onClick={toggleExpanded}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'rgba(0,0,0,0.05)',
                color: theme === 'dark' ? '#ffffff' : '#000000',
                cursor: 'pointer'
              }}
              aria-label={isExpanded ? '退出全屏' : '全屏'}
              title={isExpanded ? '退出全屏' : '全屏'}
            >
              {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
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
              <Star 
                size={18} 
                fill={prompt.meta.is_favorite ? "currentColor" : "none"}
                className={isBursting ? 'star-bounce' : undefined}
              />
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
              padding: isExpanded || isFocusMode ? '72px 48px 48px 48px' : '48px 48px 48px 48px'
            }}
          >
            <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* 头部信息区 */}
              <div
                style={{
                  marginBottom: isFocusMode ? '0px' : '32px',
                  maxHeight: isFocusMode ? '0px' : '2000px',
                  opacity: isFocusMode ? 0 : 1,
                  overflow: 'hidden',
                  transition: 'max-height 0.26s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.18s ease, margin-bottom 0.18s ease',
                }}
              >
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
                            triggerAction('update');
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
                                triggerAction('update');
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
                marginBottom: isFocusMode ? '16px' : '32px',
                maxHeight: isFocusMode ? '0px' : '1px',
                opacity: isFocusMode ? 0 : 1,
                overflow: 'hidden',
                transition: 'max-height 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.18s ease, margin-bottom 0.18s ease',
              }} />

              {/* 正文编辑区 */}
              <div 
                style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', position: 'relative' }}
                onDoubleClick={(e) => {
                  // 🔥 双击容器空白区域（不是 textarea 内部）时切换专注模式
                  const target = e.target as HTMLElement;
                  const isTextarea = target.tagName === 'TEXTAREA';
                  
                  if (!isTextarea) {
                    e.stopPropagation();
                    toggleFocusMode();
                  }
                }}
              >
                {/* 🔥 搜索栏 */}
                <ContentSearchBar
                  content={content}
                  isVisible={isSearchVisible}
                  onClose={() => {
                    setIsSearchVisible(false);
                  }}
                  onHighlight={handleSearchHighlight}
                  theme={theme}
                  textareaRef={contentTextareaRef}
                />
                
                {/* 🔥 OpenAI 风格：点击进入编辑，失焦显示渲染 */}
                {isEditing ? (
                  <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <textarea 
                      ref={contentTextareaRef}
                      style={{
                        width: '100%',
                        flex: 1,
                        minHeight: 0,
                        fontSize: '16px',
                        lineHeight: 1.7,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        resize: 'none',
                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                        color: theme === 'dark' ? '#e4e4e7' : '#18181b',
                        padding: '0',
                      }}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      onPaste={handlePaste}
                      onBlur={() => {
                        // 🔥 失去焦点时退出编辑模式，回到预览
                        setIsEditing(false);
                      }}
                      onContextMenu={(e) => {
                        // 🔥 右键菜单
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY });
                      }}
                      onDoubleClick={(e) => {
                        // 🔥 阻止默认的双击全选行为，改为切换专注模式
                        e.preventDefault();
                        toggleFocusMode();
                      }}
                      onKeyDown={(e) => {
                        // Tab 键插入制表符
                        if (e.key === 'Tab') {
                          e.preventDefault();
                          const textarea = e.currentTarget;
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const newContent = content.substring(0, start) + '  ' + content.substring(end);
                          setContent(newContent);
                          requestAnimationFrame(() => {
                            textarea.selectionStart = textarea.selectionEnd = start + 2;
                          });
                        }
                      }}
                      placeholder="开始写作... (支持 Markdown)"
                      autoFocus
                      disabled={isUploadingImage}
                    />
                    
                    {/* 🔥 图片预览层 - 显示编辑器中的图片 */}
                    {content.match(/!\[.*?\]\((assets\/[^)]+)\)/g) && (
                      <div style={{
                        marginTop: '16px',
                        padding: '12px',
                        backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                        borderRadius: '8px',
                        border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                      }}>
                        <div style={{
                          fontSize: '12px',
                          color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                          marginBottom: '8px',
                          fontWeight: 500,
                        }}>
                          📷 文档中的图片 ({content.match(/!\[.*?\]\((assets\/[^)]+)\)/g)?.length || 0})
                        </div>
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '8px',
                        }}>
                          {content.match(/!\[.*?\]\((assets\/[^)]+)\)/g)?.map((match, index) => {
                            const pathMatch = match.match(/!\[.*?\]\((assets\/[^)]+)\)/);
                            if (!pathMatch) return null;
                            
                            const imagePath = pathMatch[1];
                            const parts = imagePath.split('/');
                            if (parts.length < 3) return null;
                            
                            const promptId = parts[1];
                            const fileName = parts.slice(2).join('/');
                            const apiBaseUrl = 'http://localhost:3001';
                            const imageUrl = `${apiBaseUrl}/api/images/${promptId}/${fileName}`;
                            
                            return (
                              <div
                                key={index}
                                style={{
                                  position: 'relative',
                                  width: '120px',
                                  height: '120px',
                                  borderRadius: '6px',
                                  overflow: 'hidden',
                                  border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
                                  cursor: 'pointer',
                                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'scale(1.05)';
                                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'scale(1)';
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                                onClick={() => {
                                  // 点击图片可以在新窗口打开
                                  window.open(imageUrl, '_blank');
                                }}
                              >
                                <img
                                  src={imageUrl}
                                  alt="预览"
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    ref={markdownContainerRef}
                    onClick={(e) => {
                      // 🔥 双击检测逻辑
                      clickCountRef.current += 1;
                      
                      if (clickCountRef.current === 1) {
                        // 第一次点击：等待 300ms 看是否有第二次点击
                        clickTimerRef.current = window.setTimeout(() => {
                          // 300ms 后仍然只有一次点击 → 进入编辑模式
                          setIsEditing(true);
                          clickCountRef.current = 0;
                        }, 300);
                      } else if (clickCountRef.current === 2) {
                        // 第二次点击（双击）→ 进入专注模式
                        if (clickTimerRef.current) {
                          clearTimeout(clickTimerRef.current);
                          clickTimerRef.current = null;
                        }
                        e.stopPropagation();
                        toggleFocusMode();
                        clickCountRef.current = 0;
                      }
                    }}
                    style={{
                      flex: 1,
                      minHeight: 0,
                      overflowY: 'auto',
                      cursor: 'text',
                    }}
                  >
                    {content.trim() ? (
                      <Suspense fallback={<div style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontSize: '16px' }}>加载中...</div>}>
                        <MarkdownRenderer 
                          content={content} 
                          theme={theme}
                        />
                      </Suspense>
                    ) : (
                      <div 
                        style={{ 
                          color: theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                          fontSize: '16px',
                          lineHeight: 1.7,
                        }}
                      >
                        点击此处开始写作... (支持 Markdown)
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🔥 Firework 粒子效果 */}
      {burstAnchor && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            left: burstAnchor.x,
            top: burstAnchor.y,
            width: 0,
            height: 0,
            pointerEvents: 'none',
            zIndex: 1000001,
          }}
        >
          {fireworkParticles.map((p: { tx: string; ty: string; color: string }, idx: number) => (
            <span
              key={idx}
              className="firework-particle"
              style={{
                ['--tx' as any]: p.tx,
                ['--ty' as any]: p.ty,
                backgroundColor: p.color,
              }}
            />
          ))}
        </div>,
        document.body
      )}
      
      {/* 🔥 右键菜单 */}
      {contextMenu && typeof document !== 'undefined' && createPortal(
        <div
          ref={contextMenuRef}
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 1000002,
            backgroundColor: theme === 'dark' ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(10px)',
            border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            borderRadius: '8px',
            boxShadow: theme === 'dark' 
              ? '0 4px 12px rgba(0,0,0,0.5)' 
              : '0 4px 12px rgba(0,0,0,0.15)',
            padding: '4px',
            minWidth: '160px',
          }}
        >
          <button
            onClick={() => {
              setIsEditing(false);
              setContextMenu(null);
            }}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: 'none',
              background: 'transparent',
              color: theme === 'dark' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)',
              fontSize: '14px',
              textAlign: 'left',
              cursor: 'pointer',
              borderRadius: '4px',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            切换预览
          </button>
        </div>,
        document.body
      )}
    </>
  );
}
