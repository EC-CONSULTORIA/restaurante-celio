# Sabor & Gestão — versão para instalar no PC (Python + banco local)

Esta versão roda direto no computador do restaurante, **sem internet e sem mensalidade**, e guarda tudo num **banco de dados SQLite** no próprio PC (não mais no navegador).

## Como instalar (Windows 10/11)

1. Descompacte o `SaborGestao-Instalador.zip` em qualquer pasta (ex.: Downloads).
2. Dê dois cliques em **`Instalar.bat`**.
   - Se o Python não estiver instalado, o instalador tenta instalar sozinho (winget). Se não conseguir, abre o site do Python: instale marcando **"Add python.exe to PATH"** e rode o `Instalar.bat` de novo.
3. Responda às perguntas (abrir junto com o Windows? abrir agora?).
4. Pronto: aparece o atalho **Sabor & Gestão** na Área de Trabalho e no menu Iniciar.

Não precisa ser administrador. O programa fica em `%LOCALAPPDATA%\SaborGestao`.

## Onde ficam os dados

| O quê | Onde |
|---|---|
| Banco de dados | `%LOCALAPPDATA%\SaborGestao\dados\sabor_gestao.db` |
| Cópia automática (1 por dia, guarda 30 dias) | `%LOCALAPPDATA%\SaborGestao\dados\backups\` |
| Registro de erros | `%LOCALAPPDATA%\SaborGestao\dados\servidor.log` |

No menu Iniciar há o atalho **"Pasta de dados e backups"**. Copie essa pasta para um pen drive de vez em quando.

O botão **Backup → Baixar backup completo (JSON)** continua funcionando, e **Restaurar backup** serve para trazer os dados que você já tinha na versão antiga do navegador: na versão antiga baixe o backup JSON, e na nova clique em **Restaurar backup (JSON)** e escolha o arquivo.

Para ver ou exportar os dados em planilha, abra o `.db` no programa gratuito *DB Browser for SQLite*. Já existem tabelas prontas para consulta: `vw_vendas`, `vw_insumos`, `vw_cardapio`, `vw_contas_pagar`, `vw_contas_receber`, `vw_kardex`.

## Como funciona

- O atalho roda `servidor.py` (sem janela preta), que abre o sistema numa janela própria do Edge/Chrome em `http://127.0.0.1:8765`.
- Só este computador acessa (127.0.0.1). Nada vai para a internet.
- Cada alteração é gravada no banco na hora. O canto superior mostra **💾 Banco local** quando está tudo gravado.
- Se a janela ficar fechada por 15 minutos, o servidor se desliga sozinho. Clicar no atalho de novo reabre.
- Impressão de cupom e exportações funcionam normalmente.

## Atualizar

Rode o `Instalar.bat` de uma versão nova. O programa é substituído e **os dados são mantidos**.

## Desinstalar

Menu Iniciar → Sabor & Gestão → **Desinstalar**. Ele pergunta se quer apagar também o banco de dados (o padrão é **manter**).

## Outros arquivos

- `Abrir-Sem-Instalar.bat`: roda direto desta pasta, sem instalar (os dados ficam em `.\dados`). Bom para testar ou levar num pen drive.
- `Gerar-EXE.bat` (opcional): gera um `SaborGestao.exe` com o PyInstaller para usar em PCs **sem Python**. O banco fica na pasta `dados` ao lado do `.exe`.
- Em Mac/Linux: `python3 servidor.py`.

## Problemas comuns

- **"Python não encontrado"** depois de instalar o Python: feche a janela e abra o `Instalar.bat` de novo (o PATH só atualiza em janelas novas).
- **O sistema não abre:** veja `dados\servidor.log`. A porta usada é a 8765; para trocar, defina a variável de ambiente `SABOR_PORTA`.
- **Antivírus bloqueou:** libere a pasta `%LOCALAPPDATA%\SaborGestao`. O programa é só Python + HTML, código aberto nesta pasta.
