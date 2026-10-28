@echo off
chcp 65001 >nul
title TRAE宝表情工厂
cd /d "%~dp0"
echo.
echo  TRAE宝表情工厂 - 本地服务 http://127.0.0.1:8923/
echo  （关闭服务：直接关闭本窗口即可）
echo.
start "trae-emoji-server" /min python -m http.server 8923 --bind 127.0.0.1
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:8923/index.html"
echo  已在浏览器打开；若页面未弹出或空白，请手动访问上方地址。
echo.
pause
