# -*- coding: utf-8 -*-
"""
Gerador de licenças do Sabor & Gestão — USO EXCLUSIVO DO DESENVOLVEDOR (Emanuel).

NÃO entregue esta pasta ao cliente: o arquivo chave_privada.json é o que
permite criar licenças. Guarde uma cópia em local seguro (pen drive, cofre de
senhas). Se perder, gere novas chaves e reinstale o sistema nos clientes.

Uso:
    py gerador_licenca.py                      abre a janela do gerador
    py gerador_licenca.py --cliente "Restaurante X" --dias 30 [--maquina ABCDE-12345]
    py gerador_licenca.py --cliente "Restaurante X" --ate 2027-12-31
    py gerador_licenca.py --novas-chaves CAMINHO\\licenca.py
        cria um novo par de chaves e grava a chave pública no licenca.py do sistema
"""
import argparse
import base64
import csv
import datetime
import hashlib
import json
import os
import random
import re
import secrets
import sys

PASTA = os.path.dirname(os.path.abspath(__file__))
ARQ_PRIVADA = os.path.join(PASTA, "chave_privada.json")
ARQ_HISTORICO = os.path.join(PASTA, "licencas_emitidas.csv")
PREFIXO = "SG1-"


# ------------------------------------------------------------ RSA
def _primo_provavel(n, rodadas=40):
    if n < 2:
        return False
    for p in (2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37):
        if n % p == 0:
            return n == p
    d, r = n - 1, 0
    while d % 2 == 0:
        d //= 2
        r += 1
    rnd = random.SystemRandom()
    for _ in range(rodadas):
        a = rnd.randrange(2, n - 2)
        x = pow(a, d, n)
        if x in (1, n - 1):
            continue
        for _ in range(r - 1):
            x = pow(x, 2, n)
            if x == n - 1:
                break
        else:
            return False
    return True


def _gerar_primo(bits):
    while True:
        c = secrets.randbits(bits) | (1 << (bits - 1)) | (1 << (bits - 2)) | 1
        if _primo_provavel(c):
            return c


def novas_chaves(bits=2048, e=65537):
    while True:
        p, q = _gerar_primo(bits // 2), _gerar_primo(bits // 2)
        phi = (p - 1) * (q - 1)
        if p != q and phi % e and (p * q).bit_length() == bits:
            break
    n = p * q
    d = pow(e, -1, phi)
    return {"n": n, "e": e, "d": d}


def hash_dominio(mensagem, n):
    # Igual ao licenca.py do sistema
    k = (n.bit_length() + 7) // 8
    saida, i = b"", 0
    while len(saida) < k - 1:
        saida += hashlib.sha256(i.to_bytes(4, "big") + mensagem).digest()
        i += 1
    return int.from_bytes(saida[:k - 1], "big")


def _b64(b):
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def carregar_privada():
    if not os.path.exists(ARQ_PRIVADA):
        raise SystemExit("Não achei %s. Ele precisa estar na mesma pasta do gerador." % ARQ_PRIVADA)
    with open(ARQ_PRIVADA, encoding="utf-8") as f:
        k = json.load(f)
    return {"n": int(k["n"]), "e": int(k["e"]), "d": int(k["d"])}


def emitir(cliente, validade, maquina="*"):
    """Cria a chave de licença. validade = datetime.date."""
    cliente = (cliente or "").strip()
    if not cliente:
        raise ValueError("Informe o nome do cliente.")
    maquina = (maquina or "*").strip().upper() or "*"
    if maquina != "*" and not re.fullmatch(r"[0-9A-F]{5}-[0-9A-F]{5}", maquina):
        raise ValueError("Código do computador deve ter o formato ABCDE-12345 (ou deixe em branco).")
    k = carregar_privada()
    dados = {"c": cliente, "v": validade.isoformat(), "m": maquina,
             "e": datetime.date.today().isoformat(), "id": secrets.token_hex(4)}
    corpo = json.dumps(dados, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    sig = pow(hash_dominio(corpo, k["n"]), k["d"], k["n"])
    if pow(sig, k["e"], k["n"]) != hash_dominio(corpo, k["n"]):
        raise RuntimeError("falha ao assinar")
    tam = (k["n"].bit_length() + 7) // 8
    chave = PREFIXO + _b64(corpo) + "." + _b64(sig.to_bytes(tam, "big"))
    novo = not os.path.exists(ARQ_HISTORICO)
    with open(ARQ_HISTORICO, "a", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        if novo:
            w.writerow(["emitida_em", "id", "cliente", "validade", "computador", "chave"])
        w.writerow([datetime.datetime.now().strftime("%d/%m/%Y %H:%M"), dados["id"], cliente,
                    validade.strftime("%d/%m/%Y"), maquina, chave])
    return chave, dados


def gravar_publica_no_sistema(caminho_licenca_py, k):
    with open(caminho_licenca_py, encoding="utf-8") as f:
        texto = f.read()
    novo = re.sub(r"CHAVE_PUBLICA = \{.*?\n\}",
                  'CHAVE_PUBLICA = {\n    "n": int(\n        "%s"\n    ),\n    "e": %d,\n}' % (
                      '"\n        "'.join(re.findall(".{1,76}", str(k["n"]))), k["e"]),
                  texto, count=1, flags=re.S)
    if novo == texto:
        raise SystemExit("Não encontrei CHAVE_PUBLICA em " + caminho_licenca_py)
    with open(caminho_licenca_py, "w", encoding="utf-8") as f:
        f.write(novo)


def validade_de(dias=None, ate=None):
    if ate:
        return datetime.date.fromisoformat(ate) if "-" in ate else datetime.datetime.strptime(ate, "%d/%m/%Y").date()
    return datetime.date.today() + datetime.timedelta(days=int(dias))


# ------------------------------------------------------------ janela
def janela():
    import tkinter as tk
    from tkinter import messagebox, ttk

    raiz = tk.Tk()
    raiz.title("Gerador de Licenças — Sabor & Gestão")
    raiz.geometry("640x470")
    f = ttk.Frame(raiz, padding=16)
    f.pack(fill="both", expand=True)

    ttk.Label(f, text="Gerador de Licenças", font=("Segoe UI", 14, "bold")).grid(row=0, column=0, columnspan=3, sticky="w")
    ttk.Label(f, text="Uso exclusivo do desenvolvedor. Não envie esta pasta ao cliente.").grid(row=1, column=0, columnspan=3, sticky="w", pady=(0, 12))

    ttk.Label(f, text="Cliente (restaurante):").grid(row=2, column=0, sticky="w")
    cliente = ttk.Entry(f, width=44)
    cliente.grid(row=2, column=1, columnspan=2, sticky="we", pady=3)

    ttk.Label(f, text="Prazo:").grid(row=3, column=0, sticky="w")
    prazo = ttk.Combobox(f, state="readonly", width=20, values=[
        "7 dias", "15 dias", "30 dias", "90 dias", "6 meses (180 dias)", "1 ano (365 dias)", "Até a data..."])
    prazo.current(2)
    prazo.grid(row=3, column=1, sticky="w", pady=3)
    data = ttk.Entry(f, width=14)
    data.insert(0, (datetime.date.today() + datetime.timedelta(days=30)).strftime("%d/%m/%Y"))
    data.grid(row=3, column=2, sticky="w")

    ttk.Label(f, text="Código do computador:").grid(row=4, column=0, sticky="w")
    maq = ttk.Entry(f, width=16)
    maq.grid(row=4, column=1, sticky="w", pady=3)
    ttk.Label(f, text="(opcional — prende a chave a um PC;\naparece na tela de licença do cliente)").grid(row=4, column=2, sticky="w")

    saida = tk.Text(f, height=9, wrap="char")
    saida.grid(row=6, column=0, columnspan=3, sticky="nsew", pady=(12, 6))
    f.rowconfigure(6, weight=1)
    f.columnconfigure(2, weight=1)
    info = ttk.Label(f, text="")
    info.grid(row=7, column=0, columnspan=3, sticky="w")

    def gerar():
        try:
            escolha = prazo.get()
            if escolha.startswith("Até"):
                val = validade_de(ate=data.get().strip())
            else:
                val = validade_de(dias=re.findall(r"(\d+) dias", escolha)[-1])
            chave, d = emitir(cliente.get(), val, maq.get())
        except Exception as e:
            messagebox.showerror("Erro", str(e))
            return
        saida.delete("1.0", "end")
        saida.insert("1.0", chave)
        raiz.clipboard_clear()
        raiz.clipboard_append(chave)
        info.config(text="✔ Chave copiada! Válida até %s para %s. Registrada em licencas_emitidas.csv" %
                    (val.strftime("%d/%m/%Y"), d["c"]))

    ttk.Button(f, text="Gerar chave e copiar", command=gerar).grid(row=5, column=0, columnspan=3, sticky="we", pady=(10, 0))
    raiz.mainloop()


def main():
    ap = argparse.ArgumentParser(description="Gerador de licenças do Sabor & Gestão")
    ap.add_argument("--cliente")
    ap.add_argument("--dias", type=int)
    ap.add_argument("--ate", help="data final, AAAA-MM-DD ou DD/MM/AAAA")
    ap.add_argument("--maquina", default="*")
    ap.add_argument("--novas-chaves", metavar="LICENCA_PY", help="cria par de chaves e grava a pública nesse licenca.py")
    a = ap.parse_args()

    if a.novas_chaves:
        if os.path.exists(ARQ_PRIVADA):
            os.replace(ARQ_PRIVADA, ARQ_PRIVADA + ".antiga-%s" % datetime.date.today().isoformat())
        k = novas_chaves()
        with open(ARQ_PRIVADA, "w", encoding="utf-8") as f:
            json.dump({"aviso": "SEGREDO do desenvolvedor. Não compartilhe.", "n": str(k["n"]), "e": k["e"], "d": str(k["d"])}, f, indent=1)
        gravar_publica_no_sistema(a.novas_chaves, k)
        print("Novas chaves criadas. Chave pública gravada em", a.novas_chaves)
        return
    if a.cliente:
        if not (a.dias or a.ate):
            raise SystemExit("Informe --dias ou --ate")
        chave, d = emitir(a.cliente, validade_de(a.dias, a.ate), a.maquina)
        print("Cliente: %s | válida até %s | computador: %s\n" % (d["c"], d["v"], d["m"]))
        print(chave)
        return
    janela()


if __name__ == "__main__":
    main()
