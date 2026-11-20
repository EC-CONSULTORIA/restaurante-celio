/* =========================================================
   Sabor & Gestão — lógica do sistema (Vanilla JS, offline)
   Todos os dados ficam no localStorage do navegador.
   ========================================================= */
'use strict';

const STORAGE_KEY = 'saborGestao.v1';
const CATEGORIAS = ['Marmitex', 'Pratos Feitos', 'Porções', 'Bebidas', 'Sobremesas'];
const CATS_PAGAR = ['Insumos & Fornecedores', 'Gás / Utilidades', 'Energia & Água', 'Aluguel', 'Diárias / Mão de Obra', 'Impostos', 'Outros'];
const UNIDADES = ['kg', 'g', 'L', 'ml', 'un'];
// Na ficha técnica, kg é informado em gramas e L em mililitros.
const SUBUNIDADE = { kg: ['g', 1000], L: ['ml', 1000], g: ['g', 1], ml: ['ml', 1], un: ['un', 1] };
const MIN_ATRASO = 25;

/* ---------- utilidades ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v, d = 2) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d });
const pct = v => (isFinite(v) ? v : 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const round2 = v => Math.round((Number(v) || 0) * 100) / 100;
const parseNum = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };

function hojeISO(offsetDias = 0) {
  const d = new Date(); d.setDate(d.getDate() + offsetDias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const dataBR = iso => { if (!iso) return '—'; const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
const horaBR = iso => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dataHoraBR = iso => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const isoLocalDia = iso => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/* ---------- dados de exemplo ---------- */
function dadosIniciais() {
  const ins = (id, nome, unidade, qtd, min, custo) => ({ id, nome, unidade, qtd, min, custo });
  const insumos = [
    ins('arroz', 'Arroz branco', 'kg', 25, 5, 5.5),
    ins('feijao', 'Feijão carioca', 'kg', 15, 4, 8),
    ins('contrafile', 'Contra-filé', 'kg', 10, 3, 42),
    ins('frango', 'Peito de frango', 'kg', 12, 3, 18),
    ins('batata', 'Batata', 'kg', 10, 3, 6),
    ins('cebola', 'Cebola', 'kg', 5, 1, 5),
    ins('oleo', 'Óleo de soja', 'L', 9, 2, 8),
    ins('salada', 'Salada (alface/tomate)', 'kg', 3, 1, 10),
    ins('calabresa', 'Calabresa', 'kg', 5, 1, 28),
    ins('ovo', 'Ovo', 'un', 60, 12, 0.6),
    ins('embalagem', 'Embalagem marmitex descartável', 'un', 200, 50, 0.45),
    ins('refri', 'Refrigerante lata 350ml', 'un', 48, 12, 2.8),
    ins('suco', 'Suco natural (polpa preparada)', 'L', 5, 1, 7),
    ins('pudim', 'Pudim (fatia)', 'un', 10, 3, 2.5),
  ];
  const p = (id, nome, cat, desc, preco, ficha) => ({ id, nome, cat, desc, preco, ativo: true, ficha: ficha.map(([insumoId, qtd]) => ({ insumoId, qtd })) });
  const cardapio = [
    p('m1', 'Marmitex Bife Acebolado', 'Marmitex', 'Arroz, feijão, contra-filé acebolado', 22, [['arroz', 160], ['feijao', 100], ['contrafile', 160], ['cebola', 30], ['embalagem', 1]]),
    p('m2', 'Marmitex Frango Grelhado', 'Marmitex', 'Arroz, feijão, frango grelhado e salada', 18, [['arroz', 160], ['feijao', 100], ['frango', 180], ['salada', 40], ['embalagem', 1]]),
    p('m3', 'Marmitex Calabresa', 'Marmitex', 'Arroz, feijão, calabresa acebolada e fritas', 19, [['arroz', 160], ['feijao', 100], ['calabresa', 120], ['batata', 100], ['oleo', 20], ['embalagem', 1]]),
    p('pf1', 'PF Frango com Fritas', 'Pratos Feitos', 'Arroz, feijão, frango, fritas e salada', 24, [['arroz', 180], ['feijao', 120], ['frango', 200], ['batata', 150], ['oleo', 30], ['salada', 50]]),
    p('pf2', 'PF Bife a Cavalo', 'Pratos Feitos', 'Arroz, feijão, bife com ovo frito', 28, [['arroz', 180], ['feijao', 120], ['contrafile', 180], ['ovo', 1], ['oleo', 10]]),
    p('po1', 'Porção de Batata Frita', 'Porções', '400 g de batata frita crocante', 20, [['batata', 400], ['oleo', 60]]),
    p('po2', 'Porção de Calabresa', 'Porções', 'Calabresa acebolada (350 g)', 26, [['calabresa', 350], ['cebola', 60], ['oleo', 20]]),
    p('b1', 'Refrigerante Lata', 'Bebidas', 'Lata 350 ml', 6, [['refri', 1]]),
    p('b2', 'Suco Natural 300ml', 'Bebidas', 'Sabores do dia', 7, [['suco', 300]]),
    p('s1', 'Pudim de Leite', 'Sobremesas', 'Fatia individual', 8, [['pudim', 1]]),
  ];
  const pagar = [
    { id: uid(), desc: 'Botijão de gás P45', cat: 'Gás / Utilidades', fornecedor: 'Gás Bom', valor: 420, venc: hojeISO(0), pago: false },
    { id: uid(), desc: 'Conta de energia', cat: 'Energia & Água', fornecedor: 'Concessionária', valor: 380, venc: hojeISO(-2), pago: false },
    { id: uid(), desc: 'Aluguel do ponto', cat: 'Aluguel', fornecedor: 'Imobiliária', valor: 1800, venc: hojeISO(8), pago: false },
    { id: uid(), desc: 'Diária auxiliar de cozinha', cat: 'Diárias / Mão de Obra', fornecedor: 'Equipe', valor: 90, venc: hojeISO(0), pago: true, dataPag: hojeISO(0) },
  ];
  return {
    versao: 1,
    config: { nome: 'Sabor & Gestão', metaCmv: 35, tetoFiado: 150, prazoFiado: 15, tema: 'light' },
    insumos, cardapio, vendas: [], kardex: [], pagar, receber: [], seqPedido: 1,
  };
}

/* ---------- persistência ----------
   Instalado no PC (servidor.py): os dados vão para o banco SQLite local.
   Aberto direto pelo index.html: continua usando o localStorage do navegador. */
let db;
let modoBanco = false, timerSalvar = null, salvando = false, pendente = false;
async function carregar() {
  let raw = null;
  if (location.protocol.startsWith('http')) {
    try {
      const r = await fetch('/api/dados', { cache: 'no-store' });
      if (r.ok) { const j = await r.json(); modoBanco = true; db = j.dados || dadosIniciais(); }
    } catch (e) { modoBanco = false; }
  }
  if (!modoBanco) {
    try { raw = localStorage.getItem(STORAGE_KEY); db = raw ? JSON.parse(raw) : dadosIniciais(); }
    catch (e) { db = dadosIniciais(); }
  }
  const base = dadosIniciais();
  for (const k of Object.keys(base)) if (db[k] === undefined) db[k] = base[k];
  db.config = { ...base.config, ...db.config };
}
function salvar() {
  if (!modoBanco) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }
    catch (e) { toast('Não foi possível salvar no navegador: ' + e.message, 'bad'); }
    return;
  }
  pendente = true;
  clearTimeout(timerSalvar);
  timerSalvar = setTimeout(enviarBanco, 250);
}
async function enviarBanco() {
  if (salvando) { timerSalvar = setTimeout(enviarBanco, 250); return; }
  salvando = true; pendente = false;
  try {
    const r = await fetch('/api/dados', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(db) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || 'HTTP ' + r.status);
    marcarBanco(true);
  } catch (e) {
    pendente = true; marcarBanco(false);
    toast('Não consegui gravar no banco de dados (' + e.message + '). Vou tentar de novo.', 'bad');
    clearTimeout(timerSalvar); timerSalvar = setTimeout(enviarBanco, 5000);
  } finally { salvando = false; }
}
function marcarBanco(ok) {
  const el = document.getElementById('statusBanco'); if (!el) return;
  el.textContent = ok ? '💾 Banco local' : '⚠️ Sem gravar';
  el.title = ok ? 'Dados gravados no banco SQLite deste computador' : 'O servidor local não respondeu. Mantenha esta janela aberta e reabra o sistema pelo atalho.';
}
window.addEventListener('beforeunload', () => {
  if (modoBanco && pendente) navigator.sendBeacon('/api/dados', new Blob([JSON.stringify(db)], { type: 'application/json' }));
});

/* ---------- regras de negócio ---------- */
const insumo = id => db.insumos.find(i => i.id === id);
const prato = id => db.cardapio.find(p => p.id === id);
const fator = un => (SUBUNIDADE[un] || ['un', 1])[1];
const subun = un => (SUBUNIDADE[un] || ['un', 1])[0];

function custoPrato(p) {
  return round2(p.ficha.reduce((s, f) => { const i = insumo(f.insumoId); return s + (i ? (f.qtd / fator(i.unidade)) * i.custo : 0); }, 0));
}
function cmvPrato(p) { return p.preco > 0 ? custoPrato(p) / p.preco * 100 : 0; }

/** Consumo de insumos (na unidade do estoque) de uma lista de itens {pratoId, qtd}. */
function consumo(itens) {
  const mapa = {};
  for (const it of itens) {
    const p = prato(it.pratoId); if (!p) continue;
    for (const f of p.ficha) {
      const i = insumo(f.insumoId); if (!i) continue;
      mapa[i.id] = (mapa[i.id] || 0) + (f.qtd / fator(i.unidade)) * it.qtd;
    }
  }
  return mapa;
}
/** Retorna a lista de insumos que faltariam para produzir os itens. */
function faltas(itens) {
  const c = consumo(itens), out = [];
  for (const [id, q] of Object.entries(c)) { const i = insumo(id); if (i && q > i.qtd + 1e-9) out.push(i); }
  return out;
}
const porcoesPossiveis = p => {
  let min = Infinity;
  for (const f of p.ficha) { const i = insumo(f.insumoId); if (!i) continue; const need = f.qtd / fator(i.unidade); if (need > 0) min = Math.min(min, Math.floor(i.qtd / need + 1e-9)); }
  return min === Infinity ? 999 : min;
};

function registrarEntrada(insumoId, qtd, custoUnit, fornecedor, nf) {
  const i = insumo(insumoId);
  const totalAntes = i.qtd > 0 ? i.qtd * i.custo : 0;
  const qtdBase = Math.max(i.qtd, 0);
  // custo médio ponderado
  i.custo = Math.round(((totalAntes + qtd * custoUnit) / (qtdBase + qtd)) * 10000) / 10000;
  i.qtd = round3(i.qtd + qtd);
  db.kardex.push({ id: uid(), data: new Date().toISOString(), insumoId, tipo: 'entrada', qtd, custoUnit, fornecedor, nf, saldo: i.qtd });
}
const round3 = v => Math.round(v * 1000) / 1000;

function statusConta(c) {
  if (c.pago) return ['Paga', 'b-ok'];
  const h = hojeISO();
  if (c.venc < h) return ['Vencida', 'b-bad'];
  if (c.venc === h) return ['Vence hoje', 'b-warn'];
  return ['A vencer', 'b-info'];
}
const saldoTitulo = t => round2(t.valor - (t.baixas || []).reduce((s, b) => s + b.valor, 0));
function statusTitulo(t) {
  const s = saldoTitulo(t);
  if (s <= 0.004) return ['Quitado', 'b-ok'];
  const h = hojeISO();
  const parcial = (t.baixas || []).length > 0 ? ' (parcial)' : '';
  if (t.venc < h) return ['Vencido' + parcial, 'b-bad'];
  if (t.venc === h) return ['Vence hoje' + parcial, 'b-warn'];
  return ['A receber' + parcial, 'b-info'];
}
function saldoCliente(nome) {
  const n = nome.trim().toLowerCase();
  return round2(db.receber.filter(t => t.origem !== 'Cartão de Crédito' && t.cliente.trim().toLowerCase() === n).reduce((s, t) => s + saldoTitulo(t), 0));
}

/* ---------- UI genérica ---------- */
function toast(msg, tipo = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + tipo; el.textContent = msg;
  const box = $('#toasts');
  if (box.lastChild && box.lastChild.textContent === msg) box.lastChild.remove();
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.remove(), 4200);
}
function abrirModal(titulo, corpoHTML, botoes = []) {
  $('#modalTitulo').textContent = titulo;
  $('#modalCorpo').innerHTML = corpoHTML;
  const rod = $('#modalRodape'); rod.innerHTML = '';
  for (const b of [{ label: 'Cancelar', cls: 'btn-ghost', fechar: true }, ...botoes]) {
    const btn = document.createElement('button');
    btn.className = 'btn ' + (b.cls || ''); btn.textContent = b.label;
    btn.onclick = () => { if (b.fechar) return fecharModal(); if (b.acao() !== false) fecharModal(); };
    rod.appendChild(btn);
  }
  $('#modalBg').hidden = false;
  const first = $('#modalCorpo input, #modalCorpo select'); if (first) first.focus();
}
function fecharModal() { $('#modalBg').hidden = true; }
function confirmar(titulo, texto, label, acao) {
  abrirModal(titulo, `<p>${esc(texto)}</p>`, [{ label, cls: 'btn-danger', acao }]);
}
function imprimir(html) {
  $('#printArea').innerHTML = html;
  setTimeout(() => window.print(), 50);
}
function baixarArquivo(nome, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const vazio = (cols, txt) => `<tr><td colspan="${cols}" class="empty">${txt}</td></tr>`;

/* ---------- navegação ---------- */
let abaAtual = 'dashboard';
function irPara(aba) {
  abaAtual = aba;
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === aba));
  $$('.panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + aba));
  renderAba();
  try { localStorage.setItem(STORAGE_KEY + '.aba', aba); } catch (e) { }
}
function renderAba() {
  ({ dashboard: renderDashboard, pdv: renderPdv, cozinha: renderCozinha, estoque: renderEstoque, cardapio: renderCardapio, pagar: renderPagar, receber: renderReceber, backup: renderBackup })[abaAtual]();
}
function aplicarTema() {
  document.documentElement.dataset.theme = db.config.tema;
  $('#btnTema').textContent = db.config.tema === 'dark' ? '☀️' : '🌙';
  $('#nomeRestaurante').textContent = db.config.nome;
  document.title = db.config.nome;
}

/* =========================================================
   1. DASHBOARD / DRE
   ========================================================= */
let periodo = 'hoje';
function noPeriodo(isoDia) {
  const h = hojeISO();
  if (periodo === 'hoje') return isoDia === h;
  if (periodo === '7d') return isoDia >= hojeISO(-6) && isoDia <= h;
  if (periodo === 'mes') return isoDia.slice(0, 7) === h.slice(0, 7);
  return true;
}
function renderDashboard() {
  const vendas = db.vendas.filter(v => noPeriodo(isoLocalDia(v.data)));
  const receita = vendas.reduce((s, v) => s + v.total, 0);
  const cmv = vendas.reduce((s, v) => s + v.custo, 0);
  const lucroBruto = receita - cmv;
  const cmvPct = receita > 0 ? cmv / receita * 100 : 0;
  const despesas = db.pagar.filter(c => c.pago && c.cat !== 'Insumos & Fornecedores' && noPeriodo(c.dataPag || c.venc));
  const totDesp = despesas.reduce((s, c) => s + c.valor, 0);
  const estoqueValor = db.insumos.reduce((s, i) => s + Math.max(i.qtd, 0) * i.custo, 0);
  const aPagar = db.pagar.filter(c => !c.pago).reduce((s, c) => s + c.valor, 0);
  const aReceber = db.receber.reduce((s, t) => s + Math.max(saldoTitulo(t), 0), 0);
  const ticket = vendas.length ? receita / vendas.length : 0;
  const meta = db.config.metaCmv;

  $('#kpis').innerHTML = [
    ['Faturamento bruto', brl(receita), `${vendas.length} pedido(s) · ticket médio ${brl(ticket)}`, ''],
    ['CMV real consumido', pct(cmvPct), `${brl(cmv)} · meta ${meta}%`, receita === 0 ? '' : cmvPct <= meta ? 'ok' : 'bad'],
    ['Lucro bruto', brl(lucroBruto), 'Receita menos custo dos insumos', lucroBruto >= 0 ? 'ok' : 'bad'],
    ['Capital em estoque', brl(estoqueValor), `${db.insumos.length} insumos cadastrados`, ''],
    ['Contas a pagar pendentes', brl(aPagar), `${db.pagar.filter(c => !c.pago).length} conta(s) em aberto`, aPagar > 0 ? 'warn' : ''],
    ['Contas a receber pendentes', brl(aReceber), `${db.receber.filter(t => saldoTitulo(t) > 0).length} título(s) em aberto`, ''],
  ].map(([t, v, s, c]) => `<div class="kpi ${c}"><span>${t}</span><strong>${v}</strong><small>${s}</small></div>`).join('');

  const liquido = lucroBruto - totDesp;
  $('#dre').innerHTML = `
    <tr><td>(+) Receita bruta de vendas</td><td class="num">${brl(receita)}</td></tr>
    <tr><td>(−) Custo dos insumos (CMV real pelas fichas)</td><td class="num">${brl(-cmv)}</td></tr>
    <tr class="total"><td>(=) Lucro bruto operacional</td><td class="num">${brl(lucroBruto)}</td></tr>
    <tr><td>(−) Despesas operacionais pagas (luz, gás, equipe...)</td><td class="num">${brl(-totDesp)}</td></tr>
    <tr class="total final"><td>(=) Lucro líquido real apurado</td><td class="num" style="color:var(${liquido >= 0 ? '--ok' : '--bad'})">${brl(liquido)}</td></tr>`;

  const alertas = [];
  const baixos = db.insumos.filter(i => i.qtd <= i.min);
  baixos.forEach(i => alertas.push(['warn', `📦 ${i.nome}: ${num(i.qtd, 3)} ${i.unidade} (mínimo ${num(i.min, 3)})`]));
  db.pagar.filter(c => !c.pago).forEach(c => { const [s] = statusConta(c); if (s !== 'A vencer') alertas.push([s === 'Vencida' ? 'bad' : 'warn', `💸 ${c.desc}: ${brl(c.valor)} — ${s.toLowerCase()} (${dataBR(c.venc)})`]); });
  db.receber.filter(t => saldoTitulo(t) > 0 && t.venc < hojeISO()).forEach(t => alertas.push(['bad', `💰 ${t.cliente} deve ${brl(saldoTitulo(t))} vencido em ${dataBR(t.venc)}`]));
  const atrasados = db.vendas.filter(v => ['novo', 'preparo'].includes(v.status) && minutosDesde(v.data) > MIN_ATRASO);
  if (atrasados.length) alertas.push(['bad', `👨‍🍳 ${atrasados.length} pedido(s) na cozinha há mais de ${MIN_ATRASO} min`]);
  $('#alertas').innerHTML = alertas.length ? alertas.map(([c, t]) => `<li class="${c}">${esc(t)}</li>`).join('') : '<li class="ok">Tudo em ordem por aqui ✅</li>';

  // Engenharia de cardápio
  const vendidos = {};
  for (const v of vendas) for (const it of v.itens) {
    const r = vendidos[it.pratoId] ||= { nome: it.nome, qtd: 0, receita: 0, custo: 0 };
    r.qtd += it.qtd; r.receita += it.preco * it.qtd; r.custo += it.custo * it.qtd;
  }
  const linhas = Object.values(vendidos);
  if (!linhas.length) { $('#tabEngenharia').innerHTML = vazio(1, 'Nenhuma venda no período. Faça um pedido na Frente de Caixa.'); return; }
  const mediaQtd = linhas.reduce((s, r) => s + r.qtd, 0) / linhas.length;
  const mediaMarg = linhas.reduce((s, r) => s + (r.receita - r.custo) / r.qtd, 0) / linhas.length;
  linhas.sort((a, b) => b.qtd - a.qtd);
  $('#tabEngenharia').innerHTML = `<tr><th>Item</th><th class="num">Qtd</th><th class="num">Receita</th><th class="num">Margem unit.</th><th class="num">CMV</th><th>Classificação</th></tr>` +
    linhas.map(r => {
      const mu = (r.receita - r.custo) / r.qtd, alta = r.qtd >= mediaQtd, boa = mu >= mediaMarg;
      const [cls, b] = alta && boa ? ['⭐ Estrela', 'b-ok'] : alta ? ['🐴 Cavalo de batalha', 'b-warn'] : boa ? ['🧩 Quebra-cabeça', 'b-info'] : ['🐶 Cachorro', 'b-bad'];
      return `<tr><td>${esc(r.nome)}</td><td class="num">${r.qtd}</td><td class="num">${brl(r.receita)}</td><td class="num">${brl(mu)}</td><td class="num">${pct(r.custo / r.receita * 100)}</td><td><span class="badge ${b}">${cls}</span></td></tr>`;
    }).join('');
}

/* =========================================================
   2. FRENTE DE CAIXA (PDV)
   ========================================================= */
const pdv = { cat: 'Todos', busca: '', canal: 'Balcão', forma: 'PIX', itens: [], mesa: '', taxa: true, pessoas: 1, cliente: '', endereco: '', telefone: '', recebido: '', venc: '' };

function renderPdv() {
  $('#chipsCategorias').innerHTML = ['Todos', ...CATEGORIAS].map(c => `<button class="chip ${pdv.cat === c ? 'active' : ''}" data-cat="${c}">${c}</button>`).join('');
  const termo = pdv.busca.trim().toLowerCase();
  const lista = db.cardapio.filter(p => p.ativo !== false && (pdv.cat === 'Todos' || p.cat === pdv.cat) && (!termo || (p.nome + ' ' + p.desc).toLowerCase().includes(termo)));
  $('#menuGrid').innerHTML = lista.length ? lista.map(p => {
    const n = porcoesPossiveis(p);
    const tag = n <= 0 ? '<span class="badge b-bad">Sem insumo</span>' : n <= 5 ? `<span class="badge b-warn">Restam ${n}</span>` : '';
    return `<button class="item ${n <= 0 ? 'sem-estoque' : ''}" data-add="${p.id}"><b>${esc(p.nome)}</b><small>${esc(p.desc)}</small><span class="price">${brl(p.preco)}</span>${tag}</button>`;
  }).join('') : '<p class="hint">Nenhum item encontrado.</p>';
  renderCarrinho();
}
function totaisPdv() {
  const subtotal = round2(pdv.itens.reduce((s, it) => s + it.preco * it.qtd, 0));
  const taxa = pdv.canal === 'Mesa' && pdv.taxa ? round2(subtotal * 0.10) : 0;
  return { subtotal, taxa, total: round2(subtotal + taxa) };
}
function renderCarrinho() {
  $$('#canalVenda button').forEach(b => b.classList.toggle('active', b.dataset.c === pdv.canal));
  $$('#formasPagamento button').forEach(b => b.classList.toggle('active', b.dataset.f === pdv.forma));

  let campos = '';
  if (pdv.canal === 'Mesa') campos = `
    <label>Nº da mesa<input data-pdv="mesa" value="${esc(pdv.mesa)}" inputmode="numeric"></label>
    <label>Pessoas (dividir)<input data-pdv="pessoas" type="number" min="1" value="${pdv.pessoas}"></label>
    <label class="check"><input type="checkbox" data-pdv="taxa" ${pdv.taxa ? 'checked' : ''}> Taxa de serviço 10%</label>`;
  if (pdv.canal === 'Delivery') campos = `
    <label>Cliente<input data-pdv="cliente" value="${esc(pdv.cliente)}"></label>
    <label>Telefone / WhatsApp<input data-pdv="telefone" value="${esc(pdv.telefone)}"></label>
    <label style="grid-column:1/-1">Endereço<input data-pdv="endereco" value="${esc(pdv.endereco)}"></label>`;
  $('#camposCanal').innerHTML = campos;

  $('#carrinho').innerHTML = pdv.itens.length ? pdv.itens.map((it, i) => `
    <li><span>${esc(it.nome)}<br><small class="hint">${brl(it.preco)} un.</small></span>
      <span class="qty"><button data-dec="${i}">−</button><b>${it.qtd}</b><button data-inc="${i}">+</button></span>
      <b>${brl(it.preco * it.qtd)}</b></li>`).join('') : '<li class="hint">Toque nos itens do cardápio para adicionar.</li>';

  const t = totaisPdv();
  let tot = `<div><span>Subtotal</span><span>${brl(t.subtotal)}</span></div>`;
  if (t.taxa) tot += `<div><span>Taxa de serviço (10%)</span><span>${brl(t.taxa)}</span></div>`;
  tot += `<div class="grand"><span>Total</span><span>${brl(t.total)}</span></div>`;
  if (pdv.canal === 'Mesa' && pdv.pessoas > 1) tot += `<div><span>Por pessoa (${pdv.pessoas})</span><span>${brl(t.total / pdv.pessoas)}</span></div>`;
  $('#totais').innerHTML = tot;

  let pag = '';
  if (pdv.forma === 'Dinheiro') {
    const troco = parseNum(pdv.recebido) - t.total;
    pag = `<label>Valor recebido<input data-pdv="recebido" inputmode="decimal" value="${esc(pdv.recebido)}" placeholder="0,00"></label>
      <span class="troco" id="troco">${pdv.recebido ? (troco >= 0 ? 'Troco: ' + brl(troco) : 'Faltam ' + brl(-troco)) : ''}</span>`;
  } else if (pdv.forma === 'Fiado') {
    pag = `${pdv.canal === 'Delivery' ? '' : `<label>Cliente (obrigatório)<input data-pdv="cliente" list="listaClientes" value="${esc(pdv.cliente)}"></label>`}
      <label>Vencimento<input data-pdv="venc" type="date" value="${pdv.venc || hojeISO(db.config.prazoFiado)}"></label>
      <datalist id="listaClientes">${[...new Set(db.receber.filter(r => r.origem !== 'Cartão de Crédito').map(r => r.cliente))].map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <span class="hint" id="saldoFiado" style="grid-column:1/-1"></span>`;
  } else if (pdv.forma === 'Crédito') {
    pag = `<span class="hint" style="grid-column:1/-1">Gera um título a receber da maquininha com compensação em D+30 (${dataBR(hojeISO(30))}).</span>`;
  }
  $('#camposPagamento').innerHTML = pag;
  atualizarSaldoFiado();
  $('#btnFinalizar').disabled = !pdv.itens.length;
}
function atualizarSaldoFiado() {
  const el = $('#saldoFiado'); if (!el) return;
  const saldo = pdv.cliente.trim() ? saldoCliente(pdv.cliente) : 0;
  el.innerHTML = saldo > 0 ? `Saldo devedor atual de ${esc(pdv.cliente)}: <b>${brl(saldo)}</b> (teto ${brl(db.config.tetoFiado)})` : '';
}
function addItem(pratoId) {
  const p = prato(pratoId);
  const futuro = pdv.itens.map(it => ({ pratoId: it.pratoId, qtd: it.qtd + (it.pratoId === pratoId ? 1 : 0) }));
  if (!futuro.some(it => it.pratoId === pratoId)) futuro.push({ pratoId, qtd: 1 });
  const f = faltas(futuro);
  if (f.length) { toast(`Não dá para fazer ${p.nome}: falta ${f.map(i => i.nome).join(', ')} no estoque.`, 'bad'); return; }
  const it = pdv.itens.find(i => i.pratoId === pratoId);
  if (it) it.qtd++; else pdv.itens.push({ pratoId, nome: p.nome, preco: p.preco, qtd: 1 });
  renderCarrinho();
}
function limparPdv() {
  Object.assign(pdv, { itens: [], mesa: '', taxa: true, pessoas: 1, cliente: '', endereco: '', telefone: '', recebido: '', venc: '' });
  renderPdv();
}
function finalizarPedido() {
  if (!pdv.itens.length) return;
  const t = totaisPdv();
  const f = faltas(pdv.itens);
  if (f.length) return toast('Estoque insuficiente: ' + f.map(i => i.nome).join(', '), 'bad');
  if (pdv.canal === 'Mesa' && !pdv.mesa.trim()) return toast('Informe o número da mesa.', 'bad');
  if (pdv.canal === 'Delivery' && (!pdv.cliente.trim() || !pdv.endereco.trim())) return toast('Delivery precisa de nome e endereço do cliente.', 'bad');
  if (pdv.forma === 'Fiado' && !pdv.cliente.trim()) return toast('Fiado exige o nome do cliente.', 'bad');
  if (pdv.forma === 'Dinheiro' && pdv.recebido && parseNum(pdv.recebido) < t.total) return toast('Valor recebido menor que o total.', 'bad');
  if (pdv.forma === 'Fiado') {
    const novoSaldo = saldoCliente(pdv.cliente) + t.total;
    if (db.config.tetoFiado > 0 && novoSaldo > db.config.tetoFiado) {
      return confirmar('Teto de fiado ultrapassado', `${pdv.cliente} ficaria devendo ${brl(novoSaldo)}, acima do teto de ${brl(db.config.tetoFiado)}. Vender mesmo assim?`, 'Vender mesmo assim', () => { gravarVenda(); });
    }
  }
  gravarVenda();
}
function gravarVenda() {
  const t = totaisPdv();
  const agora = new Date().toISOString();
  const num = db.seqPedido++;
  const itens = pdv.itens.map(it => { const p = prato(it.pratoId); return { pratoId: it.pratoId, nome: it.nome, preco: it.preco, qtd: it.qtd, custo: custoPrato(p) }; });
  const custo = round2(itens.reduce((s, it) => s + it.custo * it.qtd, 0));
  const venda = {
    id: uid(), num, data: agora, canal: pdv.canal, mesa: pdv.mesa, pessoas: pdv.pessoas,
    cliente: pdv.cliente.trim(), endereco: pdv.endereco.trim(), telefone: pdv.telefone.trim(),
    itens, subtotal: t.subtotal, taxa: t.taxa, total: t.total, custo, pagamento: pdv.forma,
    recebido: pdv.forma === 'Dinheiro' ? (parseNum(pdv.recebido) || t.total) : null, status: 'novo',
  };
  // Baixa de estoque por insumo real
  for (const [id, q] of Object.entries(consumo(itens))) {
    const i = insumo(id); i.qtd = round3(i.qtd - q);
    db.kardex.push({ id: uid(), data: agora, insumoId: id, tipo: 'venda', qtd: -round3(q), custoUnit: i.custo, ref: `Pedido #${num}`, vendaId: venda.id, saldo: i.qtd });
  }
  // Automação financeira
  if (pdv.forma === 'Fiado') db.receber.push({ id: uid(), cliente: venda.cliente, desc: `Pedido #${num}`, origem: 'Fiado', valor: t.total, venc: pdv.venc || hojeISO(db.config.prazoFiado), emissao: hojeISO(), baixas: [], vendaId: venda.id });
  if (pdv.forma === 'Crédito') db.receber.push({ id: uid(), cliente: 'Maquininha (crédito)', desc: `Pedido #${num}`, origem: 'Cartão de Crédito', valor: t.total, venc: hojeISO(30), emissao: hojeISO(), baixas: [], vendaId: venda.id });
  db.vendas.push(venda);
  salvar();
  const troco = venda.recebido ? venda.recebido - venda.total : 0;
  toast(`Pedido #${num} finalizado: ${brl(venda.total)}${troco > 0 ? ' · troco ' + brl(troco) : ''}`, 'ok');
  abrirModal(`Pedido #${num} enviado para a cozinha`, `<pre>${esc(textoCupom(venda))}</pre>`, [{ label: '🖨️ Imprimir cupom', cls: 'btn-primary', acao: () => imprimirCupom(venda.id) }]);
  limparPdv();
}

function textoCupom(v) {
  const W = 40, linha = '-'.repeat(W);
  const centro = s => { s = String(s).slice(0, W); return ' '.repeat(Math.max(0, Math.floor((W - s.length) / 2))) + s; };
  const lr = (a, b) => { a = String(a); b = String(b); return a.slice(0, W - b.length - 1).padEnd(W - b.length) + b; };
  const r = s => brl(s).replace(/ /g, ' ');
  const out = [centro(db.config.nome.toUpperCase()), centro('CUPOM NÃO FISCAL'), linha,
    `Pedido: #${v.num}   ${dataHoraBR(v.data)}`, `Canal: ${v.canal}${v.mesa ? ' - Mesa ' + v.mesa : ''}`];
  if (v.cliente) out.push(`Cliente: ${v.cliente}`);
  if (v.telefone) out.push(`Fone: ${v.telefone}`);
  if (v.endereco) out.push(`End.: ${v.endereco}`);
  out.push(linha);
  for (const it of v.itens) { out.push(it.nome.slice(0, W)); out.push(lr(`  ${it.qtd} x ${r(it.preco)}`, r(it.qtd * it.preco))); }
  out.push(linha, lr('Subtotal', r(v.subtotal)));
  if (v.taxa) out.push(lr('Taxa de serviço 10%', r(v.taxa)));
  out.push(lr('TOTAL', r(v.total)));
  if (v.pessoas > 1) out.push(lr(`Por pessoa (${v.pessoas})`, r(v.total / v.pessoas)));
  out.push(lr('Pagamento', v.pagamento));
  if (v.recebido) { out.push(lr('Recebido', r(v.recebido))); out.push(lr('Troco', r(v.recebido - v.total))); }
  if (v.pagamento === 'Fiado') { const t = db.receber.find(x => x.vendaId === v.id); if (t) out.push(lr('Vencimento', dataBR(t.venc))); }
  out.push(linha, centro('Obrigado e volte sempre!'));
  return out.join('\n');
}
function imprimirCupom(vendaId) {
  const v = db.vendas.find(x => x.id === vendaId);
  if (v) imprimir(`<pre class="cupom">${esc(textoCupom(v))}</pre>`);
  return true;
}

/* =========================================================
   3. COZINHA / KDS
   ========================================================= */
const minutosDesde = iso => Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
function renderCozinha() {
  const cols = { novo: [], preparo: [], pronto: [] };
  db.vendas.filter(v => cols[v.status]).sort((a, b) => a.data.localeCompare(b.data)).forEach(v => cols[v.status].push(v));
  const prox = { novo: ['preparo', '🔥 Iniciar preparo'], preparo: ['pronto', '✅ Pronto'], pronto: ['entregue', '🛵 Entregue'] };
  const card = v => {
    const m = minutosDesde(v.data), late = v.status !== 'pronto' && m > MIN_ATRASO;
    const onde = v.canal === 'Mesa' ? `Mesa ${esc(v.mesa)}` : v.canal === 'Delivery' ? `Delivery · ${esc(v.cliente)}` : 'Balcão' + (v.cliente ? ' · ' + esc(v.cliente) : '');
    return `<div class="ticket ${late ? 'late' : ''}">
      <div class="ticket-head"><span>#${v.num} · ${onde}</span><span class="timer">⏱ ${m} min</span></div>
      <ul>${v.itens.map(it => `<li><b>${it.qtd}×</b> ${esc(it.nome)}</li>`).join('')}</ul>
      <div class="meta">${horaBR(v.data)} · ${esc(v.pagamento)}</div>
      <div class="btn-row"><button class="btn btn-primary btn-sm" data-status="${v.id}" data-to="${prox[v.status][0]}">${prox[v.status][1]}</button>
      <button class="btn btn-sm" data-cupom="${v.id}">🖨️ Cupom</button></div></div>`;
  };
  for (const [k, ids] of [['novo', ['kNovo', 'cNovo']], ['preparo', ['kPreparo', 'cPreparo']], ['pronto', ['kPronto', 'cPronto']]]) {
    $('#' + ids[0]).innerHTML = cols[k].map(card).join('') || '<p class="hint">Nada aqui.</p>';
    $('#' + ids[1]).textContent = cols[k].length;
  }
  const hist = [...db.vendas].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 100);
  const nomeStatus = { novo: ['Novo', 'b-info'], preparo: ['Em preparo', 'b-warn'], pronto: ['Pronto', 'b-ok'], entregue: ['Entregue', 'b-muted'] };
  $('#tabHistorico').innerHTML = `<tr><th>#</th><th>Data</th><th>Canal</th><th>Itens</th><th>Pagamento</th><th class="num">Total</th><th>Status</th><th></th></tr>` +
    (hist.length ? hist.map(v => `<tr><td>${v.num}</td><td>${dataHoraBR(v.data)}</td><td>${esc(v.canal)}${v.mesa ? ' ' + esc(v.mesa) : ''}</td>
      <td>${v.itens.map(i => `${i.qtd}× ${esc(i.nome)}`).join(', ')}</td><td>${esc(v.pagamento)}</td><td class="num">${brl(v.total)}</td>
      <td><span class="badge ${nomeStatus[v.status][1]}">${nomeStatus[v.status][0]}</span></td>
      <td><button class="btn btn-sm" data-cupom="${v.id}">2ª via</button></td></tr>`).join('') : vazio(8, 'Nenhum pedido ainda.'));
}

/* =========================================================
   4. ESTOQUE
   ========================================================= */
function renderEstoque() {
  $('#tabInsumos').innerHTML = `<tr><th>Insumo</th><th class="num">Estoque</th><th class="num">Mínimo</th><th class="num">Custo médio</th><th class="num">Valor em estoque</th><th>Status</th><th></th></tr>` +
    (db.insumos.length ? [...db.insumos].sort((a, b) => a.nome.localeCompare(b.nome)).map(i => {
      const st = i.qtd <= 0 ? ['Zerado', 'b-bad', 'row-bad'] : i.qtd <= i.min ? ['Abaixo do mínimo', 'b-warn', 'row-warn'] : ['OK', 'b-ok', ''];
      return `<tr class="${st[2]}"><td>${esc(i.nome)}</td><td class="num">${num(i.qtd, 3)} ${i.unidade}</td><td class="num">${num(i.min, 3)} ${i.unidade}</td>
      <td class="num">${brl(i.custo)}/${i.unidade}</td><td class="num">${brl(Math.max(i.qtd, 0) * i.custo)}</td><td><span class="badge ${st[1]}">${st[0]}</span></td>
      <td class="num"><div class="btn-row" style="justify-content:flex-end"><button class="btn btn-sm btn-primary" data-entrada="${i.id}">+ Compra</button><button class="btn btn-sm" data-perda="${i.id}">− Saída</button><button class="btn btn-sm btn-ghost" data-edit-insumo="${i.id}">✏️</button></div></td></tr>`;
    }).join('') : vazio(7, 'Nenhum insumo cadastrado.'));
  renderKardex();
}
function renderKardex() {
  const f = $('#filtroKardex').value;
  const lista = db.kardex.filter(k => !f || k.tipo === f).slice(-200).reverse();
  const tipos = { entrada: ['Entrada', 'b-ok'], venda: ['Saída por venda', 'b-info'], perda: ['Saída manual', 'b-bad'] };
  $('#tabKardex').innerHTML = `<tr><th>Data</th><th>Insumo</th><th>Tipo</th><th class="num">Qtd</th><th class="num">Custo unit.</th><th class="num">Saldo</th><th>Detalhe</th></tr>` +
    (lista.length ? lista.map(k => { const i = insumo(k.insumoId) || { nome: '(excluído)', unidade: '' };
      const det = k.tipo === 'entrada' ? [k.fornecedor && 'Fornecedor: ' + k.fornecedor, k.nf && 'NF ' + k.nf].filter(Boolean).join(' · ') : k.tipo === 'venda' ? k.ref : k.motivo;
      return `<tr><td>${dataHoraBR(k.data)}</td><td>${esc(i.nome)}</td><td><span class="badge ${tipos[k.tipo][1]}">${tipos[k.tipo][0]}</span></td>
      <td class="num">${k.qtd > 0 ? '+' : ''}${num(k.qtd, 3)} ${i.unidade}</td><td class="num">${brl(k.custoUnit)}</td><td class="num">${k.saldo !== undefined ? num(k.saldo, 3) : '—'}</td><td>${esc(det || '')}</td></tr>`; }).join('') : vazio(7, 'Nenhuma movimentação.'));
}
function modalInsumo(id) {
  const i = id ? insumo(id) : { nome: '', unidade: 'kg', qtd: 0, min: 0, custo: 0 };
  abrirModal(id ? 'Editar insumo' : 'Novo insumo', `
    <label>Nome<input id="fNome" value="${esc(i.nome)}"></label>
    <div class="form-grid">
      <label>Unidade<select id="fUn">${UNIDADES.map(u => `<option ${u === i.unidade ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
      ${id ? '' : `<label>Estoque inicial<input id="fQtd" type="number" step="0.001" min="0" value="0"></label>`}
      <label>Estoque mínimo<input id="fMin" type="number" step="0.001" min="0" value="${i.min}"></label>
      <label>Custo por unidade (R$)<input id="fCusto" type="number" step="0.01" min="0" value="${i.custo}"></label>
    </div>${id ? '<p class="hint">Para mudar a quantidade use “+ Compra” ou “− Saída”, assim o Kardex fica correto.</p>' : ''}`,
    [...(id ? [{ label: 'Excluir', cls: 'btn-danger', acao: () => {
      if (db.cardapio.some(p => p.ficha.some(f => f.insumoId === id))) { toast('Este insumo é usado em fichas técnicas. Remova das fichas antes.', 'bad'); return false; }
      db.insumos = db.insumos.filter(x => x.id !== id); salvar(); renderAba(); toast('Insumo excluído.');
    } }] : []),
    { label: 'Salvar', cls: 'btn-primary', acao: () => {
      const nome = $('#fNome').value.trim(); if (!nome) { toast('Informe o nome.', 'bad'); return false; }
      const dados = { nome, unidade: $('#fUn').value, min: parseNum($('#fMin').value), custo: parseNum($('#fCusto').value) };
      if (id) Object.assign(i, dados);
      else {
        const novo = { id: uid(), ...dados, qtd: 0 }; db.insumos.push(novo);
        const q = parseNum($('#fQtd').value);
        if (q > 0) { novo.qtd = q; db.kardex.push({ id: uid(), data: new Date().toISOString(), insumoId: novo.id, tipo: 'entrada', qtd: q, custoUnit: novo.custo, fornecedor: 'Estoque inicial', nf: '', saldo: q }); }
      }
      salvar(); renderAba(); toast('Insumo salvo.', 'ok');
    } }]);
}
function modalEntrada(id) {
  const i = insumo(id);
  abrirModal(`Entrada (compra): ${i.nome}`, `
    <div class="form-grid">
      <label>Quantidade (${i.unidade})<input id="eQtd" type="number" step="0.001" min="0"></label>
      <label>Valor total da compra (R$)<input id="eTotal" type="number" step="0.01" min="0"></label>
      <label>Fornecedor<input id="eForn"></label>
      <label>Nº da NF<input id="eNf"></label>
    </div>
    <p class="hint" id="eInfo">Custo médio atual: ${brl(i.custo)}/${i.unidade}</p>
    <label class="check"><input type="checkbox" id="eGerar" checked> Gerar conta a pagar para esta compra</label>
    <div class="form-grid"><label>Vencimento<input id="eVenc" type="date" value="${hojeISO(7)}"></label>
    <label class="check"><input type="checkbox" id="ePaga"> Já foi paga (à vista)</label></div>`,
    [{ label: 'Registrar entrada', cls: 'btn-primary', acao: () => {
      const q = parseNum($('#eQtd').value), tot = parseNum($('#eTotal').value);
      if (q <= 0 || tot <= 0) { toast('Informe quantidade e valor.', 'bad'); return false; }
      const forn = $('#eForn').value.trim(), nf = $('#eNf').value.trim();
      registrarEntrada(id, q, tot / q, forn, nf);
      if ($('#eGerar').checked) {
        const paga = $('#ePaga').checked;
        db.pagar.push({ id: uid(), desc: `Compra ${i.nome}${nf ? ' NF ' + nf : ''}`, cat: 'Insumos & Fornecedores', fornecedor: forn, valor: round2(tot), venc: paga ? hojeISO() : $('#eVenc').value || hojeISO(), pago: paga, dataPag: paga ? hojeISO() : undefined });
      }
      salvar(); renderAba(); toast(`Entrada registrada. Novo custo médio: ${brl(i.custo)}/${i.unidade}`, 'ok');
    } }]);
  const atualiza = () => { const q = parseNum($('#eQtd').value), t = parseNum($('#eTotal').value);
    if (q > 0 && t > 0) { const novo = ((Math.max(i.qtd, 0) * i.custo) + t) / (Math.max(i.qtd, 0) + q);
      $('#eInfo').textContent = `Custo desta compra: ${brl(t / q)}/${i.unidade} · custo médio passa de ${brl(i.custo)} para ${brl(novo)}`; } };
  $('#eQtd').oninput = $('#eTotal').oninput = atualiza;
}
function modalPerda(id) {
  const i = insumo(id);
  abrirModal(`Saída manual: ${i.nome}`, `
    <div class="form-grid">
      <label>Quantidade (${i.unidade})<input id="pQtd" type="number" step="0.001" min="0"></label>
      <label>Motivo<select id="pMotivo"><option>Desperdício</option><option>Vencimento / validade</option><option>Quebra / avaria</option><option>Consumo da equipe</option><option>Ajuste de inventário</option></select></label>
    </div><label>Observação<input id="pObs"></label><p class="hint">Disponível: ${num(i.qtd, 3)} ${i.unidade}</p>`,
    [{ label: 'Registrar saída', cls: 'btn-danger', acao: () => {
      const q = parseNum($('#pQtd').value); if (q <= 0) { toast('Informe a quantidade.', 'bad'); return false; }
      i.qtd = round3(i.qtd - q);
      const obs = $('#pObs').value.trim();
      db.kardex.push({ id: uid(), data: new Date().toISOString(), insumoId: id, tipo: 'perda', qtd: -q, custoUnit: i.custo, motivo: $('#pMotivo').value + (obs ? ' — ' + obs : ''), saldo: i.qtd });
      salvar(); renderAba(); toast(`Saída registrada (${brl(q * i.custo)} de perda).`);
    } }]);
}
function listaCompras() {
  const itens = db.insumos.filter(i => i.qtd <= i.min).map(i => ({ ...i, sugestao: round3(Math.max(i.min * 2 - i.qtd, i.min)) }));
  if (!itens.length) return toast('Nenhum insumo abaixo do mínimo. Estoque abastecido! ✅', 'ok');
  const total = itens.reduce((s, i) => s + i.sugestao * i.custo, 0);
  const linhas = itens.map(i => `<tr><td>${esc(i.nome)}</td><td class="num">${num(i.qtd, 3)} ${i.unidade}</td><td class="num"><b>${num(i.sugestao, 3)} ${i.unidade}</b></td><td class="num">${brl(i.sugestao * i.custo)}</td></tr>`).join('');
  const tabela = `<table><tr><th>Insumo</th><th class="num">Atual</th><th class="num">Comprar</th><th class="num">Estimativa</th></tr>${linhas}<tr><td colspan="3"><b>Total estimado</b></td><td class="num"><b>${brl(total)}</b></td></tr></table>`;
  abrirModal('🛒 Lista de compras sugerida', tabela + '<p class="hint">Sugestão: repor até o dobro do estoque mínimo.</p>', [{ label: '🖨️ Imprimir', cls: 'btn-primary', acao: () => { imprimir(`<h2>Lista de compras — ${esc(db.config.nome)}</h2><p>${dataBR(hojeISO())}</p>${tabela}`); } }]);
}

/* =========================================================
   5. CARDÁPIO & FICHA TÉCNICA
   ========================================================= */
function renderCardapio() {
  $('#metaCmv').value = db.config.metaCmv;
  const meta = db.config.metaCmv;
  const ord = [...db.cardapio].sort((a, b) => CATEGORIAS.indexOf(a.cat) - CATEGORIAS.indexOf(b.cat) || a.nome.localeCompare(b.nome));
  $('#tabCardapio').innerHTML = `<tr><th>Item</th><th>Categoria</th><th>Ficha técnica</th><th class="num">Custo insumos</th><th class="num">Preço venda</th><th class="num">Margem bruta</th><th class="num">CMV</th><th></th></tr>` +
    (ord.length ? ord.map(p => {
      const c = custoPrato(p), cmv = cmvPrato(p);
      const ficha = p.ficha.map(f => { const i = insumo(f.insumoId); return i ? `${num(f.qtd, 3)}${subun(i.unidade)} ${esc(i.nome)}` : ''; }).filter(Boolean).join(' + ');
      return `<tr><td><b>${esc(p.nome)}</b>${p.ativo === false ? ' <span class="badge b-muted">Inativo</span>' : ''}<br><small class="hint">${esc(p.desc)}</small></td><td>${esc(p.cat)}</td>
        <td><small>${ficha || '<span class="badge b-warn">Sem ficha</span>'}</small></td><td class="num">${brl(c)}</td><td class="num">${brl(p.preco)}</td><td class="num">${brl(p.preco - c)}</td>
        <td class="num"><span class="badge ${cmv <= meta ? 'b-ok' : 'b-bad'}">${pct(cmv)}</span></td><td><button class="btn btn-sm" data-edit-prato="${p.id}">✏️ Editar</button></td></tr>`;
    }).join('') : vazio(8, 'Cardápio vazio.'));
}
function modalPrato(id) {
  const orig = id ? prato(id) : { nome: '', cat: 'Marmitex', desc: '', preco: 0, ativo: true, ficha: [] };
  const rasc = JSON.parse(JSON.stringify(orig));
  const opcoes = sel => db.insumos.map(i => `<option value="${i.id}" ${i.id === sel ? 'selected' : ''}>${esc(i.nome)} (${i.unidade})</option>`).join('');
  const linhaFicha = (f, k) => { const i = insumo(f.insumoId);
    return `<div class="ficha-row"><select data-fi="${k}">${opcoes(f.insumoId)}</select><input type="number" step="0.001" min="0" data-fq="${k}" value="${f.qtd}"><span class="hint">${i ? subun(i.unidade) : ''}</span><button class="btn btn-sm btn-ghost" data-frm="${k}">✕</button></div>`; };
  const corpo = () => `
    <div class="form-grid">
      <label style="grid-column:1/-1">Nome<input id="cNome" value="${esc(rasc.nome)}"></label>
      <label>Categoria<select id="cCat">${CATEGORIAS.map(c => `<option ${c === rasc.cat ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <label>Preço de venda (R$)<input id="cPreco" type="number" step="0.01" min="0" value="${rasc.preco}"></label>
      <label style="grid-column:1/-1">Descrição<input id="cDesc" value="${esc(rasc.desc)}"></label>
      <label class="check"><input type="checkbox" id="cAtivo" ${rasc.ativo !== false ? 'checked' : ''}> Ativo no PDV</label>
    </div>
    <h3 style="margin:.3rem 0 0">Ficha técnica</h3><p class="hint" style="margin:0">Insumos em kg são informados em gramas e em L em mililitros.</p>
    <div id="fichaLinhas">${rasc.ficha.map(linhaFicha).join('')}</div>
    <button class="btn btn-sm" id="fAdd">+ Adicionar insumo</button>
    <div class="ficha-resumo" id="fichaResumo"></div>`;
  const resumo = () => {
    rasc.preco = parseNum($('#cPreco').value);
    const c = custoPrato(rasc), cmv = rasc.preco > 0 ? c / rasc.preco * 100 : 0;
    $('#fichaResumo').innerHTML = `<div><span>Custo unitário</span><b>${brl(c)}</b></div><div><span>Preço de venda</span><b>${brl(rasc.preco)}</b></div>
      <div><span>Margem bruta</span><b>${brl(rasc.preco - c)}</b></div><div><span>CMV (meta ${db.config.metaCmv}%)</span><b style="color:var(${cmv <= db.config.metaCmv ? '--ok' : '--bad'})">${pct(cmv)}</b></div>`;
  };
  const capturar = () => { rasc.nome = $('#cNome').value; rasc.cat = $('#cCat').value; rasc.desc = $('#cDesc').value; rasc.ativo = $('#cAtivo').checked; rasc.preco = parseNum($('#cPreco').value); };
  const montar = () => {
    $('#modalCorpo').innerHTML = corpo(); resumo();
    $('#cPreco').oninput = resumo;
    $$('[data-fi]').forEach(s => s.onchange = () => { capturar(); rasc.ficha[s.dataset.fi].insumoId = s.value; montar(); });
    $$('[data-fq]').forEach(s => s.oninput = () => { rasc.ficha[s.dataset.fq].qtd = parseNum(s.value); resumo(); });
    $$('[data-frm]').forEach(b => b.onclick = () => { capturar(); rasc.ficha.splice(+b.dataset.frm, 1); montar(); });
    $('#fAdd').onclick = () => { if (!db.insumos.length) return toast('Cadastre insumos no Estoque primeiro.', 'bad'); capturar(); rasc.ficha.push({ insumoId: db.insumos[0].id, qtd: 0 }); montar(); };
  };
  abrirModal(id ? 'Editar item do cardápio' : 'Novo item do cardápio', '', [
    ...(id ? [{ label: 'Excluir', cls: 'btn-danger', acao: () => { db.cardapio = db.cardapio.filter(p => p.id !== id); salvar(); renderAba(); toast('Item removido do cardápio.'); } }] : []),
    { label: 'Salvar', cls: 'btn-primary', acao: () => {
      capturar();
      if (!rasc.nome.trim()) { toast('Informe o nome do item.', 'bad'); return false; }
      if (rasc.preco <= 0) { toast('Informe o preço de venda.', 'bad'); return false; }
      rasc.ficha = rasc.ficha.filter(f => f.qtd > 0);
      if (id) Object.assign(orig, rasc); else db.cardapio.push({ ...rasc, id: uid() });
      salvar(); renderAba(); toast('Cardápio atualizado.', 'ok');
    } }]);
  montar();
}

/* =========================================================
   6. CONTAS A PAGAR
   ========================================================= */
function renderPagar() {
  const f = $('#filtroPagar').value, h = hojeISO();
  const abertas = db.pagar.filter(c => !c.pago);
  const soma = l => l.reduce((s, c) => s + c.valor, 0);
  $('#resumoPagar').innerHTML = [
    ['Vencidas', soma(abertas.filter(c => c.venc < h)), 'bad'],
    ['Vencendo hoje', soma(abertas.filter(c => c.venc === h)), 'warn'],
    ['A vencer', soma(abertas.filter(c => c.venc > h)), ''],
    ['Pagas no mês', soma(db.pagar.filter(c => c.pago && (c.dataPag || '').slice(0, 7) === h.slice(0, 7))), 'ok'],
  ].map(([t, v, c]) => `<div class="kpi ${c}"><span>${t}</span><strong>${brl(v)}</strong></div>`).join('');
  const lista = db.pagar.filter(c => f === 'todas' || (f === 'pagas' ? c.pago : !c.pago)).sort((a, b) => a.venc.localeCompare(b.venc));
  $('#tabPagar').innerHTML = `<tr><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th>Fornecedor</th><th class="num">Valor</th><th>Status</th><th></th></tr>` +
    (lista.length ? lista.map(c => { const [s, b] = statusConta(c);
      return `<tr class="${s === 'Vencida' ? 'row-bad' : s === 'Vence hoje' ? 'row-warn' : ''}"><td>${dataBR(c.venc)}</td><td>${esc(c.desc)}</td><td>${esc(c.cat)}</td><td>${esc(c.fornecedor || '')}</td>
      <td class="num">${brl(c.valor)}</td><td><span class="badge ${b}">${s}</span>${c.pago ? `<br><small class="hint">em ${dataBR(c.dataPag)}</small>` : ''}</td>
      <td class="num"><div class="btn-row" style="justify-content:flex-end">${c.pago ? `<button class="btn btn-sm" data-estornar="${c.id}">Estornar</button>` : `<button class="btn btn-sm btn-primary" data-pagar="${c.id}">Dar baixa</button>`}<button class="btn btn-sm btn-ghost" data-del-pagar="${c.id}">🗑️</button></div></td></tr>`; }).join('') : vazio(7, 'Nenhuma conta neste filtro.'));
}
function modalConta() {
  abrirModal('Nova conta a pagar', `
    <label>Descrição<input id="pDesc"></label>
    <div class="form-grid">
      <label>Categoria<select id="pCat">${CATS_PAGAR.map(c => `<option>${c}</option>`).join('')}</select></label>
      <label>Fornecedor<input id="pForn"></label>
      <label>Valor (R$)<input id="pValor" type="number" step="0.01" min="0"></label>
      <label>Vencimento<input id="pVenc" type="date" value="${hojeISO()}"></label>
      <label>Repetir (meses)<input id="pRep" type="number" min="1" max="24" value="1"></label>
    </div>`, [{ label: 'Salvar', cls: 'btn-primary', acao: () => {
      const desc = $('#pDesc').value.trim(), valor = parseNum($('#pValor').value), venc = $('#pVenc').value;
      if (!desc || valor <= 0 || !venc) { toast('Preencha descrição, valor e vencimento.', 'bad'); return false; }
      const rep = Math.max(1, Math.min(24, parseInt($('#pRep').value) || 1));
      for (let k = 0; k < rep; k++) {
        const d = new Date(venc + 'T12:00:00'); d.setMonth(d.getMonth() + k);
        db.pagar.push({ id: uid(), desc: rep > 1 ? `${desc} (${k + 1}/${rep})` : desc, cat: $('#pCat').value, fornecedor: $('#pForn').value.trim(), valor: round2(valor), venc: d.toISOString().slice(0, 10), pago: false });
      }
      salvar(); renderAba(); toast('Conta lançada.', 'ok');
    } }]);
}
function modalBaixaPagar(id) {
  const c = db.pagar.find(x => x.id === id);
  abrirModal('Dar baixa na conta', `<p><b>${esc(c.desc)}</b> — ${brl(c.valor)}</p><label>Data do pagamento<input id="bData" type="date" value="${hojeISO()}"></label>`,
    [{ label: 'Confirmar pagamento', cls: 'btn-primary', acao: () => { c.pago = true; c.dataPag = $('#bData').value || hojeISO(); salvar(); renderAba(); toast('Conta quitada.', 'ok'); } }]);
}

/* =========================================================
   7. CONTAS A RECEBER / FIADO
   ========================================================= */
function renderReceber() {
  const f = $('#filtroReceber').value;
  // saldos por cliente (fiado e convênios)
  const clientes = {};
  db.receber.filter(t => t.origem !== 'Cartão de Crédito').forEach(t => {
    const k = t.cliente.trim().toLowerCase();
    const r = clientes[k] ||= { nome: t.cliente, saldo: 0, titulos: 0, vencido: 0 };
    const s = saldoTitulo(t); r.saldo += s; if (s > 0) { r.titulos++; if (t.venc < hojeISO()) r.vencido += s; }
  });
  const cl = Object.values(clientes).filter(c => c.saldo > 0.004).sort((a, b) => b.saldo - a.saldo);
  const teto = db.config.tetoFiado;
  $('#tabSaldos').innerHTML = `<tr><th>Cliente</th><th class="num">Títulos</th><th class="num">Vencido</th><th class="num">Saldo devedor</th></tr>` +
    (cl.length ? cl.map(c => `<tr><td>${esc(c.nome)} ${teto > 0 && c.saldo > teto ? '<span class="badge b-bad">Acima do teto</span>' : ''}</td><td class="num">${c.titulos}</td><td class="num">${brl(c.vencido)}</td><td class="num"><b>${brl(c.saldo)}</b></td></tr>`).join('') : vazio(4, 'Ninguém devendo. 🎉'));
  const cart = db.receber.filter(t => t.origem === 'Cartão de Crédito' && saldoTitulo(t) > 0).sort((a, b) => a.venc.localeCompare(b.venc));
  $('#tabCartao').innerHTML = `<tr><th>Compensação</th><th>Referência</th><th class="num">Valor</th><th></th></tr>` +
    (cart.length ? cart.map(t => `<tr><td>${dataBR(t.venc)}</td><td>${esc(t.desc)}</td><td class="num">${brl(saldoTitulo(t))}</td><td class="num"><button class="btn btn-sm" data-baixa="${t.id}">Conciliar</button></td></tr>`).join('') : vazio(4, 'Nenhum recebível de cartão pendente.'));
  const lista = db.receber.filter(t => f === 'todas' || (f === 'quitadas' ? saldoTitulo(t) <= 0.004 : saldoTitulo(t) > 0.004)).sort((a, b) => a.venc.localeCompare(b.venc));
  $('#tabReceber').innerHTML = `<tr><th>Vencimento</th><th>Cliente</th><th>Origem</th><th>Referência</th><th class="num">Valor</th><th class="num">Recebido</th><th class="num">Saldo</th><th>Status</th><th></th></tr>` +
    (lista.length ? lista.map(t => { const [s, b] = statusTitulo(t), saldo = saldoTitulo(t);
      return `<tr class="${s.startsWith('Vencido') ? 'row-bad' : ''}"><td>${dataBR(t.venc)}</td><td>${esc(t.cliente)}</td><td>${esc(t.origem)}</td><td>${esc(t.desc)}</td>
      <td class="num">${brl(t.valor)}</td><td class="num">${brl(t.valor - saldo)}</td><td class="num"><b>${brl(saldo)}</b></td><td><span class="badge ${b}">${s}</span></td>
      <td class="num">${saldo > 0.004 ? `<button class="btn btn-sm btn-primary" data-baixa="${t.id}">Receber</button>` : ''}</td></tr>`; }).join('') : vazio(9, 'Nenhum título neste filtro.'));
}
function modalBaixaReceber(id) {
  const t = db.receber.find(x => x.id === id), saldo = saldoTitulo(t);
  const hist = (t.baixas || []).map(b => `<li>${dataBR(b.data)} — ${brl(b.valor)} (${esc(b.forma)})</li>`).join('');
  abrirModal(`Receber de ${t.cliente}`, `<p>${esc(t.desc)} · valor original ${brl(t.valor)} · <b>saldo ${brl(saldo)}</b></p>
    <div class="form-grid"><label>Valor recebido (R$)<input id="rValor" type="number" step="0.01" min="0" value="${saldo}"></label>
    <label>Forma<select id="rForma"><option>PIX</option><option>Dinheiro</option><option>Débito</option><option>Repasse da maquininha</option></select></label>
    <label>Data<input id="rData" type="date" value="${hojeISO()}"></label></div>
    <p class="hint">Pode receber só uma parte. O restante continua em aberto.</p>${hist ? `<b>Recebimentos anteriores</b><ul>${hist}</ul>` : ''}`,
    [{ label: 'Confirmar recebimento', cls: 'btn-primary', acao: () => {
      const v = round2(parseNum($('#rValor').value));
      if (v <= 0 || v > saldo + 0.004) { toast(`Informe um valor entre R$ 0,01 e ${brl(saldo)}.`, 'bad'); return false; }
      (t.baixas ||= []).push({ data: $('#rData').value || hojeISO(), valor: v, forma: $('#rForma').value });
      salvar(); renderAba(); toast(saldoTitulo(t) <= 0.004 ? 'Título quitado. ✅' : `Baixa parcial. Restam ${brl(saldoTitulo(t))}.`, 'ok');
    } }]);
}
function modalTitulo() {
  abrirModal('Novo lançamento a receber', `
    <div class="form-grid">
      <label>Cliente / empresa<input id="tCli" list="listaCli2"></label>
      <label>Origem<select id="tOrig"><option>Fiado</option><option>Convênio</option><option>Cartão de Crédito</option></select></label>
      <label>Referência<input id="tDesc" placeholder="Ex.: 5 marmitex semana 12"></label>
      <label>Valor (R$)<input id="tValor" type="number" step="0.01" min="0"></label>
      <label>Vencimento<input id="tVenc" type="date" value="${hojeISO(db.config.prazoFiado)}"></label>
    </div><datalist id="listaCli2">${[...new Set(db.receber.map(r => r.cliente))].map(c => `<option value="${esc(c)}">`).join('')}</datalist>`,
    [{ label: 'Salvar', cls: 'btn-primary', acao: () => {
      const cli = $('#tCli').value.trim(), valor = parseNum($('#tValor').value);
      if (!cli || valor <= 0) { toast('Informe cliente e valor.', 'bad'); return false; }
      db.receber.push({ id: uid(), cliente: cli, origem: $('#tOrig').value, desc: $('#tDesc').value.trim() || 'Lançamento manual', valor: round2(valor), venc: $('#tVenc').value || hojeISO(), emissao: hojeISO(), baixas: [] });
      salvar(); renderAba(); toast('Lançamento criado.', 'ok');
    } }]);
}

/* =========================================================
   8. BACKUP / CONFIG
   ========================================================= */
function renderBackup() {
  $('#cfgNome').value = db.config.nome;
  $('#cfgTeto').value = db.config.tetoFiado;
  $('#cfgPrazo').value = db.config.prazoFiado;
}
function exportarCsv() {
  if (!db.vendas.length) return toast('Ainda não há vendas para exportar.', 'bad');
  const cel = v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const n = v => (Number(v) || 0).toFixed(2).replace('.', ',');
  const linhas = [['Pedido', 'Data', 'Hora', 'Canal', 'Mesa', 'Cliente', 'Itens', 'Subtotal', 'Taxa serviço', 'Total', 'Custo insumos (CMV)', 'Lucro bruto', 'Pagamento', 'Status']];
  for (const v of db.vendas) linhas.push([v.num, dataBR(isoLocalDia(v.data)), horaBR(v.data), v.canal, v.mesa, v.cliente, v.itens.map(i => `${i.qtd}x ${i.nome}`).join(' | '), n(v.subtotal), n(v.taxa), n(v.total), n(v.custo), n(v.total - v.custo), v.pagamento, v.status]);
  baixarArquivo(`vendas-${hojeISO()}.csv`, '﻿' + linhas.map(l => l.map(cel).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  toast('CSV gerado. Abre direto no Excel.', 'ok');
}
function restaurar(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const dados = JSON.parse(r.result);
      if (!dados || !Array.isArray(dados.insumos) || !Array.isArray(dados.cardapio)) throw new Error('arquivo não parece um backup do Sabor & Gestão');
      confirmar('Restaurar backup', `Isto substitui todos os dados atuais pelo backup (${dados.vendas?.length || 0} vendas, ${dados.insumos.length} insumos). Continuar?`, 'Restaurar', () => {
        db = dados; carregarDefaults(); salvar(); aplicarTema(); renderAba(); toast('Backup restaurado.', 'ok');
      });
    } catch (e) { toast('Não consegui ler o backup: ' + e.message, 'bad'); }
  };
  r.readAsText(file);
}
function carregarDefaults() { const b = dadosIniciais(); for (const k of Object.keys(b)) if (db[k] === undefined) db[k] = b[k]; db.config = { ...b.config, ...db.config }; }
function modoReal() {
  confirmar('Zerar vendas de teste', `Serão apagados ${db.vendas.length} pedido(s) e os títulos gerados por eles, e o estoque consumido volta para as prateleiras. Continuar?`, 'Zerar vendas', () => {
    for (const k of db.kardex.filter(k => k.tipo === 'venda')) { const i = insumo(k.insumoId); if (i) i.qtd = round3(i.qtd - k.qtd); }
    db.kardex = db.kardex.filter(k => k.tipo !== 'venda');
    db.receber = db.receber.filter(t => !t.vendaId);
    db.vendas = []; db.seqPedido = 1;
    salvar(); renderAba(); toast('Pronto! Sistema em modo real.', 'ok');
  });
}

/* =========================================================
   Eventos
   ========================================================= */
function ligarEventos() {
  $('#tabs').onclick = e => { const b = e.target.closest('.tab'); if (b) irPara(b.dataset.tab); };
  $('#btnTema').onclick = () => { db.config.tema = db.config.tema === 'dark' ? 'light' : 'dark'; salvar(); aplicarTema(); };
  $('#filtroPeriodo').onclick = e => { const b = e.target.closest('button'); if (!b) return; periodo = b.dataset.p; $$('#filtroPeriodo button').forEach(x => x.classList.toggle('active', x === b)); renderDashboard(); };

  // PDV
  $('#buscaPdv').oninput = e => { pdv.busca = e.target.value; renderPdv(); };
  $('#chipsCategorias').onclick = e => { const b = e.target.closest('[data-cat]'); if (b) { pdv.cat = b.dataset.cat; renderPdv(); } };
  $('#menuGrid').onclick = e => { const b = e.target.closest('[data-add]'); if (b) addItem(b.dataset.add); };
  $('#carrinho').onclick = e => {
    const inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]');
    if (inc) addItem(pdv.itens[inc.dataset.inc].pratoId);
    if (dec) { const it = pdv.itens[dec.dataset.dec]; if (--it.qtd <= 0) pdv.itens.splice(dec.dataset.dec, 1); renderCarrinho(); }
  };
  $('#canalVenda').onclick = e => { const b = e.target.closest('button'); if (b) { pdv.canal = b.dataset.c; renderCarrinho(); } };
  $('#formasPagamento').onclick = e => { const b = e.target.closest('button'); if (b) { pdv.forma = b.dataset.f; renderCarrinho(); } };
  const campoPdv = e => {
    const k = e.target.dataset.pdv; if (!k) return;
    pdv[k] = e.target.type === 'checkbox' ? e.target.checked : k === 'pessoas' ? Math.max(1, parseInt(e.target.value) || 1) : e.target.value;
    if (['taxa', 'pessoas'].includes(k)) renderCarrinho();
    if (k === 'recebido') { const t = totaisPdv(), troco = parseNum(pdv.recebido) - t.total; $('#troco').textContent = pdv.recebido ? (troco >= 0 ? 'Troco: ' + brl(troco) : 'Faltam ' + brl(-troco)) : ''; }
  };
  $('.pdv-cart').addEventListener('input', campoPdv);
  $('.pdv-cart').addEventListener('change', e => { campoPdv(e); if (e.target.dataset.pdv === 'cliente') atualizarSaldoFiado(); });
  $('#btnLimpar').onclick = limparPdv;
  $('#btnFinalizar').onclick = finalizarPedido;

  // Cozinha
  $('#tab-cozinha').onclick = e => {
    const s = e.target.closest('[data-status]'), c = e.target.closest('[data-cupom]');
    if (s) { const v = db.vendas.find(x => x.id === s.dataset.status); v.status = s.dataset.to; salvar(); renderCozinha(); }
    if (c) imprimirCupom(c.dataset.cupom);
  };

  // Estoque
  $('#btnNovoInsumo').onclick = () => modalInsumo();
  $('#btnListaCompras').onclick = listaCompras;
  $('#filtroKardex').onchange = renderKardex;
  $('#tabInsumos').onclick = e => {
    const a = e.target.closest('[data-entrada]'), p = e.target.closest('[data-perda]'), ed = e.target.closest('[data-edit-insumo]');
    if (a) modalEntrada(a.dataset.entrada); if (p) modalPerda(p.dataset.perda); if (ed) modalInsumo(ed.dataset.editInsumo);
  };

  // Cardápio
  $('#btnNovoPrato').onclick = () => modalPrato();
  $('#tabCardapio').onclick = e => { const b = e.target.closest('[data-edit-prato]'); if (b) modalPrato(b.dataset.editPrato); };
  $('#metaCmv').onchange = e => { db.config.metaCmv = Math.max(1, Math.min(100, parseNum(e.target.value) || 35)); salvar(); renderCardapio(); };

  // Pagar
  $('#btnNovaConta').onclick = modalConta;
  $('#filtroPagar').onchange = renderPagar;
  $('#tabPagar').onclick = e => {
    const p = e.target.closest('[data-pagar]'), es = e.target.closest('[data-estornar]'), d = e.target.closest('[data-del-pagar]');
    if (p) modalBaixaPagar(p.dataset.pagar);
    if (es) { const c = db.pagar.find(x => x.id === es.dataset.estornar); c.pago = false; delete c.dataPag; salvar(); renderPagar(); toast('Pagamento estornado.'); }
    if (d) { const c = db.pagar.find(x => x.id === d.dataset.delPagar); confirmar('Excluir conta', `Excluir “${c.desc}” (${brl(c.valor)})?`, 'Excluir', () => { db.pagar = db.pagar.filter(x => x !== c); salvar(); renderPagar(); }); }
  };

  // Receber
  $('#btnNovoTitulo').onclick = modalTitulo;
  $('#filtroReceber').onchange = renderReceber;
  $('#tab-receber').addEventListener('click', e => { const b = e.target.closest('[data-baixa]'); if (b) modalBaixaReceber(b.dataset.baixa); });

  // Backup
  $('#btnSalvarCfg').onclick = () => {
    db.config.nome = $('#cfgNome').value.trim() || 'Sabor & Gestão';
    db.config.tetoFiado = Math.max(0, parseNum($('#cfgTeto').value));
    db.config.prazoFiado = Math.max(1, parseInt($('#cfgPrazo').value) || 15);
    salvar(); aplicarTema(); toast('Configurações salvas.', 'ok');
  };
  $('#btnCsv').onclick = exportarCsv;
  $('#btnBackup').onclick = () => { baixarArquivo(`backup-sabor-gestao-${hojeISO()}.json`, JSON.stringify(db, null, 2), 'application/json'); toast('Backup baixado. Guarde em pen drive ou na nuvem.', 'ok'); };
  $('#fileRestore').onchange = e => { if (e.target.files[0]) restaurar(e.target.files[0]); e.target.value = ''; };
  $('#btnModoReal').onclick = modoReal;
  $('#btnFabrica').onclick = () => confirmar('Restaurar padrão de fábrica', 'Todos os dados serão apagados e substituídos pelos dados de exemplo. Faça um backup antes se precisar. Continuar?', 'Apagar tudo', () => {
    db = dadosIniciais(); salvar(); aplicarTema(); renderAba(); toast('Dados de exemplo restaurados.', 'ok');
  });

  // Modal
  $('#modalBg').addEventListener('click', e => { if (e.target.id === 'modalBg' || e.target.closest('[data-close]')) fecharModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modalBg').hidden) fecharModal(); });
  window.addEventListener('afterprint', () => { $('#printArea').innerHTML = ''; });
}

/* ---------- inicialização ---------- */
function relogio() { $('#relogio').textContent = new Date().toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
async function iniciar() {
  await carregar(); salvar(); aplicarTema();
  if (modoBanco) {
    marcarBanco(true);
    const h = document.getElementById('hintArmazenamento');
    if (h) h.textContent = 'Os dados ficam no banco de dados deste computador (pasta do programa → dados\\sabor_gestao.db) e o sistema faz uma cópia automática por dia em dados\\backups. Mesmo assim, baixe o backup JSON de vez em quando e guarde no pen drive ou na nuvem.';
    setInterval(() => fetch('/api/ping').catch(() => marcarBanco(false)), 60000); }
  ligarEventos(); relogio();
  let aba = 'dashboard'; try { aba = localStorage.getItem(STORAGE_KEY + '.aba') || 'dashboard'; } catch (e) { }
  irPara(document.getElementById('tab-' + aba) ? aba : 'dashboard');
  setInterval(() => { relogio(); if (abaAtual === 'cozinha' || abaAtual === 'dashboard') renderAba(); }, 30000);
}
document.addEventListener('DOMContentLoaded', iniciar);
