#!/usr/bin/env node

/**
 * Baseline Performance Measurement Script
 * 
 * Measures current performance metrics and saves them as baseline.
 * Run this before starting optimization work.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { gzipSync } from 'zlib';

const DIST_DIR = './dist/assets';
const BASELINE_FILE = './.kiro/specs/production-performance-optimization/baseline.json';

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
 * Measure bundle sizes
 */
function measureBundleSizes() {
  console.log('📦 Measuring bundle sizes...');
  
  try {
    const files = readdirSync(DIST_DIR);
    const jsFiles = files.filter(f => extname(f) === '.js');
    
    if (jsFiles.length === 0) {
      console.error('❌ No JavaScript files found in dist/assets');
      console.error('   Run "npm run build" first');
      process.exit(1);
    }
    
    const chunks = {};
    let totalSize = 0;
    let totalGzipSize = 0;
    let mainSize = 0;
    let mainGzipSize = 0;
    let vendorSize = 0;
    let vendorGzipSize = 0;
    
    for (const file of jsFiles) {
      const filePath = join(DIST_DIR, file);
      const size = getFileSize(filePath);
      const gzipSize = getGzipSize(filePath);
      
      totalSize += size;
      totalGzipSize += gzipSize;
      
      chunks[file] = size;
      
      // Identify main and vendor chunks
      if (file.includes('index-')) {
        mainSize = size;
        mainGzipSize = gzipSize;
      } else if (file.includes('vendor-') || file.includes('react-vendor-')) {
        vendorSize += size;
        vendorGzipSize += gzipSize;
      }
    }
    
    return {
      main: mainSize,
      mainGzip: mainGzipSize,
      vendor: vendorSize,
      vendorGzip: vendorGzipSize,
      total: totalSize,
      totalGzip: totalGzipSize,
      chunks,
    };
  } catch (error) {
    console.error('❌ Error measuring bundle sizes:', error.message);
    process.exit(1);
  }
}

/**
 * Create baseline metrics
 */
function createBaseline() {
  console.log('\n🎯 Creating Performance Baseline\n');
  console.log('='.repeat(80));
  
  const bundleSizes = measureBundleSizes();
  
  const baseline = {
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    description: 'Pre-optimization baseline metrics',
    
    // Bundle metrics (measured)
    bundle: {
      mainSize: bundleSizes.main,
      mainGzipSize: bundleSizes.mainGzip,
      vendorSize: bundleSizes.vendor,
      vendorGzipSize: bundleSizes.vendorGzip,
      totalSize: bundleSizes.total,
      totalGzipSize: bundleSizes.totalGzip,
      chunkCount: Object.keys(bundleSizes.chunks).length,
      largestChunk: {
        name: Object.keys(bundleSizes.chunks).reduce((a, b) => 
          bundleSizes.chunks[a] > bundleSizes.chunks[b] ? a : b
        ),
        size: Math.max(...Object.values(bundleSizes.chunks)),
      },
      chunks: bundleSizes.chunks,
    },
    
    // Startup metrics (estimated - will be measured in real app)
    startup: {
      totalTime: 0, // To be measured
      backendStartTime: 0, // To be measured
      vaultScanTime: 0, // To be measured
      firstPaintTime: 0, // To be measured
      timeToInteractive: 0, // To be measured
    },
    
    // Runtime metrics (estimated - will be measured in real app)
    runtime: {
      idleCpuUsage: 0, // To be measured
      activeTaskCpuUsage: 0, // To be measured
      memoryUsage: 0, // To be measured
      memoryPeak: 0, // To be measured
      frameRate: 60, // Target
    },
    
    // Task timer metrics (from V2 refactor)
    taskTimer: {
      frontendPollingInterval: 5000, // Current: 5s
      backendTickRate: 1000, // Current: 1s
      activeTaskCount: 0, // Variable
      notificationCount: 0, // Variable
      batchUpdateCount: 0, // Variable
    },
    
    // Responsiveness metrics (targets)
    responsiveness: {
      searchDebounceDelay: 0, // Not yet implemented
      categorySwitchTime: 0, // To be measured
      scrollFrameRate: 60, // Target
      animationFrameRate: 60, // Target
    },
    
    // Performance targets
    targets: {
      startupTime: 3000, // <3s
      idleCpuUsage: 1, // <1%
      activeTaskCpuUsage: 5, // <5%
      memoryUsage: 200, // <200MB
      maxChunkSize: 300 * 1024, // 300KB
    },
  };
  
  // Save baseline
  try {
    writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2), 'utf-8');
    console.log('\n✅ Baseline saved to:', BASELINE_FILE);
  } catch (error) {
    console.error('❌ Error saving baseline:', error.message);
    process.exit(1);
  }
  
  // Print summary
  console.log('\n📊 Baseline Summary:\n');
  console.log(`Bundle Size:       ${(baseline.bundle.totalSize / 1024).toFixed(2)} KB (${(baseline.bundle.totalGzipSize / 1024).toFixed(2)} KB gzipped)`);
  console.log(`Chunk Count:       ${baseline.bundle.chunkCount}`);
  console.log(`Largest Chunk:     ${baseline.bundle.largestChunk.name} (${(baseline.bundle.largestChunk.size / 1024).toFixed(2)} KB)`);
  console.log(`Main Bundle:       ${(baseline.bundle.mainSize / 1024).toFixed(2)} KB (${(baseline.bundle.mainGzipSize / 1024).toFixed(2)} KB gzipped)`);
  console.log(`Vendor Bundle:     ${(baseline.bundle.vendorSize / 1024).toFixed(2)} KB (${(baseline.bundle.vendorGzipSize / 1024).toFixed(2)} KB gzipped)`);
  
  console.log('\n📝 Notes:');
  console.log('   • Startup and runtime metrics will be measured in the running application');
  console.log('   • Use the performance monitor in development mode to collect these metrics');
  console.log('   • Task timer metrics are based on the V2 refactor (already optimized)');
  
  console.log('\n' + '='.repeat(80) + '\n');
}

// Run baseline measurement
createBaseline();
