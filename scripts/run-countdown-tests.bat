@echo off
REM 倒计时系统自动化测试脚本
REM 运行所有测试并生成报告

echo ========================================
echo 倒计时系统自动化测试
echo ========================================
echo.

echo [1/5] 检查依赖...
call npm list vitest >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 测试依赖未安装
    echo 请运行: npm install
    exit /b 1
)
echo ✓ 依赖检查通过
echo.

echo [2/5] 运行单元测试...
call npm run test:countdown
if %errorlevel% neq 0 (
    echo ✗ 单元测试失败
    exit /b 1
)
echo ✓ 单元测试通过
echo.

echo [3/5] 运行性能测试...
call npm run test:perf
if %errorlevel% neq 0 (
    echo ✗ 性能测试失败
    exit /b 1
)
echo ✓ 性能测试通过
echo.

echo [4/5] 运行集成测试...
call npm run test:integration
if %errorlevel% neq 0 (
    echo ✗ 集成测试失败
    exit /b 1
)
echo ✓ 集成测试通过
echo.

echo [5/5] 生成覆盖率报告...
call npm run test:coverage
if %errorlevel% neq 0 (
    echo ✗ 覆盖率报告生成失败
    exit /b 1
)
echo ✓ 覆盖率报告已生成
echo.

echo ========================================
echo 所有测试通过! ✓
echo ========================================
echo.
echo 查看覆盖率报告:
echo   start coverage\index.html
echo.
echo 查看测试 UI:
echo   npm run test:ui
echo.

exit /b 0
