@echo off
chcp 65001 >nul
echo ========================================
echo 运行桌面应用（带控制台输出）
echo ========================================
echo.

echo 查找最新的 exe 文件...
if exist "src-tauri\target\release\promptmanager.exe" (
    echo 找到: src-tauri\target\release\promptmanager.exe
    echo.
    echo 启动应用...
    echo 注意查看控制台输出以确认后端是否启动
    echo.
    "src-tauri\target\release\promptmanager.exe"
) else (
    echo 错误: 找不到 promptmanager.exe
    echo 请先运行: npm run desktop:build
)

echo.
pause
