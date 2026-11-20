# Gerador de Licenças — Sabor & Gestão

**Uso exclusivo do Emanuel (desenvolvedor). Não entregue esta pasta ao cliente.**

O arquivo `chave_privada.json` é o que permite criar licenças. Quem tiver esse arquivo consegue gerar chaves. Guarde uma cópia num pen drive ou num cofre de senhas.

## Como liberar o sistema para um cliente

1. O cliente instala o sistema. Ele já abre com **7 dias de teste**.
2. Na tela **ℹ️ Sobre** (ou na tela de bloqueio), o cliente vê o **código do computador** (ex.: `7AE0B-DD2A5`) e manda para você.
3. Dê dois cliques em **`Gerar-Licenca.bat`**. Na janela:
   - Cliente: nome do restaurante
   - Prazo: 7, 15, 30, 90 dias, 6 meses, 1 ano, ou até uma data
   - Código do computador: cole o código do cliente (opcional; se deixar em branco a chave funciona em qualquer PC)
4. Clique em **Gerar chave e copiar** e mande a chave (começa com `SG1-`) pelo WhatsApp/e-mail.
5. O cliente cola a chave em **ℹ️ Sobre → Ativar nova chave**.

Toda chave emitida fica registrada em `licencas_emitidas.csv` (abre no Excel).

## Como funciona o prazo

- Faltando 10 dias, aparece uma faixa amarela avisando e mostrando seu contato.
- No dia seguinte à validade, o sistema bloqueia: o cliente vê seu contato e o campo para colar uma nova chave. Os dados **não** são apagados e ele ainda consegue baixar o backup.
- Se o cliente atrasar a data do Windows para "ganhar tempo", o sistema percebe e bloqueia até a data ser corrigida.
- Para renovar, gere uma chave nova com a nova data. Não precisa reinstalar nada.

## Pela linha de comando

```
py gerador_licenca.py --cliente "Restaurante Célio" --dias 30
py gerador_licenca.py --cliente "Restaurante Célio" --ate 31/12/2027 --maquina 7AE0B-DD2A5
```

## Trocar o par de chaves (só se a chave privada vazar)

```
py gerador_licenca.py --novas-chaves ..\instalador-pc\licenca.py
```

Isso cria uma nova `chave_privada.json` e grava a chave pública no `licenca.py` do sistema. Depois gere um novo instalador e reinstale nos clientes. As licenças antigas deixam de valer.

## Limite da proteção

A chave não pode ser falsificada sem o `chave_privada.json`. Mas o sistema é feito em Python e HTML, então alguém com conhecimento técnico poderia editar o código instalado para tirar a verificação. Para dificultar, entregue a versão `.exe` (veja `Gerar-EXE.bat` no instalador).
