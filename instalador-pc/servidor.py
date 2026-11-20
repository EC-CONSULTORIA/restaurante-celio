# -*- coding: utf-8 -*-
"""
Sabor & Gestão — servidor local com banco de dados SQLite.

Roda só no próprio computador (127.0.0.1), sem internet e sem mensalidade.
Serve a tela do sistema (pasta app/) e grava todos os dados no arquivo
dados/sabor_gestao.db. Usa apenas a biblioteca padrão do Python 3.8+.

Uso:
    pythonw servidor.py            abre o sistema (sem janela preta)
    python  servidor.py --sem-navegador   só sobe o servidor
"""
import datetime
import json
import logging
import os
import shutil
import sqlite3
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

VERSAO = "1.0.0"
HOST = "127.0.0.1"
PORTA = int(os.environ.get("SABOR_PORTA", "8765"))
URL = "http://%s:%d/" % (HOST, PORTA)
MINUTOS_SEM_USO = 15       # encerra sozinho se nenhuma janela do sistema ficar aberta
BACKUPS_GUARDADOS = 30     # cópias diárias do banco

# Coleções do sistema que viram tabelas no banco (lista fixa: nada de nome vindo de fora).
COLECOES = ["insumos", "cardapio", "vendas", "kardex", "pagar", "receber"]

# ---------------------------------------------------------------- caminhos
if getattr(sys, "frozen", False):          # versão .exe (PyInstaller)
    PASTA_PROGRAMA = os.path.dirname(sys.executable)
    PASTA_APP = os.path.join(getattr(sys, "_MEIPASS", PASTA_PROGRAMA), "app")
else:
    PASTA_PROGRAMA = os.path.dirname(os.path.abspath(__file__))
    PASTA_APP = os.path.join(PASTA_PROGRAMA, "app")
PASTA_DADOS = os.environ.get("SABOR_DADOS") or os.path.join(PASTA_PROGRAMA, "dados")
PASTA_BACKUPS = os.path.join(PASTA_DADOS, "backups")
ARQ_BANCO = os.path.join(PASTA_DADOS, "sabor_gestao.db")

os.makedirs(PASTA_BACKUPS, exist_ok=True)
_handler = logging.FileHandler(os.path.join(PASTA_DADOS, "servidor.log"), encoding="utf-8")
_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
logging.getLogger().addHandler(_handler)
logging.getLogger().setLevel(logging.INFO)
log = logging.getLogger("sabor")

# ---------------------------------------------------------------- banco
_trava = threading.Lock()


def conectar():
    con = sqlite3.connect(ARQ_BANCO, timeout=30)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA synchronous=FULL")
    return con


def criar_estrutura():
    con = conectar()
    with con:
        con.execute("CREATE TABLE IF NOT EXISTS meta (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)")
        for t in COLECOES:
            con.execute(
                "CREATE TABLE IF NOT EXISTS %s (id TEXT PRIMARY KEY, pos INTEGER NOT NULL, "
                "dados TEXT NOT NULL, atualizado_em TEXT NOT NULL)" % t)
        # Visões prontas para consultar/exportar (ex.: DB Browser for SQLite, Excel via ODBC).
        visoes = {
            "vw_vendas": """SELECT json_extract(dados,'$.num') AS pedido, json_extract(dados,'$.data') AS data_hora,
                json_extract(dados,'$.canal') AS canal, json_extract(dados,'$.mesa') AS mesa,
                json_extract(dados,'$.cliente') AS cliente, json_extract(dados,'$.pagamento') AS pagamento,
                json_extract(dados,'$.subtotal') AS subtotal, json_extract(dados,'$.taxa') AS taxa,
                json_extract(dados,'$.total') AS total, json_extract(dados,'$.custo') AS custo,
                json_extract(dados,'$.status') AS status FROM vendas ORDER BY pos""",
            "vw_insumos": """SELECT id, json_extract(dados,'$.nome') AS nome, json_extract(dados,'$.unidade') AS unidade,
                json_extract(dados,'$.qtd') AS estoque, json_extract(dados,'$.min') AS minimo,
                json_extract(dados,'$.custo') AS custo_medio FROM insumos ORDER BY pos""",
            "vw_cardapio": """SELECT id, json_extract(dados,'$.nome') AS nome, json_extract(dados,'$.cat') AS categoria,
                json_extract(dados,'$.preco') AS preco, json_extract(dados,'$.ativo') AS ativo FROM cardapio ORDER BY pos""",
            "vw_contas_pagar": """SELECT json_extract(dados,'$.desc') AS descricao, json_extract(dados,'$.cat') AS categoria,
                json_extract(dados,'$.fornecedor') AS fornecedor, json_extract(dados,'$.valor') AS valor,
                json_extract(dados,'$.venc') AS vencimento, json_extract(dados,'$.pago') AS pago,
                json_extract(dados,'$.dataPag') AS data_pagamento FROM pagar ORDER BY pos""",
            "vw_contas_receber": """SELECT json_extract(dados,'$.cliente') AS cliente, json_extract(dados,'$.desc') AS descricao,
                json_extract(dados,'$.origem') AS origem, json_extract(dados,'$.valor') AS valor,
                json_extract(dados,'$.emissao') AS emissao, json_extract(dados,'$.venc') AS vencimento,
                (SELECT COALESCE(SUM(json_extract(b.value,'$.valor')),0) FROM json_each(dados,'$.baixas') b) AS recebido
                FROM receber ORDER BY pos""",
            "vw_kardex": """SELECT json_extract(dados,'$.data') AS data_hora, json_extract(dados,'$.insumoId') AS insumo,
                json_extract(dados,'$.tipo') AS tipo, json_extract(dados,'$.qtd') AS quantidade,
                json_extract(dados,'$.custoUnit') AS custo_unit, json_extract(dados,'$.saldo') AS saldo
                FROM kardex ORDER BY pos""",
        }
        for nome, sql in visoes.items():
            con.execute("DROP VIEW IF EXISTS %s" % nome)
            con.execute("CREATE VIEW %s AS %s" % (nome, sql))
        con.execute("INSERT OR IGNORE INTO meta VALUES ('_criado_em', ?)", (json.dumps(agora()),))
    con.close()


def agora():
    return datetime.datetime.now().isoformat(timespec="seconds")


def ler_dados():
    """Monta o objeto completo do sistema a partir das tabelas. None = banco vazio."""
    con = conectar()
    try:
        meta = {k: json.loads(v) for k, v in con.execute("SELECT chave, valor FROM meta") if not k.startswith("_")}
        if not meta:
            return None
        for t in COLECOES:
            meta[t] = [json.loads(d) for (d,) in con.execute("SELECT dados FROM %s ORDER BY pos" % t)]
        return meta
    finally:
        con.close()


def gravar_dados(obj):
    if not isinstance(obj, dict) or not isinstance(obj.get("insumos"), list) or not isinstance(obj.get("cardapio"), list):
        raise ValueError("dados inválidos")
    quando = agora()
    with _trava:
        con = conectar()
        try:
            with con:
                for chave, valor in obj.items():
                    if chave in COLECOES:
                        continue
                    con.execute("INSERT INTO meta VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor",
                                (str(chave), json.dumps(valor, ensure_ascii=False)))
                for t in COLECOES:
                    itens = obj.get(t) or []
                    atuais = dict(con.execute("SELECT id, dados || '|' || pos FROM %s" % t))
                    vistos = set()
                    for pos, item in enumerate(itens):
                        if not isinstance(item, dict):
                            continue
                        iid = str(item.get("id") or "%s-%d" % (t, pos))
                        if iid in vistos:
                            iid = "%s~%d" % (iid, pos)
                        vistos.add(iid)
                        dados = json.dumps(item, ensure_ascii=False, separators=(",", ":"))
                        if atuais.get(iid) == "%s|%d" % (dados, pos):
                            continue
                        con.execute(
                            "INSERT INTO %s (id, pos, dados, atualizado_em) VALUES (?,?,?,?) "
                            "ON CONFLICT(id) DO UPDATE SET pos=excluded.pos, dados=excluded.dados, "
                            "atualizado_em=excluded.atualizado_em" % t, (iid, pos, dados, quando))
                    removidos = [(i,) for i in atuais if i not in vistos]
                    if removidos:
                        con.executemany("DELETE FROM %s WHERE id=?" % t, removidos)
        finally:
            con.close()


def backup_diario():
    """Uma cópia do banco por dia em dados/backups, guardando as últimas 30."""
    if not os.path.exists(ARQ_BANCO):
        return
    destino = os.path.join(PASTA_BACKUPS, "sabor_gestao-%s.db" % datetime.date.today().isoformat())
    if not os.path.exists(destino):
        origem = conectar()
        copia = sqlite3.connect(destino)
        with copia:
            origem.backup(copia)
        copia.close()
        origem.close()
        log.info("backup diário criado: %s", destino)
    antigos = sorted(f for f in os.listdir(PASTA_BACKUPS) if f.startswith("sabor_gestao-") and f.endswith(".db"))
    for f in antigos[:-BACKUPS_GUARDADOS]:
        try:
            os.remove(os.path.join(PASTA_BACKUPS, f))
        except OSError:
            pass


# ---------------------------------------------------------------- HTTP
ultimo_uso = time.time()


class Manipulador(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=PASTA_APP, **kw)

    def log_message(self, fmt, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, codigo, obj):
        corpo = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def _origem_ok(self):
        # Só aceita gravação vinda da própria tela do sistema.
        origem = self.headers.get("Origin")
        return origem in (None, "null", URL.rstrip("/"), "http://localhost:%d" % PORTA)

    def do_GET(self):
        global ultimo_uso
        ultimo_uso = time.time()
        caminho = self.path.split("?")[0]
        if caminho == "/api/ping":
            return self._json(200, {"ok": True, "app": "sabor-gestao", "versao": VERSAO})
        if caminho == "/api/dados":
            try:
                return self._json(200, {"dados": ler_dados(), "banco": ARQ_BANCO})
            except Exception as e:
                log.exception("erro ao ler")
                return self._json(500, {"erro": str(e)})
        if caminho.startswith("/api/"):
            return self._json(404, {"erro": "não encontrado"})
        return super().do_GET()

    def do_PUT(self):
        global ultimo_uso
        ultimo_uso = time.time()
        if self.path.split("?")[0] != "/api/dados":
            return self._json(404, {"erro": "não encontrado"})
        if not self._origem_ok():
            return self._json(403, {"erro": "origem não permitida"})
        try:
            tamanho = int(self.headers.get("Content-Length") or 0)
            obj = json.loads(self.rfile.read(tamanho).decode("utf-8"))
            gravar_dados(obj)
            return self._json(200, {"ok": True, "salvo_em": agora()})
        except Exception as e:
            log.exception("erro ao gravar")
            return self._json(400, {"erro": str(e)})

    do_POST = do_PUT   # navigator.sendBeacon ao fechar a janela usa POST


# ---------------------------------------------------------------- janela
def ja_rodando():
    try:
        with urllib.request.urlopen(URL + "api/ping", timeout=1.5) as r:
            return json.loads(r.read().decode()).get("app") == "sabor-gestao"
    except Exception:
        return False


def abrir_janela():
    """Abre como 'aplicativo' (janela própria) no Edge ou Chrome; senão, no navegador padrão."""
    if os.name == "nt":
        candidatos = []
        for base in (os.environ.get("ProgramFiles(x86)"), os.environ.get("ProgramFiles"), os.environ.get("LOCALAPPDATA")):
            if base:
                candidatos += [os.path.join(base, r"Microsoft\Edge\Application\msedge.exe"),
                               os.path.join(base, r"Google\Chrome\Application\chrome.exe")]
        perfil = os.path.join(PASTA_DADOS, "perfil-janela")
        for exe in candidatos:
            if os.path.exists(exe):
                try:
                    subprocess.Popen([exe, "--app=" + URL, "--user-data-dir=" + perfil,
                                      "--no-first-run", "--window-size=1366,850"])
                    return
                except OSError:
                    pass
    webbrowser.open(URL)


def vigia_inatividade(servidor):
    while True:
        time.sleep(60)
        if time.time() - ultimo_uso > MINUTOS_SEM_USO * 60:
            log.info("sem uso há %d min, encerrando", MINUTOS_SEM_USO)
            servidor.shutdown()
            return


def main():
    abrir = "--sem-navegador" not in sys.argv
    if ja_rodando():
        if abrir:
            abrir_janela()
        return
    criar_estrutura()
    try:
        backup_diario()
    except Exception:
        log.exception("falha no backup diário")
    servidor = ThreadingHTTPServer((HOST, PORTA), Manipulador)
    log.info("Sabor & Gestão %s em %s | banco: %s", VERSAO, URL, ARQ_BANCO)
    if sys.stdout:
        try:
            print("Sabor & Gestão rodando em %s\nBanco de dados: %s\n(Ctrl+C para sair)" % (URL, ARQ_BANCO))
        except Exception:
            pass
    if abrir:
        threading.Timer(0.6, abrir_janela).start()
        threading.Thread(target=vigia_inatividade, args=(servidor,), daemon=True).start()
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        servidor.server_close()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        log.exception("erro fatal")
        raise
