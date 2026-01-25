/**
 * 模拟文件系统适配器(用于浏览器环境)
 */

import { v4 as uuidv4 } from 'uuid';
import { IFileSystemAdapter, FileSystemState, PromptData, PromptMetadata, CategoryNode } from './types';

export class MockFileSystemAdapter implements IFileSystemAdapter {
  private storage: Map<string, PromptData> = new Map();
  private mockData: FileSystemState;

  constructor() {
    const mock = this.getMockData();
    this.mockData = {
      root: '/vault',
      categories: mock.categories,
      allPrompts: mock.allPrompts,
    };
    this.storage = new Map(
      Array.from(this.mockData.allPrompts.values()).map(prompt => [prompt.path, prompt])
    );
  }

  async scanVault(rootPath: string): Promise<FileSystemState> {
    this.mockData.root = rootPath;
    return {
      root: rootPath,
      categories: this.mockData.categories,
      allPrompts: this.mockData.allPrompts,
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
    this.mockData.allPrompts.set(promptData.meta.id, promptData);
  }

  async deletePrompt(promptPath: string, _permanent = false): Promise<void> {
    this.storage.delete(promptPath);
    const removeFromCategory = (nodes: CategoryNode[]) => {
      nodes.forEach(node => {
        node.prompts = node.prompts.filter(prompt => prompt.path !== promptPath);
        if (node.children.length > 0) {
          removeFromCategory(node.children);
        }
      });
    };
    removeFromCategory(this.mockData.categories);
    const toRemove = Array.from(this.mockData.allPrompts.values()).find(prompt => prompt.path === promptPath);
    if (toRemove) {
      this.mockData.allPrompts.delete(toRemove.meta.id);
    }
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
    this.mockData.allPrompts.set(meta.id, promptData);
    const insertIntoCategory = (nodes: CategoryNode[]): boolean => {
      for (const node of nodes) {
        if (node.path === categoryPath) {
          node.prompts.push(promptData);
          return true;
        }
        if (node.children.length > 0 && insertIntoCategory(node.children)) return true;
      }
      return false;
    };
    insertIntoCategory(this.mockData.categories);
    return promptData;
  }

  async createCategory(parentPath: string, name: string): Promise<void> {
    const newCategory: CategoryNode = {
      name,
      path: `${parentPath}/${name}`,
      children: [],
      prompts: [],
    };
    const insertIntoCategory = (nodes: CategoryNode[]): boolean => {
      for (const node of nodes) {
        if (node.path === parentPath) {
          node.children.push(newCategory);
          return true;
        }
        if (node.children.length > 0 && insertIntoCategory(node.children)) return true;
      }
      return false;
    };
    if (parentPath === this.mockData.root) {
      this.mockData.categories.push(newCategory);
      return;
    }
    insertIntoCategory(this.mockData.categories);
  }

  async renameCategory(categoryPath: string, newName: string): Promise<void> {
    // Mock 实现：简单更新内存中的分类名称
    const updateCategoryName = (nodes: CategoryNode[]): boolean => {
      for (const node of nodes) {
        if (node.path === categoryPath) {
          node.name = newName;
          return true;
        }
        if (updateCategoryName(node.children)) return true;
      }
      return false;
    };

    updateCategoryName(this.mockData.categories);
  }

  async moveCategory(categoryPath: string, targetParentPath: string): Promise<{ name: string; path: string; usedFallback?: boolean }> {
    // Mock 实现：返回移动后的分类信息
    const categoryName = categoryPath.split('/').pop() || '';
    const newPath = `${targetParentPath}/${categoryName}`;
    
    return {
      name: categoryName,
      path: newPath,
      usedFallback: false,
    };
  }

  async deleteCategory(categoryPath: string): Promise<void> {
    const collected: PromptData[] = [];
    const collectPrompts = (node: CategoryNode) => {
      collected.push(...node.prompts);
      node.children.forEach(child => collectPrompts(child));
    };
    const removeCategory = (nodes: CategoryNode[], path: string): CategoryNode | null => {
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].path === path) {
          const [removed] = nodes.splice(i, 1);
          return removed ?? null;
        }
        const removed = removeCategory(nodes[i].children, path);
        if (removed) return removed;
      }
      return null;
    };
    const removedCategory = removeCategory(this.mockData.categories, categoryPath);
    if (!removedCategory) return;
    collectPrompts(removedCategory);
    const timestamp = Date.now();
    collected.forEach((prompt, index) => {
      const moved: PromptData = {
        ...prompt,
        path: `/vault/trash/${prompt.meta.slug}_${timestamp + index}`,
        meta: {
          ...prompt.meta,
          updated_at: new Date().toISOString(),
        },
      };
      this.storage.delete(prompt.path);
      this.storage.set(moved.path, moved);
      this.mockData.allPrompts.set(moved.meta.id, moved);
    });
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
              title: "Hero's Journey Generator",
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
            content: "Generate a plot outline following the 12 steps of the Hero's Journey...",
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
