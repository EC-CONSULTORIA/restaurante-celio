# -*- coding: utf-8 -*-
"""
Sabor & Gestão — verificação da licença de uso.
Desenvolvido por Emanuel (contato em app/autor.js).

A chave é assinada (RSA-2048 com hash de domínio completo) pelo gerador que
só o desenvolvedor tem. Este arquivo tem apenas a chave PÚBLICA: com ela dá
para conferir uma licença, mas não para criar uma.

Formato da chave:  SG1-<dados em base64url>.<assinatura em base64url>
Dados: {"c": cliente, "v": "AAAA-MM-DD" validade, "m": código da máquina ou "*",
        "e": data de emissão, "id": identificador}
"""
import base64
import datetime
import hashlib
import json
import os
import sys
import uuid

PREFIXO = "SG1-"
DIAS_TESTE = 7          # período de teste sem chave, contado da 1ª abertura
DIAS_AVISO = 10         # começa a avisar quando faltar isso para vencer

# Chave pública do desenvolvedor (gerada pelo gerador_licenca.py --novas-chaves).
CHAVE_PUBLICA = {
    "n": int(
        "2776971328061138459782471786376312654376962724531144056480231657324074326547"
        "3444191937861471786624521373376255815179352395892231652079887229847487361029"
        "5861158831323482468818855520813199769437177021764510204175726827210752274327"
        "2957044144171820241221179912226697932855117129584076680400956050821681829673"
        "1089016968005639990874827934060125636037305405348097455752506988560439492192"
        "7479424683506268347984616642004534433177622195073567770645300439778273892044"
        "9496960263009425359612996128492168628221580002591423639336494443994617867882"
        "8440925260033554665030428393043110752435449060924794812679633890276795247162"
        "450460869"
    ),
    "e": 65537,
}


class LicencaInvalida(Exception):
    pass


def _b64d(s):
    s = s.strip()
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def hash_dominio(mensagem, n):
    """Hash do tamanho do módulo (FDH): SHA-256 em modo contador, menor que n."""
    k = (n.bit_length() + 7) // 8
    saida, i = b"", 0
    while len(saida) < k - 1:
        saida += hashlib.sha256(i.to_bytes(4, "big") + mensagem).digest()
        i += 1
    return int.from_bytes(saida[:k - 1], "big")


def codigo_maquina():
    """Código curto e estável deste computador (não revela dados pessoais)."""
    bruto = ""
    if os.name == "nt":
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Cryptography",
                                0, winreg.KEY_READ | getattr(winreg, "KEY_WOW64_64KEY", 0)) as k:
                bruto = winreg.QueryValueEx(k, "MachineGuid")[0]
        except OSError:
            pass
    else:
        for p in ("/etc/machine-id", "/var/lib/dbus/machine-id"):
            try:
                with open(p) as f:
                    bruto = f.read().strip()
                    break
            except OSError:
                pass
    if not bruto:
        bruto = "%012x" % uuid.getnode()
    h = hashlib.sha256(("sabor-gestao:" + bruto).encode()).hexdigest().upper()
    return "%s-%s" % (h[:5], h[5:10])


def ler_chave(chave, publica=None):
    """Confere a assinatura e devolve os dados da licença. Não olha a data."""
    publica = publica or CHAVE_PUBLICA
    chave = "".join((chave or "").split())   # tira espaços e quebras de linha coladas
    if not chave.startswith(PREFIXO) or "." not in chave:
        raise LicencaInvalida("formato de chave não reconhecido")
    corpo, assinatura = chave[len(PREFIXO):].split(".", 1)
    try:
        dados_bytes = _b64d(corpo)
        sig = int.from_bytes(_b64d(assinatura), "big")
        dados = json.loads(dados_bytes.decode("utf-8"))
    except Exception:
        raise LicencaInvalida("chave danificada (confira se copiou inteira)")
    n, e = int(publica["n"]), int(publica["e"])
    if not n or sig >= n or pow(sig, e, n) != hash_dominio(dados_bytes, n):
        raise LicencaInvalida("assinatura inválida: esta chave não foi emitida pelo desenvolvedor")
    try:
        datetime.date.fromisoformat(dados["v"])
    except Exception:
        raise LicencaInvalida("chave sem data de validade")
    return dados


def avaliar(meta, hoje=None, maquina=None):
    """
    Calcula a situação da licença. `meta` é um dict-like persistente com:
      _licenca (chave ativa), _inicio_teste, _ultima_data.
    Devolve (situacao, alteracoes_para_gravar).
    estado: ativa | aviso | teste | expirada | teste_fim | invalida | relogio
    """
    hoje = hoje or datetime.date.today()
    maquina = maquina or codigo_maquina()
    gravar = {}
    ultima = meta.get("_ultima_data")
    if ultima and hoje < datetime.date.fromisoformat(ultima) - datetime.timedelta(days=1):
        return ({"estado": "relogio", "bloqueado": True, "maquina": maquina,
                 "mensagem": "A data do computador está antes da última vez que o sistema foi usado (%s). "
                             "Acerte a data e a hora do Windows." % datetime.date.fromisoformat(ultima).strftime("%d/%m/%Y")},
                gravar)
    if not ultima or hoje.isoformat() > ultima:
        gravar["_ultima_data"] = hoje.isoformat()

    base = {"maquina": maquina, "bloqueado": False}
    chave = meta.get("_licenca")
    if chave:
        try:
            d = ler_chave(chave)
            if d.get("m", "*") not in ("*", maquina):
                raise LicencaInvalida("esta chave é de outro computador")
        except LicencaInvalida as e:
            return (dict(base, estado="invalida", bloqueado=True, mensagem="Licença inválida: %s." % e), gravar)
        validade = datetime.date.fromisoformat(d["v"])
        restam = (validade - hoje).days
        info = dict(base, cliente=d.get("c", ""), validade=d["v"], dias_restantes=restam, id=d.get("id"))
        if restam < 0:
            return (dict(info, estado="expirada", bloqueado=True,
                         mensagem="A licença venceu em %s." % validade.strftime("%d/%m/%Y")), gravar)
        if restam <= DIAS_AVISO:
            return (dict(info, estado="aviso", mensagem="A licença vence em %d dia(s), em %s." %
                         (restam, validade.strftime("%d/%m/%Y"))), gravar)
        return (dict(info, estado="ativa", mensagem="Licença ativa até %s." % validade.strftime("%d/%m/%Y")), gravar)

    inicio = meta.get("_inicio_teste")
    if not inicio:
        inicio = hoje.isoformat()
        gravar["_inicio_teste"] = inicio
    fim = datetime.date.fromisoformat(inicio) + datetime.timedelta(days=DIAS_TESTE)
    restam = (fim - hoje).days
    if restam < 0:
        return (dict(base, estado="teste_fim", bloqueado=True, validade=fim.isoformat(), dias_restantes=restam,
                     mensagem="O período de teste de %d dias terminou." % DIAS_TESTE), gravar)
    return (dict(base, estado="teste", validade=fim.isoformat(), dias_restantes=restam,
                 mensagem="Versão de teste: faltam %d dia(s). Peça sua chave de licença." % restam), gravar)


if __name__ == "__main__":
    print("Código deste computador:", codigo_maquina())
    if len(sys.argv) > 1:
        print(json.dumps(ler_chave(sys.argv[1]), ensure_ascii=False, indent=2))
