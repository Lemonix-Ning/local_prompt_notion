/**
 * JSON Importer Utility
 * Handles importing prompts from JSON files with auto-categorization
 */

interface JsonImportOptions {
  defaultCategory?: string; // Default to "公共" if not provided
  conflictStrategy?: 'rename' | 'skip' | 'overwrite'; // Default to 'rename'
}

interface JsonImportResult {
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

/**
 * Import JSON file with simplified configuration
 * - Auto-handles categorization (uses category_path from JSON or defaults to "公共")
 * - Auto-handles conflicts (default: rename)
 * 
 * @param file - The JSON file to import
 * @param api - The API client instance
 * @param options - Import options (defaultCategory, conflictStrategy)
 * @returns Promise with import results
 */
export async function importJsonFile(
  file: File,
  api: any,
  options: JsonImportOptions = {}
): Promise<JsonImportResult> {
  try {
    // Read file content
    const content = await file.text();
    
    // Parse JSON
    let data: any;
    try {
      data = JSON.parse(content);
    } catch (parseError) {
      return { 
        success: false, 
        error: 'Invalid JSON format' 
      };
    }
    
    // Support both single object and array
    const prompts = Array.isArray(data) ? data : [data];
    
    // Validate prompts - filter out invalid entries
    const validPrompts = prompts.filter((p: any) => {
      // Must have a title and it must be a non-empty string
      return p && p.title && typeof p.title === 'string' && p.title.trim().length > 0;
    });
    
    if (validPrompts.length === 0) {
      return { 
        success: false, 
        error: 'No valid prompts found in JSON file' 
      };
    }
    
    // Check if prompts have category_path
    const hasCategories = validPrompts.some((p: any) => p.category_path);
    
    // Determine target category
    let categoryPath: string | undefined;
    if (!hasCategories) {
      // No category_path in JSON, use default category
      categoryPath = options.defaultCategory || '公共';
    }
    // If hasCategories, leave categoryPath undefined so backend uses JSON's category_path
    
    // Call import API
    const response = await api.prompts.import({
      prompts: validPrompts,
      categoryPath,
      conflictStrategy: options.conflictStrategy || 'rename',
    });
    
    if (response.success && response.data) {
      return { 
        success: true, 
        results: response.data 
      };
    } else {
      return { 
        success: false, 
        error: response.error || 'Import failed' 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}
