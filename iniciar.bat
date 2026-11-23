@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

set NODE_DIR=runtime\node
set NODE_EXE=%NODE_DIR%\node.exe
set NPM_CMD=%NODE_DIR%\npm.cmd
set APP_DIR=%CD%

if not exist "%NODE_EXE%" (
    echo Node.js portatil nao encontrado. Tentando baixar...
    call download-node.bat
    if errorlevel 1 exit /b 1
)

if not exist "server\package.json" (
    echo Arquivo server\package.json nao encontrado.
    pause
    exit /b 1
)

if not exist "server\node_modules" (
    echo Instalando dependencias do servidor...
    cd /d "server"
    call "%NPM_CMD%" install
    if errorlevel 1 (
        echo Falha ao instalar dependencias.
        pause
        exit /b 1
    )
    cd /d "%APP_DIR%"
)

echo Verificando build do servidor...
if not exist "server\dist\index.js" (
    echo Compilando servidor...
    cd /d "server"
    call "%NPM_CMD%" run build
    if errorlevel 1 (
        echo Falha ao compilar servidor.
        pause
        exit /b 1
    )
    cd /d "%APP_DIR%"
)

set PORT=
"%NODE_EXE%" -p "require('./config/settings.json').server.port" > "%TEMP%\hwc_port.txt" 2>nul
if exist "%TEMP%\hwc_port.txt" set /p PORT=<"%TEMP%\hwc_port.txt"
del "%TEMP%\hwc_port.txt" >nul 2>&1
if "!PORT!"=="" set PORT=3000

echo Verificando se a porta !PORT! esta disponivel...
netstat -ano | findstr /C:":!PORT! " >nul
if not errorlevel 1 (
    echo Porta !PORT! ja esta em uso.
    pause
    exit /b 1
)

echo Iniciando servidor...
cd /d "%APP_DIR%"
"%NODE_EXE%" server\dist\index.js

pause
