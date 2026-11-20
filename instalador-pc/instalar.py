# -*- coding: utf-8 -*-
"""
Instalador do Sabor & Gestão para Windows (Python 3.8+ , sem bibliotecas extras).

    py instalar.py                instala ou atualiza (mantém os dados)
    py instalar.py --desinstalar  remove o programa e os atalhos
    py instalar.py --sim          instala sem fazer perguntas

O programa vai para %LOCALAPPDATA%\\SaborGestao (não precisa de administrador).
O banco de dados fica em %LOCALAPPDATA%\\SaborGestao\\dados e nunca é apagado
numa atualização.
"""
import os
import shutil
import subprocess
import sys

NOME = "Sabor & Gestão"
ORIGEM = os.path.dirname(os.path.abspath(__file__))
DESTINO = os.path.join(os.environ.get("LOCALAPPDATA") or os.path.expanduser("~"), "SaborGestao")
ARQUIVOS = ["servidor.py", "instalar.py", "icone.ico", "LEIA-ME.md"]


def perguntar(texto, padrao=False):
    if "--sim" in sys.argv:
        return padrao
    try:
        r = input("%s [%s]: " % (texto, "S/n" if padrao else "s/N")).strip().lower()
    except EOFError:
        return padrao
    return padrao if not r else r.startswith("s")


def powershell(script):
    script = "[Console]::OutputEncoding=[Text.Encoding]::UTF8;" + script
    r = subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
                       capture_output=True, text=True, encoding="utf-8", errors="replace",
                       creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    return r.stdout.strip(), r.returncode


def pasta_especial(nome):
    """Desktop, Programs (menu Iniciar) e Startup, respeitando OneDrive/idioma."""
    saida, _ = powershell("[Environment]::GetFolderPath('%s')" % nome)
    return saida or None


def pythonw():
    exe = sys.executable
    w = os.path.join(os.path.dirname(exe), "pythonw.exe")
    return w if os.path.exists(w) else exe


def criar_atalho(caminho_lnk, alvo, argumentos="", icone="", pasta_trabalho=""):
    esc = lambda s: s.replace("'", "''")
    script = (
        "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%s');"
        "$s.TargetPath='%s';$s.Arguments='%s';$s.WorkingDirectory='%s';"
        "%s$s.Save()" % (esc(caminho_lnk), esc(alvo), esc(argumentos), esc(pasta_trabalho),
                         ("$s.IconLocation='%s';" % esc(icone)) if icone else ""))
    _, rc = powershell(script)
    if rc != 0:
        print("  ! não consegui criar o atalho:", caminho_lnk)
    return rc == 0


def locais_atalhos():
    desktop = pasta_especial("Desktop")
    programas = pasta_especial("Programs")
    menu = os.path.join(programas, NOME) if programas else None
    inicio = pasta_especial("Startup")
    return desktop, menu, inicio


def parar_servidor():
    """Pede para o servidor fechar (se estiver aberto) antes de copiar arquivos."""
    powershell("Get-CimInstance Win32_Process -Filter \"Name like 'python%.exe'\" | "
               "Where-Object { $_.CommandLine -like '*SaborGestao*servidor.py*' } | "
               "ForEach-Object { Stop-Process -Id $_.ProcessId -Force }")


def instalar():
    if os.name != "nt":
        print("Este instalador é para Windows. Em outro sistema rode:  python3 servidor.py")
        return 1
    if sys.version_info < (3, 8):
        print("É preciso Python 3.8 ou mais novo. Baixe em https://www.python.org/downloads/")
        return 1

    print("=" * 60)
    print("  Instalando %s" % NOME)
    print("  Pasta: %s" % DESTINO)
    print("=" * 60)
    atualizacao = os.path.exists(os.path.join(DESTINO, "servidor.py"))
    if atualizacao:
        print("Já existe uma instalação. Vou atualizar o programa e MANTER os dados.")
        parar_servidor()

    os.makedirs(os.path.join(DESTINO, "dados", "backups"), exist_ok=True)
    if os.path.normcase(ORIGEM) != os.path.normcase(DESTINO):
        app_destino = os.path.join(DESTINO, "app")
        if os.path.exists(app_destino):
            shutil.rmtree(app_destino)
        shutil.copytree(os.path.join(ORIGEM, "app"), app_destino)
        for f in ARQUIVOS:
            if os.path.exists(os.path.join(ORIGEM, f)):
                shutil.copy2(os.path.join(ORIGEM, f), os.path.join(DESTINO, f))
    # Desinstalador com o caminho exato deste Python
    with open(os.path.join(DESTINO, "Desinstalar.bat"), "w", encoding="oem", errors="replace", newline="\r\n") as f:
        f.write('@echo off\ntitle Desinstalar Sabor e Gestao\ncd /d "%%TEMP%%"\n'
                '"%s" "%s" --desinstalar\npause\n(goto) 2>nul & del "%%~f0"\n'
                % (sys.executable, os.path.join(DESTINO, "instalar.py")))
    print("✔ Arquivos copiados")

    alvo, script = pythonw(), os.path.join(DESTINO, "servidor.py")
    icone = os.path.join(DESTINO, "icone.ico")
    desktop, menu, inicio = locais_atalhos()
    if desktop:
        criar_atalho(os.path.join(desktop, NOME + ".lnk"), alvo, '"%s"' % script, icone, DESTINO)
        print("✔ Atalho na Área de Trabalho")
    if menu:
        os.makedirs(menu, exist_ok=True)
        criar_atalho(os.path.join(menu, NOME + ".lnk"), alvo, '"%s"' % script, icone, DESTINO)
        criar_atalho(os.path.join(menu, "Pasta de dados e backups.lnk"), os.path.join(DESTINO, "dados"))
        criar_atalho(os.path.join(menu, "Desinstalar.lnk"), os.path.join(DESTINO, "Desinstalar.bat"), "", "", DESTINO)
        print("✔ Atalhos no menu Iniciar")
    if inicio:
        lnk = os.path.join(inicio, NOME + ".lnk")
        if perguntar("Abrir o sistema automaticamente quando o Windows ligar?", False):
            criar_atalho(lnk, alvo, '"%s"' % script, icone, DESTINO)
            print("✔ Vai abrir junto com o Windows")
        elif os.path.exists(lnk):
            os.remove(lnk)

    print()
    print("Instalação concluída!")
    print("Banco de dados: %s" % os.path.join(DESTINO, "dados", "sabor_gestao.db"))
    print("Backups automáticos (1 por dia): %s" % os.path.join(DESTINO, "dados", "backups"))
    print()
    if perguntar("Abrir o %s agora?" % NOME, True):
        subprocess.Popen([alvo, script], cwd=DESTINO)
    return 0


def desinstalar():
    print("Desinstalando %s..." % NOME)
    parar_servidor()
    desktop, menu, inicio = locais_atalhos()
    for lnk in [os.path.join(desktop or "", NOME + ".lnk"), os.path.join(inicio or "", NOME + ".lnk")]:
        if os.path.isfile(lnk):
            os.remove(lnk)
    if menu and os.path.isdir(menu):
        shutil.rmtree(menu, ignore_errors=True)
    apagar_dados = perguntar("Apagar TAMBÉM o banco de dados e os backups? (não tem volta)", False)
    if os.path.isdir(DESTINO):
        for item in os.listdir(DESTINO):
            if item == "dados" and not apagar_dados:
                continue
            p = os.path.join(DESTINO, item)
            if item == "Desinstalar.bat":
                continue   # está em uso; sai na próxima linha do .bat
            shutil.rmtree(p, ignore_errors=True) if os.path.isdir(p) else os.remove(p)
    print("Programa removido.")
    if not apagar_dados:
        print("Seus dados continuam em: %s" % os.path.join(DESTINO, "dados"))
    return 0


if __name__ == "__main__":
    try:
        codigo = desinstalar() if "--desinstalar" in sys.argv else instalar()
    except Exception as e:
        print("\nERRO:", e)
        codigo = 1
    sys.exit(codigo)
