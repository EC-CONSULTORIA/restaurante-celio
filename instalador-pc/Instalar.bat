@echo off
title Instalador - Sabor e Gestao
cd /d "%~dp0"
echo.
echo  ===== Sabor e Gestao - Instalador =====
echo.

set "PY="
py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3,8) else 1)" >nul 2>&1 && set "PY=py -3"
if not defined PY python -c "import sys; sys.exit(0 if sys.version_info >= (3,8) else 1)" >nul 2>&1 && set "PY=python"

if not defined PY (
  echo  O Python nao foi encontrado neste computador.
  echo  Vou tentar instalar o Python 3.12 automaticamente pelo winget...
  echo.
  winget install -e --id Python.Python.3.12 --scope user --accept-package-agreements --accept-source-agreements
  if errorlevel 1 (
    echo.
    echo  Nao consegui instalar sozinho. Vou abrir a pagina de download do Python.
    echo  IMPORTANTE: na instalacao marque a opcao "Add python.exe to PATH".
    echo  Depois de instalar, rode este Instalar.bat de novo.
    start "" "https://www.python.org/downloads/windows/"
    pause
    exit /b 1
  )
  echo.
  echo  Python instalado. FECHE esta janela e rode o Instalar.bat de novo.
  pause
  exit /b 0
)

%PY% "%~dp0instalar.py" %*
echo.
pause
