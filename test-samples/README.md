# JSON Importer Test Samples

This directory contains sample JSON files for testing the JSON importer functionality.

## Files

### sample-with-categories.json
Tests importing prompts with `category_path` fields. Each prompt should be imported to its specified category.

**Expected behavior:**
- Prompt 1 → "Test Category/Subcategory"
- Prompt 2 → "Another Category"

### sample-without-categories.json
Tests importing prompts without `category_path` fields. All prompts should be imported to the default "公共" category.

**Expected behavior:**
- Both prompts → "公共" category

### sample-mixed-validity.json
Tests validation and filtering of invalid prompts. Only prompts with valid titles (non-empty strings) should be imported.

**Expected behavior:**
- 2 valid prompts imported
- 3 invalid prompts filtered out (no title, invalid title type, empty title)

## Testing

1. Open `test-json-importer.html` in a browser
2. Use the file upload test to import these sample files
3. Verify the results match the expected behavior

## Manual Testing with the App

1. Start the development server: `npm run dev:api`
2. Drag and drop these JSON files into the application
3. Verify:
   - Prompts are imported to correct categories
   - Invalid prompts are filtered out
   - Toast notifications show correct counts
   - Vault data is refreshed after import
