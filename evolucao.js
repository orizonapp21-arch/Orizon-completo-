/* ============================================================
   Orizon — evolucao.js
   Aba "Evolução": gráfico de patrimônio acumulado mês a mês (a
   soma corrida do saldo de cada mês, na mesma ordem Jan→Dez usada
   no Painel) + estatísticas do ano: total economizado, melhor e
   pior mês, médias de gastos/renda e crescimento percentual desde
   o primeiro mês com dados.
   ============================================================ */

function calcularEvolucaoAnual(){
  const patrimonioAcumulado = [];
  let acumulado = 0;
  const mesesComDados = [];

  for (let m = 1; m <= 12; m++){
    const temDados = estado.meses[m].renda.length > 0 || estado.meses[m].despesas.length > 0 || estado.meses[m].cartoes.length > 0;
    if (temDados) mesesComDados.push(m);
    acumulado += saldoDoMes(m);
    patrimonioAcumulado.push(acumulado);
  }

  let melhorMes = null, piorMes = null;
  mesesComDados.forEach(m => {
    const saldo = saldoDoMes(m);
    if (melhorMes === null || saldo > saldoDoMes(melhorMes)) melhorMes = m;
    if (piorMes === null || saldo < saldoDoMes(piorMes)) piorMes = m;
  });

  const mediaGastos = mesesComDados.length ? mesesComDados.reduce((s, m) => s + totalDespesas(m), 0) / mesesComDados.length : 0;
  const mediaRenda = mesesComDados.length ? mesesComDados.reduce((s, m) => s + totalRenda(m), 0) / mesesComDados.length : 0;

  let crescimentoPct = null;
  if (mesesComDados.length >= 2){
    const primeiro = mesesComDados[0], ultimo = mesesComDados[mesesComDados.length - 1];
    const acumPrimeiro = patrimonioAcumulado[primeiro - 1];
    const acumUltimo = patrimonioAcumulado[ultimo - 1];
    if (Math.abs(acumPrimeiro) > 0.01){
      crescimentoPct = ((acumUltimo - acumPrimeiro) / Math.abs(acumPrimeiro)) * 100;
    }
  }

  return {
    patrimonioAcumulado,
    mesesComDados,
    totalEconomizadoAno: acumulado,
    melhorMes, piorMes,
    mediaGastos, mediaRenda,
    crescimentoPct
  };
}

function renderizarEvolucao(){
  const dados = calcularEvolucaoAnual();

  desenharGraficoLinhaAnimado(
    document.getElementById("grafico-evolucao"),
    dados.patrimonioAcumulado,
    NOMES_MESES.map(n => n.slice(0,3)),
    { corTexto: corTextoAtual(), cor: "#3B82F6" }
  );

  const semDadosSuficientes = dados.mesesComDados.length === 0;
  document.getElementById("evolucao-sem-dados").classList.toggle("hidden", !semDadosSuficientes);
  document.getElementById("evolucao-resumo").classList.toggle("hidden", semDadosSuficientes);
  if (semDadosSuficientes) return;

  document.getElementById("evo-total-economizado").textContent = formatarMoeda(dados.totalEconomizadoAno);
  const totalEl = document.getElementById("evo-total-economizado");
  totalEl.className = "kpi-valor" + (dados.totalEconomizadoAno < 0 ? " negativo" : " positivo");

  document.getElementById("evo-melhor-mes").textContent = dados.melhorMes ? `${NOMES_MESES[dados.melhorMes-1]} (${formatarMoeda(saldoDoMes(dados.melhorMes))})` : "—";
  document.getElementById("evo-pior-mes").textContent = dados.piorMes ? `${NOMES_MESES[dados.piorMes-1]} (${formatarMoeda(saldoDoMes(dados.piorMes))})` : "—";
  document.getElementById("evo-media-gastos").textContent = formatarMoeda(dados.mediaGastos);
  document.getElementById("evo-media-renda").textContent = formatarMoeda(dados.mediaRenda);

  const crescEl = document.getElementById("evo-crescimento");
  if (dados.crescimentoPct == null){
    crescEl.textContent = "Cadastre pelo menos 2 meses";
    crescEl.className = "kpi-valor";
  } else {
    const sinal = dados.crescimentoPct >= 0 ? "+" : "";
    crescEl.textContent = `${sinal}${dados.crescimentoPct.toFixed(1)}%`;
    crescEl.className = "kpi-valor" + (dados.crescimentoPct >= 0 ? " positivo" : " negativo");
  }
}
