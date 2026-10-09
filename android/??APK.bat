@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set ROOT=%~dp0
set TC=%ROOT%..\.toolchain
set GALAXY=%ROOT%..\galaxy
set ASSETS=%ROOT%app\src\main\assets
set ENVFILE=%TC%\env.bat

echo ============================================
echo    星海牧场 · 一键打包 APK
echo ============================================
echo.

echo [1/4] 同步网页资源 ...
if exist "%ASSETS%" rmdir /s /q "%ASSETS%"
mkdir "%ASSETS%" 2>nul
copy /y "%GALAXY%\m.html" "%ASSETS%\" >nul
copy /y "%GALAXY%\index.html" "%ASSETS%\" >nul
xcopy /s /y /q /i "%GALAXY%\css" "%ASSETS%\css" >nul
xcopy /s /y /q /i "%GALAXY%\js"  "%ASSETS%\js"  >nul
echo       完成

echo.
echo [2/4] 安装 / 检查构建工具链 ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%_setup_toolchain.ps1"
if exist "%ENVFILE%" call "%ENVFILE%"

if "%GRADLE_BAT%"=="" (
    echo       × Gradle 不可用
    goto :failed
)
if not exist "%ANDROID_HOME%\platforms\android-34\android.jar" (
    echo       × 缺少 Android SDK platform-34
    goto :failed
)
if not exist "%ANDROID_HOME%\build-tools\34.0.0\aapt2.exe" (
    echo       × 缺少 Android SDK build-tools 34.0.0
    goto :failed
)
echo       √ 工具链就绪

echo.
echo [3/4] 写入 local.properties ...
set SDKESC=%ANDROID_HOME:\=\\%
> "%ROOT%local.properties" echo sdk.dir=%SDKECS%
echo       完成

echo.
echo [4/4] 编译 APK（首次会下载依赖，请耐心等待）...
call "%GRADLE_BAT%" -p "%ROOT%" assembleRelease assembleDebug --no-daemon
if errorlevel 1 goto :failed

echo.
echo ============================================
echo   打包成功！APK 位置：
dir /s /b "%ROOT%app\build\outputs\apk\*.apk" 2>nul
echo ============================================
goto :end

:failed
echo.
echo ============================================
echo   本机打包未能完成。
echo.
echo   原因通常是：当前网络无法访问 dl.google.com
echo   （Android SDK 官方下载源），拿不到 platform /
echo   build-tools，就无法编译 APK。
echo.
echo   请把整个 hunyuanji 目录推到 GitHub，用云端编译：
echo     仓库 → Actions → 「构建星海牧场 APK」→ Run workflow
echo     → Artifacts 下载 APK
echo.
echo   或者：开一个能访问 dl.google.com 的代理后，
echo   重新双击本脚本即可全自动出包。
echo ============================================

:end
echo.
pause
