# -*- coding: utf-8 -*-
"""Testes do servidor local: banco SQLite, API, segurança e licença."""
import datetime
import json
import os
import sqlite3
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DADOS = tempfile.mkdtemp(prefix="sabor-teste-")
os.environ["SABOR_DADOS"] = DADOS
os.environ["SABOR_PORTA"] = "8799"
sys.path.insert(0, os.path.join(RAIZ, "instalador-pc"))
sys.path.insert(0, os.path.join(RAIZ, "gerador-licenca"))

import licenca  # noqa: E402
import servidor  # noqa: E402
import gerador_licenca as gerador  # noqa: E402

URL = servidor.URL


def req(caminho, metodo="GET", corpo=None, origem=None):
    dados = json.dumps(corpo).encode() if corpo is not None else None
    r = urllib.request.Request(URL + caminho.lstrip("/"), data=dados, method=metodo,
                               headers={"Content-Type": "application/json", **({"Origin": origem} if origem else {})})
    try:
        with urllib.request.urlopen(r, timeout=5) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


def exemplo():
    return {"versao": 1, "config": {"nome": "Teste"}, "seqPedido": 3,
            "insumos": [{"id": "arroz", "nome": "Arroz", "unidade": "kg", "qtd": 10, "min": 2, "custo": 5}],
            "cardapio": [{"id": "m1", "nome": "Marmita", "cat": "Marmitex", "preco": 20, "ativo": True,
                          "ficha": [{"insumoId": "arroz", "qtd": 150}]}],
            "vendas": [{"id": "v1", "num": 1, "total": 20, "pagamento": "PIX", "status": "novo"}],
            "kardex": [], "pagar": [],
            "receber": [{"id": "r1", "cliente": "Ana", "valor": 30, "baixas": [{"valor": 10}]}]}


class TestServidor(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        tmp = tempfile.mkdtemp()
        cls.k = gerador.novas_chaves(bits=1024)
        gerador.ARQ_PRIVADA = os.path.join(tmp, "privada.json")
        gerador.ARQ_HISTORICO = os.path.join(tmp, "hist.csv")
        with open(gerador.ARQ_PRIVADA, "w") as f:
            json.dump({"n": str(cls.k["n"]), "e": cls.k["e"], "d": str(cls.k["d"])}, f)
        licenca.CHAVE_PUBLICA = {"n": cls.k["n"], "e": cls.k["e"]}
        servidor.criar_estrutura()
        cls.srv = servidor.ThreadingHTTPServer((servidor.HOST, servidor.PORTA), servidor.Manipulador)
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.srv.server_close()

    def setUp(self):
        # cada teste começa com uma licença válida
        servidor.gravar_meta({"_licenca": gerador.emitir("Teste", datetime.date.today() + datetime.timedelta(days=90))[0],
                              "_ultima_data": datetime.date.today().isoformat()})

    def test_01_ping_e_tela(self):
        self.assertEqual(req("/api/ping")[1]["app"], "sabor-gestao")
        with urllib.request.urlopen(URL, timeout=5) as r:
            html = r.read().decode()
        self.assertIn("Sabor &amp; Gestão", html)
        self.assertIn("autor.js", html)

    def test_02_banco_vazio_devolve_null(self):
        codigo, j = req("/api/dados")
        self.assertEqual(codigo, 200)
        self.assertIsNone(j["dados"])

    def test_03_grava_e_le_igual(self):
        self.assertEqual(req("/api/dados", "PUT", exemplo())[0], 200)
        self.assertEqual(req("/api/dados")[1]["dados"], exemplo())

    def test_04_atualiza_e_remove_itens(self):
        d = exemplo()
        req("/api/dados", "PUT", d)
        d["vendas"].append({"id": "v2", "num": 2, "total": 7})
        d["receber"] = []
        d["insumos"][0]["qtd"] = 9.85
        req("/api/dados", "PUT", d)
        lido = req("/api/dados")[1]["dados"]
        self.assertEqual(len(lido["vendas"]), 2)
        self.assertEqual(lido["receber"], [])
        self.assertEqual(lido["insumos"][0]["qtd"], 9.85)

    def test_05_visoes_sql(self):
        req("/api/dados", "PUT", exemplo())
        con = sqlite3.connect(servidor.ARQ_BANCO)
        self.assertEqual(con.execute("SELECT pedido, total, pagamento FROM vw_vendas").fetchone(), (1, 20, "PIX"))
        self.assertEqual(con.execute("SELECT cliente, valor, recebido FROM vw_contas_receber").fetchone(), ("Ana", 30, 10))
        self.assertEqual(con.execute("SELECT nome, estoque FROM vw_insumos").fetchone(), ("Arroz", 10))
        con.close()

    def test_06_recusa_outra_origem(self):
        self.assertEqual(req("/api/dados", "PUT", exemplo(), origem="http://site-malicioso.com")[0], 403)

    def test_07_recusa_dados_invalidos(self):
        self.assertEqual(req("/api/dados", "PUT", {"insumos": "x"})[0], 400)

    def test_08_tela_nao_mexe_na_licenca(self):
        d = exemplo()
        d["_inicio_teste"] = "2099-01-01"
        d["_licenca"] = "SG1-falsa"
        req("/api/dados", "PUT", d)
        meta = servidor.meta_interna()
        self.assertNotEqual(meta.get("_inicio_teste"), "2099-01-01")
        self.assertNotEqual(meta.get("_licenca"), "SG1-falsa")

    def test_09_situacao_licenca(self):
        j = req("/api/licenca")[1]
        self.assertEqual(j["estado"], "ativa")
        self.assertEqual(j["cliente"], "Teste")
        self.assertRegex(j["maquina"], r"^[0-9A-F]{5}-[0-9A-F]{5}$")

    def test_10_ativar_chave(self):
        chave = gerador.emitir("Restaurante Novo", datetime.date.today() + datetime.timedelta(days=365))[0]
        codigo, j = req("/api/licenca", "PUT", {"chave": chave})
        self.assertEqual(codigo, 200)
        self.assertEqual(j["cliente"], "Restaurante Novo")

    def test_11_recusa_chave_falsa_vencida_ou_de_outro_pc(self):
        vencida = gerador.emitir("X", datetime.date.today() - datetime.timedelta(days=1))[0]
        outro_pc = gerador.emitir("X", datetime.date.today() + datetime.timedelta(days=30), "FFFFF-00000")[0]
        for chave in ["SG1-qualquer.coisa", vencida, outro_pc]:
            codigo, j = req("/api/licenca", "PUT", {"chave": chave})
            self.assertEqual(codigo, 400, chave[:20])
            self.assertIn("Chave não aceita", j["erro"])
        self.assertEqual(req("/api/licenca")[1]["estado"], "ativa")   # a anterior continua

    def test_12_licenca_vencida_bloqueia_gravacao_mas_nao_leitura(self):
        req("/api/dados", "PUT", exemplo())
        venc = gerador.emitir("X", datetime.date.today() + datetime.timedelta(days=5))[0]
        servidor.gravar_meta({"_licenca": venc, "_ultima_data": (datetime.date.today() + datetime.timedelta(days=10)).isoformat()})
        # relógio "voltou" 10 dias -> bloqueado
        codigo, j = req("/api/dados", "PUT", exemplo())
        self.assertEqual(codigo, 402)
        self.assertTrue(j["licenca"]["bloqueado"])
        self.assertEqual(req("/api/dados")[0], 200)     # dados continuam acessíveis para backup

    def test_13_backup_diario(self):
        servidor.backup_diario()
        arquivos = os.listdir(servidor.PASTA_BACKUPS)
        self.assertIn("sabor_gestao-%s.db" % datetime.date.today().isoformat(), arquivos)

    def test_14_rota_inexistente(self):
        self.assertEqual(req("/api/nada")[0], 404)
        self.assertEqual(req("/api/nada", "PUT", {})[0], 404)


if __name__ == "__main__":
    unittest.main()
