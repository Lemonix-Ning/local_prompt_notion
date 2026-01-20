/**
 * ContentSearchBar 组件
 * 编辑器内容搜索栏 - Ctrl+F 触发
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import { useDebounce } from '../utils/debounce';

interface ContentSearchBarProps {
  content: string;
  isVisible: boolean;
  onClose: () => void;
  onHighlight: (matches: SearchMatch[], currentIndex: number) => void;
  theme: string;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

export interface SearchMatch {
  start: number;
  end: number;
  text: string;
}

export function ContentSearchBar({ 
  content, 
  isVisible, 
  onClose, 
  onHighlight,
  theme,
  textareaRef
}: ContentSearchBarProps) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search query to avoid excessive re-renders (300ms delay)
  const debouncedQuery = useDebounce(query, 300);

  // 搜索逻辑
  const performSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      setMatches([]);
      setCurrentIndex(0);
      onHighlight([], -1);
      return;
    }

    const results: SearchMatch[] = [];
    const lowerContent = content.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();
    let pos = 0;

    while (pos < lowerContent.length) {
      const index = lowerContent.indexOf(lowerQuery, pos);
      if (index === -1) break;
      
      results.push({
        start: index,
        end: index + searchQuery.length,
        text: content.substring(index, index + searchQuery.length)
      });
      pos = index + 1;
    }

    setMatches(results);
    if (results.length > 0) {
      setCurrentIndex(0);
      onHighlight(results, 0);
      scrollToMatch(results[0]);
    } else {
      setCurrentIndex(0);
      onHighlight([], -1);
    }
  }, [content, onHighlight]);

  // 滚动到匹配位置
  const scrollToMatch = useCallback((match: SearchMatch) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // 设置光标位置并滚动
    textarea.focus();
    textarea.setSelectionRange(match.start, match.end);
    
    // 计算滚动位置
    const lineHeight = 24; // 大约的行高
    const textBeforeMatch = content.substring(0, match.start);
    const lineNumber = textBeforeMatch.split('\n').length;
    const scrollTop = Math.max(0, (lineNumber - 3) * lineHeight);
    
    textarea.scrollTop = scrollTop;
  }, [content, textareaRef]);

  // 上一个匹配
  const goToPrevious = useCallback(() => {
    if (matches.length === 0) return;
    const newIndex = currentIndex === 0 ? matches.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);
    onHighlight(matches, newIndex);
    scrollToMatch(matches[newIndex]);
  }, [matches, currentIndex, onHighlight, scrollToMatch]);

  // 下一个匹配
  const goToNext = useCallback(() => {
    if (matches.length === 0) return;
    const newIndex = currentIndex === matches.length - 1 ? 0 : currentIndex + 1;
    setCurrentIndex(newIndex);
    onHighlight(matches, newIndex);
    scrollToMatch(matches[newIndex]);
  }, [matches, currentIndex, onHighlight, scrollToMatch]);

  // 当搜索词变化时执行搜索 (debounced)
  useEffect(() => {
    performSearch(debouncedQuery);
  }, [debouncedQuery, performSearch]);

  // 显示时聚焦输入框
  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isVisible]);

  // 键盘快捷键
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          goToPrevious();
        } else {
          goToNext();
        }
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (e.shiftKey) {
          goToPrevious();
        } else {
          goToNext();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, onClose, goToNext, goToPrevious]);

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        backgroundColor: theme === 'dark' ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 10,
        backdropFilter: 'blur(8px)',
      }}
    >
      <Search size={14} style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }} />
      
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索..."
        style={{
          width: '180px',
          padding: '4px 8px',
          backgroundColor: 'transparent',
          border: 'none',
          outline: 'none',
          color: theme === 'dark' ? '#fff' : '#000',
          fontSize: '13px',
        }}
      />

      {/* 匹配计数 */}
      {query && (
        <span style={{
          fontSize: '11px',
          color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
          minWidth: '50px',
          textAlign: 'center',
        }}>
          {matches.length > 0 ? `${currentIndex + 1}/${matches.length}` : '无结果'}
        </span>
      )}

      {/* 上一个/下一个按钮 */}
      <div style={{ display: 'flex', gap: '2px' }}>
        <button
          onClick={goToPrevious}
          disabled={matches.length === 0}
          style={{
            padding: '4px',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '4px',
            cursor: matches.length > 0 ? 'pointer' : 'not-allowed',
            color: matches.length > 0 
              ? (theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)')
              : (theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'),
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            if (matches.length > 0) {
              e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          title="上一个 (Shift+Enter)"
        >
          <ChevronUp size={14} />
        </button>
        <button
          onClick={goToNext}
          disabled={matches.length === 0}
          style={{
            padding: '4px',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '4px',
            cursor: matches.length > 0 ? 'pointer' : 'not-allowed',
            color: matches.length > 0 
              ? (theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)')
              : (theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'),
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            if (matches.length > 0) {
              e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          title="下一个 (Enter)"
        >
          <ChevronDown size={14} />
        </button>
      </div>

      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        style={{
          padding: '4px',
          backgroundColor: 'transparent',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
          e.currentTarget.style.color = theme === 'dark' ? '#fff' : '#000';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
        }}
        title="关闭 (Esc)"
      >
        <X size={14} />
      </button>
    </div>
  );
}
