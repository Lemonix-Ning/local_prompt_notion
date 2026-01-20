#!/usr/bin/env node

/**
 * Bundle Size Analysis Tool
 * 
 * Analyzes the production build bundle and generates a report.
 * Enforces size limits (300KB per chunk) and warns about large dependencies.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { gzipSync } from 'zlib';

const DIST_DIR = './dist/assets';
const MAX_CHUNK_SIZE = 300 * 1024; // 300KB in bytes

/**
 * Get file size in bytes
 */
function getFileSize(filePath) {
  return statSync(filePath).size;
}

/**
 * Get gzipped size of file
 */
function getGzipSize(filePath) {
  const content = readFileSync(filePath);
  const gzipped = gzipSync(content, { level: 9 });
  return gzipped.length;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Analyze bundle size
 */
function analyzeBundleSize() {
  console.log('\n📦 Bundle Size Analysis\n');
  console.log('='.repeat(80));
  
  try {
    const files = readdirSync(DIST_DIR);
    const jsFiles = files.filter(f => extname(f) === '.js');
    
    if (jsFiles.length === 0) {
      console.error('❌ No JavaScript files found in dist/assets');
      console.error('   Run "npm run build" first');
      process.exit(1);
    }
    
    const chunks = [];
    let totalSize = 0;
    let totalGzipSize = 0;
    let hasErrors = false;
    
    for (const file of jsFiles) {
      const filePath = join(DIST_DIR, file);
      const size = getFileSize(filePath);
      const gzipSize = getGzipSize(filePath);
      
      totalSize += size;
      totalGzipSize += gzipSize;
      
      const exceedsLimit = size > MAX_CHUNK_SIZE;
      if (exceedsLimit) {
        hasErrors = true;
      }
      
      chunks.push({
        name: file,
        size,
        gzipSize,
        exceedsLimit
      });
    }
    
    // Sort by size (largest first)
    chunks.sort((a, b) => b.size - a.size);
    
    // Print chunk details
    console.log('\n📄 Chunks:\n');
    console.log('File'.padEnd(40) + 'Size'.padEnd(15) + 'Gzipped'.padEnd(15) + 'Status');
    console.log('-'.repeat(80));
    
    for (const chunk of chunks) {
      const status = chunk.exceedsLimit ? '❌ EXCEEDS LIMIT' : '✅ OK';
      const nameColor = chunk.exceedsLimit ? '\x1b[31m' : '\x1b[32m';
      const resetColor = '\x1b[0m';
      
      console.log(
        nameColor + chunk.name.padEnd(40) + resetColor +
        formatBytes(chunk.size).padEnd(15) +
        formatBytes(chunk.gzipSize).padEnd(15) +
        status
      );
    }
    
    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 Summary:\n');
    console.log(`Total Size:        ${formatBytes(totalSize)}`);
    console.log(`Total Gzipped:     ${formatBytes(totalGzipSize)}`);
    console.log(`Chunk Count:       ${chunks.length}`);
    console.log(`Largest Chunk:     ${chunks[0].name} (${formatBytes(chunks[0].size)})`);
    console.log(`Max Chunk Limit:   ${formatBytes(MAX_CHUNK_SIZE)}`);
    
    // Print warnings
    const oversizedChunks = chunks.filter(c => c.exceedsLimit);
    if (oversizedChunks.length > 0) {
      console.log('\n⚠️  Warnings:\n');
      for (const chunk of oversizedChunks) {
        const excess = chunk.size - MAX_CHUNK_SIZE;
        console.log(`   • ${chunk.name} exceeds limit by ${formatBytes(excess)}`);
      }
      console.log('\n   Suggestions:');
      console.log('   - Split large chunks using dynamic imports');
      console.log('   - Move heavy dependencies to separate chunks');
      console.log('   - Use lazy loading for non-critical features');
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
    
    // Exit with error if any chunk exceeds limit
    if (hasErrors) {
      console.error('❌ Build failed: One or more chunks exceed the 300KB limit\n');
      process.exit(1);
    } else {
      console.log('✅ All chunks are within size limits\n');
    }
    
    // Return analysis for programmatic use
    return {
      totalSize,
      totalGzipSize,
      chunks: chunks.map(c => ({
        name: c.name,
        size: c.size,
        gzipSize: c.gzipSize
      })),
      warnings: oversizedChunks.map(c => 
        `${c.name} exceeds limit by ${formatBytes(c.size - MAX_CHUNK_SIZE)}`
      )
    };
    
  } catch (error) {
    console.error('❌ Error analyzing bundle:', error.message);
    process.exit(1);
  }
}

// Run analysis
analyzeBundleSize();
