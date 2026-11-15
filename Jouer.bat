@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Empire Of Sea
echo.
echo   EMPIRE OF SEA - La puissance des oceans
echo.
where git >/dev/null 2>nul
if %errorlevel%==0 (
  echo [1/3] Recuperation de la derniere version...
  git pull
) else (
  echo [1/3] Git nest pas installe : pas de mise a jour automatique.
)
echo [2/3] Verification des dependances...
call npm.cmd install --no-audit --no-fund
echo [3/3] Lancement du jeu : le navigateur va souvrir...
start "" cmd /c "timeout /t 12 >/dev/null & start http://localhost:8080"
call npm.cmd start
pause
