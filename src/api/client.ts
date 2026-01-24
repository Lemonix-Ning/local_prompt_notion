/**
 * API 客户端
 * 与后端服务通信
 * 
 * 端口策略（完全基于运行环境检测，不依赖环境变量）：
 * - 网页端：使用 3001 端口
 * - 桌面端（Tauri）：默认使用 Mock，不走 API
 */

const WEB_API_BASE = 'http://localhost:3001/api';
const DESKTOP_API_BASE = 'http://localhost:3001/api';

// 🔥 检测是否在 Tauri 桌面环境中
const isTauri = (() => {
  if (typeof window === 'undefined') return false;
  
  // Tauri 2.x 检测方式
  if ((window as any).__TAURI_INTERNALS__) {
    return true;
  }
  
  // Tauri 1.x 兼容检测
  if ((window as any).__TAURI__) {
    return true;
  }
  
  // 额外检测：检查 Tauri 的 IPC 协议
  if (window.location.protocol === 'tauri:' || (window.location.protocol === 'https:' && window.location.hostname === 'tauri.localhost')) {
    return true;
  }
  
  return false;
})();

// 🔥 端口选择：完全基于 Tauri 检测，忽略环境变量
// 桌面端默认走 Mock，这里与网页端保持一致
const API_BASE: string = isTauri ? DESKTOP_API_BASE : WEB_API_BASE;

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * 通用请求函数
 * 🔥 不进行任何端口回退，确保数据隔离
 */
async function request<T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`[API Client] Request error (${API_BASE}${endpoint}):`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * API 客户端
 */
export const api = {
  /**
   * Vault 管理
   */
  vault: {
    scan: () => request('/vault/scan'),
    info: () => request('/vault/info'),
  },

  /**
   * 分类管理
   */
  categories: {
    getAll: () => request('/categories'),
    create: (parentPath: string, name: string) =>
      request('/categories', {
        method: 'POST',
        body: JSON.stringify({ parentPath, name }),
      }),
    move: (categoryPath: string, targetParentPath: string) =>
      request('/categories/move', {
        method: 'PUT',
        body: JSON.stringify({ categoryPath, targetParentPath }),
      }),
    rename: (categoryPath: string, newName: string) =>
      request('/categories/rename', {
        method: 'PUT',
        body: JSON.stringify({ categoryPath, newName }),
      }),
    delete: (categoryPath: string) =>
      request(`/categories?path=${encodeURIComponent(categoryPath)}`, {
        method: 'DELETE',
      }),
  },

  /**
   * 提示词管理
   */
  prompts: {
    getAll: (params?: { category?: string; search?: string; tags?: string[] }) => {
      const query = new URLSearchParams();
      if (params?.category) query.append('category', params.category);
      if (params?.search) query.append('search', params.search);
      if (params?.tags) params.tags.forEach(tag => query.append('tags', tag));
      
      return request(`/prompts?${query.toString()}`);
    },

    getById: (id: string) => request(`/prompts/${id}`),

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
      request('/prompts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: {
      title?: string;
      content?: string;
      tags?: string[];
      model_config?: any;
      is_favorite?: boolean;
      is_pinned?: boolean;
      author?: string;
      category?: string;
      type?: 'NOTE' | 'TASK';
      scheduled_time?: string | null; // null 表示清除
      categoryPath?: string;
      recurrence?: {
        type: 'daily' | 'weekly' | 'monthly' | 'interval';
        weekDays?: number[];
        monthDays?: number[];
        time: string;
        intervalMinutes?: number;
        enabled: boolean;
      } | null; // null 表示清除
    }) =>
      request(`/prompts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: string, permanent = false) =>
      request(`/prompts/${id}${permanent ? '?permanent=true' : ''}`, {
        method: 'DELETE',
      }),

    batchDelete: (ids: string[], permanent = false) =>
      request('/prompts/batch-delete', {
        method: 'POST',
        body: JSON.stringify({ ids, permanent }),
      }),

    restore: (id: string) =>
      request(`/prompts/${id}/restore`, {
        method: 'POST',
      }),

    uploadImage: async (promptId: string, file: File) => {
      const formData = new FormData();
      formData.append('image', file);

      try {
        const response = await fetch(`${API_BASE}/prompts/${promptId}/images`, {
          method: 'POST',
          body: formData,
        });

        return await response.json();
      } catch (error) {
        console.error('Image upload error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Upload failed',
        };
      }
    },

    import: (data: {
      prompts: Array<{
        title: string;
        content?: string;
        tags?: string[];
        model_config?: any;
        is_favorite?: boolean;
        type?: 'NOTE' | 'TASK';
        scheduled_time?: string;
        recurrence?: any;
        author?: string;
        version?: string;
        category_path?: string;
      }>;
      categoryPath?: string;
      conflictStrategy?: 'rename' | 'skip' | 'overwrite';
    }) =>
      request('/prompts/import', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    export: (data: {
      ids?: string[]; // 兼容旧版
      includeContent?: boolean;
      preserveStructure?: boolean; // 兼容旧版：全局标志
      structuredIds?: string[]; // 新增：需要保留结构的 ID
      flatIds?: string[]; // 新增：扁平导出的 ID
    }) =>
      request('/prompts/export', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  /**
   * 搜索和标签
   */
  search: (query: string, filters?: { tags?: string[]; category?: string }) => {
    const params = new URLSearchParams({ q: query });
    if (filters?.category) params.append('category', filters.category);
    if (filters?.tags) filters.tags.forEach(tag => params.append('tags', tag));
    
    return request(`/search?${params.toString()}`);
  },

  tags: {
    getAll: () => request('/tags/tags'),
  },
  trash: {
    status: (threshold?: number) =>
      request(`/trash/status${threshold ? `?threshold=${encodeURIComponent(String(threshold))}` : ''}`),
    visit: (threshold?: number) =>
      request(`/trash/visit${threshold ? `?threshold=${encodeURIComponent(String(threshold))}` : ''}`, {
        method: 'POST',
      }),
  },
};

export default api;
