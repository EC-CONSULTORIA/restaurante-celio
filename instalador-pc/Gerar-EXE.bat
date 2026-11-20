@echo off
REM OPCIONAL: gera um SaborGestao.exe que roda em PCs sem Python.
REM Precisa de Python + internet so neste PC onde o .exe e gerado.
cd /d "%~dp0"
py -3 -m pip install --upgrade pyinstaller || python -m pip install --upgrade pyinstaller
py -3 -m PyInstaller --noconfirm --onefile --noconsole --name SaborGestao --icon icone.ico --add-data "app;app" servidor.py || python -m PyInstaller --noconfirm --onefile --noconsole --name SaborGestao --icon icone.ico --add-data "app;app" servidor.py
echo.
echo Pronto: o arquivo esta em dist\SaborGestao.exe
echo Copie o .exe para uma pasta fixa (ex.: C:\SaborGestao). O banco fica em dados\ ao lado dele.
pause
