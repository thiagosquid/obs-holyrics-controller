@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

set PID_FILE=data\server.pid

if not exist "%PID_FILE%" (
    echo Arquivo de PID nao encontrado. O servidor pode nao estar em execucao.
    echo Voce pode encerrar manualmente pelo Gerenciador de Tarecas (taskmgr).
    pause
    exit /b 1
)

set /p PID=<%PID_FILE%
if "!PID!"=="" (
    echo Arquivo de PID vazio.
    pause
    exit /b 1
)

echo Encerrando processo !PID!...
taskkill /PID !PID! /F
if errorlevel 1 (
    echo Falha ao encerrar o processo. Pode ja estar parado.
) else (
    echo Servidor encerrado.
)

del "%PID_FILE%" 2>nul
pause
