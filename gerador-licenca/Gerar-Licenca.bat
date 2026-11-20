@echo off
REM Gerador de licencas do Sabor e Gestao - USO EXCLUSIVO DO DESENVOLVEDOR
cd /d "%~dp0"
where pyw >nul 2>&1 && (start "" pyw -3 "%~dp0gerador_licenca.py" & exit /b)
where pythonw >nul 2>&1 && (start "" pythonw "%~dp0gerador_licenca.py" & exit /b)
echo Python nao encontrado. Instale o Python 3 (python.org) e tente de novo.
pause
