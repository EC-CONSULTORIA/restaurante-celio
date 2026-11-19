# 🍽️ Sabor & Gestão — Sistema Integrado para Restaurantes e Marmitarias

Sistema de gestão operacional e financeira para pequenos restaurantes, marmitarias, lanchonetes e bares.

---

## 📌 Sumário
1. [Visão Geral](#-visão-geral)
2. [Como Executar o Aplicativo](#-como-executar-o-aplicativo)
3. [Estrutura de Arquivos](#-estrutura-de-arquivos)
4. [Módulos e Funcionalidades](#️-módulos-e-funcionalidades)
   - [Dashboard, DRE e Indicadores](#1-dashboard-dre-e-indicadores-gerenciais)
   - [Frente de Caixa (PDV)](#2-frente-de-caixa-pdv--venda-de-refeições)
   - [Cozinha e KDS](#3-cozinha--kds-em-tempo-real)
   - [Estoque, Insumos e Kardex](#4-gestão-de-estoque-e-insumos-fracionados)
   - [Cardápio e Ficha Técnica](#5-cardápio--engenharia-de-ficha-técnica)
   - [Contas a Pagar](#6-contas-a-pagar-despesas--fornecedores)
   - [Contas a Receber e Fiado](#7-contas-a-receber--caderneta-de-fiadoconvênios)
   - [Backup, Segurança e Exportação](#8-backup-segurança-e-exportação)
5. [Pesquisa de Mercado e Benchmarks](#-pesquisa-de-mercado-e-benchmarks)
6. [Dicas Práticas de Gestão e Melhorias Futuras](#-dicas-práticas-de-gestão-e-melhorias-futuras)

---

## 🌟 Visão Geral

O **Sabor & Gestão** resolve o problema clássico de pequenos negócios de alimentação: a desconexão entre as vendas no balcão, as compras de insumos, o desperdício na cozinha e o controle de recebíveis (principalmente o fiado de mensalistas e os repasses das maquininhas).

### Principais diferenciais
- **100% offline:** funciona direto no navegador, sem servidor, sem internet e sem mensalidade.
- **Salvamento automático:** todos os dados ficam no `localStorage` do navegador. Como ficam só naquele navegador e computador, faça o backup JSON com frequência (aba **Backup**).
- **Baixa de estoque por insumo real:** a venda de 1 marmitex abate os gramas exatos de arroz, feijão, proteína e a embalagem.
- **Automação financeira cruzada:** a compra lançada no estoque já gera a conta a pagar; a venda no fiado já gera a conta a receber com vencimento; a venda no crédito gera o recebível da maquininha em D+30.

---

## 🚀 Como Executar o Aplicativo

No Windows, de duas formas:

1. **Inicializador rápido:** dê um duplo clique em [`Abrir-Restaurante.bat`](Abrir-Restaurante.bat).
2. **Pelo navegador:** dê um duplo clique em [`index.html`](index.html) (Chrome, Edge, Firefox, Brave ou Opera).

Em Mac ou Linux, abra o `index.html` no navegador.

> Na primeira abertura o sistema já vem com cardápio, estoque e contas de exemplo. Para começar a usar de verdade, vá em **Backup → Zerar vendas de teste** (ou **Restaurar padrão de fábrica**) e ajuste o cardápio e os insumos.

---

## 📁 Estrutura de Arquivos

```
restaurante-celio/
│
├── index.html               # Estrutura das 8 abas, modais, formulários e área do cupom térmico
├── styles.css               # Design system com variáveis CSS, tema claro/escuro e layout responsivo
├── app.js                   # Lógica de negócio, banco de dados local, cálculo de CMV e validações
├── Abrir-Restaurante.bat    # Abre o sistema com 1 clique no Windows
└── README.md                # Esta documentação
```

---

## ⚙️ Módulos e Funcionalidades

### 1. Dashboard, DRE e Indicadores Gerenciais
- **Filtro de período:** hoje, últimos 7 dias, mês atual ou tudo.
- **KPIs:**
  - Faturamento bruto (com número de pedidos e ticket médio)
  - CMV real consumido (%), em verde dentro da meta e vermelho acima dela
  - Lucro bruto apurado
  - Capital imobilizado em estoque
  - Total de contas a pagar pendentes
  - Total de contas a receber pendentes
- **DRE gerencial simplificado:**
  ```
  (+) Receita Bruta de Vendas
  (-) Custo dos Insumos (CMV real apurado pelas fichas técnicas)
  (=) Lucro Bruto Operacional
  (-) Despesas Operacionais Pagas (luz, gás, aluguel, equipe, impostos)
  (=) Lucro Líquido Real Apurado
  ```
  As contas da categoria *Insumos & Fornecedores* **não** entram como despesa no DRE, porque o custo desses insumos já aparece no CMV quando o prato é vendido. Assim a compra não é contada duas vezes.
- **Alertas:** insumos abaixo do mínimo, contas vencidas ou vencendo hoje, fiado vencido e pedidos atrasados na cozinha.
- **Engenharia de cardápio:** classifica cada prato vendido no período como Estrela, Cavalo de batalha, Quebra-cabeça ou Cachorro (veja as dicas no fim).

### 2. Frente de Caixa (PDV) / Venda de Refeições
- **Filtros por categoria:** Marmitex, Pratos Feitos, Porções, Bebidas e Sobremesas.
- **Busca em tempo real** por nome ou descrição.
- **Regra dos 3 toques:** tocar no item, escolher o pagamento e finalizar.
- **Canais de venda:**
  - `Balcão`: retirada rápida.
  - `Mesa`: número da mesa, taxa de serviço opcional de 10% e divisão da conta por pessoa.
  - `Delivery`: nome, telefone/WhatsApp e endereço do cliente.
- **Formas de pagamento:**
  - `PIX` e `Débito`: baixa imediata.
  - `Dinheiro`: cálculo do troco na hora.
  - `Crédito`: gera título a receber da maquininha para compensação em D+30.
  - `Fiado / Mensalista`: exige o nome do cliente, gera título com vencimento e avisa quando o cliente passa do teto de fiado.
- **Bloqueio preditivo:** o item mostra quantas porções ainda dá para fazer e o sistema não deixa vender um prato se faltar insumo.
- **Cupom térmico 80 mm:** texto monoespaçado pronto para impressora de bobina.

### 3. Cozinha & KDS em Tempo Real
- **Kanban:** `🕒 Novos pedidos` → `🔥 Em preparo` → `🍽️ Prontos` → entregue.
- **Cronômetro de espera:** mostra os minutos de cada pedido e destaca em vermelho os que passam de 25 minutos. A tela se atualiza sozinha a cada 30 segundos.
- **Histórico de pedidos** com **reimpressão da 2ª via** do cupom.

### 4. Gestão de Estoque e Insumos Fracionados
- **Cadastro de matérias-primas** em `kg`, `g`, `L`, `ml` ou `un`.
- **Custo médio ponderado** recalculado a cada compra.
- **Alerta de estoque mínimo** com destaque na tabela.
- **Kardex completo:**
  - `Entradas (compras)`: com fornecedor e número da NF, e opção de gerar a conta a pagar (à vista ou com vencimento).
  - `Saídas por venda`: lançadas automaticamente ao finalizar um pedido.
  - `Saídas manuais / perdas`: desperdício, validade, quebra, consumo da equipe ou ajuste de inventário.
- **Lista de compras em 1 clique:** sugere repor até o dobro do mínimo, com custo estimado, e pode ser impressa.

### 5. Cardápio & Engenharia de Ficha Técnica
- Cada item do cardápio tem sua ficha técnica. Na ficha, insumos em kg são informados em **gramas** e insumos em L em **mililitros**.
- Exemplo incluído:
  - **Marmitex Bife Acebolado:** 160 g de arroz + 100 g de feijão + 160 g de contra-filé + 30 g de cebola + 1 embalagem marmitex.
- **Indicadores calculados na hora:** custo unitário dos insumos, preço de venda, margem bruta e CMV (%), em verde se estiver dentro da meta (padrão 35%, ajustável) e em vermelho se estiver acima.

### 6. Contas a Pagar (Despesas & Fornecedores)
- Categorias: *Insumos & Fornecedores, Gás / Utilidades, Energia & Água, Aluguel, Diárias / Mão de Obra, Impostos, Outros*.
- Lançamento recorrente (repetir por vários meses).
- Destaque para contas **vencidas** e **vencendo hoje**, com resumo no topo.
- Baixa individual com a data de pagamento, e estorno se a baixa foi feita por engano.

### 7. Contas a Receber & Caderneta de Fiado/Convênios
- Crédito para clientes corporativos (oficinas, clínicas, lojas vizinhas) e mensalistas.
- **Saldo devedor por cliente**, com aviso de quem está acima do teto.
- **Baixas parciais:** o cliente pode pagar só uma parte e o restante continua em aberto.
- **Recebíveis de cartão de crédito** com data de compensação e botão para conciliar.

### 8. Backup, Segurança e Exportação
- **Exportação de vendas para CSV/Excel** (separado por ponto e vírgula, abre direto no Excel em português).
- **Backup completo em JSON** para guardar em pen drive ou nuvem.
- **Restauração em 1 clique** em qualquer computador.
- **Modo real:** apaga as vendas de teste e os títulos gerados por elas, e devolve ao estoque o que essas vendas consumiram. Cardápio, insumos e contas a pagar são mantidos.
- **Configurações:** nome do restaurante, teto de fiado por cliente e prazo padrão do fiado.
- **Tema claro/escuro** no botão 🌙/☀️ do topo.

---

## 📊 Pesquisa de Mercado e Benchmarks

| Sistema | Pontos fortes | Principais limitações para pequenos |
| :--- | :--- | :--- |
| **Saipos** | Excelente integração com iFood e KDS | Custo mensal elevado para pequenos negócios |
| **Consumer (MenuDino)** | Bom controle de fiado e cardápio digital | Planos avançados exigem assinatura contínua |
| **GrandChef / SisFood** | Foco em mesas e atendimento de salão | Instalação local mais complexa em alguns cenários |
| **Toast / Square (EUA)** | UI/UX moderna com a "regra dos 3 toques" | Voltados ao mercado internacional |

### Como o *Sabor & Gestão* foi estruturado a partir desse estudo
1. **Zero mensalidade:** ideal para negócios com orçamento enxuto.
2. **Foco no fiado:** essencial para restaurantes de bairro que fornecem marmitas para trabalhadores locais.
3. **Ficha técnica sem complicação:** interface visual no lugar de planilhas complexas.

---

## 💡 Dicas Práticas de Gestão e Melhorias Futuras

### 1. Fator de correção (IPC — Índice de Parte Comestível)
- Uma peça de contra-filé de 1 kg perde cerca de 10% a 15% na limpeza da gordura e mais 15% a 20% na grelha.
- *Recomendação:* na ficha técnica, informe o peso **bruto** comprado (antes da limpeza e do cozimento), para o custo da porção servida não ficar subestimado.

### 2. Política segura para vendas no fiado
- **Fixe um teto de crédito:** por exemplo, R$ 150,00 ou 5 marmitex por cliente antes de exigir a quitação (configurável na aba Backup).
- **Ciclo de cobrança semanal ou quinzenal:** alinhe os vencimentos com os dias de pagamento das empresas da vizinhança.

### 3. Engenharia de cardápio (matriz de popularidade × margem)
- **Estrelas:** muita saída e boa margem (ex.: marmitex de frango bem precificada). Promova sempre.
- **Cavalos de batalha:** muita saída e margem apertada (ex.: marmitex de bife). Monitore o custo da carne e renegocie com o frigorífico.
- **Quebra-cabeças:** boa margem e pouca saída. Dê destaque no balcão ou no WhatsApp.
- **Cachorros:** pouca saída e margem ruim. Tire do cardápio para não empatar dinheiro no estoque.

### Melhorias futuras sugeridas
- Integração com iFood / WhatsApp para receber pedidos.
- Fator de correção (IPC) por insumo direto na ficha técnica.
- Sincronização opcional entre dois computadores (caixa e cozinha).
- Emissão de NFC-e por meio de um emissor homologado.

---

*Sistema desenvolvido com HTML5, CSS3 e Vanilla JavaScript.*
