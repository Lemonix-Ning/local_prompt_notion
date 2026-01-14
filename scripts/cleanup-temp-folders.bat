@echo off
chcp 65001 >nul
echo ========================================
echo 清理临时文件夹
echo ========================================
echo.

node "%~dp0cleanup-temp-folders.cjs"

echo.
echo 按任意键退出...
pause >nul
