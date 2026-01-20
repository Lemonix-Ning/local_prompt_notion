/**
 * 文件系统适配器
 * 处理所有文件系统操作
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  IFileSystemAdapter,
  FileSystemState,
  PromptData,
  PromptMetadata,
  CategoryNode,
} from './types';

export class FileSystemAdapter implements IFileSystemAdapter {
  /**
   * 移动分类到新的父目录
   */
  async moveCategory(
    categoryPath: string,
    newParentPath: string
  ): Promise<{ name: string; path: string; usedFallback?: boolean }> {
    const categoryName = path.basename(categoryPath);
    const newPath = path.join(newParentPath, categoryName);
    
    // 确保目标路径不存在
    if (await this.fileExists(newPath)) {
      throw new Error(`Category "${categoryName}" already exists in target location`);
    }
    
    // 移动分类
    await fs.rename(categoryPath, newPath);

    return { name: categoryName, path: newPath };
  }
  /**
   * 扫描 Vault 目录,构建文件系统状态
   */
  async scanVault(rootPath: string): Promise<FileSystemState> {
    const categories = await this.scanDirectory(rootPath, rootPath);
    const allPrompts = new Map<string, PromptData>();

    // 递归收集所有提示词
    const collectPrompts = (node: CategoryNode) => {
      node.prompts.forEach(prompt => {
        allPrompts.set(prompt.meta.id, prompt);
      });
      node.children.forEach(collectPrompts);
    };

    categories.forEach(collectPrompts);

    return {
      root: rootPath,
      categories,
      allPrompts,
    };
  }

  /**
   * 递归扫描目录
   */
  private async scanDirectory(
    dirPath: string,
    rootPath: string
  ): Promise<CategoryNode[]> {
    const nodes: CategoryNode[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        // 跳过隐藏文件夹和 trash
        if (entry.name.startsWith('.') || entry.name === 'trash') {
          continue;
        }

        if (entry.isDirectory()) {
          const fullPath = path.join(dirPath, entry.name);
          const hasMeta = await this.fileExists(path.join(fullPath, 'meta.json'));

          if (hasMeta) {
            // 这是一个提示词容器
            // 不作为分类节点,而是在父级处理
            continue;
          } else {
            // 这是一个分类文件夹
            const categoryNode: CategoryNode = {
              name: entry.name,
              path: fullPath,
              children: await this.scanDirectory(fullPath, rootPath),
              prompts: await this.loadPromptsInDirectory(fullPath),
              isExpanded: false,
            };
            nodes.push(categoryNode);
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error);
    }

    return nodes;
  }

  /**
   * 加载目录中的所有提示词
   */
  private async loadPromptsInDirectory(dirPath: string): Promise<PromptData[]> {
    const prompts: PromptData[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const fullPath = path.join(dirPath, entry.name);
          const hasMeta = await this.fileExists(path.join(fullPath, 'meta.json'));

          if (hasMeta) {
            try {
              const prompt = await this.readPrompt(fullPath);
              prompts.push(prompt);
            } catch (error) {
              console.error(`Error reading prompt at ${fullPath}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error loading prompts in ${dirPath}:`, error);
    }

    return prompts;
  }

  /**
   * 读取单个提示词
   */
  async readPrompt(promptPath: string): Promise<PromptData> {
    const metaPath = path.join(promptPath, 'meta.json');
    const contentPath = path.join(promptPath, 'prompt.md');

    // 读取元数据
    const metaContent = await fs.readFile(metaPath, 'utf-8');
    const meta: PromptMetadata = JSON.parse(metaContent);

    // 读取内容
    let content = '';
    try {
      content = await fs.readFile(contentPath, 'utf-8');
    } catch (error) {
      content = '';
    }

    return {
      meta,
      content,
      path: promptPath,
    };
  }

  /**
   * 保存提示词
   */
  async savePrompt(promptData: PromptData): Promise<void> {
    const { meta, content, path: promptPath } = promptData;

    const metaPath = path.join(promptPath, 'meta.json');
    const contentPath = path.join(promptPath, 'prompt.md');
    let touchUpdatedAt = true;
    try {
      const prevMetaRaw = await fs.readFile(metaPath, 'utf-8');
      const prevMeta = JSON.parse(prevMetaRaw);
      let prevContent = '';
      try {
        prevContent = await fs.readFile(contentPath, 'utf-8');
      } catch {
      }

      const changedFavorite = !!prevMeta.is_favorite !== !!meta.is_favorite;
      const changedTitle = (prevMeta.title || '') !== (meta.title || '');
      const changedAuthor = (prevMeta.author || '') !== (meta.author || '');
      const changedTags = JSON.stringify(prevMeta.tags || []) !== JSON.stringify(meta.tags || []);
      const changedModel = JSON.stringify(prevMeta.model_config || {}) !== JSON.stringify(meta.model_config || {});
      const changedContent = (prevContent || '') !== (content || '');

      const onlyFavoriteChanged = changedFavorite && !changedTitle && !changedAuthor && !changedTags && !changedModel && !changedContent;
      if (onlyFavoriteChanged) {
        touchUpdatedAt = false;
      }
    } catch {
    }

    // 确保目录存在
    await fs.mkdir(promptPath, { recursive: true });

    // 更新时间戳
    if (touchUpdatedAt) {
      meta.updated_at = new Date().toISOString();
    }

    // 写入元数据
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

    // 写入内容
    await fs.writeFile(contentPath, content, 'utf-8');
  }

  /**
   * 删除提示词(移动到 trash)
   */
  async deletePrompt(promptPath: string, permanent = false): Promise<void> {
    if (permanent) {
      // 永久删除
      await fs.rm(promptPath, { recursive: true, force: true });
    } else {
      // 移动到回收站
      const rootPath = this.getRootPath(promptPath);
      const trashPath = path.join(rootPath, 'trash');

      // 确保 trash 目录存在
      await fs.mkdir(trashPath, { recursive: true });

      // 移动到 trash
      const promptName = path.basename(promptPath);
      const targetPath = path.join(trashPath, `${promptName}_${Date.now()}`);
      await fs.rename(promptPath, targetPath);
    }
  }

  /**
   * 从回收站恢复提示词
   */
  async restorePrompt(promptPath: string): Promise<void> {
    const rootPath = this.getRootPath(promptPath);
    const trashItemName = path.basename(promptPath);
    const originalName = trashItemName.replace(/_\d+$/, '');
    
    // 恢复到默认分类
    const categoriesPath = path.join(rootPath, 'Coding');
    await fs.mkdir(categoriesPath, { recursive: true });
    
    let targetPath = path.join(categoriesPath, originalName);
    let counter = 1;
    while (await this.fileExists(targetPath)) {
      targetPath = path.join(categoriesPath, `${originalName}_restored_${counter}`);
      counter++;
    }
    
    await fs.rename(promptPath, targetPath);
  }

  /**
   * 创建新提示词
   */
  async createPrompt(categoryPath: string, title: string, options?: { type?: 'NOTE' | 'TASK'; scheduled_time?: string }): Promise<PromptData> {
    const slug = this.titleToSlug(title);
    const promptPath = path.join(categoryPath, slug);

    // 确保目录不存在
    if (await this.fileExists(promptPath)) {
      throw new Error(`Prompt with slug "${slug}" already exists`);
    }

    // 创建目录
    await fs.mkdir(promptPath, { recursive: true });

    // 创建元数据
    const meta: PromptMetadata = {
      id: uuidv4(),
      title,
      slug,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [],
      version: '1.0.0',
      author: 'User',
      model_config: {
        default_model: 'gpt-4',
        temperature: 0.7,
        top_p: 1.0,
      },
      is_favorite: false,
      type: options?.type || 'NOTE',
      scheduled_time: options?.scheduled_time,
    };

    const promptData: PromptData = {
      meta,
      content: '',
      path: promptPath,
    };

    // 保存
    await this.savePrompt(promptData);

    return promptData;
  }

  /**
   * 创建新分类
   */
  async createCategory(parentPath: string, name: string): Promise<void> {
    const categoryPath = path.join(parentPath, name);
    await fs.mkdir(categoryPath, { recursive: true });
  }

  /**
   * 重命名分类
   */
  async renameCategory(categoryPath: string, newName: string): Promise<void> {
    const parentPath = path.dirname(categoryPath);
    const newPath = path.join(parentPath, newName);
    await fs.rename(categoryPath, newPath);
  }

  /**
   * 删除分类
   */
  async deleteCategory(categoryPath: string): Promise<void> {
    await fs.rm(categoryPath, { recursive: true, force: true });
  }

  /**
   * 搜索提示词
   */
  searchPrompts(query: string, prompts: PromptData[]): PromptData[] {
    if (!query.trim()) {
      return prompts;
    }

    const lowerQuery = query.toLowerCase();

    return prompts.filter(prompt => {
      // 搜索标题
      if (prompt.meta.title.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      // 搜索标签
      if (prompt.meta.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) {
        return true;
      }

      // 搜索内容
      if (prompt.content.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      return false;
    });
  }

  /**
   * 获取所有标签
   */
  getAllTags(prompts: PromptData[]): string[] {
    const tagSet = new Set<string>();

    prompts.forEach(prompt => {
      prompt.meta.tags.forEach(tag => tagSet.add(tag));
    });

    return Array.from(tagSet).sort();
  }

  /**
   * 工具方法:检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 工具方法:标题转 slug
   */
  private titleToSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .replace(/-+/g, '_');
  }

  /**
   * 工具方法:获取根路径
   */
  private getRootPath(promptPath: string): string {
    // 简化实现:向上查找包含 .config 的目录
    let current = promptPath;
    while (current !== path.dirname(current)) {
      const configPath = path.join(current, '.config');
      if (this.fileExistsSync(configPath)) {
        return current;
      }
      current = path.dirname(current);
    }
    return path.dirname(promptPath);
  }

  /**
   * 同步检查文件是否存在
   */
  private fileExistsSync(filePath: string): boolean {
    try {
      require('fs').accessSync(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 模拟文件系统适配器(用于浏览器环境)
 */
export class MockFileSystemAdapter implements IFileSystemAdapter {
  /**
   * 移动分类到新的父目录
   */
  async moveCategory(
    categoryPath: string,
    newParentPath: string
  ): Promise<{ name: string; path: string; usedFallback?: boolean }> {
    // Mock environment simulates moving category
    const name = categoryPath.split(/[/\\]/).filter(Boolean).pop() || '';
    const newPath = `${newParentPath}/${name}`;
    return { name, path: newPath, usedFallback: true };
  }

  private storage: Map<string, PromptData> = new Map();

  async scanVault(rootPath: string): Promise<FileSystemState> {
    // 返回模拟数据
    const mockData = this.getMockData();
    return {
      root: rootPath,
      categories: mockData.categories,
      allPrompts: mockData.allPrompts,
    };
  }

  async readPrompt(promptPath: string): Promise<PromptData> {
    const prompt = this.storage.get(promptPath);
    if (!prompt) {
      throw new Error(`Prompt not found: ${promptPath}`);
    }
    return prompt;
  }

  async savePrompt(promptData: PromptData): Promise<void> {
    this.storage.set(promptData.path, promptData);
  }

  async deletePrompt(promptPath: string, _permanent = false): Promise<void> {
    // Mock 环境直接删除
    this.storage.delete(promptPath);
  }

  async restorePrompt(_promptPath: string): Promise<void> {
    // Mock 环境不需要恢复逻辑
    // 实际应用中这里应该有更复杂的实现
  }

  async createPrompt(categoryPath: string, title: string, options?: { type?: 'NOTE' | 'TASK'; scheduled_time?: string }): Promise<PromptData> {
    const slug = title.toLowerCase().replace(/\s+/g, '_');
    const promptPath = `${categoryPath}/${slug}`;

    const meta: PromptMetadata = {
      id: uuidv4(),
      title,
      slug,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [],
      version: '1.0.0',
      author: 'User',
      model_config: {
        default_model: 'gpt-4',
        temperature: 0.7,
        top_p: 1.0,
      },
      is_favorite: false,
      type: options?.type || 'NOTE',
      scheduled_time: options?.scheduled_time,
    };

    const promptData: PromptData = {
      meta,
      content: '',
      path: promptPath,
    };

    this.storage.set(promptPath, promptData);
    return promptData;
  }

  async createCategory(_parentPath: string, _name: string): Promise<void> {
    // 模拟实现
  }

  async renameCategory(_categoryPath: string, _newName: string): Promise<void> {
    // Mock implementation
  }

  async deleteCategory(_categoryPath: string): Promise<void> {
    // Mock implementation
  }

  searchPrompts(query: string, prompts: PromptData[]): PromptData[] {
    if (!query.trim()) {
      return prompts;
    }

    const lowerQuery = query.toLowerCase();
    return prompts.filter(prompt =>
      prompt.meta.title.toLowerCase().includes(lowerQuery) ||
      prompt.meta.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      prompt.content.toLowerCase().includes(lowerQuery)
    );
  }

  getAllTags(prompts: PromptData[]): string[] {
    const tagSet = new Set<string>();
    prompts.forEach(prompt => {
      prompt.meta.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }

  private getMockData() {
    const categories: CategoryNode[] = [
      {
        name: 'Coding',
        path: '/vault/Coding',
        children: [],
        prompts: [
          {
            meta: {
              id: 'react-arch',
              title: 'React System Architect',
              slug: 'react_architect',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              tags: ['react', 'architecture', 'expert'],
              version: '1.0.0',
              author: 'User',
              model_config: {
                default_model: 'gpt-4-turbo',
                temperature: 0.7,
                top_p: 1.0,
              },
              is_favorite: true,
            },
            content: '# Role: React Architect\n\nYou are an expert in scalable React patterns...',
            path: '/vault/Coding/react_architect',
          },
          {
            meta: {
              id: 'sql-opt',
              title: 'SQL Query Optimizer',
              slug: 'sql_optimizer',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              tags: ['sql', 'database', 'performance'],
              version: '1.0.0',
              author: 'User',
              model_config: {
                default_model: 'gpt-3.5-turbo',
                temperature: 0.2,
                top_p: 1.0,
              },
              is_favorite: false,
            },
            content: 'Analyze the following SQL query for performance bottlenecks...',
            path: '/vault/Coding/sql_optimizer',
          },
        ],
      },
      {
        name: 'Creative Writing',
        path: '/vault/Creative Writing',
        children: [],
        prompts: [
          {
            meta: {
              id: 'hero-journey',
              title: 'Hero\'s Journey Generator',
              slug: 'hero_journey',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              tags: ['story', 'structure', 'fiction'],
              version: '1.0.0',
              author: 'User',
              model_config: {
                default_model: 'claude-3-opus',
                temperature: 0.9,
                top_p: 1.0,
              },
              is_favorite: true,
            },
            content: 'Generate a plot outline following the 12 steps of the Hero\'s Journey...',
            path: '/vault/Creative Writing/hero_journey',
          },
        ],
      },
    ];

    const allPrompts = new Map<string, PromptData>();
    categories.forEach(cat => {
      cat.prompts.forEach(prompt => {
        allPrompts.set(prompt.meta.id, prompt);
      });
    });

    return { categories, allPrompts };
  }
}
