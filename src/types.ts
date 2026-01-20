/**
 * 类型定义文件
 * 定义系统中使用的所有数据结构
 */

/**
 * 模型配置
 */
export interface ModelConfig {
  default_model: string;
  temperature: number;
  top_p: number;
}

/**
 * 重复任务配置
 */
export interface RecurrenceConfig {
  type: 'daily' | 'weekly' | 'monthly' | 'interval';
  // 每周的哪几天 (0-6, 0=周日)
  weekDays?: number[];
  // 每月的哪几天 (1-31)
  monthDays?: number[];
  // 每天的触发时间 (HH:mm 格式)
  time: string;
  // 间隔触发（每 N 分钟）
  intervalMinutes?: number;
  // 是否启用
  enabled: boolean;
}

/**
 * 提示词元数据
 */
export interface PromptMetadata {
  id: string;
  title: string;
  slug: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  version: string;
  author: string;
  model_config: ModelConfig;
  is_favorite: boolean;
  is_pinned?: boolean; // 是否置顶
  category?: string; // 分类标签(用于恢复和分类管理)
  category_path?: string;
  original_path?: string; // 删除前的原始路径(用于恢复)
  type?: 'NOTE' | 'TASK'; // 资产类型
  scheduled_time?: string | null; // 任务计划时间 (ISO 8601)，null 表示清除
  recurrence?: RecurrenceConfig | null; // 重复任务配置，null 表示清除
  last_notified?: string; // 上次通知时间 (ISO 8601)
}

/**
 * 提示词完整数据
 */
export interface PromptData {
  meta: PromptMetadata;
  content: string;
  path: string;
}

/**
 * 分类节点(树形结构)
 */
export interface CategoryNode {
  name: string;
  path: string;
  children: CategoryNode[];
  prompts: PromptData[];
  isExpanded?: boolean;
}

/**
 * 文件系统状态
 */
export interface FileSystemState {
  root: string;
  categories: CategoryNode[];
  allPrompts: Map<string, PromptData>;
}

/**
 * 应用配置
 */
export interface AppSettings {
  theme: 'light' | 'dark';
  defaultModel: string;
  autoSave: boolean;
  editorFontSize: number;
}

/**
 * 工作区状态
 */
export interface WorkspaceState {
  sidebarWidth: number;
  listWidth: number;
  openFolders: string[];
  lastOpenedPrompt: string | null;
}

/**
 * UI 状态
 */
export interface UIState {
  sidebarOpen: boolean;
  editorMode: 'edit' | 'preview' | 'split';
  isLoading: boolean;
  newPromptModal: {
    isOpen: boolean;
    preselectedCategory?: string;
  };
  editorOverlay: {
    isOpen: boolean;
    promptId?: string;
    originCardId?: string;
  };
}

/**
 * 应用状态
 */
export interface AppState {
  fileSystem: FileSystemState | null;
  selectedCategory: string | null;
  selectedPromptId: string | null;
  isEditing: boolean;
  searchQuery: string;
  filterTags: string[];
  sortBy: 'updated' | 'title' | 'created';
  uiState: UIState;
  settings: AppSettings;
}

/**
 * 应用操作类型
 */
export type AppAction =
  | { type: 'LOAD_VAULT'; payload: FileSystemState }
  | { type: 'SELECT_CATEGORY'; payload: string | null }
  | { type: 'SELECT_PROMPT'; payload: string | null }
  | { type: 'UPDATE_PROMPT'; payload: PromptData }
  | { type: 'CREATE_PROMPT'; payload: PromptData }
  | { type: 'DELETE_PROMPT'; payload: string }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_FILTER_TAGS'; payload: string[] }
  | { type: 'SET_SORT_BY'; payload: 'updated' | 'title' | 'created' }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_EDITOR_MODE'; payload: 'edit' | 'preview' | 'split' }
  | { type: 'SET_EDITING'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'OPEN_NEW_PROMPT_MODAL'; payload?: string }
  | { type: 'CLOSE_NEW_PROMPT_MODAL' }
  | { type: 'OPEN_EDITOR_OVERLAY'; payload: { promptId: string; originCardId: string } }
  | { type: 'CLOSE_EDITOR_OVERLAY' };

/**
 * 文件系统适配器接口
 */
export interface IFileSystemAdapter {
  scanVault(rootPath: string): Promise<FileSystemState>;
  readPrompt(promptPath: string): Promise<PromptData>;
  savePrompt(promptData: PromptData): Promise<void>;
  deletePrompt(promptPath: string, permanent?: boolean): Promise<void>;
  restorePrompt(promptPath: string): Promise<void>;
  createPrompt(categoryPath: string, title: string, options?: { type?: 'NOTE' | 'TASK'; scheduled_time?: string }): Promise<PromptData>;
  createCategory(parentPath: string, name: string): Promise<void>;
  renameCategory(categoryPath: string, newName: string): Promise<void>;
  moveCategory(categoryPath: string, targetParentPath: string): Promise<{ name: string; path: string; usedFallback?: boolean }>;
  deleteCategory(categoryPath: string): Promise<void>;
  searchPrompts(query: string, prompts: PromptData[]): PromptData[];
  getAllTags(prompts: PromptData[]): string[];
}

/**
 * 搜索选项
 */
export interface SearchOptions {
  query: string;
  tags?: string[];
  category?: string;
  favorites?: boolean;
}

/**
 * 排序选项
 */
export type SortOption = 'updated' | 'title' | 'created' | 'favorite';
