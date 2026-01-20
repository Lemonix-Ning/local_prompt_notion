import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function getHostTriple() {
  // rustc --print host-tuple requires Rust 1.84+, fallback to rustc -vV parsing.
  try {
    const triple = execSync('rustc --print host-tuple', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (triple) return triple;
  } catch {
    // ignore
  }

  const rustInfo = execSync('rustc -vV', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  const match = /host: (\S+)/.exec(rustInfo);
  if (!match) throw new Error('Failed to determine platform target triple from rustc');
  return match[1];
}

const projectRoot = path.resolve(process.cwd());
const serverEntry = path.join(projectRoot, 'server', 'index.js');
const outDir = path.join(projectRoot, 'src-tauri', 'binaries');

const pkgCacheDir = path.join(projectRoot, '.pkg-cache');

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(pkgCacheDir, { recursive: true });

const ext = process.platform === 'win32' ? '.exe' : '';
const triple = getHostTriple();

// pkg outputs platform-specific binary name; we re-name into Tauri expected pattern.
const tmpOut = path.join(outDir, `server${ext}`);
const finalOut = path.join(outDir, `server-${triple}${ext}`);

console.log(`[sidecar] building Node backend with pkg -> ${finalOut}`);

// Explicit target avoids extra resolution work and makes behavior deterministic.
// NOTE: pkg will download a base Node binary on first run (requires network access).
const pkgTarget = 'node20-win-x64';

console.log(`[sidecar] PKG_CACHE_PATH=${pkgCacheDir}`);
console.log(`[sidecar] target=${pkgTarget}`);

execSync(`pkg "${serverEntry}" --targets ${pkgTarget} --output "${tmpOut}"`, {
  stdio: 'inherit',
  env: {
    ...process.env,
    CI: '1',
    PKG_CACHE_PATH: pkgCacheDir,
  },
});

// Replace if exists
try {
  fs.rmSync(finalOut, { force: true });
} catch {
  // ignore
}

fs.renameSync(tmpOut, finalOut);

console.log('[sidecar] done');
