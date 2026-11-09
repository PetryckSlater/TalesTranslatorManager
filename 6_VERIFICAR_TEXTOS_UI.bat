@echo off
chcp 65001 > nul
title Tales of Immortal - Detector de Textos Longos da UI
color 0b
echo ========================================================
echo    Tales of Immortal - Detector de Textos Longos (UI)
echo ========================================================
echo.
echo Analisando botoes, rotulos e caixas com risco de corte...
echo.

node tools/scripts/diagnose-ui.js

echo.
echo ========================================================
echo Pressione qualquer tecla para abrir o Painel Web e ajustar...
pause > nul
start http://localhost:3000
node tools/scripts/server.js
