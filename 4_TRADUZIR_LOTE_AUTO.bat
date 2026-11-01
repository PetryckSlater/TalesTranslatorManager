@echo off
chcp 65001 > nul
title Tales of Immortal - Traducao em Lote
echo ====================================================
echo   Traduzindo Proximo Lote de Textos Pendentes...
echo ====================================================
set /p LIMIT="Quantos itens deseja traduzir agora? (padrao: 50): "
if "%LIMIT%"=="" set LIMIT=50
node tools\scripts\translate.js %LIMIT%
echo.
pause
