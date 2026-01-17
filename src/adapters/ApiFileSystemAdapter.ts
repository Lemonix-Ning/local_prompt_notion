import api from '../api/client';
import {
  IFileSystemAdapter,
  FileSystemState,
  PromptData,
} from '../types';

/**
 * Browser-safe adapter that proxies file-system style calls
 * to the Express REST API so data persists to disk.
 */
export class ApiFileSystemAdapter implements IFileSystemAdapter {
  private pathToId = new Map<string, string>();

  private rebuildPathIndex(allPrompts: Map<string, PromptData>) {
    this.pathToId.clear();
    allPrompts.forEach(prompt => {
      this.pathToId.set(prompt.path, prompt.meta.id);
    });
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
    Object.entries(response.data.allPrompts || {}).forEach(([, prompt]) => {
      const promptData = prompt as PromptData;
      // 使用 prompt.meta.id 作为 key，而不是文件路径
      allPrompts.set(promptData.meta.id, promptData);
    });

    this.rebuildPathIndex(allPrompts);

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
      is_pinned: meta.is_pinned,
      author: meta.author,
      categoryPath: meta.category_path,
      type: meta.type,
      scheduled_time: meta.scheduled_time,
      recurrence: meta.recurrence,
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

  async batchDeletePrompts(promptPaths: string[], permanent = false): Promise<{ success: string[]; failed: Array<{ path: string; error: string }> }> {
    const ids: string[] = [];
    const pathToIdMap = new Map<string, string>();
    
    // 收集所有有效的 ID
    for (const path of promptPaths) {
      try {
        const id = this.getPromptIdByPath(path);
        ids.push(id);
        pathToIdMap.set(id, path);
      } catch (error) {
        // 路径未索引，跳过
      }
    }

    if (ids.length === 0) {
      return { success: [], failed: [] };
    }

    const response = await api.prompts.batchDelete(ids, permanent);

    if (!response.success) {
      throw new Error(response.error || 'Failed to batch delete prompts');
    }

    const results = (response.data as any)?.results || (response as any).results || { success: [], failed: [] };
    
    // 清理成功删除的路径索引
    if (Array.isArray(results.success)) {
      results.success.forEach((id: string) => {
        const path = pathToIdMap.get(id);
        if (path) {
          this.pathToId.delete(path);
        }
      });
    }

    return {
      success: results.success || [],
      failed: Array.isArray(results.failed) ? results.failed.map((f: any) => ({
        path: pathToIdMap.get(f.id) || '',
        error: f.error,
      })) : [],
    };
  }

  async restorePrompt(promptPath: string): Promise<void> {
    const id = this.getPromptIdByPath(promptPath);
    const response = await api.prompts.restore(id);

    if (!response.success) {
      throw new Error(response.error || 'Failed to restore prompt');
    }

    this.pathToId.delete(promptPath);
  }

  async createPrompt(categoryPath: string, title: string, options?: { type?: 'NOTE' | 'TASK'; scheduled_time?: string }): Promise<PromptData> {
    const response = await api.prompts.create({
      categoryPath,
      title,
      content: '',
      tags: [],
      type: options?.type || 'NOTE',
      scheduled_time: options?.scheduled_time,
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

  async moveCategory(categoryPath: string, targetParentPath: string): Promise<{ name: string; path: string; usedFallback?: boolean }> {
    const response = await api.categories.move(categoryPath, targetParentPath);

    if (!response.success) {
      throw new Error(response.error || 'Failed to move category');
    }

    return response.data;
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
