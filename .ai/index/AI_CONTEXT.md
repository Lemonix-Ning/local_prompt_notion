# AI_CONTEXT Index (Single Source of Truth)

## 0. Maintenance Guide (维护指南)

### How to Add New Content (如何添加)
- **Location**: Always insert new modules or feature groups at the **TOP** of the "Content Logs" section (immediately after the section header).
- **Order**: Reverse Chronological (Newest first).
- **Content**: 
  - Only include **Function Signatures**, **Interface Definitions**, **API Endpoints**, and **Component Props**.
  - **NO** implementation details (use `...` or comments).
  - Must include file path references.
- **Index**: Update the "1. Quick Index" section to include a link to your new block.

### What to Add (添加内容)
- **New Modules**: If you create a new file/module, add its public interface here.
- **New APIs**: If you add a route to the backend, list it here.
- **Key Utilities**: If you write a reusable helper function, document its signature here to prevent re-implementation.

---

## 1. Quick Index (快速索引)
*Latest updates are at the top of the Content Logs.*

- [**[2026-01-24] Lumi Interaction & Feedback**](#2026-01-24-lumi-interaction--feedback)
- [**[2026-01-24] Settings & Import UX Enhancements**](#2026-01-24-settings--import-ux-enhancements)
- [**[v1.1] Detailed Coverage Fill**](#v11-detailed-coverage-fill)
- [**[Baseline] v1.0 Initial Codebase**](#baseline-v10-initial-codebase)
  - [Backend API (Node.js Sidecar)](#backend-api-nodejs-sidecar)
  - [Frontend Data Layer](#frontend-data-layer)
  - [Core UI Components](#core-ui-components)
  - [Shared Utilities](#shared-utilities-business-logic)
  - [Tauri Commands](#tauri-commands-rust)
  - [Global State](#global-state-context)

---

## 2. Content Logs (Reverse Chronological)

### [2026-01-24] Lumi Interaction & Feedback

#### Lumi Context
*Path: `src/contexts/LumiContext.tsx`*

```typescript
type LumiAction =
  | 'create_card' | 'create_folder' | 'update' | 'delete' | 'restore'
  | 'favorite' | 'pin' | 'clipboard' | 'search' | 'rename'

type LumiTransferState = 'importing' | 'exporting' | null
type LumiTimeState = 'countdown' | 'schedule' | null

function useLumi(): {
  action: LumiAction | null
  transferState: LumiTransferState
  timeState: LumiTimeState
  isWindy: boolean
  isSleeping: boolean
  isDragging: boolean
  notificationMessage: string | null
  triggerAction: (action: LumiAction, durationMs?: number) => void
  triggerTransfer: (state: NonNullable<LumiTransferState>, durationMs?: number) => void
  triggerTime: (state: NonNullable<LumiTimeState>, durationMs?: number) => void
  reportScrollSpeed: (speed: number) => void
  setDragging: (dragging: boolean) => void
  notifyActivity: () => void
  notifyMessage: (message: string, durationMs?: number) => void
}
```

#### SpiritCat Props
*Path: `src/components/SpiritCat.tsx`*

```tsx
interface SpiritCatProps {
  orientation: 'bottom' | 'left' | 'right' | 'top'
  mode: 'idle' | 'sleep' | 'windy' | 'dragging' | 'chat'
  pupilX?: MotionValue<number> | null
  pupilY?: MotionValue<number> | null
  isWindy: boolean
  isSleeping: boolean
  isThinking?: boolean
  theme: 'light' | 'dark'
}
```

### [2026-01-24] Settings & Import UX Enhancements

#### Theme Context (Auto Mode)
*Path: `src/contexts/ThemeContext.tsx`*

```typescript
type Theme = 'dark' | 'light'
type ThemeMode = 'manual' | 'auto'

function useTheme(): {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
}
```

#### Settings Drawer (Sidebar)
*Path: `src/components/Sidebar.tsx`*

```tsx
interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  sidebarWidth: number
}
```

#### Tauri Commands (Close Behavior)
*Path: `src-tauri/src/lib.rs`*

```rust
// Invoke via: invoke('command_name', payload?)
fn get_close_behavior() -> String  // "minimize" | "exit"
fn set_close_behavior(behavior: String) // payload: { behavior: "minimize" | "exit" }
```

### [v1.1] Detailed Coverage Fill
*Captured on 2026-01-23*

#### Missing Components
*Path: `src/components/*.tsx`*

```tsx
// ChronoAlert.tsx - Floating task reminder
<ChronoAlert 
  task={PromptData} 
  onFocus={() => void} 
  onDismiss={() => void} 
/>

// DeleteCategoryDialog.tsx - Confirmation with content analysis
<DeleteCategoryDialog 
  isOpen={boolean}
  originId={string}
  categoryName={string}
  contentInfo={CategoryContentInfo}
  onConfirm={({ forceDelete }) => void}
  onCancel={() => void}
  onClosed={() => void}
/>

// EditorOverlay.tsx - Mac-style immersive editor
<EditorOverlay 
  promptId={string}
  originCardId={string}
  onClose={() => void}
  promptIds?={string[]} // For navigation
  onNavigate?={(id, originId) => void}
/>

// EditorPage.tsx - Full screen editor page
<EditorPage 
  promptId={string}
  onClose={() => void}
/>
```

#### Advanced Hooks
*Path: `src/hooks/*.ts`*

```typescript
// useCountdown.ts
function useCountdown(
  targetDateStr: string, 
  startDateStr?: string, 
  recurrence?: RecurrenceInfo
): { 
  days, hours, minutes, seconds, totalSeconds, 
  isExpired, progress 
}

// useSystemNotification.ts
function useSystemNotification(): {
  isSupported: boolean,
  permissionGranted: boolean,
  requestPermission: () => Promise<boolean>,
  sendNotification: (title, body?) => Promise<boolean>,
  sendTaskReminder: (taskId, title, isExpired, isRecurring) => Promise<boolean>,
  resetTaskThrottle: (taskId) => void
}
```

#### Frontend Utilities
*Path: `src/utils/*.ts`*

**Performance & UX**
```typescript
// lazyLoad.ts
class LazyLoadManager(config?) { observe(el, cb), unobserve(el), disconnect() }
function useLazyLoad(config?)

// virtualScroll.ts
class VirtualScrollManager(config)
function useVirtualScroll(items, config, enabled): { 
  visibleItems, totalHeight, offsetY, onScroll 
}

// markdownCache.ts
class MarkdownCache(maxSize=100, maxAge=5min) { get(content), set(content, rendered) }
const markdownCache // Singleton
```

**Business Logic**
```typescript
// categoryContentAnalyzer.ts
function analyzeCategoryContent(category): CategoryContentInfo
function generateDeleteConfirmationMessage(name, info): string

// notificationThrottler.ts
class NotificationThrottler(config) { shouldShowNotification(taskId), reset(taskId) }

// recentCategory.ts
function saveRecentCategory(category)
function getRecentCategory(): string | null
function isRecentCategory(category): boolean
```

#### Server Internals
*Path: `server/utils/*.js`*

```javascript
// fileSystem.js
async function scanDirectory(dir, root, batchSize=50) // Returns category tree
async function loadPromptsInDirectory(dir, batchSize=50)
async function readPrompt(path) // Returns { meta, content }
async function movePrompt(path, newCat, root)
function titleToSlug(title)
function isPathSafe(target, root)
```

#### Additional Contexts
*Path: `src/contexts/*.tsx`*

```typescript
// ThemeContext.tsx
function useTheme(): { 
  theme: 'dark' | 'light', 
  setTheme(t), 
  toggleTheme() 
}
```

---

### [Baseline] v1.0 Initial Codebase
*Captured on 2026-01-23*

#### Backend API (Node.js Sidecar)
*Path: `server/routes/*.js`, `server/index.js`*

**Vault & Data**
```javascript
GET  /api/vault/scan          // -> { root, categories, allPrompts }
GET  /api/prompts/:id         // -> PromptData
POST /api/prompts/:id         // Body: { title, content, tags, ... } -> Update
POST /api/prompts/import      // Body: { prompts: [], categoryPath, conflictStrategy }
POST /api/categories/move     // Body: { categoryPath, newParentPath }
```

**Search & Trash**
```javascript
GET  /api/search?q=...        // -> SearchResult[]
GET  /api/trash               // -> TrashItem[]
POST /api/trash/restore/:id   // -> Restore item
DELETE /api/trash/clear       // -> Empty trash
```

**Images & Tasks (New)**
```javascript
// server/routes/images.js
POST /api/images/upload       // Body: { imageData, promptId, fileName? } -> Upload Base64 image

// server/routes/intervalTasks.js
GET  /api/interval-tasks/pending          // -> PendingTask[]
POST /api/interval-tasks/:id/acknowledge  // -> Dismiss task
```

**Infrastructure**
```javascript
// server/utils/requestQueue.js
class RequestQueue(concurrency=10) { add(fn) }

// server/utils/intervalTaskScheduler.js
class IntervalTaskScheduler {
  setWindowVisibility(isVisible) // Adjust polling rate (1s vs 10s)
  start() / stop()
  getPendingNotifications()
  acknowledgeTask(id)
}

// server/utils/apiCache.js
class ApiCache(ttl=5000) { get(key), set(key, data) }
```

#### Frontend Data Layer
*Path: `src/api/client.ts`, `src/adapters/ApiFileSystemAdapter.ts`, `src/hooks/*.ts`*

**API Client (`api`)**
```typescript
// src/api/client.ts
const api = {
  vault: { scan(), info() },
  prompts: { getById, update, delete, import },
  categories: { getAll, create, move, delete },
  trash: { getAll, restore, clear },
  search: { query },
  images: { upload(formData) }
}
```

**Hooks (Logic Reuse)**
```typescript
// src/hooks/useIntervalTasks.ts
function useIntervalTasks(apiBaseUrl, enabled): { pendingTasks, isLoading, error }

// src/hooks/useDocumentVisibility.ts
function useDocumentVisibility(): boolean
```

**FileSystem Adapter**
```typescript
// src/adapters/ApiFileSystemAdapter.ts
// Implements IFileSystemAdapter interface
class ApiFileSystemAdapter {
  scanVault(root): Promise<FileSystemState>
  readPrompt(path): Promise<PromptData>
  savePrompt(data): Promise<void> // Auto-handles ID mapping
  deletePrompt(path): Promise<void>
  moveCategory(path, newParent): Promise<Result>
}
```

#### Core UI Components
*Path: `src/components/*.tsx`*

**Editors & Viewers**
```tsx
<Editor prompt={data} onChange={fn} /> // Main editor with Markdown support
<MarkdownRenderer content={string} />  // Read-only view
<ElasticScroll />                      // Wrapper for iOS-like scroll
<TaskEditorOverlay />                  // Specialized editor for tasks
```

**Reusable UI**
```tsx
<Button variant="default|ghost" size="sm|md|icon" />
<ChronoCard targetDate="..." recurrence="..." /> // Countdown card
<EmptyState title="..." primaryActionLabel="..." />
<RecurrenceSelector value={config} onChange={fn} /> // Task recurrence UI
```

**Navigation & Management**
```tsx
<Sidebar />              // Category tree & Drag-drop
<PromptList />           // Virtualized list of prompts
<ContentSearchBar />     // Global search input
```

**Overlays & Dialogs**
```tsx
<NewPromptOverlay />     // Creation modal
<ImportPromptsDialog />  // JSON/Markdown import
<ExportPromptsDialog />  // Bulk export to JSON
<DisintegrateOverlay />  // Thanos-snap deletion effect
```

#### Shared Utilities (Business Logic)
*Path: `src/utils/*.ts`*

**Importers**
```typescript
// src/utils/jsonImporter.ts
importJsonFile(file, api, options): Promise<Result> 
// Handles auto-categorization & conflict resolution

// src/utils/markdownImporter.ts
importMarkdownFiles(files, api): Promise<Result>
// Parses Frontmatter
```

**Domain Logic**
```typescript
// src/utils/smartIcon.ts
// Auto-matches icons based on title/tags semantics
// No public export, usually internal use, but good to know concept exists

// src/utils/tagColors.ts
const COLOR_PALETTE // Deterministic color list

// src/utils/recurrenceTag.ts
function generateRecurrenceTag(config): string // "Every day", "Every 2 days"
```

**Helpers**
```typescript
// src/utils/performanceMonitor.ts
class PerformanceMonitor { start(id), end(id) }

// src/utils/adaptivePolling.ts
class AdaptivePollingManager { start(), stop(), setVisibility(v) }

// src/utils/debounce.ts
function debounce<T>(fn: T, wait: number): T

// src/utils/memoryManager.ts
class MemoryManager { register(key, cb), executeCleanup(key) }
```

#### Tauri Commands (Rust)
*Path: `src-tauri/src/lib.rs`*

```rust
// Invoke via: invoke('command_name')
fn start_backend_if_needed() // Launch Node.js sidecar
fn exit_app()                // Kill sidecar & exit
```

#### Global State (Context)
*Path: `src/contexts/*.tsx`*

```typescript
AppContext    // { currentView, selectedCategory, theme }
ToastContext  // { showToast(msg, type) }
ConfirmContext // { confirm({ title, content, onConfirm }) }
```
