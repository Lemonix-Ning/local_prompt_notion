import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { spawnSync } from 'child_process';

const args = process.argv.slice(2);
const getArg = (key) => {
  const idx = args.indexOf(key);
  if (idx === -1) return undefined;
  return args[idx + 1];
};

const identifier = 'com.lumina.desktop';
const appData = process.env.APPDATA;
const defaultConfigDir = appData ? join(appData, identifier) : undefined;
const configDir = getArg('--configDir') || defaultConfigDir;

if (!configDir) {
  console.error('Missing --configDir and APPDATA not set');
  process.exit(1);
}

const snapshotPath = resolve(configDir, 'performance-snapshot.json');
const singleProcessPath = resolve(configDir, 'single-process.json');

if (!existsSync(snapshotPath)) {
  console.error(`Snapshot not found: ${snapshotPath}`);
  process.exit(1);
}

if (!existsSync(singleProcessPath)) {
  console.error(`Single-process file not found: ${singleProcessPath}`);
  process.exit(1);
}

const merge = spawnSync('node', ['scripts/merge-runtime-metrics.mjs', '--snapshot', snapshotPath], {
  stdio: 'inherit',
});
if (merge.status !== 0) {
  process.exit(merge.status ?? 1);
}

const writeState = spawnSync('node', ['scripts/write-current-state.mjs', '--singleProcess', singleProcessPath], {
  stdio: 'inherit',
});
if (writeState.status !== 0) {
  process.exit(writeState.status ?? 1);
}

const baseline = JSON.parse(readFileSync(resolve('./.kiro/specs/production-performance-optimization/baseline.json'), 'utf-8'));
console.log('Baseline updated with runtime metrics:', baseline.timestamp);
