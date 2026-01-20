@echo off
echo ========================================
echo 紧急停止扫描器
echo ========================================
echo.
echo 这个脚本会在浏览器的 localStorage 中设置紧急停止标志
echo 请在浏览器控制台（F12）中运行以下命令：
echo.
echo localStorage.setItem('lumina_stop_scanner', '1');
echo location.reload();
echo.
echo ========================================
echo 如何恢复正常：
echo ========================================
echo.
echo localStorage.removeItem('lumina_stop_scanner');
echo location.reload();
echo.
pause
