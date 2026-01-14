/**
 * 分类内容分析工具
 * 用于分析分类中包含的提示词和子分类数量
 */

import { CategoryNode } from '../types';

export interface CategoryContentInfo {
  promptCount: number;
  subcategoryCount: number;
  totalSize: number;
  isEmpty: boolean;
  hasPrompts: boolean;
  hasSubcategories: boolean;
}

/**
 * 分析分类内容信息
 */
export function analyzeCategoryContent(category: CategoryNode): CategoryContentInfo {
  const promptCount = getTotalPromptCount(category);
  const subcategoryCount = getTotalSubcategoryCount(category);
  const totalSize = promptCount + subcategoryCount;
  
  return {
    promptCount,
    subcategoryCount,
    totalSize,
    isEmpty: totalSize === 0,
    hasPrompts: promptCount > 0,
    hasSubcategories: subcategoryCount > 0,
  };
}

/**
 * 递归计算分类中的提示词总数
 */
function getTotalPromptCount(category: CategoryNode): number {
  return category.prompts.length + 
    category.children.reduce((sum, child) => sum + getTotalPromptCount(child), 0);
}

/**
 * 递归计算分类中的子分类总数
 */
function getTotalSubcategoryCount(category: CategoryNode): number {
  return category.children.length + 
    category.children.reduce((sum, child) => sum + getTotalSubcategoryCount(child), 0);
}

/**
 * 生成删除确认消息
 */
export function generateDeleteConfirmationMessage(
  categoryName: string, 
  contentInfo: CategoryContentInfo
): string {
  if (contentInfo.isEmpty) {
    return `确定要删除空分类"${categoryName}"吗？此操作无法撤销。`;
  }

  const parts: string[] = [];
  
  if (contentInfo.hasPrompts) {
    parts.push(`${contentInfo.promptCount}个提示词`);
  }
  
  if (contentInfo.hasSubcategories) {
    parts.push(`${contentInfo.subcategoryCount}个子分类`);
  }

  const contentDescription = parts.join('和');
  
  return `分类"${categoryName}"包含${contentDescription}。删除此分类将把所有内容移动到回收站。确定要继续吗？`;
}

/**
 * 检查分类是否可以安全删除
 */
export function canDeleteCategory(_contentInfo: CategoryContentInfo): boolean {
  // 现在允许删除包含内容的分类，因为内容会被移动到回收站
  return true;
}