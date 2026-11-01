@echo off
chcp 65001 > nul
title Tales of Immortal - Painel Visual de Revisao
echo ====================================================
echo   Iniciando Painel Web de Traducao e Revisao...
echo ====================================================
start "" http://localhost:3000
node tools\scripts\server.js
pause
