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
import rehypeHighlight from 'rehype-highlight';
import { Copy, Check } from 'lucide-react';
import { useState, useCallback } from 'react';
import { LazyLoadManager } from '../utils/lazyLoad';

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
  inline 
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
  
  const handleCopy = useCallback(async () => {
    const text = String(children).replace(/\n$/, '');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Failed to copy
    }
  }, [children]);
  
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
        }}
      >
        {children}
      </code>
    );
  }
  
  // 代码块
  return (
    <div style={{ position: 'relative', marginBottom: '16px' }}>
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
          overflow: 'auto',
          fontSize: '14px',
          lineHeight: 1.6,
        }}
      >
        <code className={className} style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}>
          {children}
        </code>
      </pre>
    </div>
  );
}

// 懒加载图片组件
function LazyImage({ src, alt }: { src?: string; alt?: string }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
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

  // 🔥 处理本地图片路径
  const getImageSrc = () => {
    if (!src) return undefined;
    
    // 如果是 assets/ 开头的相对路径，转换为 API 路径
    if (src.startsWith('assets/')) {
      const apiBaseUrl = typeof window !== 'undefined' && window.location.port === '1420' 
        ? 'http://localhost:3002'
        : 'http://localhost:3001';
      
      // 提取 promptId 和 fileName
      // 格式: assets/promptId/fileName
      const parts = src.split('/');
      if (parts.length >= 3) {
        const promptId = parts[1];
        const fileName = parts.slice(2).join('/');
        return `${apiBaseUrl}/api/images/${promptId}/${fileName}`;
      }
    }
    
    // 其他情况直接返回原始 src
    return src;
  };

  return (
    <img
      ref={imgRef}
      src={isVisible ? getImageSrc() : undefined}
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
        rehypePlugins={[rehypeHighlight]}
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
          
          // pre 标签 - 让 code 组件处理
          pre: ({ children }) => <>{children}</>,
          
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
