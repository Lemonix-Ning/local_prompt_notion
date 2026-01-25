import { invoke } from '@tauri-apps/api/core';

const wrap = async <T>(fn: () => Promise<T>) => {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
};

export const tauriClient = {
  trash: {
    visit: (threshold: number) =>
      wrap(() => invoke('trash_visit', { threshold })),
    status: (threshold: number) =>
      wrap(() => invoke('trash_status', { threshold })),
  },
  prompts: {
    create: (data: {
      categoryPath: string;
      title: string;
      content?: string;
      tags?: string[];
      model_config?: any;
      author?: string;
      type?: 'NOTE' | 'TASK';
      scheduled_time?: string;
    }) =>
      wrap(async () => {
        const prompt = await invoke<any>('create_prompt', {
          categoryPath: data.categoryPath,
          title: data.title,
          options: {
            type: data.type,
            scheduled_time: data.scheduled_time,
          },
        });
        const updated = {
          ...prompt,
          content: data.content ?? prompt.content,
          meta: {
            ...prompt.meta,
            tags: data.tags ?? prompt.meta.tags,
            model_config: data.model_config ?? prompt.meta.model_config,
            author: data.author ?? prompt.meta.author,
            type: data.type ?? prompt.meta.type,
            scheduled_time: data.scheduled_time ?? prompt.meta.scheduled_time,
          },
        };
        await invoke('save_prompt', { prompt: updated });
        return updated;
      }),
    import: (payload: { prompts: any[]; categoryPath?: string; conflictStrategy?: string }) =>
      wrap(() =>
        invoke('import_prompts', {
          prompts: payload.prompts,
          categoryPath: payload.categoryPath,
          conflictStrategy: payload.conflictStrategy,
        })
      ),
    export: (payload: {
      ids?: string[];
      includeContent?: boolean;
      preserveStructure?: boolean;
      structuredIds?: string[];
      flatIds?: string[];
    }) =>
      wrap(() =>
        invoke('export_prompts', {
          ids: payload.ids,
          includeContent: payload.includeContent,
          preserveStructure: payload.preserveStructure,
          structuredIds: payload.structuredIds,
          flatIds: payload.flatIds,
        })
      ),
  },
  images: {
    upload: (payload: { imageData: string; promptId: string; fileName?: string }) =>
      wrap(() =>
        invoke('upload_image', {
          imageData: payload.imageData,
          promptId: payload.promptId,
          fileName: payload.fileName,
        })
      ),
  },
  performance: {
    saveSnapshot: (snapshot: any) =>
      wrap(() => invoke('save_performance_snapshot', { snapshot })),
  },
  vault: {
    root: () => invoke<string>('get_vault_root'),
  },
};
