@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

set NODE_VERSION=20.15.1
set NODE_DIR=runtime\node
set NODE_EXE=%NODE_DIR%\node.exe
set ZIP_FILE=runtime\node-%NODE_VERSION%-win-x64.zip
set DOWNLOAD_URL=https://nodejs.org/dist/v%NODE_VERSION%/node-v%NODE_VERSION%-win-x64.zip

if exist "%NODE_EXE%" (
    echo Node.js portatil ja encontrado em %NODE_EXE%
    exit /b 0
)

echo Baixando Node.js v%NODE_VERSION%...
if not exist "runtime" mkdir runtime

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '%DOWNLOAD_URL%' -OutFile '%ZIP_FILE%' -UseBasicParsing } catch { exit 1 }"
if errorlevel 1 (
    echo Falha ao baixar Node.js. Verifique a conexao com a internet.
    exit /b 1
)

echo Extraindo Node.js...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%ZIP_FILE%' -DestinationPath 'runtime' -Force"
if errorlevel 1 (
    echo Falha ao extrair Node.js.
    exit /b 1
)

echo Movendo arquivos para %NODE_DIR%...
if exist "%NODE_DIR%" rmdir /s /q "%NODE_DIR%"
move "runtime\node-v%NODE_VERSION%-win-x64" "%NODE_DIR%"
del "%ZIP_FILE%"

if exist "%NODE_EXE%" (
    echo Node.js portatil pronto: %NODE_EXE%
) else (
    echo Erro ao instalar Node.js portatil.
    exit /b 1
)
