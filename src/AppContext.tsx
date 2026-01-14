/**
 * 应用状态管理
 * 使用 React Context + useReducer
 */

import React, { createContext, useContext, useReducer, ReactNode, useRef, useCallback } from 'react';
import { AppState, AppAction, PromptData, FileSystemState, CategoryNode } from './types';
import { IFileSystemAdapter } from './types';

/**
 * 增量更新文件系统状态中的分类位置
 * 避免完整的 vault 重新扫描以提升性能
 */
function updateCategoryInFileSystem(
  fileSystem: FileSystemState,
  oldCategoryPath: string,
  newParentPath: string,
  newCategoryPath: string
): FileSystemState | null {
  try {
    // 正确地深拷贝文件系统数据，保持 Map 对象的类型
    const updatedFileSystem: FileSystemState = {
      root: fileSystem.root,
      categories: JSON.parse(JSON.stringify(fileSystem.categories)),
      allPrompts: new Map(fileSystem.allPrompts) // 正确拷贝 Map 对象
    };
    
    // 查找并移除旧位置的分类
    const movedCategory = findAndRemoveCategory(updatedFileSystem.categories, oldCategoryPath);
    if (!movedCategory) {
      console.warn('Could not find category to move:', oldCategoryPath);
      return null;
    }
    
    // 更新分类路径
    updateCategoryPaths(movedCategory, newCategoryPath);
    
    // 将分类插入到新位置
    if (!insertCategoryAtPath(updatedFileSystem.categories, newParentPath, movedCategory, fileSystem.root)) {
      console.warn('Could not insert category at new location:', newParentPath);
      return null;
    }
    
    return updatedFileSystem;
  } catch (error) {
    console.error('Error updating category in file system:', error);
    return null;
  }
}

/**
 * 查找并移除指定路径的分类
 */
function findAndRemoveCategory(categories: CategoryNode[], targetPath: string): CategoryNode | null {
  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    
    if (category.path === targetPath) {
      // 找到目标分类，移除并返回
      return categories.splice(i, 1)[0];
    }
    
    // 递归搜索子分类
    if (category.children.length > 0) {
      const found = findAndRemoveCategory(category.children, targetPath);
      if (found) return found;
    }
  }
  
  return null;
}

/**
 * 递归更新分类及其子分类的路径
 */
function updateCategoryPaths(category: CategoryNode, newBasePath: string): void {
  category.path = newBasePath;
  
  // 更新子分类路径
  category.children.forEach(child => {
    const childName = child.name;
    const newChildPath = `${newBasePath}/${childName}`;
    updateCategoryPaths(child, newChildPath);
  });
  
  // 更新提示词路径（如果需要的话）
  category.prompts.forEach(_prompt => {
    // 提示词的实际文件路径会在服务器端处理
    // 这里只需要确保内存中的数据结构正确
  });
}

/**
 * 将分类插入到指定父路径下
 */
function insertCategoryAtPath(
  categories: CategoryNode[], 
  parentPath: string, 
  categoryToInsert: CategoryNode,
  rootPath: string
): boolean {
  // 如果是根目录，直接插入
  if (parentPath === rootPath) {
    categories.push(categoryToInsert);
    return true;
  }
  
  // 查找目标父分类
  for (const category of categories) {
    if (category.path === parentPath) {
      category.children.push(categoryToInsert);
      return true;
    }
    
    // 递归搜索子分类
    if (category.children.length > 0) {
      if (insertCategoryAtPath(category.children, parentPath, categoryToInsert, rootPath)) {
        return true;
      }
    }
  }
  
  return false;
}

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
    newPromptModal: {
      isOpen: false,
    },
    editorOverlay: {
      isOpen: false,
    },
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

    case 'OPEN_NEW_PROMPT_MODAL':
      return {
        ...state,
        uiState: {
          ...state.uiState,
          newPromptModal: {
            isOpen: true,
            preselectedCategory: action.payload,
          },
        },
      };

    case 'CLOSE_NEW_PROMPT_MODAL':
      return {
        ...state,
        uiState: {
          ...state.uiState,
          newPromptModal: {
            isOpen: false,
          },
        },
      };

    case 'OPEN_EDITOR_OVERLAY':
      return {
        ...state,
        uiState: {
          ...state.uiState,
          editorOverlay: {
            isOpen: true,
            promptId: action.payload.promptId,
            originCardId: action.payload.originCardId,
          },
        },
      };

    case 'CLOSE_EDITOR_OVERLAY':
      return {
        ...state,
        uiState: {
          ...state.uiState,
          editorOverlay: {
            isOpen: false,
          },
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
  adapter: IFileSystemAdapter;
  // 辅助方法
  loadVault: (rootPath: string) => Promise<void>;
  refreshVault: () => Promise<void>;
  savePrompt: (prompt: PromptData) => Promise<void>;
  deletePrompt: (promptId: string, permanent?: boolean) => Promise<void>;
  restorePrompt: (promptId: string) => Promise<void>;
  createPrompt: (categoryPath: string, title: string) => Promise<PromptData>;
  createCategory: (parentPath: string, name: string) => Promise<void>;
  renameCategory: (categoryPath: string, newName: string) => Promise<void>;
  moveCategory: (categoryPath: string, targetParentPath: string) => Promise<void>;
  deleteCategory: (categoryPath: string) => Promise<void>;
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
  adapter: IFileSystemAdapter;
}

/**
 * Provider 组件
 */
export function AppProvider({ children, adapter }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const lastRootPathRef = useRef<string | null>(null);

  const refreshVault = useCallback(async () => {
    if (!lastRootPathRef.current) return;
    try {
      const fileSystem = await adapter.scanVault(lastRootPathRef.current);
      dispatch({ type: 'LOAD_VAULT', payload: fileSystem });
    } catch (error) {
      console.error('Error refreshing vault:', error);
    }
  }, [adapter]);

  /**
   * 加载 Vault
   */
  const loadVault = useCallback(async (rootPath: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const fileSystem = await adapter.scanVault(rootPath);
      dispatch({ type: 'LOAD_VAULT', payload: fileSystem });
      lastRootPathRef.current = rootPath;
    } catch (error) {
      console.error('Error loading vault:', error);
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [adapter]);

  /**
   * 保存提示词
   */
  const savePrompt = async (prompt: PromptData) => {
    try {
      await adapter.savePrompt(prompt);
      dispatch({ type: 'UPDATE_PROMPT', payload: prompt });
    } catch (error) {
      console.error('Error saving prompt:', error);
      throw error;
    }
  };

  /**
   * 删除提示词
   */
  const deletePrompt = async (promptId: string, permanent = false) => {
    try {
      const prompt = state.fileSystem?.allPrompts.get(promptId);
      if (!prompt) {
        throw new Error('Prompt not found');
      }
      await adapter.deletePrompt(prompt.path, permanent);
      dispatch({ type: 'DELETE_PROMPT', payload: promptId });
      await refreshVault();
    } catch (error) {
      console.error('Error deleting prompt:', error);
      throw error;
    }
  };

  /**
   * 恢复提示词
   */
  const restorePrompt = async (promptId: string) => {
    try {
      const prompt = state.fileSystem?.allPrompts.get(promptId);
      if (!prompt) {
        throw new Error('Prompt not found');
      }
      await adapter.restorePrompt(prompt.path);
      await refreshVault();
    } catch (error) {
      console.error('Error restoring prompt:', error);
      throw error;
    }
  };

  /**
   * 创建提示词
   */
  const createPrompt = async (categoryPath: string, title: string) => {
    try {
      const newPrompt = await adapter.createPrompt(categoryPath, title);
      dispatch({ type: 'CREATE_PROMPT', payload: newPrompt });
      await refreshVault();
      return newPrompt;
    } catch (error) {
      console.error('Error creating prompt:', error);
      throw error;
    }
  };

  const createCategory = async (parentPath: string, name: string) => {
    try {
      await adapter.createCategory(parentPath, name);
      await refreshVault();
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  };

  const renameCategory = async (categoryPath: string, newName: string) => {
    try {
      await adapter.renameCategory(categoryPath, newName);
      // 等待一下,确保后端完成文件操作
      await new Promise(resolve => setTimeout(resolve, 300));
      await refreshVault();
    } catch (error) {
      console.error('Error renaming category:', error);
      throw error;
    }
  };

  const moveCategory = async (categoryPath: string, targetParentPath: string) => {
    try {
      const result = await adapter.moveCategory(categoryPath, targetParentPath);
      
      // 性能优化：增量更新状态而不是完整重新扫描
      if (state.fileSystem) {
        const updatedFileSystem = updateCategoryInFileSystem(
          state.fileSystem, 
          categoryPath, 
          targetParentPath, 
          result.path
        );
        
        if (updatedFileSystem) {
          dispatch({ type: 'LOAD_VAULT', payload: updatedFileSystem });
          return;
        }
      }
      
      // 如果增量更新失败，回退到完整刷新
      await refreshVault();
    } catch (error) {
      console.error('Error moving category:', error);
      throw error;
    }
  };

  const deleteCategory = async (categoryPath: string) => {
    try {
      await adapter.deleteCategory(categoryPath);
      // 等待一下,确保后端完成文件操作
      await new Promise(resolve => setTimeout(resolve, 300));
      await refreshVault();
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  };

  /**
   * 获取过滤后的提示词列表
   */
  const getFilteredPrompts = (): PromptData[] => {
    if (!state.fileSystem) return [];

    let prompts = Array.from(state.fileSystem.allPrompts.values());

    // 辅助函数:检查路径是否在回收站中 (支持 Windows 和 Unix 路径)
    const isInTrash = (path: string) => {
      return path.includes('/trash/') || path.includes('\\trash\\');
    };

    // 特殊分类过滤:收藏夹
    if (state.selectedCategory === 'favorites') {
      prompts = prompts.filter(prompt => prompt.meta.is_favorite && !isInTrash(prompt.path));
    }
    // 特殊分类过滤:回收站
    else if (state.selectedCategory === 'trash') {
      prompts = prompts.filter(prompt => isInTrash(prompt.path));
    }
    // 按分类过滤
    else if (state.selectedCategory) {
      prompts = prompts.filter(prompt => 
        prompt.path.includes(state.selectedCategory!) && !isInTrash(prompt.path)
      );
    }
    // 默认:过滤掉回收站中的项目
    else {
      prompts = prompts.filter(prompt => !isInTrash(prompt.path));
    }

    // 按搜索查询过滤
    if (state.searchQuery) {
      prompts = adapter.searchPrompts(state.searchQuery, prompts);
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
    adapter,
    loadVault,
    refreshVault,
    savePrompt,
    deletePrompt,
    restorePrompt,
    createPrompt,
    createCategory,
    renameCategory,
    moveCategory,
    deleteCategory,
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
