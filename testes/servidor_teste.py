# -*- coding: utf-8 -*-
"""Sobe o servidor com banco e chaves TEMPORÁRIOS para o teste no navegador (e2e_navegador.js)."""
import datetime, json, os, sys, tempfile, threading

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tmp = tempfile.mkdtemp(prefix="sabor-e2e-")
os.environ["SABOR_DADOS"] = os.path.join(tmp, "dados")
os.environ["SABOR_PORTA"] = os.environ.get("SABOR_PORTA", "8798")
sys.path.insert(0, os.path.join(RAIZ, "instalador-pc"))
sys.path.insert(0, os.path.join(RAIZ, "gerador-licenca"))
import licenca, servidor, gerador_licenca as g  # noqa: E402

k = g.novas_chaves(bits=1024)
g.ARQ_PRIVADA, g.ARQ_HISTORICO = os.path.join(tmp, "priv.json"), os.path.join(tmp, "hist.csv")
json.dump({"n": str(k["n"]), "e": k["e"], "d": str(k["d"])}, open(g.ARQ_PRIVADA, "w"))
licenca.CHAVE_PUBLICA = {"n": k["n"], "e": k["e"]}

FLAG = os.path.join(tmp, "forcar_bloqueio")
_orig = servidor.situacao_licenca
def situacao():          # permite ao teste simular licença vencida
    if os.path.exists(FLAG):
        s = dict(_orig(), estado="expirada", bloqueado=True, mensagem="A licença venceu em 01/01/2026.")
        return s
    return _orig()
servidor.situacao_licenca = situacao

hoje = datetime.date.today()
servidor.criar_estrutura()
srv = servidor.ThreadingHTTPServer((servidor.HOST, servidor.PORTA), servidor.Manipulador)
print(json.dumps({
    "url": servidor.URL, "flag": FLAG, "banco": servidor.ARQ_BANCO,
    "chave_ano": g.emitir("Restaurante Célio", hoje + datetime.timedelta(days=365))[0],
    "chave_3dias": g.emitir("Restaurante Célio", hoje + datetime.timedelta(days=3))[0],
    "chave_outro_pc": g.emitir("Outro", hoje + datetime.timedelta(days=30), "FFFFF-00000")[0],
}), flush=True)
srv.serve_forever()
