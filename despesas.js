/* ============================================================
   Orizon — despesas.js
   Funções puras de cálculo (totais, categorias, diagnóstico
   50/30/20) + CRUD de renda e despesas do mês selecionado.
   ============================================================ */

function totalRenda(mes){
  return estado.meses[mes].renda.reduce((s, r) => s + Number(r.valor || 0), 0);
}
function totalDespesas(mes){
  const despesas = estado.meses[mes].despesas.reduce((s, d) => s + Number(d.valor || 0), 0);
  return despesas + totalCartoes(mes);
}
function totalDespesasPagas(mes){
  return estado.meses[mes].despesas.filter(d => d.paga).reduce((s, d) => s + Number(d.valor || 0), 0) + totalCartoesPagos(mes);
}
function totalDespesasPendentes(mes){
  return estado.meses[mes].despesas.filter(d => !d.paga).reduce((s, d) => s + Number(d.valor || 0), 0) + totalCartoesPendentes(mes);
}
function saldoDoMes(mes){
  return totalRenda(mes) - totalDespesas(mes);
}
// "Saldo disponível": o que já saiu de fato da sua renda até agora (só despesas pagas) —
// diferente do saldo projetado, que já desconta tudo (pago ou não).
function saldoDisponivel(mes){
  return totalRenda(mes) - totalDespesasPagas(mes);
}

function despesasPorCategoria(mes){
  const mapa = {};
  estado.meses[mes].despesas.forEach(d => {
    mapa[d.categoria] = (mapa[d.categoria] || 0) + Number(d.valor || 0);
  });
  const lista = Object.entries(mapa).map(([id, valor]) => ({ categoria: categoriaPorId(id), valor }));
  const cartoes = totalCartoes(mes);
  if (cartoes > 0) lista.push({ categoria: CATEGORIA_CARTAO, valor: cartoes });
  return lista.sort((a,b) => b.valor - a.valor);
}

function calcularDiagnostico5030_20(mes){
  // Regra 50/30/20 é sobre a RENDA (não sobre o total de despesas) — cada grupo de
  // gasto deveria consumir aquele % da sua renda. Ex: renda 1.600, gastar 150 em
  // Moradia é ~9% da renda (dentro do ideal de necessidades), não 100% de nada.
  const renda = totalRenda(mes);
  const porGrupo = { necessidades: 0, desejos: 0, futuro: 0 };
  estado.meses[mes].despesas.forEach(d => {
    const cat = categoriaPorId(d.categoria);
    porGrupo[cat.grupo] += Number(d.valor || 0);
  });
  porGrupo.necessidades += totalCartoes(mes); // fatura de cartão conta como dívida (necessidades)
  return GRUPOS_5030_20.map(g => {
    const atualPct = renda > 0 ? porGrupo[g.id] / renda : 0;
    let situacao;
    // margem de tolerância de 3 pontos percentuais pra não marcar "acima" por diferenças mínimas
    if (renda <= 0) situacao = "sem-renda";
    else if (atualPct > g.percentualIdeal + 0.03) situacao = "acima";
    else if (atualPct < g.percentualIdeal - 0.03) situacao = "abaixo";
    else situacao = "dentro";
    return { id: g.id, nome: g.nome, percentualIdeal: g.percentualIdeal, atualPct, valor: porGrupo[g.id], situacao };
  });
}

// ---------------------------------------------------------------
// CRUD — Renda
// Cada renda tem valorPrevisto (fixo, o que você esperava receber)
// e valor (o valor atual/real — editável quando o dia chega e você
// confirma quanto realmente caiu).
// ---------------------------------------------------------------
function adicionarRenda(mes, descricao, valor){
  estado.meses[mes].renda.push({ id: gerarId("renda"), descricao, valor: Number(valor), valorPrevisto: Number(valor) });
  salvarEstado();
}
function editarRenda(mes, id, descricao, valor){
  const r = estado.meses[mes].renda.find(r => r.id === id);
  if (r) { r.descricao = descricao; r.valor = Number(valor); salvarEstado(); }
}
function removerRenda(mes, id){
  estado.meses[mes].renda = estado.meses[mes].renda.filter(r => r.id !== id);
  salvarEstado();
}

// ---------------------------------------------------------------
// CRUD — Despesas
// Mesma lógica: valorPrevisto fica fixo desde a criação (o "gasto
// previsto" da planilha original); valor é o atual/real, editável —
// inclusive em despesas recorrentes, já que cada mês tem sua própria
// cópia independente (editar uma não muda as outras).
// ---------------------------------------------------------------
function adicionarDespesa(mes, dados){
  const recorrenciaId = dados.recorrente ? gerarId("rec") : null;
  const despesa = {
    id: gerarId("desp"),
    descricao: dados.descricao,
    valor: Number(dados.valor),
    valorPrevisto: Number(dados.valor),
    vencimento: dados.vencimento,
    categoria: dados.categoria,
    tipoPagamento: dados.tipoPagamento,
    parcelas: dados.tipoPagamento === "Parcelado" ? Number(dados.parcelas || 2) : null,
    icone: dados.icone || null,
    recorrenciaId,
    recorrente: !!dados.recorrente,
    paga: !!dados.paga
  };
  estado.meses[mes].despesas.push(despesa);
  let copia = null;
  if (recorrenciaId) copia = criarCopiaRecorrente(despesa, mes);
  salvarEstado();
  return { despesa, copia }; // "copia" diz em qual mês a recorrência caiu (ou null)
}

function editarDespesa(mes, id, dados){
  const d = estado.meses[mes].despesas.find(d => d.id === id);
  if (!d) return;
  const vencimentoMudou = d.vencimento !== dados.vencimento;
  d.descricao = dados.descricao;
  d.valor = Number(dados.valor);
  d.vencimento = dados.vencimento;
  d.categoria = dados.categoria;
  d.tipoPagamento = dados.tipoPagamento;
  d.parcelas = dados.tipoPagamento === "Parcelado" ? Number(dados.parcelas || 2) : null;
  d.icone = dados.icone !== undefined ? dados.icone : d.icone;
  d.paga = !!dados.paga;
  if (vencimentoMudou) limparNotificacoesEnviadasDe(d.id); // nova data = pode avisar de novo

  // Recorrência: ligar cria a cópia no mês seguinte; desligar remove a cópia (se ainda não paga)
  let resultado = null;
  if (dados.recorrente !== undefined){
    const quer = !!dados.recorrente;
    if (quer && !d.recorrente){
      if (!d.recorrenciaId) d.recorrenciaId = gerarId("rec");
      d.recorrente = true;
      resultado = criarCopiaRecorrente(d, mes);
      if (!resultado.ok) d.recorrente = false;
    } else if (!quer && d.recorrente){
      d.recorrente = false;
      removerCopiaRecorrente(d, mes);
    }
  }
  salvarEstado();
  return resultado;
}

function removerDespesa(mes, id){
  // Cada mês é independente: apagar aqui NÃO apaga os outros meses.
  estado.meses[mes].despesas = estado.meses[mes].despesas.filter(d => d.id !== id);
  salvarEstado();
}

// Duplica uma despesa no mesmo mês (cópia independente, sem recorrência e como pendente) —
// útil pra lançar rapidamente algo parecido com o que já existe.
function duplicarDespesa(mes, id){
  const original = estado.meses[mes].despesas.find(d => d.id === id);
  if (!original) return null;
  const copia = {
    ...original,
    id: gerarId("desp"),
    descricao: original.descricao + " (cópia)",
    recorrenciaId: null,
    origemId: null,
    veioDeRecorrencia: false,
    recorrente: false,
    paga: false
  };
  estado.meses[mes].despesas.push(copia);
  salvarEstado();
  return copia;
}

function alternarDespesaPaga(mes, id){
  const despesa = estado.meses[mes].despesas.find(d => d.id === id);
  if (despesa) { despesa.paga = !despesa.paga; salvarEstado(); }
}

// ---------------------------------------------------------------
// Contas a vencer nos próximos N dias (usado no mês e no alerta global)
// ---------------------------------------------------------------
function diasAteVencimento(vencimentoISO){
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const venc = new Date(vencimentoISO + "T00:00:00");
  return Math.round((venc - hoje) / (1000*60*60*24));
}

function contasAVencer(mes, dentroDeDias){
  return estado.meses[mes].despesas
    .filter(d => !d.paga)
    .map(d => ({ ...d, diasRestantes: diasAteVencimento(d.vencimento) }))
    .filter(d => d.diasRestantes <= (dentroDeDias == null ? 999999 : dentroDeDias))
    .sort((a,b) => a.diasRestantes - b.diasRestantes);
}

function todasContasAVencerEm5Dias(){
  let resultado = [];
  for (let m = 1; m <= 12; m++){
    contasAVencer(m, 5).forEach(d => resultado.push({ ...d, mes: m }));
  }
  return resultado.filter(d => d.diasRestantes >= 0); // já vencidas negativas ficam de fora do alerta "a vencer"
}

// ---------------------------------------------------------------
// CARTÕES DE CRÉDITO
// Ficam cadastrados à parte da lista de despesas, mas o total de
// cada um entra na soma de despesas do mês. Cada cartão funciona
// em um de dois modos: "itens" (soma as compras cadastradas nele)
// ou "total" (a pessoa digita direto o valor da fatura).
// ---------------------------------------------------------------
function totalCartao(cartao){
  // Cartão ligado à Central: total do mês (digitado) + compras/parcelas lançadas
  if (cartao.centralId){
    const base = cartao.modo === "semana" ? (cartao.semanas || []).reduce((s, v) => s + Number(v || 0), 0) : Number(cartao.totalManual || 0);
    return base + (cartao.compras || []).reduce((s, c) => s + Number(c.valor || 0), 0);
  }
  if (cartao.modo === "total") return Number(cartao.totalManual || 0);
  if (cartao.modo === "semana") return (cartao.semanas || []).reduce((s, v) => s + Number(v || 0), 0);
  return (cartao.compras || []).reduce((s, c) => s + Number(c.valor || 0), 0);
}

function totalCartoes(mes){
  return estado.meses[mes].cartoes.reduce((s, c) => s + totalCartao(c), 0);
}
function totalCartoesPagos(mes){
  return estado.meses[mes].cartoes.filter(c => c.paga).reduce((s, c) => s + totalCartao(c), 0);
}
function totalCartoesPendentes(mes){
  return estado.meses[mes].cartoes.filter(c => !c.paga).reduce((s, c) => s + totalCartao(c), 0);
}

function cartaoTemLancamentos(c){
  return totalCartao(c) > 0 || (c.compras && c.compras.length > 0) || Number(c.totalManual || 0) > 0 || (c.semanas || []).some(v => Number(v) > 0);
}

function acharCartaoPorId(id){
  for (let m = 1; m <= 12; m++){
    const c = estado.meses[m].cartoes.find(x => x.id === id);
    if (c) return { cartao: c, mes: m };
  }
  return null;
}

// ---------------------------------------------------------------
// LIMITE E DISPONÍVEL
// Cada cartão pertence a UM mês. "Limite total" é o teto do cartão;
// "disponível no início do mês" é só o ponto de partida informado
// por você — daí em diante cada gasto lançado vai diminuindo o
// disponível. Quando o cartão é repetido no mês seguinte, o mês novo
// começa com o que SOBROU do mês anterior (e acompanha se o mês
// anterior mudar), a não ser que você digite outro valor lá.
// ---------------------------------------------------------------
function disponivelInicialCartao(cartao, profundidade){
  profundidade = profundidade || 0;
  if (cartao.herdaDisponivel && cartao.origemId && profundidade < 13){
    const origem = acharCartaoPorId(cartao.origemId);
    if (origem) return disponivelAtualCartao(origem.cartao, profundidade + 1);
  }
  return cartao.disponivelInicial !== undefined && cartao.disponivelInicial !== null ? Number(cartao.disponivelInicial) : Number(cartao.limite || 0);
}
function disponivelAtualCartao(cartao, profundidade){
  // Cartão ligado à Central: o limite é um só e vale para todos os meses (ver cartoes-central.js)
  if (cartao.centralId){
    const cc = acharCentral(cartao.centralId);
    if (cc) return disponivelCentral(cc); // todas as faturas em aberto, de qualquer mês, seguram o limite
  }
  return disponivelInicialCartao(cartao, profundidade) - totalCartao(cartao);
}
// nomes antigos, usados pela interface
function limiteDisponivelCartao(cartao){ return disponivelAtualCartao(cartao); }
function percentualUsoCartao(cartao){
  const limite = Number(cartao.limite || 0);
  if (limite <= 0) return null; // sem limite cadastrado — não faz sentido calcular %
  return Math.max(0, ((limite - disponivelAtualCartao(cartao)) / limite) * 100);
}

function normalizarDisponivel(limite, disponivel){
  limite = Number(limite || 0);
  if (disponivel === "" || disponivel === null || disponivel === undefined || isNaN(Number(disponivel))) return limite;
  let v = Math.max(0, Number(disponivel));
  if (limite > 0 && v > limite) v = limite;
  return v;
}

function novoCartao(dados){
  const limite = Number(dados.limite || 0);
  return {
    id: gerarId("cartao"),
    nome: dados.nome, icone: dados.icone || null,
    modo: dados.modo || "itens", totalManual: 0, compras: [], semanas: [0,0,0,0,0],
    limite,
    disponivelInicial: normalizarDisponivel(limite, dados.disponivel),
    herdaDisponivel: !!dados.herdaDisponivel,
    origemId: dados.origemId || null,
    veioDeRecorrencia: !!dados.origemId,
    recorrente: false,
    paga: false,
    fechamento: dados.fechamento ? Number(dados.fechamento) : null,
    vencimento: dados.vencimento ? Number(dados.vencimento) : null
  };
}

// Cria o cartão SÓ neste mês. Se "recorrente", já manda uma cópia (independente) para o mês seguinte.
function adicionarCartao(mes, dados){
  const cartao = novoCartao(dados);
  estado.meses[mes].cartoes.push(cartao);
  let copia = null;
  if (dados.recorrente){
    cartao.recorrente = true;
    copia = criarCopiaCartao(cartao, mes);
    if (!copia.ok) cartao.recorrente = false;
  }
  salvarEstado();
  return { cartao, copia };
}

function criarCopiaCartao(cartao, mesOrigem){
  const prox = proximoMesDoCiclo(mesOrigem);
  if (!prox) return { ok:false, motivo:"fim-do-ciclo" };
  if (estado.meses[prox].cartoes.some(c => c.origemId === cartao.id)) return { ok:true, mes:prox, jaExistia:true };
  const copia = novoCartao({
    nome: cartao.nome, icone: cartao.icone, limite: cartao.limite,
    disponivel: Math.max(0, disponivelAtualCartao(cartao)), // "foto" caso o mês de origem suma
    herdaDisponivel: true, origemId: cartao.id,
    fechamento: cartao.fechamento, vencimento: cartao.vencimento, modo: cartao.modo
  });
  estado.meses[prox].cartoes.push(copia);
  return { ok:true, mes:prox };
}

// Desligou "repetir": remove a cópia do mês seguinte, mas só se ainda estiver vazia
function removerCopiaCartao(cartao, mesOrigem){
  const prox = proximoMesDoCiclo(mesOrigem);
  if (!prox) return { removida:false };
  const copia = estado.meses[prox].cartoes.find(c => c.origemId === cartao.id);
  if (!copia) return { removida:false };
  if (cartaoTemLancamentos(copia)) return { removida:false, mantida:true, mes:prox };
  estado.meses[prox].cartoes = estado.meses[prox].cartoes.filter(c => c.id !== copia.id);
  return { removida:true, mes:prox };
}

function definirCartaoRecorrente(mes, id, quer){
  const c = estado.meses[mes].cartoes.find(c => c.id === id);
  if (!c) return null;
  let resultado = null;
  if (quer && !c.recorrente){
    c.recorrente = true;
    resultado = criarCopiaCartao(c, mes);
    if (!resultado.ok) c.recorrente = false;
  } else if (!quer && c.recorrente){
    c.recorrente = false;
    resultado = removerCopiaCartao(c, mes);
  }
  salvarEstado();
  return resultado;
}

function definirCartaoPago(mes, id, pago){
  const c = estado.meses[mes].cartoes.find(c => c.id === id);
  if (c){ c.paga = !!pago; salvarEstado(); }
}

function removerCartao(mes, id){
  estado.meses[mes].cartoes = estado.meses[mes].cartoes.filter(x => x.id !== id);
  salvarEstado();
}

function editarCartao(mes, id, nome, icone){
  const c = estado.meses[mes].cartoes.find(c => c.id === id);
  if (!c) return;
  c.nome = nome;
  if (icone !== undefined) c.icone = icone;
  salvarEstado();
}

// Limite total, dia de fechamento e dia de vencimento (modal de detalhe do cartão)
function editarLimiteDatasCartao(mes, id, dados){
  const c = estado.meses[mes].cartoes.find(c => c.id === id);
  if (!c) return;
  c.limite = Number(dados.limite || 0);
  c.fechamento = dados.fechamento ? Number(dados.fechamento) : null;
  c.vencimento = dados.vencimento ? Number(dados.vencimento) : null;
  salvarEstado();
}

// Muda o "disponível no início do mês" — a partir daí o cartão deixa de herdar do mês anterior
function definirDisponivelInicialCartao(mes, id, valor){
  const c = estado.meses[mes].cartoes.find(c => c.id === id);
  if (!c) return;
  c.disponivelInicial = normalizarDisponivel(c.limite, valor);
  c.herdaDisponivel = false;
  salvarEstado();
}

function definirValorSemanaCartao(mes, id, indice, valor){
  const c = estado.meses[mes].cartoes.find(c => c.id === id);
  if (!c) return;
  if (!Array.isArray(c.semanas)) c.semanas = [0,0,0,0,0];
  c.semanas[indice] = Number(valor || 0);
  salvarEstado();
}

function definirModoCartao(mes, id, modo){
  const c = estado.meses[mes].cartoes.find(c => c.id === id);
  if (!c) return;
  c.modo = modo;
  salvarEstado();
}

function definirTotalManualCartao(mes, id, valor){
  const c = estado.meses[mes].cartoes.find(c => c.id === id);
  if (!c) return;
  c.totalManual = Number(valor || 0);
  salvarEstado();
}

// Versão 2.2 espalhava o mesmo cartão pelos 12 meses. Aqui desfazemos: mantém só os meses em que
// o cartão tem lançamentos (ou, se estiver vazio em todos, apenas o mês atual/selecionado).
function desfazerCartoesEspalhados(){
  if (estado.migracaoCartoesV3) return;
  const grupos = {};
  for (let m = 1; m <= 12; m++){
    estado.meses[m].cartoes.forEach(c => {
      if (!Array.isArray(c.semanas)) c.semanas = [0,0,0,0,0];
      if (!Array.isArray(c.compras)) c.compras = [];
      if (c.refId) (grupos[c.refId] = grupos[c.refId] || []).push({ m, c });
    });
  }
  const mesAtual = new Date().getMonth() + 1;
  Object.values(grupos).forEach(lista => {
    const comDados = lista.filter(x => cartaoTemLancamentos(x.c));
    const manter = comDados.length ? comDados : [lista.find(x => x.m === estado.mesSelecionado) || lista.find(x => x.m === mesAtual) || lista[0]];
    const ids = new Set(manter.map(x => x.c.id));
    lista.forEach(x => {
      if (!ids.has(x.c.id)) estado.meses[x.m].cartoes = estado.meses[x.m].cartoes.filter(y => y.id !== x.c.id);
    });
  });
  for (let m = 1; m <= 12; m++){
    estado.meses[m].cartoes.forEach(c => {
      delete c.refId;
      if (c.disponivelInicial === undefined) c.disponivelInicial = Number(c.limite || 0);
      if (c.herdaDisponivel === undefined) c.herdaDisponivel = false;
      if (c.paga === undefined) c.paga = false;
      if (c.recorrente === undefined) c.recorrente = false;
    });
  }
  estado.migracaoCartoesV3 = true;
  salvarEstado();
}

function adicionarCompraCartao(mes, cartaoId, descricao, valor){
  const c = estado.meses[mes].cartoes.find(c => c.id === cartaoId);
  if (!c) return;
  c.compras.push({ id: gerarId("compra"), descricao, valor: Number(valor) });
  salvarEstado();
}

function removerCompraCartao(mes, cartaoId, compraId){
  const c = estado.meses[mes].cartoes.find(c => c.id === cartaoId);
  if (!c) return;
  c.compras = c.compras.filter(cp => cp.id !== compraId);
  salvarEstado();
}
