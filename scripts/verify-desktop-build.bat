@echo off
chcp 65001 >nul
echo ========================================
echo 验证桌面应用构建
echo ========================================
echo.

echo 1. 检查主程序...
if exist "src-tauri\target\release\Lumina.exe" (
    echo    [32m✓[0m Lumina.exe 存在
) else (
    echo    [31m✗[0m Lumina.exe 不存在
    goto :error
)

echo.
echo 2. 检查安装包...
if exist "src-tauri\target\release\bundle\msi\Lumina_1.0.0_x64_en-US.msi" (
    echo    [32m✓[0m MSI 安装包存在
) else (
    echo    [33m⚠[0m MSI 安装包不存在
)

if exist "src-tauri\target\release\bundle\nsis\Lumina_1.0.0_x64-setup.exe" (
    echo    [32m✓[0m NSIS 安装包存在
) else (
    echo    [33m⚠[0m NSIS 安装包不存在
)

echo.
echo 3. 检查 vault 目录...
if exist "vault" (
    echo    [32m✓[0m vault 目录存在
) else (
    echo    [33m⚠[0m vault 目录不存在（首次运行时会自动创建）
)

echo.
echo ========================================
echo [32m✓ 验证通过！[0m
echo ========================================
echo.
echo 现在可以运行桌面应用:
echo   1. 绿色版: src-tauri\target\release\Lumina.exe
echo   2. 安装 MSI: src-tauri\target\release\bundle\msi\Lumina_1.0.0_x64_en-US.msi
echo   3. 安装 NSIS: src-tauri\target\release\bundle\nsis\Lumina_1.0.0_x64-setup.exe
goto :end

:error
echo.
echo ========================================
echo [31m✗ 验证失败！[0m
echo ========================================
echo.
echo 请先运行: npm run desktop:build
echo.

:end
pause
