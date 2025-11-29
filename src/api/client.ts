/**
 * API 客户端
 * 与后端服务通信
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

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
    console.error('API request error:', error);
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
