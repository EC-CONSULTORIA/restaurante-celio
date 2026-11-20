# -*- coding: utf-8 -*-
"""Roda todos os testes: servidor + licença (Python) e, se houver Node + Playwright, o teste no navegador."""
import os, shutil, subprocess, sys, unittest
AQUI = os.path.dirname(os.path.abspath(__file__))
r = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.discover(AQUI))
ok = r.wasSuccessful()
if shutil.which("node"):
    print("\n== Teste no navegador ==")
    ok = subprocess.call(["node", os.path.join(AQUI, "e2e_navegador.js")], env=dict(os.environ, PYTHON=sys.executable)) == 0 and ok
else:
    print("\n(Node.js não encontrado: teste no navegador pulado)")
sys.exit(0 if ok else 1)
