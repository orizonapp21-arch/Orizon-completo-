/* ============================================================
   Orizon — script.js
   Navegação, renderização das telas, modais e inicialização.
   ============================================================ */

// ---------------------------------------------------------------
// NAVEGAÇÃO
// ---------------------------------------------------------------
const SKELETON_BLOCOS_POR_ABA = {
  "tab-painel": [90, 220, 130, 160],
  "tab-mes": [70, 150, 110, 300, 200],
  "tab-cartoes": [150, 100, 100],
  "tab-metas": [130, 130],
  "tab-evolucao": [220, 160]
};

// Marca a ordem de entrada dos blocos da aba (os primeiros entram em sequência; os de baixo não esperam muito)
function prepararEntradaDaAba(tab){
  Array.from(tab.children).forEach((el, i) => el.style.setProperty("--i", Math.min(i, 8)));
}

function iniciarNavegacao(){
  prepararEntradaDaAba(document.querySelector(".tab-content.active"));
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      vibrarLeve();
      document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
      void document.body.offsetWidth; // força o navegador a reiniciar a animação (também ao tocar na aba em que já está)
      const tabNova = document.getElementById(btn.dataset.tab);
      prepararEntradaDaAba(tabNova);
      tabNova.classList.add("active");
      window.scrollTo(0, 0);
      if (btn.dataset.tab === "tab-painel") renderizarPainel();
      if (btn.dataset.tab === "tab-mes") renderizarMes(estado.mesSelecionado);
      if (btn.dataset.tab === "tab-cartoes") renderizarCentralCartoes();
      if (btn.dataset.tab === "tab-metas") renderizarMetas();
      if (btn.dataset.tab === "tab-evolucao"){ renderizarEvolucao(); renderizarVisaoAnual(); }
    });
  });
}

// ---------------------------------------------------------------
// TEMA
// ---------------------------------------------------------------
function iniciarTema(){
  const aplicar = (tema) => {
    document.body.classList.toggle("tema-claro", tema === "claro");
    document.documentElement.classList.toggle("tema-claro", tema === "claro"); // corrige o fundo escuro do <html> ao rolar além do conteúdo
    document.getElementById("btn-tema").textContent = tema === "claro" ? "☀️" : "🌙";
  };
  aplicar(estado.tema);
  document.getElementById("btn-tema").addEventListener("click", () => {
    estado.tema = estado.tema === "claro" ? "escuro" : "claro";
    aplicar(estado.tema);
    salvarEstado();
    // recarrega os gráficos pra usar a cor de fundo/texto certa do novo tema
    if (document.getElementById("tab-painel").classList.contains("active")) renderizarPainel();
    if (document.getElementById("tab-mes").classList.contains("active")) renderizarMes(estado.mesSelecionado);
  });
}

function corTextoAtual(){
  return estado.tema === "claro" ? "#4B5563" : "#9CA3AF";
}
function corFundoCardAtual(){
  return estado.tema === "claro" ? "#FFFFFF" : "#0B1530";
}

// ---------------------------------------------------------------
// PAINEL GERAL
// ---------------------------------------------------------------
function renderizarPainel(){
  // Home = só "hoje" e o mês atual (ver home.js). A visão anual agora fica na aba Evolução.
  renderizarHome();
}

// Gráfico e tabela anuais (movidos da Home para a aba Evolução)
function renderizarVisaoAnual(){
  const rendasPorMes = [], despesasPorMes = [];
  for (let m = 1; m <= 12; m++){ rendasPorMes.push(totalRenda(m)); despesasPorMes.push(totalDespesas(m)); }

  desenharGraficoBarras3D(document.getElementById("grafico-anual"), [
    { nome: "Renda", cor: "#10B981", valores: rendasPorMes },
    { nome: "Despesas", cor: "#EF4444", valores: despesasPorMes }
  ], { rotulos: NOMES_MESES.map(n => n.slice(0,3)), corTexto: corTextoAtual() });

  // tabela anual — com quadradinho verde (renda) e vermelho (despesa) ao lado do valor
  const tabela = document.getElementById("tabela-anual");
  let html = `<div class="tabela-anual-linha cabecalho"><span>Mês</span><span>Renda</span><span>Despesas</span><span>Saldo</span></div>`;
  for (let m = 1; m <= 12; m++){
    const saldo = saldoDoMes(m);
    html += `<div class="tabela-anual-linha" data-mes="${m}">
      <span class="col-mes">${NOMES_MESES[m-1]} <small class="col-ano">${anoParaMes(m)}</small></span>
      <span><span class="swatch swatch-verde"></span>${formatarMoeda(totalRenda(m))}</span>
      <span><span class="swatch swatch-vermelho"></span>${formatarMoeda(totalDespesas(m))}</span>
      <span class="col-saldo ${saldo >= 0 ? "positivo" : "negativo"}">${formatarMoeda(saldo)}</span>
    </div>`;
  }
  tabela.innerHTML = html;
  tabela.querySelectorAll(".tabela-anual-linha[data-mes]").forEach(linha => {
    linha.addEventListener("click", () => {
      estado.mesSelecionado = Number(linha.dataset.mes);
      salvarEstado();
      document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
      document.querySelector('[data-tab="tab-mes"]').classList.add("active");
      document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
      document.getElementById("tab-mes").classList.add("active");
      renderizarMes(estado.mesSelecionado);
    });
  });

  checarContasEAvisar();
}

// ---------------------------------------------------------------
// SELETOR DE MESES (scroller)
// ---------------------------------------------------------------
function renderizarSeletorMeses(){
  const container = document.getElementById("meses-scroller");
  container.innerHTML = NOMES_MESES.map((nome, idx) => {
    const m = idx + 1;
    return `<button class="mes-chip ${m === estado.mesSelecionado ? "active" : ""}" data-mes="${m}">${nome.slice(0,3)}</button>`;
  }).join("");
  container.querySelectorAll(".mes-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      estado.mesSelecionado = Number(chip.dataset.mes);
      salvarEstado();
      renderizarMes(estado.mesSelecionado);
    });
  });
}

// ---------------------------------------------------------------
// TELA DO MÊS
// ---------------------------------------------------------------
function renderizarMes(mes){
  renderizarSeletorMeses();
  renderizarCartoes(mes);
  document.getElementById("mes-titulo-ano").textContent = `${NOMES_MESES[mes-1]} de ${anoParaMes(mes)}`;

  const renda = totalRenda(mes), despesa = totalDespesas(mes), saldo = renda - despesa;
  document.getElementById("mes-renda-total").textContent = formatarMoeda(renda);
  document.getElementById("mes-despesa-total").textContent = formatarMoeda(despesa);
  const saldoEl = document.getElementById("mes-saldo");
  saldoEl.textContent = formatarMoeda(saldo);
  saldoEl.className = "kpi-valor" + (saldo < 0 ? " negativo" : "");
  document.getElementById("mes-saldo-container").className = "kpi kpi-saldo " + (saldo >= 0 ? "kpi-saldo-positivo" : "kpi-saldo-negativo");
  document.getElementById("mes-alerta-limite").classList.toggle("hidden", saldo >= 0);

  document.getElementById("mes-saldo-disponivel").textContent = formatarMoeda(saldoDisponivel(mes));

  const pagas = totalDespesasPagas(mes), pendentes = totalDespesasPendentes(mes);
  document.getElementById("mes-despesas-pagas").textContent = formatarMoeda(pagas);
  document.getElementById("mes-despesas-pendentes").textContent = formatarMoeda(pendentes);

  // Gráfico "Total do mês": Renda x Despesas x Pendente, um grupo só com 3 barras
  desenharGraficoBarras3D(document.getElementById("grafico-totais-mes"), [
    { nome: "Renda", cor: "#10B981", valores: [renda] },
    { nome: "Despesas", cor: "#EF4444", valores: [despesa] },
    { nome: "Pendente", cor: "#D4AF37", valores: [pendentes] }
  ], { rotulos: [""], corTexto: corTextoAtual() });

  // Gráfico "Cada despesa do mês": uma barra por despesa, colorida pela categoria
  const despesasParaGrafico = estado.meses[mes].despesas
    .slice().sort((a,b) => a.vencimento.localeCompare(b.vencimento))
    .map(d => ({ nome: d.descricao, valor: d.valor, cor: categoriaPorId(d.categoria).cor }))
    .concat(estado.meses[mes].cartoes.filter(c => totalCartao(c) > 0).map(c => ({ nome: "Cartão " + c.nome, valor: totalCartao(c), cor: CATEGORIA_CARTAO.cor })));
  desenharBarrasIndividuais3D(document.getElementById("grafico-despesas-individuais"), despesasParaGrafico, { corTexto: corTextoAtual() });

  // Renda
  const rendaLista = document.getElementById("renda-lista");
  rendaLista.innerHTML = estado.meses[mes].renda.length === 0
    ? `<p class="lista-vazia">Nenhuma renda cadastrada neste mês.</p>`
    : estado.meses[mes].renda.map(r => `
      <div class="item-linha item-linha-renda">
        <div class="item-info">
          <span class="item-titulo">${escaparHTML(r.descricao)}</span>
          ${r.valorPrevisto != null && r.valorPrevisto !== r.valor ? `<span class="item-sub">Previsto: ${formatarMoeda(r.valorPrevisto)}</span>` : ""}
        </div>
        <span class="item-valor positivo-texto"><span class="swatch swatch-verde"></span>${formatarMoeda(r.valor)}</span>
        <div class="item-acoes">
          <button class="item-editar" data-editar-renda="${r.id}">✎</button>
          <button class="item-remover" data-id="${r.id}">✕</button>
        </div>
      </div>`).join("");
  rendaLista.querySelectorAll(".item-remover").forEach(btn => {
    btn.addEventListener("click", () => { removerRenda(mes, btn.dataset.id); renderizarMes(mes); });
  });
  rendaLista.querySelectorAll("[data-editar-renda]").forEach(btn => {
    btn.addEventListener("click", () => abrirModalRenda(mes, btn.dataset.editarRenda));
  });

  // Contas a vencer (próximos 5 dias, deste mês — inclui vencidas não pagas)
  const contas = contasAVencer(mes, 5);
  const contasEl = document.getElementById("contas-vencer-lista");
  contasEl.innerHTML = contas.length === 0
    ? `<p class="lista-vazia">Tudo em dia! Nenhuma conta vencendo nos próximos 5 dias.</p>`
    : contas.map(d => `
      <div class="item-linha">
        <div class="item-info">
          <span class="item-titulo">${escaparHTML(d.descricao)}</span>
          <span class="item-sub">${d.diasRestantes < 0 ? "Venceu em" : "Vence em"} ${formatarDataBR(d.vencimento)}</span>
        </div>
        <span class="item-valor">${formatarMoeda(d.valor)}</span>
        <span class="chip-status chip-vencendo">${
          d.diasRestantes < 0 ? `${Math.abs(d.diasRestantes)}d atrás` : d.diasRestantes === 0 ? "hoje" : d.diasRestantes + "d"
        }</span>
      </div>`).join("");

  // Despesas do mês (busca + filtros rápidos aplicados dentro de renderizarListaDespesas)
  renderizarListaDespesas(mes);

  // Calendário financeiro, estatísticas e análise automática (Orizon Premium)
  renderizarCalendarioFinanceiro(mes);
  renderizarEstatisticas(mes);
  renderizarAnaliseAutomatica(mes);

  // Gráfico de categorias (donut 3D) + legenda
  const categorias = despesasPorCategoria(mes);
  desenharDonut3D(document.getElementById("grafico-categorias"),
    categorias.map(c => ({ nome: c.categoria.nome, valor: c.valor, cor: c.categoria.cor })),
    { corTexto: estado.tema === "claro" ? "#111827" : "#F9FAFB", corFundo: corFundoCardAtual(), textoCentral: formatarMoeda(despesa) }
  );
  const legenda = document.getElementById("categorias-legenda");
  legenda.innerHTML = categorias.length === 0 ? "" : categorias.map(c => {
    const pct = despesa > 0 ? Math.round((c.valor / despesa) * 100) : 0;
    return `<span class="legenda-item"><span class="legenda-cor" style="background:${c.categoria.cor}"></span>${c.categoria.emoji} ${c.categoria.nome} — ${pct}%</span>`;
  }).join("");

  // Diagnóstico 50/30/20
  const diagnostico = calcularDiagnostico5030_20(mes);
  const diagEl = document.getElementById("diagnostico-lista");
  if (renda <= 0){
    diagEl.innerHTML = `<p class="lista-vazia">Cadastre a renda do mês para ver o diagnóstico 50/30/20.</p>`;
  } else {
  diagEl.innerHTML = diagnostico.map(g => {
    const corBarra = g.situacao === "acima" ? "#EF4444" : g.situacao === "abaixo" ? "#D4AF37" : "#10B981";
    const larguraPct = Math.min(100, Math.round(g.atualPct * 100));
    const textoSituacao = { dentro: "Dentro do ideal", abaixo: "Abaixo do ideal", acima: "Acima do ideal" }[g.situacao];
    const classeSituacao = { dentro: "sit-dentro", abaixo: "sit-abaixo", acima: "sit-acima" }[g.situacao];
    return `<div class="diagnostico-item">
      <div class="diagnostico-cabecalho">
        <span>${g.nome} <span style="color:var(--texto-secundario); font-weight:400;">(ideal ${Math.round(g.percentualIdeal*100)}%)</span></span>
        <span>${Math.round(g.atualPct*100)}%</span>
      </div>
      <div class="diagnostico-barra-fundo"><div class="diagnostico-barra-preenchida" style="width:${larguraPct}%; background:${corBarra};"></div></div>
      <span class="diagnostico-situacao ${classeSituacao}">${textoSituacao}</span>
    </div>`;
  }).join("");
  }

  checarAlertaOrcamento(mes);
}

// ---------------------------------------------------------------
// BUSCA INTELIGENTE + FILTROS RÁPIDOS (Despesas do mês)
// ---------------------------------------------------------------
let despesasFiltroBusca = "";
let despesasFiltroRapido = "todas"; // todas | pagas | pendentes | Pix | Crédito | Boleto | Parceladas

function despesaCorrespondeAoFiltro(d){
  if (despesasFiltroRapido === "pagas") return !!d.paga;
  if (despesasFiltroRapido === "pendentes") return !d.paga;
  if (despesasFiltroRapido !== "todas") return d.tipoPagamento === despesasFiltroRapido;
  return true;
}
function despesaCorrespondeABusca(d, termo){
  if (!termo) return true;
  const alvo = `${d.descricao} ${categoriaPorId(d.categoria).nome} ${d.tipoPagamento}`.toLowerCase();
  return alvo.includes(termo);
}

function renderizarListaDespesas(mes){
  const despesasLista = document.getElementById("despesas-lista");
  if (!despesasLista) return;
  const termo = despesasFiltroBusca.trim().toLowerCase();

  const despesasOrdenadas = [...estado.meses[mes].despesas]
    .sort((a,b) => a.vencimento.localeCompare(b.vencimento))
    .filter(d => despesaCorrespondeAoFiltro(d) && despesaCorrespondeABusca(d, termo));

  const semResultadoPorFiltro = despesasOrdenadas.length === 0 && estado.meses[mes].despesas.length > 0;

  despesasLista.innerHTML = despesasOrdenadas.length === 0
    ? `<p class="lista-vazia">${semResultadoPorFiltro ? "Nenhuma despesa encontrada com esse filtro/busca." : "Nenhuma despesa cadastrada neste mês."}</p>`
    : despesasOrdenadas.map(d => {
      const cat = categoriaPorId(d.categoria);
      const previstoTexto = d.valorPrevisto != null && d.valorPrevisto !== d.valor ? ` · previsto: ${formatarMoeda(d.valorPrevisto)}` : "";
      const iconeHtml = d.icone
        ? `<img src="${d.icone}" class="item-icone-foto-inline" alt="">`
        : cat.emoji;
      return `<div class="item-linha item-linha-despesa item-linha-expandida" data-abrir-edicao="${d.id}">
        <div class="item-linha-topo">
          <span class="item-titulo-grande">${iconeHtml} ${escaparHTML(d.descricao)}</span>
          <span class="item-valor"><span class="swatch swatch-vermelho"></span>${formatarMoeda(d.valor)}</span>
        </div>
        <div class="item-linha-base">
          <span class="item-sub">${formatarDataBR(d.vencimento)} · ${cat.nome} · ${escaparHTML(d.tipoPagamento)}${d.recorrente ? " · 🔁 repete no mês seguinte" : ""}${d.veioDeRecorrencia ? " · ↩ veio do mês anterior" : ""}${previstoTexto}</span>
          <div class="item-acoes">
            <span class="chip-status ${d.paga ? "chip-pago" : "chip-pendente"}" data-toggle-paga="${d.id}">${d.paga ? "Pago" : "Pendente"}</span>
            <button class="item-editar" data-duplicar-despesa="${d.id}" title="Duplicar">⧉</button>
            <button class="item-editar" data-editar-despesa="${d.id}" title="Editar">✎</button>
            <button class="item-remover" data-id="${d.id}" title="Remover">✕</button>
          </div>
        </div>
      </div>`;
    }).join("");

  despesasLista.querySelectorAll("[data-toggle-paga]").forEach(chip => {
    chip.addEventListener("click", (ev) => { ev.stopPropagation(); vibrarLeve(); alternarDespesaPaga(mes, chip.dataset.togglePaga); renderizarMes(mes); });
  });
  despesasLista.querySelectorAll("[data-editar-despesa]").forEach(btn => {
    btn.addEventListener("click", (ev) => { ev.stopPropagation(); abrirModalDespesa(mes, btn.dataset.editarDespesa); });
  });
  despesasLista.querySelectorAll("[data-duplicar-despesa]").forEach(btn => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      duplicarDespesa(mes, btn.dataset.duplicarDespesa);
      vibrarLeve();
      mostrarToast("Despesa duplicada!");
      renderizarMes(mes);
    });
  });
  despesasLista.querySelectorAll(".item-remover").forEach(btn => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const despesa = estado.meses[mes].despesas.find(d => d.id === btn.dataset.id);
      const perguntaExtra = despesa && despesa.recorrente ? " Ela está marcada para repetir no mês seguinte — a cópia de lá continua existindo; apague lá também se quiser." : "";
      confirmarElegante("Remover esta despesa?" + perguntaExtra, () => {
        removerDespesa(mes, btn.dataset.id);
        mostrarToast("Despesa removida.");
        renderizarMes(mes);
      });
    });
  });
  // "Editar tocando no item" — toca em qualquer parte da linha (fora dos botões de ação) pra editar
  despesasLista.querySelectorAll("[data-abrir-edicao]").forEach(linha => {
    linha.addEventListener("click", () => abrirModalDespesa(mes, linha.dataset.abrirEdicao));
  });
}

function iniciarBuscaEFiltros(){
  const campoBusca = document.getElementById("despesas-busca");
  if (campoBusca){
    campoBusca.addEventListener("input", (e) => {
      despesasFiltroBusca = e.target.value;
      renderizarListaDespesas(estado.mesSelecionado);
    });
  }
  document.querySelectorAll("#despesas-filtros .chip-opcao").forEach(chip => {
    chip.addEventListener("click", () => {
      despesasFiltroRapido = chip.dataset.filtro;
      document.querySelectorAll("#despesas-filtros .chip-opcao").forEach(c => c.classList.remove("ativo"));
      chip.classList.add("ativo");
      vibrarLeve();
      renderizarListaDespesas(estado.mesSelecionado);
    });
  });
}

function escaparHTML(str){
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
function formatarDataBR(iso){
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

// ---------------------------------------------------------------
// MODAL: RENDA (criar e editar)
// ---------------------------------------------------------------
let rendaEmEdicao = null; // { mes, id } ou null quando é uma renda nova

function abrirModalRenda(mes, id){
  const r = estado.meses[mes].renda.find(r => r.id === id);
  rendaEmEdicao = { mes, id };
  document.getElementById("renda-descricao").value = r ? r.descricao : "";
  document.getElementById("renda-valor").value = r ? r.valor : "";
  document.querySelector("#modal-renda h3").textContent = "Editar renda";
  document.getElementById("modal-renda").classList.remove("hidden");
}

function iniciarModalRenda(){
  ativarMicrofoneEm("btn-microfone-renda", "renda-descricao");
  document.getElementById("btn-add-renda").addEventListener("click", () => {
    rendaEmEdicao = null;
    document.querySelector("#modal-renda h3").textContent = "Adicionar renda";
    document.getElementById("renda-descricao").value = "";
    document.getElementById("renda-valor").value = "";
    document.getElementById("modal-renda").classList.remove("hidden");
  });
  document.getElementById("renda-cancelar").addEventListener("click", () => document.getElementById("modal-renda").classList.add("hidden"));
  document.getElementById("renda-confirmar").addEventListener("click", () => {
    const descricao = document.getElementById("renda-descricao").value.trim();
    const valor = parseFloat(document.getElementById("renda-valor").value);
    if (!descricao || !valor || valor <= 0) { mostrarToast("Preencha descrição e valor."); return; }

    if (rendaEmEdicao){
      editarRenda(rendaEmEdicao.mes, rendaEmEdicao.id, descricao, valor);
      mostrarToast("Renda atualizada!");
    } else {
      adicionarRenda(estado.mesSelecionado, descricao, valor);
      mostrarToast("Renda adicionada!");
    }
    document.getElementById("modal-renda").classList.add("hidden");
    renderizarMes(estado.mesSelecionado);
  });
}

// ---------------------------------------------------------------
// MODAL: DESPESA (criar e editar)
// ---------------------------------------------------------------
function popularSelectCategorias(){
  const select = document.getElementById("despesa-categoria");
  select.innerHTML = CATEGORIAS.map(c => `<option value="${c.id}">${c.emoji} ${c.nome}</option>`).join("");
}

let despesaEmEdicao = null; // { mes, id } ou null quando é uma despesa nova
let iconeAtualDespesa = null; // base64 da foto/ícone escolhido (ou null)

function abrirModalDespesa(mes, id){
  const d = estado.meses[mes].despesas.find(d => d.id === id);
  if (!d) return;
  despesaEmEdicao = { mes, id };
  document.getElementById("despesa-modal-titulo").textContent = "Editar despesa";
  document.getElementById("despesa-descricao").value = d.descricao;
  document.getElementById("despesa-valor").value = d.valor;
  document.getElementById("despesa-vencimento").value = d.vencimento;
  document.getElementById("despesa-categoria").value = d.categoria;
  document.getElementById("despesa-pagamento").value = d.tipoPagamento;
  document.getElementById("label-parcelas").classList.toggle("hidden", d.tipoPagamento !== "Parcelado");
  document.getElementById("despesa-parcelas").value = d.parcelas || "";
  document.getElementById("despesa-recorrencia").checked = !!d.recorrente;
  document.getElementById("despesa-recorrencia").disabled = false; // cada mês decide sozinho se repete no seguinte
  const aviso = document.getElementById("despesa-recorrencia-aviso");
  if (aviso){
    aviso.textContent = d.veioDeRecorrencia ? "🔁 Esta conta veio do mês anterior. Tudo aqui é editável — e você decide se ela repete no mês seguinte." : "";
    aviso.classList.toggle("hidden", !d.veioDeRecorrencia);
  }
  document.getElementById("despesa-paga").checked = !!d.paga;
  definirIconeAtual(d.icone || null);
  document.getElementById("modal-despesa").classList.remove("hidden");
}

// Mostra/esconde a prévia da foto e guarda o valor atual (base64) pra salvar junto da despesa
function definirIconeAtual(base64){
  iconeAtualDespesa = base64;
  const preview = document.getElementById("despesa-icone-preview");
  const btnRemover = document.getElementById("btn-remover-icone");
  if (base64){
    preview.src = base64;
    preview.classList.remove("hidden");
    btnRemover.classList.remove("hidden");
  } else {
    preview.classList.add("hidden");
    btnRemover.classList.add("hidden");
  }
}

// Reduz a foto escolhida pra um tamanho pequeno antes de guardar (evita estourar o localStorage)
function redimensionarImagem(arquivo, tamanhoMax){
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, tamanhoMax / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = leitor.result;
    };
    leitor.onerror = reject;
    leitor.readAsDataURL(arquivo);
  });
}

// ---------------------------------------------------------------
// MICROFONE (Web Speech API) — reutilizável em qualquer campo de texto.
// O teclado do Android já tem microfone próprio em qualquer campo;
// isso aqui é só um atalho extra dentro do próprio app, com o
// mesmo resultado (dita e preenche o campo sozinho).
// ---------------------------------------------------------------
function ativarMicrofoneEm(idBotao, idCampo, aoTerminar){
  const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btnMicrofone = document.getElementById(idBotao);
  if (!btnMicrofone) return;

  if (!SpeechRecognitionAPI){
    btnMicrofone.classList.add("hidden");
    return;
  }

  const reconhecimento = new SpeechRecognitionAPI();
  reconhecimento.lang = "pt-BR";
  reconhecimento.interimResults = false;
  reconhecimento.maxAlternatives = 1;
  reconhecimento.onresult = (e) => {
    document.getElementById(idCampo).value = e.results[0][0].transcript;
    if (aoTerminar) aoTerminar();
  };
  reconhecimento.onend = () => btnMicrofone.classList.remove("gravando");
  reconhecimento.onerror = () => { btnMicrofone.classList.remove("gravando"); mostrarToast("Não consegui ouvir — tenta de novo."); };
  btnMicrofone.addEventListener("click", () => {
    btnMicrofone.classList.add("gravando");
    try{ reconhecimento.start(); }catch(e){ btnMicrofone.classList.remove("gravando"); }
  });
  return reconhecimento;
}

function iniciarModalDespesa(){
  popularSelectCategorias();

  document.getElementById("despesa-pagamento").addEventListener("change", (e) => {
    document.getElementById("label-parcelas").classList.toggle("hidden", e.target.value !== "Parcelado");
  });

  document.getElementById("btn-add-despesa").addEventListener("click", () => {
    despesaEmEdicao = null;
    document.getElementById("despesa-modal-titulo").textContent = "Adicionar despesa";
    document.getElementById("despesa-descricao").value = "";
    document.getElementById("despesa-valor").value = "";
    // pré-preenche com o dia 1 do mês/ano corretos (a rolagem de ano automática)
    document.getElementById("despesa-vencimento").value = dataISOParaMes(estado.mesSelecionado, 1);
    document.getElementById("despesa-categoria").selectedIndex = 0;
    document.getElementById("despesa-pagamento").value = "Pix";
    document.getElementById("label-parcelas").classList.add("hidden");
    document.getElementById("despesa-parcelas").value = "";
    document.getElementById("despesa-recorrencia").checked = false;
    document.getElementById("despesa-recorrencia").disabled = false;
    const avisoNovo = document.getElementById("despesa-recorrencia-aviso"); if (avisoNovo) avisoNovo.classList.add("hidden");
    document.getElementById("despesa-paga").checked = false;
    definirIconeAtual(null);
    document.getElementById("modal-despesa").classList.remove("hidden");
  });
  document.getElementById("despesa-cancelar").addEventListener("click", () => document.getElementById("modal-despesa").classList.add("hidden"));

  // Foto/ícone opcional
  const inputIcone = document.getElementById("despesa-icone-input");
  document.getElementById("btn-escolher-icone").addEventListener("click", () => inputIcone.click());
  inputIcone.addEventListener("change", async () => {
    if (!inputIcone.files[0]) return;
    try{
      const base64 = await redimensionarImagem(inputIcone.files[0], 200);
      definirIconeAtual(base64);
    }catch(e){ mostrarToast("Não foi possível carregar essa imagem."); }
    inputIcone.value = "";
  });
  document.getElementById("btn-remover-icone").addEventListener("click", () => definirIconeAtual(null));

  ativarMicrofoneEm("btn-microfone-despesa", "despesa-descricao");

  document.getElementById("despesa-confirmar").addEventListener("click", () => {
    const descricao = document.getElementById("despesa-descricao").value.trim();
    const valor = parseFloat(document.getElementById("despesa-valor").value);
    const vencimento = document.getElementById("despesa-vencimento").value;
    if (!descricao || !valor || valor <= 0 || !vencimento) { mostrarToast("Preencha descrição, valor e vencimento."); return; }

    const dados = {
      descricao, valor, vencimento,
      categoria: document.getElementById("despesa-categoria").value,
      tipoPagamento: document.getElementById("despesa-pagamento").value,
      parcelas: document.getElementById("despesa-parcelas").value,
      icone: iconeAtualDespesa,
      paga: document.getElementById("despesa-paga").checked,
      recorrente: document.getElementById("despesa-recorrencia").checked
    };

    const textoRecorrencia = (r) => {
      if (!r) return null;
      if (!r.ok) return "Esse é o último mês do ciclo — não dá pra repetir no seguinte.";
      return `Enviada para ${NOMES_MESES[r.mes-1]}! Lá você pode editar tudo.`;
    };
    if (despesaEmEdicao){
      const r = editarDespesa(despesaEmEdicao.mes, despesaEmEdicao.id, dados);
      mostrarToast(textoRecorrencia(r) || "Despesa atualizada!");
    } else {
      const { copia } = adicionarDespesa(estado.mesSelecionado, dados);
      mostrarToast(dados.recorrente ? (textoRecorrencia(copia) || "Despesa adicionada!") : "Despesa adicionada!");
    }

    document.getElementById("modal-despesa").classList.add("hidden");
    renderizarMes(estado.mesSelecionado);
  });
}

// ---------------------------------------------------------------
// INICIALIZAÇÃO
// ---------------------------------------------------------------
function iniciarFormatar(){
  document.getElementById("btn-formatar-mes").addEventListener("click", () => {
    const mes = estado.mesSelecionado;
    confirmarElegante(`Formatar ${NOMES_MESES[mes-1]}? Isso apaga toda renda e despesas SÓ deste mês. Essa ação não pode ser desfeita.`, () => {
      limparMes(mes);
      renderizarMes(mes);
      mostrarToast(`${NOMES_MESES[mes-1]} foi formatado.`);
    }, { titulo: "🗑️ Formatar mês", textoConfirmar: "Formatar" });
  });

  const btnFormatarTudo = document.getElementById("btn-formatar-tudo"); // não está mais na Home (use Configurações → Apagar todos os dados)
  if (btnFormatarTudo) btnFormatarTudo.addEventListener("click", () => {
    confirmarElegante("Todos os dados financeiros salvos neste dispositivo serão apagados. Essa ação não poderá ser desfeita sem um backup.", () => {
      confirmarElegante("Tem certeza mesmo? Essa é a última confirmação — os dados serão apagados agora.", () => {
        apagarTodosOsDados();
        renderizarPainel();
        renderizarMes(estado.mesSelecionado);
        mostrarToast("Todos os dados foram apagados.");
      }, { titulo: "🚨 Última confirmação", textoConfirmar: "Apagar tudo agora" });
    }, { titulo: "🚨 Atenção", textoConfirmar: "Continuar" });
  });
}

function iniciarVozPainel(){
  document.getElementById("btn-voz-painel").addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    document.querySelector('[data-tab="tab-mes"]').classList.add("active");
    document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
    document.getElementById("tab-mes").classList.add("active");
    renderizarMes(estado.mesSelecionado);

    document.getElementById("btn-add-despesa").click();
    setTimeout(() => document.getElementById("btn-microfone-despesa").click(), 250);
  });
}

function iniciarEfeitoTopoRolagem(){
  const topbar = document.querySelector(".topbar");
  window.addEventListener("scroll", () => {
    topbar.classList.toggle("rolado", window.scrollY > 8);
  }, { passive: true });
}

function iniciarApp(){
  try{ desfazerCartoesEspalhados(); }catch(err){ console.warn("Migração de cartões:", err); }
  iniciarNavegacao();
  iniciarTema();
  iniciarModalRenda();
  iniciarModalDespesa();
  iniciarNotificacoes();
  iniciarBackup();
  iniciarConfiguracoes();
  iniciarOnboarding();
  iniciarAlertaEmTela();
  iniciarFormatar();
  iniciarVozPainel();
  iniciarEfeitoTopoRolagem();
  iniciarModalCartao();
  iniciarModalCartaoDetalhe();
  iniciarCentralCartoes();
  iniciarComprasPendentes();
  iniciarModalMeta();
  iniciarCalendarioFinanceiro();
  iniciarBuscaEFiltros();
  mostrarSkeletonEm("tab-painel", SKELETON_BLOCOS_POR_ABA["tab-painel"]);
  renderizarPainel();

  window.addEventListener("beforeunload", () => {
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(estado)); }catch(e){}
  });
}

document.addEventListener("DOMContentLoaded", iniciarApp);


// ---------------------------------------------------------------
// Ocultar/mostrar valores do Painel (ícone do olho no card de saldo)
// ---------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const olho = document.getElementById("hero-olho");
  if (!olho) return;
  olho.addEventListener("click", () => document.body.classList.toggle("valores-ocultos"));
});
