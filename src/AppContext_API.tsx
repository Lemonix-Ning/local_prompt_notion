/**
 * 应用状态管理 (使用后端 API)
 * 使用 React Context + useReducer
 */

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { AppState, AppAction, PromptData } from './types';
import api from './api/client';

/**
 * 初始状态
 */
const initialState: AppState = {
  fileSystem: null,
  selectedCategory: null,
  selectedPromptId: null,
  isEditing: false,
  searchQuery: '',
  filterTags: [],
  sortBy: 'updated',
  uiState: {
    sidebarOpen: true,
    editorMode: 'edit',
    isLoading: false,
  },
  settings: {
    theme: 'light',
    defaultModel: 'gpt-4',
    autoSave: true,
    editorFontSize: 14,
  },
};

/**
 * Reducer 函数
 */
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'LOAD_VAULT':
      return {
        ...state,
        fileSystem: action.payload,
        uiState: { ...state.uiState, isLoading: false },
      };

    case 'SELECT_CATEGORY':
      return {
        ...state,
        selectedCategory: action.payload,
        selectedPromptId: null,
      };

    case 'SELECT_PROMPT':
      return {
        ...state,
        selectedPromptId: action.payload,
        isEditing: false,
      };

    case 'UPDATE_PROMPT':
      if (!state.fileSystem) return state;

      const updatedPrompts = new Map(state.fileSystem.allPrompts);
      updatedPrompts.set(action.payload.meta.id, action.payload);

      return {
        ...state,
        fileSystem: {
          ...state.fileSystem,
          allPrompts: updatedPrompts,
        },
      };

    case 'CREATE_PROMPT':
      if (!state.fileSystem) return state;

      const newPrompts = new Map(state.fileSystem.allPrompts);
      newPrompts.set(action.payload.meta.id, action.payload);

      return {
        ...state,
        fileSystem: {
          ...state.fileSystem,
          allPrompts: newPrompts,
        },
        selectedPromptId: action.payload.meta.id,
        isEditing: true,
      };

    case 'DELETE_PROMPT':
      if (!state.fileSystem) return state;

      const filteredPrompts = new Map(state.fileSystem.allPrompts);
      filteredPrompts.delete(action.payload);

      return {
        ...state,
        fileSystem: {
          ...state.fileSystem,
          allPrompts: filteredPrompts,
        },
        selectedPromptId: state.selectedPromptId === action.payload ? null : state.selectedPromptId,
      };

    case 'SET_SEARCH':
      return {
        ...state,
        searchQuery: action.payload,
      };

    case 'SET_FILTER_TAGS':
      return {
        ...state,
        filterTags: action.payload,
      };

    case 'SET_SORT_BY':
      return {
        ...state,
        sortBy: action.payload,
      };

    case 'TOGGLE_SIDEBAR':
      return {
        ...state,
        uiState: {
          ...state.uiState,
          sidebarOpen: !state.uiState.sidebarOpen,
        },
      };

    case 'SET_EDITOR_MODE':
      return {
        ...state,
        uiState: {
          ...state.uiState,
          editorMode: action.payload,
        },
      };

    case 'SET_EDITING':
      return {
        ...state,
        isEditing: action.payload,
      };

    case 'SET_LOADING':
      return {
        ...state,
        uiState: {
          ...state.uiState,
          isLoading: action.payload,
        },
      };

    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.payload,
        },
      };

    default:
      return state;
  }
}

/**
 * Context 类型
 */
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  // 辅助方法
  loadVault: () => Promise<void>;
  savePrompt: (prompt: PromptData) => Promise<void>;
  deletePrompt: (promptId: string) => Promise<void>;
  createPrompt: (categoryPath: string, title: string) => Promise<void>;
  getFilteredPrompts: () => PromptData[];
  getCurrentPrompt: () => PromptData | null;
}

/**
 * 创建 Context
 */
const AppContext = createContext<AppContextType | undefined>(undefined);

/**
 * Provider Props
 */
interface AppProviderProps {
  children: ReactNode;
}

/**
 * Provider 组件
 */
export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  /**
   * 加载 Vault
   */
  const loadVault = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const response = await api.vault.scan();
      
      if (response.success && response.data) {
        // 转换 allPrompts 为 Map
        const promptsMap = new Map();
        Object.entries(response.data.allPrompts).forEach(([id, prompt]) => {
          promptsMap.set(id, prompt);
        });

        dispatch({
          type: 'LOAD_VAULT',
          payload: {
            ...response.data,
            allPrompts: promptsMap,
          },
        });
      } else {
        console.error('Failed to load vault:', response.error);
        alert('加载 Vault 失败: ' + response.error);
      }
    } catch (error) {
      console.error('Error loading vault:', error);
      alert('加载 Vault 失败');
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  /**
   * 保存提示词
   */
  const savePrompt = async (prompt: PromptData) => {
    try {
      const beforePath = prompt.path;
      const beforeCategoryPath = prompt.meta.category_path;
      const response = await api.prompts.update(prompt.meta.id, {
        title: prompt.meta.title,
        content: prompt.content,
        tags: prompt.meta.tags,
        model_config: prompt.meta.model_config,
        is_favorite: prompt.meta.is_favorite,
        category: prompt.meta.category,
        categoryPath: prompt.meta.category_path,
      });

      if (response.success && response.data) {
        dispatch({ type: 'UPDATE_PROMPT', payload: response.data });

        const moved =
          (beforePath && response.data.path && beforePath !== response.data.path) ||
          (beforeCategoryPath && response.data.meta?.category_path && beforeCategoryPath !== response.data.meta.category_path);

        if (moved) {
          await loadVault();
        }
      } else {
        throw new Error(response.error || '保存失败');
      }
    } catch (error) {
      console.error('Error saving prompt:', error);
      throw error;
    }
  };

  /**
   * 删除提示词
   */
  const deletePrompt = async (promptId: string) => {
    try {
      const response = await api.prompts.delete(promptId);

      if (response.success) {
        dispatch({ type: 'DELETE_PROMPT', payload: promptId });
      } else {
        throw new Error(response.error || '删除失败');
      }
    } catch (error) {
      console.error('Error deleting prompt:', error);
      throw error;
    }
  };

  /**
   * 创建提示词
   */
  const createPrompt = async (categoryPath: string, title: string) => {
    try {
      const response = await api.prompts.create({
        categoryPath,
        title,
        content: '',
        tags: [],
      });

      if (response.success && response.data) {
        dispatch({ type: 'CREATE_PROMPT', payload: response.data });
        return response.data;
      } else {
        throw new Error(response.error || '创建失败');
      }
    } catch (error) {
      console.error('Error creating prompt:', error);
      throw error;
    }
  };

  /**
   * 获取过滤后的提示词列表
   */
  const getFilteredPrompts = (): PromptData[] => {
    if (!state.fileSystem) return [];

    let prompts = Array.from(state.fileSystem.allPrompts.values());

    // 按分类过滤
    if (state.selectedCategory) {
      prompts = prompts.filter(prompt => 
        prompt.path.includes(state.selectedCategory!)
      );
    }

    // 按搜索查询过滤(客户端过滤)
    if (state.searchQuery) {
      const lowerQuery = state.searchQuery.toLowerCase();
      prompts = prompts.filter(prompt =>
        prompt.meta.title.toLowerCase().includes(lowerQuery) ||
        prompt.meta.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
        prompt.content.toLowerCase().includes(lowerQuery)
      );
    }

    // 按标签过滤
    if (state.filterTags.length > 0) {
      prompts = prompts.filter(prompt =>
        state.filterTags.some(tag => prompt.meta.tags.includes(tag))
      );
    }

    // 排序
    prompts.sort((a, b) => {
      switch (state.sortBy) {
        case 'updated':
          return new Date(b.meta.updated_at).getTime() - new Date(a.meta.updated_at).getTime();
        case 'created':
          return new Date(b.meta.created_at).getTime() - new Date(a.meta.created_at).getTime();
        case 'title':
          return a.meta.title.localeCompare(b.meta.title);
        default:
          return 0;
      }
    });

    return prompts;
  };

  /**
   * 获取当前选中的提示词
   */
  const getCurrentPrompt = (): PromptData | null => {
    if (!state.selectedPromptId || !state.fileSystem) {
      return null;
    }
    return state.fileSystem.allPrompts.get(state.selectedPromptId) || null;
  };

  const value: AppContextType = {
    state,
    dispatch,
    loadVault,
    savePrompt,
    deletePrompt,
    createPrompt,
    getFilteredPrompts,
    getCurrentPrompt,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/**
 * 自定义 Hook
 */
export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
