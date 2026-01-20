# JSON Importer Utility

## Overview

The JSON Importer utility (`jsonImporter.ts`) provides simplified JSON file import functionality with automatic categorization and conflict handling.

## Features

### 1. Auto-Categorization (Requirement 2.1, 2.2)

The importer intelligently handles categorization based on the JSON content:

- **With category_path**: If any prompt in the JSON has a `category_path` field, the importer respects individual category paths for each prompt
- **Without category_path**: If no prompts have `category_path`, all prompts are imported to a default category (defaults to "公共")

### 2. Validation and Filtering (Requirement 2.3)

The importer validates each prompt and filters out invalid entries:

- Prompts must have a `title` field
- Title must be a non-empty string
- Invalid prompts are silently filtered out

### 3. Conflict Resolution (Requirement 2.3)

The importer uses a configurable conflict strategy (defaults to 'rename'):

- **rename**: Appends "_1", "_2", etc. to conflicting titles
- **skip**: Skips prompts with conflicting titles
- **overwrite**: Overwrites existing prompts with the same title

### 4. Flexible Input Format

The importer accepts both:

- JSON arrays: `[{...}, {...}]`
- Single JSON objects: `{...}` (automatically converted to array)

## API

### `importJsonFile(file, api, options)`

Imports a JSON file with simplified configuration.

**Parameters:**

- `file` (File): The JSON file to import
- `api` (any): The API client instance
- `options` (JsonImportOptions): Optional configuration
  - `defaultCategory` (string): Default category for prompts without category_path (default: "公共")
  - `conflictStrategy` ('rename' | 'skip' | 'overwrite'): How to handle title conflicts (default: 'rename')

**Returns:**

Promise<JsonImportResult>

```typescript
{
  success: boolean;
  results?: {
    total: number;
    success: number;
    failed: number;
    skipped: number;
    details?: Array<{
      index: number;
      title: string;
      status: 'success' | 'failed' | 'skipped';
      error?: string;
    }>;
  };
  error?: string;
}
```

## Usage Examples

### Example 1: Import with category_path

```typescript
import { importJsonFile } from './utils/jsonImporter';
import api from './api/client';

// JSON content:
// [
//   { "title": "Prompt 1", "content": "...", "category_path": "Category A" },
//   { "title": "Prompt 2", "content": "...", "category_path": "Category B" }
// ]

const result = await importJsonFile(file, api);
// Prompt 1 → Category A
// Prompt 2 → Category B
```

### Example 2: Import without category_path

```typescript
// JSON content:
// [
//   { "title": "Prompt 1", "content": "..." },
//   { "title": "Prompt 2", "content": "..." }
// ]

const result = await importJsonFile(file, api, {
  defaultCategory: '公共'
});
// Both prompts → 公共 category
```

### Example 3: Custom conflict strategy

```typescript
const result = await importJsonFile(file, api, {
  conflictStrategy: 'skip' // Skip prompts with conflicting titles
});
```

### Example 4: Single object import

```typescript
// JSON content:
// { "title": "Single Prompt", "content": "..." }

const result = await importJsonFile(file, api);
// Automatically converted to array and imported
```

## Error Handling

The importer handles various error scenarios:

### Invalid JSON Format

```typescript
const result = await importJsonFile(invalidJsonFile, api);
// { success: false, error: 'Invalid JSON format' }
```

### No Valid Prompts

```typescript
// JSON with all invalid prompts (no titles, empty titles, etc.)
const result = await importJsonFile(file, api);
// { success: false, error: 'No valid prompts found in JSON file' }
```

### API Errors

```typescript
// Network error, validation error, etc.
const result = await importJsonFile(file, api);
// { success: false, error: 'Import failed' }
```

## Validation Rules

A prompt is considered valid if:

1. It is an object (not null or undefined)
2. It has a `title` property
3. The `title` is a string
4. The `title` is not empty (after trimming whitespace)

Invalid prompts are filtered out before import.

## Integration with App.tsx

The JSON importer is designed to be used in the global drag-and-drop handler:

```typescript
const handleJsonImport = async (file: File) => {
  setIsImporting(true);
  showToast('正在导入 JSON 文件...', 'info');
  
  try {
    const result = await importJsonFile(file, api, {
      defaultCategory: '公共',
      conflictStrategy: 'rename',
    });
    
    if (result.success && result.results) {
      await refreshVault();
      const { total, success, failed, skipped } = result.results;
      showToast(
        `导入完成: 成功 ${success}/${total}, 失败 ${failed}, 跳过 ${skipped}`,
        success > 0 ? 'success' : 'error'
      );
    } else {
      showToast(`导入失败: ${result.error}`, 'error');
    }
  } catch (error) {
    showToast('导入过程中发生错误', 'error');
  } finally {
    setIsImporting(false);
  }
};
```

## Testing

See `test-json-importer.html` for a comprehensive test suite covering:

- Valid JSON with category_path
- Valid JSON without category_path
- Single JSON object
- Invalid JSON format
- Mixed valid/invalid prompts
- Empty arrays

Sample test files are available in `test-samples/`:

- `sample-with-categories.json`
- `sample-without-categories.json`
- `sample-mixed-validity.json`

## Requirements Traceability

- **Requirement 2.1**: Category path detection and respect ✓
- **Requirement 2.2**: Default to "公共" category when no category_path ✓
- **Requirement 2.3**: Conflict resolution with rename strategy ✓
