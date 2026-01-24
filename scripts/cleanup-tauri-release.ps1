# 一键清理 Tauri 构建中间产物，仅保留最终产物
# 仅保留 Lumina.exe、bundle 下的安装包
# 其余 .rlib/.rmeta/.dll/.pdb/build 目录等全部清理

$releaseDir = "src-tauri/target/release"
$keepFiles = @("Lumina.exe")
$keepDirs = @("bundle")

# 删除 release 下除最终产物和 bundle 外的所有文件
Get-ChildItem $releaseDir -File | Where-Object { $keepFiles -notcontains $_.Name } | Remove-Item -Force

# 删除 release 下除 bundle 外的所有目录
Get-ChildItem $releaseDir -Directory | Where-Object { $keepDirs -notcontains $_.Name } | Remove-Item -Recurse -Force

# 删除 bundle 下除 msi/nsis 安装包外的所有内容
$bundleDir = Join-Path $releaseDir "bundle"
if (Test-Path $bundleDir) {
    Get-ChildItem $bundleDir -Directory | Where-Object { $_.Name -notin @("msi", "nsis") } | Remove-Item -Recurse -Force
}

Write-Host "Tauri 构建中间产物清理完成，仅保留最终产物和安装包。"
