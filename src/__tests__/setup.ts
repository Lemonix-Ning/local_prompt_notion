/**
 * Vitest Setup File
 * 全局测试配置和模拟
 */

import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// 每个测试后自动清理
afterEach(() => {
  cleanup();
});

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => {
  setTimeout(cb, 16);
  return 1;
}) as any;

global.cancelAnimationFrame = vi.fn();

// Mock document.hidden
Object.defineProperty(document, 'hidden', {
  writable: true,
  value: false,
});

// Mock visibilitychange event
Object.defineProperty(document, 'visibilityState', {
  writable: true,
  value: 'visible',
});
