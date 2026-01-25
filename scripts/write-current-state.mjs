import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const args = process.argv.slice(2);
const getArg = (key) => {
  const idx = args.indexOf(key);
  if (idx === -1) return undefined;
  return args[idx + 1];
};

const baselinePath = resolve('./.kiro/specs/production-performance-optimization/baseline.json');
const singleProcessPath = getArg('--singleProcess');
const outputPath = resolve('./.kiro/specs/CURRENT_STATE.md');

if (!existsSync(baselinePath)) {
  console.error(`Baseline not found: ${baselinePath}`);
  process.exit(1);
}

if (!singleProcessPath || !existsSync(singleProcessPath)) {
  console.error('Missing --singleProcess <path to single-process.json>');
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));
const singleProcess = JSON.parse(readFileSync(singleProcessPath, 'utf-8'));

const lines = [];
lines.push(`# CURRENT_STATE`);
lines.push('');
lines.push(`## Desktop Single-Process`);
lines.push(`- onlyLumina: ${singleProcess.onlyLumina ? 'true' : 'false'}`);
lines.push(`- luminaCount: ${singleProcess.luminaCount}`);
lines.push(`- nodeCount: ${singleProcess.nodeCount}`);
lines.push(`- otherSidecars: ${singleProcess.otherSidecars}`);
lines.push('');
lines.push(`## Performance Baseline`);
lines.push(`- timestamp: ${baseline.timestamp}`);
lines.push(`- startup.totalTime: ${baseline.startup?.totalTime ?? 0} ms`);
lines.push(`- runtime.idleCpuUsage: ${baseline.runtime?.idleCpuUsage ?? 0} %`);
lines.push(`- runtime.memoryUsage: ${baseline.runtime?.memoryUsage ?? 0} MB`);
lines.push('');
lines.push(`## Bundle`);
lines.push(`- totalSize: ${baseline.bundle?.totalSize ?? 0} bytes`);
lines.push(`- chunkCount: ${baseline.bundle?.chunkCount ?? 0}`);
lines.push(`- largestChunk.name: ${baseline.bundle?.largestChunk?.name ?? ''}`);
lines.push(`- largestChunk.size: ${baseline.bundle?.largestChunk?.size ?? 0} bytes`);
lines.push('');

writeFileSync(outputPath, lines.join('\n'), 'utf-8');
console.log(`Wrote ${outputPath}`);
