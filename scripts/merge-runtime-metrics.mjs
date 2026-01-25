import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const args = process.argv.slice(2);
const getArg = (key) => {
  const idx = args.indexOf(key);
  if (idx === -1) return undefined;
  return args[idx + 1];
};

const baselinePath = resolve('./.kiro/specs/production-performance-optimization/baseline.json');
const snapshotPath = getArg('--snapshot');

if (!snapshotPath) {
  console.error('Missing --snapshot <path>');
  process.exit(1);
}

if (!existsSync(baselinePath)) {
  console.error(`Baseline not found: ${baselinePath}`);
  process.exit(1);
}

if (!existsSync(snapshotPath)) {
  console.error(`Snapshot not found: ${snapshotPath}`);
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));
const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf-8'));

baseline.timestamp = new Date().toISOString();
baseline.startup = snapshot.startup || baseline.startup;
baseline.runtime = snapshot.runtime || baseline.runtime;

writeFileSync(baselinePath, JSON.stringify(baseline, null, 2), 'utf-8');
console.log(`Updated baseline: ${baselinePath}`);
