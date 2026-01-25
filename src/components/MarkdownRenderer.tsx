/**
 * MarkdownRenderer 组件
 * 实现 OpenAI 风格的 Markdown 渲染
 * 
 * 支持：
 * - 标题 (h1-h6)
 * - 粗体、斜体、删除线
 * - 代码块 (带语法高亮)
 * - 行内代码
 * - 列表 (有序/无序)
 * - 引用块
 * - 链接
 * - 图片
 * - 表格
 * - 任务列表
 * - 分割线
 */

import { memo, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Copy, Check } from 'lucide-react';
import { useState, useCallback, useMemo } from 'react';
import { LazyLoadManager } from '../utils/lazyLoad';
import hljs from 'highlight.js/lib/common';
import { tauriClient } from '../api/tauriClient';
import { isTauriEnv } from '../utils/tauriEnv';
import { convertFileSrc } from '@tauri-apps/api/core';

// 导入 highlight.js 样式（在 index.css 中会覆盖）
import 'highlight.js/styles/github-dark.css';

interface MarkdownRendererProps {
  content: string;
  theme: string;
  className?: string;
}

// 代码块组件 - 带复制按钮
function CodeBlock({ 
  children, 
  className, 
  theme,
  inline,
}: { 
  children: React.ReactNode; 
  className?: string; 
  theme: string;
  inline?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  
  // 提取语言
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  
  // 🔥 递归提取所有文本内容，保留换行
  const extractText = (node: any): string => {
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(extractText).join('');
    if (node?.props?.children) return extractText(node.props.children);
    return '';
  };
  
  const codeText = extractText(children);
  const highlighted = useMemo(() => {
    if (!codeText) return '';
    try {
      if (language) {
        return hljs.highlight(codeText, { language }).value;
      }
      return hljs.highlightAuto(codeText).value;
    } catch {
      return codeText;
    }
  }, [codeText, language]);
  
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Failed to copy
    }
  }, [codeText]);
  
  // 行内代码
  if (inline) {
    return (
      <code
        style={{
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '0.9em',
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
          color: theme === 'dark' ? '#e879f9' : '#9333ea',
          whiteSpace: 'pre-wrap', // 🔥 保留空白但允许换行
        }}
      >
        {children}
      </code>
    );
  }
  
  // 代码块
  return (
    <div 
      style={{ 
        position: 'relative', 
        marginTop: '16px',
        marginBottom: '16px',
        clear: 'both', // 🔥 清除浮动
        isolation: 'isolate', // 🔥 创建新的层叠上下文
      }}
    >
      {/* 语言标签 + 复制按钮 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          borderRadius: '8px 8px 0 0',
          backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: 'transparent',
            color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
            e.currentTarget.style.color = theme === 'dark' ? '#fff' : '#000';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      
      {/* 代码内容 */}
      <pre
        style={{
          margin: 0,
          padding: '16px',
          borderRadius: '0 0 8px 8px',
          backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.03)',
          overflowX: 'auto', // 🔥 水平滚动
          overflowY: 'auto', // 🔥 垂直滚动
          fontSize: '14px',
          lineHeight: 1.6,
          whiteSpace: 'pre', // 🔥 保留空白字符和换行，不自动换行
          tabSize: 2, // 🔥 设置 tab 宽度为 2 个空格
          maxWidth: '100%', // 🔥 限制最大宽度
          boxSizing: 'border-box', // 🔥 包含 padding 在宽度内
        }}
      >
        <code
          className={className}
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
            whiteSpace: 'pre',
            display: 'inline-block',
            minWidth: '100%',
          }}
          dangerouslySetInnerHTML={{ __html: highlighted || codeText }}
        />
      </pre>
    </div>
  );
}

// 懒加载图片组件
function LazyImage({ src, alt }: { src?: string; alt?: string }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(undefined);
  const imgRef = useRef<HTMLImageElement>(null);
  const managerRef = useRef<LazyLoadManager | null>(null);

  useEffect(() => {
    // Initialize lazy load manager
    managerRef.current = new LazyLoadManager({ rootMargin: '200px', threshold: 0.01 });

    // Start observing the image
    if (imgRef.current && src) {
      managerRef.current.observe(imgRef.current, () => {
        setIsVisible(true);
      });
    }

    return () => {
      if (managerRef.current) {
        managerRef.current.disconnect();
      }
    };
  }, [src]);

  useEffect(() => {
    if (!src) {
      setResolvedSrc(undefined);
      return;
    }
    if (!src.startsWith('assets/')) {
      setResolvedSrc(src);
      return;
    }
    if (isTauriEnv()) {
      tauriClient.vault.root().then(root => {
        const separator = root.includes('\\') ? '\\' : '/';
        const cleanedRoot = root.replace(/[\\/]+$/, '');
        const cleanedRel = src.replace(/^\/+/, '').replace(/\//g, separator);
        const filePath = `${cleanedRoot}${separator}${cleanedRel}`;
        setResolvedSrc(convertFileSrc(filePath));
      }).catch(() => {
        setResolvedSrc(src);
      });
      return;
    }
    const apiBaseUrl = 'http://localhost:3001';
    const parts = src.split('/');
    if (parts.length >= 3) {
      const promptId = parts[1];
      const fileName = parts.slice(2).join('/');
      setResolvedSrc(`${apiBaseUrl}/api/images/${promptId}/${fileName}`);
      return;
    }
    setResolvedSrc(src);
  }, [src]);

  return (
    <img
      ref={imgRef}
      src={isVisible ? resolvedSrc : undefined}
      alt={alt || ''}
      onLoad={() => setIsLoaded(true)}
      style={{
        maxWidth: '100%',
        borderRadius: '8px',
        marginTop: '8px',
        marginBottom: '8px',
        opacity: isLoaded ? 1 : 0.5,
        transition: 'opacity 0.3s ease-in-out',
        backgroundColor: 'rgba(128, 128, 128, 0.1)',
        minHeight: isVisible && !isLoaded ? '200px' : undefined,
      }}
    />
  );
}

const MarkdownRendererComponent = ({ content, theme, className }: MarkdownRendererProps) => {
  // 🔥 检测是否包含裸露的 HTML 标签（不在代码块中）
  const hasRawHTML = () => {
    // 移除代码块后检查是否还有 HTML 标签
    const withoutCodeBlocks = content
      .replace(/```[\s\S]*?```/g, '') // 移除代码块
      .replace(/`[^`]+`/g, ''); // 移除行内代码
    
    // 检查是否有 HTML 标签
    return /<[a-z][\s\S]*>/i.test(withoutCodeBlocks);
  };

  // 🔥 如果包含裸露的 HTML，显示为带语法高亮的代码块
  if (hasRawHTML()) {
    return (
      <div 
        className={`markdown-body ${className || ''}`}
        style={{
          color: theme === 'dark' ? '#e4e4e7' : '#18181b',
          lineHeight: 1.7,
          fontSize: '16px',
        }}
      >
        <div style={{
          marginBottom: '16px',
          padding: '8px 12px',
          borderRadius: '8px 8px 0 0',
          backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          fontSize: '12px',
          fontWeight: 500,
          color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          HTML/JavaScript Code
        </div>
        <pre
          className="hljs"
          style={{
            margin: 0,
            padding: '16px',
            borderRadius: '0 0 8px 8px',
            backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.03)',
            overflowX: 'auto',
            overflowY: 'auto',
            fontSize: '14px',
            lineHeight: 1.6,
            whiteSpace: 'pre',
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
            border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            borderTop: 'none',
          }}
          dangerouslySetInnerHTML={{
            __html: hljs.highlight(content, { language: 'html' }).value
          }}
        />
      </div>
    );
  }

  // 🔥 否则正常渲染 Markdown
  return (
    <div 
      className={`markdown-body ${className || ''}`}
      style={{
        color: theme === 'dark' ? '#e4e4e7' : '#18181b',
        lineHeight: 1.7,
        fontSize: '16px',
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // 标题
          h1: ({ children }) => (
            <h1 style={{
              fontSize: '2em',
              fontWeight: 700,
              marginTop: '24px',
              marginBottom: '16px',
              paddingBottom: '8px',
              borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              color: theme === 'dark' ? '#fff' : '#000',
            }}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 style={{
              fontSize: '1.5em',
              fontWeight: 600,
              marginTop: '24px',
              marginBottom: '16px',
              paddingBottom: '6px',
              borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              color: theme === 'dark' ? '#fff' : '#000',
            }}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 style={{
              fontSize: '1.25em',
              fontWeight: 600,
              marginTop: '20px',
              marginBottom: '12px',
              color: theme === 'dark' ? '#fff' : '#000',
            }}>
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 style={{
              fontSize: '1.1em',
              fontWeight: 600,
              marginTop: '16px',
              marginBottom: '8px',
              color: theme === 'dark' ? '#fff' : '#000',
            }}>
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 style={{
              fontSize: '1em',
              fontWeight: 600,
              marginTop: '16px',
              marginBottom: '8px',
              color: theme === 'dark' ? '#fff' : '#000',
            }}>
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 style={{
              fontSize: '0.9em',
              fontWeight: 600,
              marginTop: '16px',
              marginBottom: '8px',
              color: theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
            }}>
              {children}
            </h6>
          ),
          
          // 段落
          p: ({ children }) => (
            <p style={{
              marginTop: 0,
              marginBottom: '16px',
            }}>
              {children}
            </p>
          ),
          
          // 粗体
          strong: ({ children }) => (
            <strong style={{ fontWeight: 600, color: theme === 'dark' ? '#fff' : '#000' }}>
              {children}
            </strong>
          ),
          
          // 斜体
          em: ({ children }) => (
            <em style={{ fontStyle: 'italic' }}>
              {children}
            </em>
          ),
          
          // 删除线
          del: ({ children }) => (
            <del style={{ textDecoration: 'line-through', opacity: 0.7 }}>
              {children}
            </del>
          ),
          
          // 代码
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            return (
              <CodeBlock 
                className={className} 
                theme={theme} 
                inline={isInline}
                {...props}
              >
                {children}
              </CodeBlock>
            );
          },
          
          // pre 标签 - 完全由 code 组件处理，避免嵌套问题
          pre: ({ children }) => {
            // 🔥 直接返回 children，不添加额外的 wrapper
            return <>{children}</>;
          },
          
          // 链接
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: theme === 'dark' ? '#60a5fa' : '#2563eb',
                textDecoration: 'none',
                borderBottom: `1px solid ${theme === 'dark' ? 'rgba(96,165,250,0.3)' : 'rgba(37,99,235,0.3)'}`,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderBottomColor = theme === 'dark' ? '#60a5fa' : '#2563eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderBottomColor = theme === 'dark' ? 'rgba(96,165,250,0.3)' : 'rgba(37,99,235,0.3)';
              }}
            >
              {children}
            </a>
          ),
          
          // 图片 - 使用懒加载
          img: ({ src, alt }) => <LazyImage src={src} alt={alt} />,
          
          // 无序列表
          ul: ({ children }) => (
            <ul style={{
              marginTop: 0,
              marginBottom: '16px',
              paddingLeft: '24px',
              listStyleType: 'disc',
            }}>
              {children}
            </ul>
          ),
          
          // 有序列表
          ol: ({ children }) => (
            <ol style={{
              marginTop: 0,
              marginBottom: '16px',
              paddingLeft: '24px',
              listStyleType: 'decimal',
            }}>
              {children}
            </ol>
          ),
          
          // 列表项
          li: ({ children }) => (
            <li style={{
              marginBottom: '4px',
            }}>
              {children}
            </li>
          ),
          
          // 引用块
          blockquote: ({ children }) => (
            <blockquote style={{
              margin: '16px 0',
              padding: '12px 16px',
              borderLeft: `4px solid ${theme === 'dark' ? '#6366f1' : '#4f46e5'}`,
              backgroundColor: theme === 'dark' ? 'rgba(99,102,241,0.1)' : 'rgba(79,70,229,0.05)',
              borderRadius: '0 8px 8px 0',
              color: theme === 'dark' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)',
            }}>
              {children}
            </blockquote>
          ),
          
          // 表格
          table: ({ children }) => (
            <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '14px',
              }}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead style={{
              backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            }}>
              {children}
            </thead>
          ),
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr style={{
              borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            }}>
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th style={{
              padding: '10px 12px',
              textAlign: 'left',
              fontWeight: 600,
              color: theme === 'dark' ? '#fff' : '#000',
            }}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td style={{
              padding: '10px 12px',
            }}>
              {children}
            </td>
          ),
          
          // 分割线
          hr: () => (
            <hr style={{
              border: 'none',
              height: '1px',
              backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              margin: '24px 0',
            }} />
          ),
          
          // 任务列表项
          input: ({ type, checked }) => {
            if (type === 'checkbox') {
              return (
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  style={{
                    marginRight: '8px',
                    width: '16px',
                    height: '16px',
                    accentColor: theme === 'dark' ? '#6366f1' : '#4f46e5',
                  }}
                />
              );
            }
            return null;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

// Memoize MarkdownRenderer to prevent unnecessary re-renders
// Only re-render when content or theme changes
export const MarkdownRenderer = memo(MarkdownRendererComponent, (prevProps, nextProps) => {
  return (
    prevProps.content === nextProps.content &&
    prevProps.theme === nextProps.theme &&
    prevProps.className === nextProps.className
  );
});

MarkdownRenderer.displayName = 'MarkdownRenderer';
