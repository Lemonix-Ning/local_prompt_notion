/**
 * 应用入口文件
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 🔥 创建日志文件用于调试
const logToFile = (message: string) => {
  try {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(logMessage);
    
    // 尝试写入 localStorage 作为日志
    const existingLogs = localStorage.getItem('lumina-startup-logs') || '';
    localStorage.setItem('lumina-startup-logs', existingLogs + logMessage);
  } catch (e) {
    // Ignore errors
  }
};

logToFile('[index.tsx] Starting application...');
logToFile(`[index.tsx] Environment: isTauri=${('__TAURI__' in window)}, port=${window.location.port}, href=${window.location.href}`);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

logToFile('[index.tsx] Root element found, rendering App...');

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

logToFile('[index.tsx] App rendered');
