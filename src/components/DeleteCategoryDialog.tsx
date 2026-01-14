/**
 * 增强的分类删除确认对话框
 */

import { AlertTriangle, Folder, FileText, Trash2, X } from 'lucide-react';
import { CategoryContentInfo } from '../utils/categoryContentAnalyzer';
import { useTheme } from '../contexts/ThemeContext';
import { useEffect, useState } from 'react';
import { NewPromptOverlay } from './NewPromptOverlay';

export interface DeleteCategoryDialogProps {
  isOpen: boolean;
  originId: string;
  categoryName: string;
  contentInfo: CategoryContentInfo;
  onConfirm: (options: DeleteOptions) => void;
  onCancel: () => void;
  onClosed: () => void;
}

export interface DeleteOptions {
  forceDelete: boolean;
}

export function DeleteCategoryDialog({
  isOpen,
  originId,
  categoryName,
  contentInfo,
  onConfirm,
  onCancel,
  onClosed
}: DeleteCategoryDialogProps) {
  const { theme } = useTheme();

  const [mounted, setMounted] = useState(false);
  const [snapshot, setSnapshot] = useState<{
    originId: string;
    categoryName: string;
    contentInfo: CategoryContentInfo;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setSnapshot({ originId, categoryName, contentInfo });
    }
  }, [isOpen, originId, categoryName, contentInfo]);

  if (!mounted || !snapshot) return null;

  const handleConfirm = () => {
    onConfirm({ forceDelete: false });
  };

  const getDialogTitle = () => {
    if (snapshot.contentInfo.isEmpty) {
      return '删除空分类';
    }
    return '删除分类及其内容';
  };

  const getDialogMessage = () => {
    if (snapshot.contentInfo.isEmpty) {
      return `确定要删除空分类"${snapshot.categoryName}"吗？`;
    }

    const parts: string[] = [];
    if (snapshot.contentInfo.hasPrompts) {
      parts.push(`${snapshot.contentInfo.promptCount}个提示词`);
    }
    if (snapshot.contentInfo.hasSubcategories) {
      parts.push(`${snapshot.contentInfo.subcategoryCount}个子分类`);
    }

    const contentDescription = parts.join('和');
    return `分类"${snapshot.categoryName}"包含${contentDescription}。`;
  };

  const getWarningMessage = () => {
    if (snapshot.contentInfo.isEmpty) {
      return '此操作无法撤销。';
    }
    return '删除此分类将把所有内容移动到回收站，您可以稍后从回收站恢复。';
  };

  // 根据主题获取背景颜色
  const getBackgroundClass = () => {
    return theme === 'dark' ? 'bg-popover/95' : 'bg-white/95';
  };

  return (
    <NewPromptOverlay
      isOpen={isOpen}
      originId={snapshot.originId}
      targetState={{
        top: '50%',
        left: '50%',
        width: 'min(92%, 520px)',
        height: 'min(70vh, 520px)',
        transform: 'translate(-50%, -50%)',
        borderRadius: '16px',
        backdropBlur: 12,
      }}
      onRequestClose={onCancel}
      onClosed={() => {
        setMounted(false);
        setSnapshot(null);
        onClosed();
      }}
    >
      <div className={`${getBackgroundClass()} backdrop-blur-xl border border-border rounded-xl shadow-2xl w-full h-full flex flex-col`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b border-border ${theme === 'dark' ? 'bg-background' : 'bg-gray-50'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-destructive/10 rounded-lg flex items-center justify-center">
              <AlertTriangle size={20} className="text-destructive" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">{getDialogTitle()}</h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-accent rounded-lg transition-colors"
          >
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 flex-1 overflow-auto">
          <p className="text-muted-foreground text-sm leading-relaxed">
            {getDialogMessage()}
          </p>

          {/* Content Summary */}
          {!snapshot.contentInfo.isEmpty && (
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-medium text-foreground">将被删除的内容：</h4>
              <div className="space-y-2">
                {snapshot.contentInfo.hasPrompts && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText size={16} className="text-blue-500" />
                    <span>{snapshot.contentInfo.promptCount} 个提示词</span>
                  </div>
                )}
                {snapshot.contentInfo.hasSubcategories && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Folder size={16} className="text-yellow-500" />
                    <span>{snapshot.contentInfo.subcategoryCount} 个子分类</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <p className="text-yellow-800 dark:text-yellow-200 text-sm">
              <AlertTriangle size={16} className="inline mr-2" />
              {getWarningMessage()}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 pb-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-lg transition-colors flex items-center gap-2"
          >
            <Trash2 size={16} />
            {snapshot.contentInfo.isEmpty ? '删除' : '移动到回收站'}
          </button>
        </div>
      </div>
    </NewPromptOverlay>
  );
}