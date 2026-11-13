@echo off
chcp 65001 > nul
title Tales of Immortal - Auditor de Qualidade & Bizarrices
color 0b

:MENU
cls
echo ========================================================
echo    Tales of Immortal - Auditor de Qualidade & Bizarrices
echo ========================================================
echo.
echo  [1] Executar Varredura (Verificar erros e relatorio)
echo  [2] Corrigir Automaticamente Erros Conhecidos (Tags/Bizarrices)
echo  [3] Corrigir e Recompilar o Mod Automaticamente
echo  [4] Abrir Painel Web para Revisao Visual
echo  [5] Sair
echo.
echo ========================================================
set /p OPT="Escolha uma opcao [1-5]: "

if "%OPT%"=="1" goto CHECK
if "%OPT%"=="2" goto FIX
if "%OPT%"=="3" goto FIX_AND_BUILD
if "%OPT%"=="4" goto OPEN_WEB
if "%OPT%"=="5" goto EXIT
goto MENU

:CHECK
cls
echo.
echo ========================================================
echo    Executando Auditoria Heuristica Completa...
echo ========================================================
echo.
node tools/scripts/audit-translation.js
echo.
pause
goto MENU

:FIX
cls
echo.
echo ========================================================
echo    Aplicando Autocorrecoes no Banco de Dados...
echo ========================================================
echo.
node tools/scripts/audit-translation.js --fix
echo.
pause
goto MENU

:FIX_AND_BUILD
cls
echo.
echo ========================================================
echo    1/2 - Corrigindo Tags e Termos Bizarros...
echo ========================================================
echo.
node tools/scripts/audit-translation.js --fix
echo.
echo ========================================================
echo    2/2 - Compilando Arquivos do Mod...
echo ========================================================
echo.
node tools/scripts/build.js
echo.
echo Concluido com sucesso! Mod atualizado para testes no jogo.
echo.
pause
goto MENU

:OPEN_WEB
cls
echo Abrindo o painel no navegador...
start http://localhost:3000
node tools/scripts/server.js
goto MENU

:EXIT
exit
