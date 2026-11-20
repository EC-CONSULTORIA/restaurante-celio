# -*- coding: utf-8 -*-
"""Testes da licença de uso (assinatura, prazo, computador, relógio)."""
import datetime
import os
import sys
import tempfile
import unittest

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, "instalador-pc"))
sys.path.insert(0, os.path.join(RAIZ, "gerador-licenca"))

import licenca  # noqa: E402
import gerador_licenca as gerador  # noqa: E402

HOJE = datetime.date(2026, 11, 20)


class BaseLicenca(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Par de chaves só para teste (não mexe na chave real do desenvolvedor)
        cls.tmp = tempfile.mkdtemp()
        cls.k = gerador.novas_chaves(bits=1024)
        cls._orig = (gerador.ARQ_PRIVADA, gerador.ARQ_HISTORICO, licenca.CHAVE_PUBLICA)
        gerador.ARQ_PRIVADA = os.path.join(cls.tmp, "privada.json")
        gerador.ARQ_HISTORICO = os.path.join(cls.tmp, "historico.csv")
        import json
        with open(gerador.ARQ_PRIVADA, "w") as f:
            json.dump({"n": str(cls.k["n"]), "e": cls.k["e"], "d": str(cls.k["d"])}, f)
        licenca.CHAVE_PUBLICA = {"n": cls.k["n"], "e": cls.k["e"]}

    @classmethod
    def tearDownClass(cls):
        gerador.ARQ_PRIVADA, gerador.ARQ_HISTORICO, licenca.CHAVE_PUBLICA = cls._orig

    def chave(self, dias=30, maquina="*", cliente="Restaurante Teste"):
        return gerador.emitir(cliente, HOJE + datetime.timedelta(days=dias), maquina)[0]


class TestAssinatura(BaseLicenca):
    def test_chave_valida_e_lida(self):
        d = licenca.ler_chave(self.chave(cliente="Restaurante Célio"))
        self.assertEqual(d["c"], "Restaurante Célio")
        self.assertEqual(d["v"], "2026-12-20")

    def test_aceita_chave_com_espacos_e_quebras(self):
        c = self.chave()
        licenca.ler_chave("  " + c[:50] + "\n" + c[50:] + " \n")

    def test_dados_alterados_sao_recusados(self):
        import base64, json
        c = self.chave(dias=7)
        corpo, sig = c[4:].split(".")
        d = json.loads(base64.urlsafe_b64decode(corpo + "=" * (-len(corpo) % 4)))
        d["v"] = "2099-12-31"   # tenta esticar o prazo
        novo = base64.urlsafe_b64encode(json.dumps(d, separators=(",", ":")).encode()).decode().rstrip("=")
        with self.assertRaises(licenca.LicencaInvalida):
            licenca.ler_chave("SG1-" + novo + "." + sig)

    def test_chave_de_outro_gerador_e_recusada(self):
        outra = gerador.novas_chaves(bits=1024)
        with self.assertRaises(licenca.LicencaInvalida):
            licenca.ler_chave(self.chave(), publica=outra)

    def test_lixo_e_recusado(self):
        for ruim in ["", "abc", "SG1-", "SG1-xx.yy", "SG1-" + "A" * 40 + "." + "B" * 40]:
            with self.assertRaises(licenca.LicencaInvalida):
                licenca.ler_chave(ruim)

    def test_historico_registrado(self):
        self.chave(cliente="Bar do Zé")
        with open(gerador.ARQ_HISTORICO, encoding="utf-8-sig") as f:
            self.assertIn("Bar do Zé", f.read())

    def test_gerador_valida_entrada(self):
        with self.assertRaises(ValueError):
            gerador.emitir("", HOJE)
        with self.assertRaises(ValueError):
            gerador.emitir("X", HOJE, "codigo-errado")

    def test_codigo_maquina_estavel(self):
        a = licenca.codigo_maquina()
        self.assertRegex(a, r"^[0-9A-F]{5}-[0-9A-F]{5}$")
        self.assertEqual(a, licenca.codigo_maquina())


class TestSituacao(BaseLicenca):
    MAQ = "AAAAA-11111"

    def avaliar(self, meta, hoje=HOJE):
        return licenca.avaliar(meta, hoje=hoje, maquina=self.MAQ)

    def test_primeira_abertura_inicia_teste(self):
        sit, gravar = self.avaliar({})
        self.assertEqual(sit["estado"], "teste")
        self.assertFalse(sit["bloqueado"])
        self.assertEqual(gravar["_inicio_teste"], HOJE.isoformat())
        self.assertEqual(sit["dias_restantes"], licenca.DIAS_TESTE)

    def test_teste_acaba(self):
        inicio = (HOJE - datetime.timedelta(days=licenca.DIAS_TESTE + 1)).isoformat()
        sit, _ = self.avaliar({"_inicio_teste": inicio})
        self.assertEqual(sit["estado"], "teste_fim")
        self.assertTrue(sit["bloqueado"])

    def test_licenca_ativa(self):
        sit, _ = self.avaliar({"_licenca": self.chave(dias=60)})
        self.assertEqual((sit["estado"], sit["bloqueado"], sit["dias_restantes"]), ("ativa", False, 60))

    def test_aviso_perto_de_vencer(self):
        sit, _ = self.avaliar({"_licenca": self.chave(dias=3)})
        self.assertEqual((sit["estado"], sit["bloqueado"]), ("aviso", False))

    def test_vence_no_dia_seguinte_a_validade(self):
        meta = {"_licenca": self.chave(dias=0)}
        self.assertFalse(self.avaliar(meta)[0]["bloqueado"])            # último dia ainda vale
        sit, _ = self.avaliar(meta, hoje=HOJE + datetime.timedelta(days=1))
        self.assertEqual((sit["estado"], sit["bloqueado"]), ("expirada", True))

    def test_chave_presa_ao_computador(self):
        self.assertEqual(self.avaliar({"_licenca": self.chave(maquina=self.MAQ)})[0]["estado"], "ativa")
        sit, _ = self.avaliar({"_licenca": self.chave(maquina="BBBBB-22222")})
        self.assertEqual((sit["estado"], sit["bloqueado"]), ("invalida", True))

    def test_relogio_atrasado_bloqueia(self):
        meta = {"_licenca": self.chave(dias=30), "_ultima_data": "2026-12-25"}
        sit, _ = self.avaliar(meta)
        self.assertEqual((sit["estado"], sit["bloqueado"]), ("relogio", True))

    def test_ultima_data_avanca(self):
        _, gravar = self.avaliar({"_ultima_data": "2026-11-01"})
        self.assertEqual(gravar["_ultima_data"], HOJE.isoformat())


if __name__ == "__main__":
    unittest.main()
