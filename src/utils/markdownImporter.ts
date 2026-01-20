/**
 * Markdown Importer Utility
 * Handles parsing and importing Markdown files as prompts
 */

interface MarkdownParseResult {
  title: string;
  content: string;
}

/**
 * Parse a Markdown file to extract title and content
 * 
 * Title extraction rules:
 * - If file contains a line starting with "#", use that heading (with "#" symbols removed)
 * - Otherwise, use the filename without the .md extension
 * 
 * Content preservation:
 * - Full file content is preserved exactly as-is
 * 
 * @param file - The Markdown file to parse
 * @returns Object containing extracted title and full content
 */
export async function parseMarkdownFile(file: File): Promise<MarkdownParseResult> {
  const content = await file.text();
  
  // Handle empty files
  if (!content || content.trim().length === 0) {
    const title = file.name.replace(/\.md$/i, '');
    return { title, content: '' };
  }
  
  // Extract title from first heading or use filename
  const lines = content.split('\n');
  const firstHeading = lines.find(line => line.trim().startsWith('#'));
  
  let title: string;
  if (firstHeading) {
    // Remove leading # symbols and trim whitespace
    title = firstHeading.replace(/^#+\s*/, '').trim();
    
    // Handle edge case: heading with only # symbols (no text)
    if (title.length === 0) {
      title = file.name.replace(/\.md$/i, '');
    }
  } else {
    // Use filename without extension
    title = file.name.replace(/\.md$/i, '');
  }
  
  return { title, content };
}

/**
 * Import a Markdown file as a new prompt
 * 
 * @param file - The Markdown file to import
 * @param categoryPath - The category path where the prompt should be created
 * @param api - The API client instance
 * @returns Result object with success status, promptId on success, or error message on failure
 */
export async function importMarkdownFile(
  file: File,
  categoryPath: string,
  api: any
): Promise<{ success: boolean; promptId?: string; error?: string }> {
  try {
    const { title, content } = await parseMarkdownFile(file);
    
    // Create prompt via API
    const response = await api.prompts.create({
      categoryPath,
      title,
      content,
      tags: [],
      type: 'NOTE' as const,
    });
    
    if (response.success && response.data) {
      return { success: true, promptId: response.data.meta.id };
    } else {
      return { 
        success: false, 
        error: response.error || 'Failed to create prompt' 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}
