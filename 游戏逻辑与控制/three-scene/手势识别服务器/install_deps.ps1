<#
PowerShell 一键安装脚本（Windows）
在手势识别服务器目录运行本脚本以创建虚拟环境并安装依赖。
#>
try {
    $cwd = Split-Path -Parent $MyInvocation.MyCommand.Path
    Set-Location $cwd
} catch {
}

Write-Host "[install_deps] 在目录: $(Get-Location)"

if (!(Test-Path ".venv")) {
    Write-Host "[install_deps] 创建虚拟环境 .venv..."
    python -m venv .venv
}

Write-Host "[install_deps] 激活并升级 pip..."
& .\.venv\Scripts\python.exe -m pip install --upgrade pip

Write-Host "[install_deps] 安装 requirements.txt 中的依赖..."
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt

if ($LASTEXITCODE -ne 0) {
    Write-Host "[install_deps] 通过 requirements 安装失败，尝试单独安装关键包..."
    & .\.venv\Scripts\python.exe -m pip install websockets
    & .\.venv\Scripts\python.exe -m pip install opencv-python
    & .\.venv\Scripts\python.exe -m pip install mediapipe
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "[install_deps] 依赖安装完成。激活虚拟环境并运行: .\\.venv\\Scripts\\Activate.ps1; python server.py"
} else {
    Write-Host "[install_deps] 安装仍有错误，请将输出粘贴给我以便进一步排查。"
}
