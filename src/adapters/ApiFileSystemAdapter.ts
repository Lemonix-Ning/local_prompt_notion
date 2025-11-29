import api from '../api/client';
import {
  IFileSystemAdapter,
  FileSystemState,
  PromptData,
  CategoryNode,
} from '../types';

/**
 * Browser-safe adapter that proxies file-system style calls
 * to the Express REST API so data persists to disk.
 */
export class ApiFileSystemAdapter implements IFileSystemAdapter {
  private pathToId = new Map<string, string>();

  private rebuildPathIndex(categories: CategoryNode[]) {
    this.pathToId.clear();

    const walk = (nodes: CategoryNode[]) => {
      nodes.forEach(node => {
        node.prompts.forEach(prompt => {
          this.pathToId.set(prompt.path, prompt.meta.id);
        });
        if (node.children?.length) {
          walk(node.children);
        }
      });
    };

    walk(categories);
  }

  private getPromptIdByPath(promptPath: string): string {
    const id = this.pathToId.get(promptPath);
    if (!id) {
      throw new Error(`Prompt path not indexed: ${promptPath}`);
    }
    return id;
  }

  async scanVault(_rootPath: string): Promise<FileSystemState> {
    const response = await api.vault.scan();

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to scan vault');
    }

    const allPrompts = new Map<string, PromptData>();
    Object.entries(response.data.allPrompts || {}).forEach(([id, prompt]) => {
      allPrompts.set(id, prompt as PromptData);
    });

    this.rebuildPathIndex(response.data.categories || []);

    return {
      root: response.data.root,
      categories: response.data.categories,
      allPrompts,
    };
  }

  async readPrompt(promptPath: string): Promise<PromptData> {
    const id = this.getPromptIdByPath(promptPath);
    const response = await api.prompts.getById(id);

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to read prompt');
    }

    return response.data as PromptData;
  }

  async savePrompt(promptData: PromptData): Promise<void> {
    const { meta, content } = promptData;
    const oldPath = promptData.path;
    const response = await api.prompts.update(meta.id, {
      title: meta.title,
      content,
      tags: meta.tags,
      model_config: meta.model_config,
      is_favorite: meta.is_favorite,
      author: meta.author,
      categoryPath: meta.category_path,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to save prompt');
    }

    const updated = response.data as PromptData;
    promptData.meta = updated.meta;
    promptData.content = updated.content;
    promptData.path = updated.path;
    if (oldPath && oldPath !== updated.path) {
      this.pathToId.delete(oldPath);
    }
    this.pathToId.set(updated.path, updated.meta.id);
  }

  async deletePrompt(promptPath: string, permanent = false): Promise<void> {
    const id = this.getPromptIdByPath(promptPath);
    const response = await api.prompts.delete(id, permanent);

    if (!response.success) {
      throw new Error(response.error || 'Failed to delete prompt');
    }

    this.pathToId.delete(promptPath);
  }

  async restorePrompt(promptPath: string): Promise<void> {
    const id = this.getPromptIdByPath(promptPath);
    const response = await api.prompts.restore(id);

    if (!response.success) {
      throw new Error(response.error || 'Failed to restore prompt');
    }

    this.pathToId.delete(promptPath);
  }

  async createPrompt(categoryPath: string, title: string): Promise<PromptData> {
    const response = await api.prompts.create({
      categoryPath,
      title,
      content: '',
      tags: [],
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to create prompt');
    }

    const prompt = response.data as PromptData;
    this.pathToId.set(prompt.path, prompt.meta.id);
    return prompt;
  }

  async createCategory(parentPath: string, name: string): Promise<void> {
    const response = await api.categories.create(parentPath, name);

    if (!response.success) {
      throw new Error(response.error || 'Failed to create category');
    }
  }

  async renameCategory(categoryPath: string, newName: string): Promise<void> {
    const response = await api.categories.rename(categoryPath, newName);

    if (!response.success) {
      throw new Error(response.error || 'Failed to rename category');
    }
  }

  async deleteCategory(categoryPath: string): Promise<void> {
    const response = await api.categories.delete(categoryPath);

    if (!response.success) {
      throw new Error(response.error || 'Failed to delete category');
    }
  }

  searchPrompts(query: string, prompts: PromptData[]): PromptData[] {
    if (!query.trim()) {
      return prompts;
    }

    const lower = query.toLowerCase();
    return prompts.filter(prompt =>
      prompt.meta.title.toLowerCase().includes(lower) ||
      prompt.meta.tags.some(tag => tag.toLowerCase().includes(lower)) ||
      prompt.content.toLowerCase().includes(lower)
    );
  }

  getAllTags(prompts: PromptData[]): string[] {
    const tagSet = new Set<string>();
    prompts.forEach(prompt => {
      prompt.meta.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }
}
