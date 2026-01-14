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
  }

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

  async createPrompt(categoryPath: string, title: string): Promise<PromptData> {
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
    };

    const promptData: PromptData = {
      meta,
      content: '',
      path: promptPath,
    };

    this.storage.set(promptPath, promptData);
    return promptData;
  }

  async createCategory(parentPath: string, name: string): Promise<void> {
    // 模拟实现
    console.log(`Creating category: ${parentPath}/${name}`);
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

  async moveCategory(_categoryPath: string, _targetParentPath: string): Promise<{ name: string; path: string; usedFallback?: boolean }> {
    throw new Error('MockFileSystemAdapter: moveCategory is not supported in mock mode');
  }

  async deleteCategory(categoryPath: string): Promise<void> {
    console.log(`Deleting category: ${categoryPath}`);
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
