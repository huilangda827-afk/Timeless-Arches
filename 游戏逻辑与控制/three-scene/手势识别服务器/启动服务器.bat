@echo off
chcp 65001 >nul
echo ========================================
echo   手势识别服务器 - 启动脚本
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] 检查 Python 环境...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误：未找到 Python！
    echo 请先安装 Python 3.7 或更高版本
    echo 下载地址：https://www.python.org/downloads/
    pause
    exit /b 1
)
python --version
echo ✅ Python 环境正常
echo.

echo [2/3] 检查依赖包...
python -c "import mediapipe" >nul 2>&1
if errorlevel 1 (
    echo ⚠️  检测到缺少依赖包，正在安装...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo ❌ 依赖安装失败！
        echo 请手动运行: pip install -r requirements.txt
        pause
        exit /b 1
    )
    echo ✅ 依赖安装完成
) else (
    echo ✅ 依赖包已安装
)
echo.

echo [3/3] 启动服务器...
echo.
echo ========================================
echo   服务器正在启动...
echo   地址: ws://localhost:12345
echo   按 Ctrl+C 停止服务器
echo ========================================
echo.

python server.py

pause

