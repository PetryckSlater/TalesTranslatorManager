@echo off
chcp 65001 > nul
title Tales of Immortal - Compilar Mod
echo ====================================================
echo   Compilando e Otimizando Arquivos para o Mod...
echo ====================================================
node tools\scripts\build.js
echo.
pause
