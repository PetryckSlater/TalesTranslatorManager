@echo off
chcp 65001 > nul
title Tales of Immortal - Sincronizar Updates
echo ====================================================
echo   Tales of Immortal: Sincronizando Arquivos do Jogo
echo ====================================================
node tools\scripts\sync.js
echo.
pause
