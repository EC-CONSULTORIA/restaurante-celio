// Teste de ponta a ponta no navegador (Playwright): usa o sistema como um operador faria.
// Rodar:  node testes/e2e_navegador.js   (precisa de Python 3 e do pacote playwright)
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

let falhas = 0, ok = 0;
const checar = (cond, nome) => { if (cond) { ok++; console.log('  ✔', nome); } else { falhas++; console.log('  ✘', nome); } };

(async () => {
  const py = spawn(process.env.PYTHON || 'python3', [path.join(__dirname, 'servidor_teste.py')], { stdio: ['ignore', 'pipe', 'inherit'] });
  const cfg = await new Promise(res => py.stdout.once('data', d => res(JSON.parse(String(d).split('\n')[0]))));
  const navegador = await chromium.launch();
  const ctx = await navegador.newContext({ viewport: { width: 1366, height: 850 }, acceptDownloads: true });
  ctx.setDefaultTimeout(6000);
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', e => erros.push(e.message));
  // 400/402 são das chaves recusadas de propósito no teste
  pg.on('console', m => { if (m.type() === 'error' && !/status of (400|402)/.test(m.text())) erros.push(m.text()); });
  const espera = (ms = 400) => pg.waitForTimeout(ms);
  const ev = f => pg.evaluate(f);
  const aba = async a => { await pg.click('#tab-' + a).catch(() => {}); await ev(`irPara('${a}')`); await espera(200); };
  const modalOk = async () => { await pg.click('#modalRodape .btn-primary, #modalRodape .btn-danger'); await espera(450); };
  const venda = async (itens, canal, forma, campos = {}) => {
    await aba('pdv');
    for (const id of itens) await pg.click(`[data-add="${id}"]`);
    await pg.click(`#canalVenda [data-c="${canal}"]`);
    await pg.click(`#formasPagamento [data-f="${forma}"]`);
    for (const [k, v] of Object.entries(campos)) await pg.fill(`[data-pdv="${k}"]`, v);
    await pg.click('#btnFinalizar'); await espera(500);
    await pg.click('[data-close]').catch(() => {});
  };

  try {
    console.log('1. Primeira abertura (período de teste) e créditos');
    await pg.goto(cfg.url); await espera(900);
    checar(await pg.textContent('#statusBanco') === '💾 Banco local', 'grava no banco local');
    checar(await pg.isVisible('#avisoLicenca') && /teste/i.test(await pg.textContent('#avisoLicenca')), 'aviso de versão de teste');
    checar(/Desenvolvido por\s+Emanuel/.test(await pg.textContent('#rodape')), 'rodapé com "Desenvolvido por Emanuel"');
    await pg.click('#btnSobre'); await espera();
    const sobre = await pg.textContent('#modalCorpo');
    checar(/Emanuel/.test(sobre) && /Teste/.test(sobre), 'tela Sobre mostra autor e licença');
    checar(/^[0-9A-F]{5}-[0-9A-F]{5}$/.test(await pg.textContent('#codMaq')), 'mostra o código do computador');
    await pg.click('[data-close]');

    console.log('2. Frente de caixa: todas as formas e canais');
    const estoqueAntes = await ev(`insumo('contrafile').qtd`);
    await venda(['m1', 'b1'], 'Balcão', 'PIX');
    await venda(['m2'], 'Balcão', 'Dinheiro', { recebido: '50' });
    await venda(['pf1', 'b2'], 'Mesa', 'Débito', { mesa: '7' });
    await venda(['m3'], 'Delivery', 'Crédito', { cliente: 'João', endereco: 'Rua A, 10' });
    await venda(['m1'], 'Balcão', 'Fiado', { cliente: 'Maria' });
    checar(await ev('db.vendas.length') === 5, '5 pedidos registrados');
    checar(await ev(`db.vendas[1].recebido`) === 50, 'dinheiro com valor recebido');
    checar(await ev(`db.vendas[2].mesa`) === '7', 'pedido de mesa');
    checar(await ev(`db.receber.filter(r => r.vendaId).length`) === 2, 'fiado e crédito geram contas a receber');
    checar(Math.abs(estoqueAntes - await ev(`insumo('contrafile').qtd`) - 0.32) < 1e-6, 'baixa de estoque pela ficha técnica (2 × 160 g)');

    console.log('3. Cozinha');
    await aba('cozinha');
    await pg.click('[data-status]'); await espera();
    checar(await ev(`db.vendas.some(v => v.status !== 'novo')`), 'pedido avança de status');

    console.log('4. Estoque: compra de insumo');
    await aba('estoque');
    const pagarAntes = await ev('db.pagar.length');
    await pg.click('[data-entrada="arroz"]'); await espera(200);
    await pg.fill('#eQtd', '5'); await pg.fill('#eTotal', '30'); await pg.fill('#eForn', 'Atacadão');
    await modalOk();
    checar(await ev(`db.kardex.some(k => k.tipo === 'entrada' && k.insumoId === 'arroz')`), 'entrada no kardex');
    checar(await ev('db.pagar.length') === pagarAntes + 1, 'compra gera conta a pagar');

    console.log('5. Contas a pagar e a receber');
    await aba('pagar');
    await pg.click('[data-pagar]'); await espera(200); await modalOk();
    checar(await ev(`db.pagar.filter(c => c.pago).length`) >= 2, 'baixa de conta a pagar');
    await aba('receber');
    const tit = await ev(`db.receber.find(r => r.cliente === 'Maria').id`);
    await pg.click(`[data-baixa="${tit}"]`); await espera(200);
    await pg.fill('#rValor', '10'); await modalOk();
    checar(await ev(`db.receber.find(r => r.cliente === 'Maria').baixas.length`) === 1, 'recebimento parcial do fiado');

    console.log('6. Backup e exportação');
    await aba('backup');
    let [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('#btnCsv')]);
    const csv = fs.readFileSync(await dl.path(), 'utf8');
    checar(csv.split('\n').length >= 6, 'CSV de vendas exportado');
    [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('#btnBackup')]);
    const arqBackup = await dl.path();
    checar(JSON.parse(fs.readFileSync(arqBackup, 'utf8')).vendas.length === 5, 'backup JSON completo');

    console.log('7. Dados continuam após fechar e abrir');
    await espera(600); await pg.reload(); await espera(900);
    checar(await ev('db.vendas.length') === 5 && await ev('db.seqPedido') === 6, 'vendas e numeração persistidas no banco');
    checar(await ev(`db.receber.find(r => r.cliente === 'Maria').baixas.length`) === 1, 'baixas persistidas');

    console.log('8. Restaurar backup');
    await ev(`db.vendas = []; salvar()`); await espera(600);
    await aba('backup');
    await pg.setInputFiles('#fileRestore', arqBackup); await espera(300); await modalOk();
    await espera(600); await pg.reload(); await espera(900);
    checar(await ev('db.vendas.length') === 5, 'backup restaurado e gravado no banco');

    console.log('9. Licença: ativação');
    await pg.click('#btnSobre'); await espera(200);
    await pg.fill('#campoChave', 'SG1-chave.inventada'); await pg.click('#modalRodape .btn-primary'); await espera();
    checar(/não aceita|inválida/i.test(await pg.textContent('#erroChave')), 'recusa chave falsa');
    await pg.fill('#campoChave', cfg.chave_outro_pc); await pg.click('#modalRodape .btn-primary'); await espera();
    checar(/outro computador/i.test(await pg.textContent('#erroChave')), 'recusa chave de outro computador');
    await pg.fill('#campoChave', cfg.chave_3dias); await pg.click('#modalRodape .btn-primary'); await espera(600);
    checar(/vence em 3 dia/.test(await pg.textContent('#avisoLicenca')), 'aviso quando faltam poucos dias');
    await pg.click('#btnSobre'); await espera(200);
    await pg.fill('#campoChave', cfg.chave_ano); await pg.click('#modalRodape .btn-primary'); await espera(600);
    checar(await pg.isHidden('#avisoLicenca'), 'licença de 1 ano ativa, sem aviso');
    await pg.click('#btnSobre'); await espera(200);
    checar(/Restaurante Célio/.test(await pg.textContent('#modalCorpo')) && /Ativa/.test(await pg.textContent('#modalCorpo')), 'Sobre mostra licenciado e "Ativa"');
    await pg.click('[data-close]');
    await pg.screenshot({ path: path.join(__dirname, 'tela-sobre-ativa.png') });

    console.log('10. Licença vencida bloqueia o uso');
    fs.writeFileSync(cfg.flag, '1');
    await pg.reload(); await espera(900);
    checar(await pg.isVisible('#bloqueio') && /venceu/.test(await pg.textContent('#bloqueio')), 'tela de bloqueio com aviso de vencimento');
    checar(/Emanuel/.test(await pg.textContent('#bloqueio')), 'bloqueio mostra contato do desenvolvedor');
    await pg.screenshot({ path: path.join(__dirname, 'tela-bloqueio.png') });
    [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('#bloqBackup')]);
    checar(JSON.parse(fs.readFileSync(await dl.path(), 'utf8')).vendas.length === 5, 'mesmo bloqueado, baixa backup dos dados');
    const r = await ev(`fetch('/api/dados', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(db) }).then(r => r.status)`);
    checar(r === 402, 'servidor recusa gravar com licença vencida');
    fs.unlinkSync(cfg.flag);
    await pg.reload(); await espera(900);
    checar(await pg.isHidden('#bloqueio'), 'volta a funcionar com licença válida');

    console.log('11. Aberto direto pelo arquivo (sem servidor)');
    const p2 = await ctx.newPage();
    await p2.goto('file://' + path.join(__dirname, '..', 'instalador-pc', 'app', 'index.html')); await p2.waitForTimeout(600);
    checar(/Abra pelo atalho/.test(await p2.textContent('#bloqueio')), 'pede para abrir pelo atalho');

    checar(erros.length === 0, 'nenhum erro no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
  } catch (e) {
    falhas++; console.log('  ✘ erro inesperado:', e.message);
  } finally {
    await navegador.close(); py.kill();
    console.log(`\n${ok} verificações OK, ${falhas} falha(s)`);
    process.exit(falhas ? 1 : 0);
  }
})();
