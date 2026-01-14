@echo off
chcp 65001 >nul
echo ========================================
echo 测试 Sidecar 独立运行
echo ========================================
echo.

set PORT=3002
set VAULT_PATH=%~dp0..\vault

echo 端口: %PORT%
echo Vault 路径: %VAULT_PATH%
echo.
echo 启动 sidecar...
echo.

"%~dp0..\src-tauri\binaries\server-x86_64-pc-windows-msvc.exe"

pause
