@echo off
chcp 65001 > nul
title Tales of Immortal - Compartilhar Painel Online
echo ====================================================
echo   Tales of Immortal - Compartilhar Painel Online
echo ====================================================
echo.
echo 1. Iniciando servidor local de traducao...
start "Tales Server" node tools\scripts\server.js
timeout /t 2 > nul

echo.
echo 2. Gerando link publico 100%% gratuito...
echo ====================================================
echo   Envie o link que vai aparecer abaixo para seus amigos!
echo   Tudo o que eles traduzirem vai salvar direto no seu PC!
echo   (Para fechar e encerrar o acesso, basta fechar esta janela).
echo ====================================================
echo.
npx.cmd -y localtunnel --port 3000
pause
