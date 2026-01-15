/**
 * API 客户端
 * 与后端服务通信
 */

const DEFAULT_API_BASE = 'http://localhost:3001/api';
const DESKTOP_API_BASE = 'http://localhost:3002/api';
const ENV_API_BASE = import.meta.env.VITE_API_BASE as string | undefined;

// 🔥 检测是否在 Tauri 桌面环境中
const isTauri =
  typeof window !== 'undefined' &&
  typeof (window as any).__TAURI__ !== 'undefined' &&
  (window as any).__TAURI__;

// 🔥 桌面端始终使用 3002 端口，网页端使用环境变量或默认 3001 端口
let runtimeApiBase: string;
if (isTauri) {
  // 桌面端：强制使用 3002 端口，不进行任何回退
  runtimeApiBase = DESKTOP_API_BASE;
  console.log('[API Client] Running in Tauri desktop mode, using port 3002');
} else {
  // 网页端：使用环境变量或默认值
  runtimeApiBase = ENV_API_BASE || DEFAULT_API_BASE;
  console.log('[API Client] Running in web mode, using:', runtimeApiBase);
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * 通用请求函数
 */
async function request<T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const fetchOnce = async (base: string): Promise<ApiResponse<T>> => {
    const response = await fetch(`${base}${endpoint}`, {
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
  };

  try {
    return await fetchOnce(runtimeApiBase);
  } catch (error) {
    // 🔥 只有在网页端才进行端口回退，桌面端不回退
    if (!isTauri && runtimeApiBase !== DEFAULT_API_BASE) {
      try {
        console.warn(`[API Client] Request failed for ${runtimeApiBase}, retrying with ${DEFAULT_API_BASE}`, error);
        const out = await fetchOnce(DEFAULT_API_BASE);
        runtimeApiBase = DEFAULT_API_BASE;
        return out;
      } catch (retryError) {
        console.error('[API Client] Retry also failed:', retryError);
        return {
          success: false,
          error: retryError instanceof Error ? retryError.message : 'Unknown error',
        };
      }
    }

    console.error('[API Client] Request error:', error);
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
      author?: string;
      category?: string;
      categoryPath?: string;
    }) =>
      request(`/prompts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: string, permanent = false) =>
      request(`/prompts/${id}${permanent ? '?permanent=true' : ''}`, {
        method: 'DELETE',
      }),

    restore: (id: string) =>
      request(`/prompts/${id}/restore`, {
        method: 'POST',
      }),

    uploadImage: async (promptId: string, file: File) => {
      const formData = new FormData();
      formData.append('image', file);

      try {
        const response = await fetch(`${runtimeApiBase}/prompts/${promptId}/images`, {
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
