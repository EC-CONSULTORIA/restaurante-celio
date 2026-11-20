@echo off
REM Roda o Sabor e Gestao direto desta pasta, sem instalar (os dados ficam em .\dados)
cd /d "%~dp0"
where pyw >nul 2>&1 && (start "" pyw -3 "%~dp0servidor.py" & exit /b)
where pythonw >nul 2>&1 && (start "" pythonw "%~dp0servidor.py" & exit /b)
echo Python nao encontrado. Rode o Instalar.bat primeiro.
pause
