import { invoke } from '@tauri-apps/api/core';
import {
  IFileSystemAdapter,
  FileSystemState,
  PromptData,
} from '../types';

export class TauriFileSystemAdapter implements IFileSystemAdapter {
  private pathToId = new Map<string, string>();

  private rebuildPathIndex(allPrompts: Map<string, PromptData>) {
    this.pathToId.clear();
    allPrompts.forEach(prompt => {
      this.pathToId.set(prompt.path, prompt.meta.id);
    });
  }

  async scanVault(_rootPath: string): Promise<FileSystemState> {
    const response = await invoke<any>('scan_vault');
    const promptsMap = new Map<string, PromptData>();
    Object.entries(response.allPrompts || {}).forEach(([id, prompt]) => {
      promptsMap.set(id, prompt as PromptData);
    });
    const state: FileSystemState = {
      root: response.root,
      categories: response.categories || [],
      allPrompts: promptsMap,
    };
    this.rebuildPathIndex(state.allPrompts);
    return state;
  }

  async readPrompt(promptPath: string): Promise<PromptData> {
    const prompt = await invoke<PromptData>('read_prompt', { promptPath });
    this.pathToId.set(prompt.path, prompt.meta.id);
    return prompt;
  }

  async savePrompt(promptData: PromptData): Promise<void> {
    await invoke('save_prompt', { prompt: promptData });
    this.pathToId.set(promptData.path, promptData.meta.id);
  }

  async deletePrompt(promptPath: string, permanent = false): Promise<void> {
    await invoke('delete_prompt', { promptPath, permanent });
    this.pathToId.delete(promptPath);
  }

  async restorePrompt(promptPath: string): Promise<void> {
    await invoke('restore_prompt', { promptPath });
  }

  async createPrompt(categoryPath: string, title: string, options?: { type?: 'NOTE' | 'TASK'; scheduled_time?: string }): Promise<PromptData> {
    const prompt = await invoke<PromptData>('create_prompt', {
      categoryPath,
      title,
      options: options || {},
    });
    this.pathToId.set(prompt.path, prompt.meta.id);
    return prompt;
  }

  async createCategory(parentPath: string, name: string): Promise<void> {
    await invoke('create_category', { parentPath, name });
  }

  async renameCategory(categoryPath: string, newName: string): Promise<void> {
    await invoke('rename_category', { categoryPath, newName });
  }

  async moveCategory(categoryPath: string, targetParentPath: string): Promise<{ name: string; path: string; usedFallback?: boolean }> {
    const response = await invoke<{ name: string; path: string }>('move_category', { categoryPath, targetParentPath });
    return response;
  }

  async deleteCategory(categoryPath: string): Promise<void> {
    await invoke('delete_category', { categoryPath });
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
}
