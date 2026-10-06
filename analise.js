/* ============================================================
   Orizon — analise.js
   Duas seções novas da aba "Mês":
   - Estatísticas: indicadores objetivos do mês selecionado.
   - Análise Automática: frases geradas a partir dos números reais
     (comparação com o mês anterior, regra 50/30/20, projeção de
     meta), sempre com cálculo defensivo — nunca dividindo por zero
     nem citando dados que não existem.
   ============================================================ */

function diasNoMes(mes){
  return new Date(anoParaMes(mes), mes, 0).getDate();
}

function economiaAcumuladaAte(mes){
  let soma = 0;
  for (let m = 1; m <= mes; m++) soma += saldoDoMes(m);
  return soma;
}

// ---------------------------------------------------------------
// ESTATÍSTICAS
// ---------------------------------------------------------------
function calcularEstatisticasMes(mes){
  const cartoesComValor = estado.meses[mes].cartoes.filter(c => totalCartao(c) > 0).map(c => ({ descricao: "Cartão " + c.nome, valor: totalCartao(c) }));
  const despesas = estado.meses[mes].despesas.concat(cartoesComValor);
  const maiorGasto = despesas.length ? despesas.reduce((a,b) => (Number(b.valor)||0) > (Number(a.valor)||0) ? b : a) : null;
  const categorias = despesasPorCategoria(mes);
  const categoriaMaisCara = categorias.length ? categorias[0] : null;

  return {
    maiorGasto,
    categoriaMaisCara,
    totalPago: totalDespesasPagas(mes),
    totalPendente: totalDespesasPendentes(mes),
    mediaDiaria: totalDespesas(mes) / diasNoMes(mes),
    quantidadeLancamentos: despesas.length,
    economiaAcumulada: economiaAcumuladaAte(mes)
  };
}

function renderizarEstatisticas(mes){
  const container = document.getElementById("estatisticas-grid");
  if (!container) return;
  const e = calcularEstatisticasMes(mes);

  container.innerHTML = `
    <div class="kpi">
      <span class="kpi-label">🔺 Maior gasto</span>
      <span class="kpi-valor" style="font-size:15px;">${e.maiorGasto ? escaparHTML(e.maiorGasto.descricao) + " · " + formatarMoeda(e.maiorGasto.valor) : "—"}</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">🏷️ Categoria mais cara</span>
      <span class="kpi-valor" style="font-size:15px;">${e.categoriaMaisCara ? e.categoriaMaisCara.categoria.emoji + " " + e.categoriaMaisCara.categoria.nome : "—"}</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">✅ Total pago</span>
      <span class="kpi-valor positivo">${formatarMoeda(e.totalPago)}</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">⏳ Total pendente</span>
      <span class="kpi-valor">${formatarMoeda(e.totalPendente)}</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">📆 Média diária de gastos</span>
      <span class="kpi-valor" style="font-size:16px;">${formatarMoeda(e.mediaDiaria)}</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">🧾 Lançamentos no mês</span>
      <span class="kpi-valor" style="font-size:16px;">${e.quantidadeLancamentos}</span>
    </div>
    <div class="kpi kpi-saldo">
      <span class="kpi-label">💎 Economia acumulada no ano (até este mês)</span>
      <span class="kpi-valor ${e.economiaAcumulada < 0 ? "negativo" : "positivo"}">${formatarMoeda(e.economiaAcumulada)}</span>
    </div>`;
}

// ---------------------------------------------------------------
// ANÁLISE AUTOMÁTICA
// ---------------------------------------------------------------
function gerarAnaliseAutomatica(mes){
  const frases = [];
  const renda = totalRenda(mes);
  const despesa = totalDespesas(mes);
  const saldo = renda - despesa;

  if (renda > 0){
    const pct = (saldo / renda) * 100;
    frases.push(pct >= 0
      ? `Você economizou ${pct.toFixed(0)}% da sua renda este mês.`
      : `Suas despesas ficaram ${Math.abs(pct).toFixed(0)}% acima da sua renda este mês.`);
  }

  // Comparação de categorias com o mês anterior (dentro do mesmo ciclo de 12 slots)
  const mesAnterior = mes === 1 ? 12 : mes - 1;
  const catsAtual = despesasPorCategoria(mes);
  const catsAnterior = despesasPorCategoria(mesAnterior);
  const mapaAnterior = {};
  catsAnterior.forEach(c => mapaAnterior[c.categoria.id] = c.valor);

  let maiorAumento = null; // { nome, pct }
  catsAtual.forEach(c => {
    const valorAnterior = mapaAnterior[c.categoria.id];
    if (valorAnterior > 0){
      const pctVariacao = ((c.valor - valorAnterior) / valorAnterior) * 100;
      if (pctVariacao > 5 && (!maiorAumento || pctVariacao > maiorAumento.pct)){
        maiorAumento = { nome: c.categoria.nome, pct: pctVariacao };
      }
    }
  });
  if (maiorAumento){
    frases.push(`${maiorAumento.nome} aumentou ${maiorAumento.pct.toFixed(0)}% em relação ao mês anterior.`);
  }

  if (catsAtual.length > 0){
    frases.push(`Sua maior despesa foi ${catsAtual[0].categoria.nome}.`);
  }

  if (renda > 0){
    const diagnostico = calcularDiagnostico5030_20(mes);
    const acima = diagnostico.find(g => g.situacao === "acima");
    const todosDentro = diagnostico.every(g => g.situacao === "dentro" || g.situacao === "abaixo");
    if (acima){
      frases.push(`Seus gastos com ${acima.nome} estão acima do recomendado pela regra 50/30/20.`);
    } else if (todosDentro){
      frases.push("Você está dentro da regra 50/30/20 este mês. 👏");
    }
  }

  // Projeção de meta usando a média histórica de economia
  const metaAtiva = estado.metas.find(m => progressoMeta(m).pct < 100);
  if (metaAtiva){
    const evolucao = calcularEvolucaoAnual();
    if (evolucao.mesesComDados.length > 0){
      const mediaEconomia = evolucao.mesesComDados.reduce((s, m) => s + saldoDoMes(m), 0) / evolucao.mesesComDados.length;
      if (mediaEconomia > 0){
        const falta = progressoMeta(metaAtiva).falta;
        const mesesFaltantes = Math.ceil(falta / mediaEconomia);
        frases.push(`Mantendo essa média, sua meta "${metaAtiva.nome}" ficará pronta em ${mesesFaltantes} mês(es).`);
      }
    }
  }

  return frases;
}

function renderizarAnaliseAutomatica(mes){
  const container = document.getElementById("analise-automatica-lista");
  if (!container) return;
  const frases = gerarAnaliseAutomatica(mes);
  container.innerHTML = frases.length === 0
    ? `<p class="lista-vazia">Cadastre renda e despesas deste mês para ver sua análise automática aqui.</p>`
    : frases.map(f => `<div class="analise-item">💡 ${f}</div>`).join("");
}
