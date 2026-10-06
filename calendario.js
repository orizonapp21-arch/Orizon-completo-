/* ============================================================
   Orizon — calendario.js
   Visualização em calendário mensal dentro da aba "Mês": cada dia
   mostra quantas contas vencem ali e o valor total, colorido em
   verde quando tudo já foi pago e em vermelho quando há pendência.
   Tocar num dia abre as despesas daquele dia num modal.
   ============================================================ */

const NOMES_DIAS_SEMANA = ["D","S","T","Q","Q","S","S"];

function renderizarCalendarioFinanceiro(mes){
  const container = document.getElementById("calendario-financeiro");
  if (!container) return;

  const ano = anoParaMes(mes);
  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay();
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const despesas = estado.meses[mes].despesas;

  let html = `<div class="calendario-cabecalho">${NOMES_DIAS_SEMANA.map(d => `<span>${d}</span>`).join("")}</div>`;
  html += `<div class="calendario-grade">`;
  for (let i = 0; i < primeiroDiaSemana; i++) html += `<div class="calendario-dia calendario-dia-vazio"></div>`;

  for (let dia = 1; dia <= ultimoDia; dia++){
    const iso = dataISOParaMes(mes, dia);
    const despesasDoDia = despesas.filter(d => d.vencimento === iso);
    let classeStatus = "dia-sem-contas";
    if (despesasDoDia.length > 0){
      classeStatus = despesasDoDia.every(d => d.paga) ? "dia-tudo-pago" : "dia-tem-pendencia";
    }
    const totalDia = despesasDoDia.reduce((s, d) => s + Number(d.valor || 0), 0);
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const ehHoje = new Date(iso + "T00:00:00").getTime() === hoje.getTime();

    html += `<button type="button" class="calendario-dia ${classeStatus} ${ehHoje ? "calendario-dia-hoje" : ""}" data-dia-iso="${iso}">
      <span class="calendario-dia-numero">${dia}</span>
      ${despesasDoDia.length > 0 ? `<span class="calendario-dia-badge">${despesasDoDia.length}</span><span class="calendario-dia-valor">${formatarMoedaCurta(totalDia)}</span>` : ""}
    </button>`;
  }
  html += `</div>`;
  container.innerHTML = html;

  container.querySelectorAll("[data-dia-iso]").forEach(el => {
    el.addEventListener("click", () => abrirModalDiaCalendario(mes, el.dataset.diaIso));
  });
}

function abrirModalDiaCalendario(mes, iso){
  const despesasDoDia = estado.meses[mes].despesas.filter(d => d.vencimento === iso);
  const [ano, m, dia] = iso.split("-");
  document.getElementById("calendario-dia-titulo").textContent = `Despesas de ${dia}/${m}/${ano}`;

  const lista = document.getElementById("calendario-dia-lista");
  lista.innerHTML = despesasDoDia.length === 0
    ? `<p class="lista-vazia">Nenhuma despesa vence neste dia.</p>`
    : despesasDoDia.map(d => {
      const cat = categoriaPorId(d.categoria);
      return `<div class="item-linha" data-abrir-despesa="${d.id}" style="cursor:pointer;">
        <div class="item-info">
          <span class="item-titulo">${cat.emoji} ${escaparHTML(d.descricao)}</span>
          <span class="item-sub">${cat.nome}</span>
        </div>
        <span class="item-valor">${formatarMoeda(d.valor)}</span>
        <span class="chip-status ${d.paga ? "chip-pago" : "chip-pendente"}">${d.paga ? "Pago" : "Pendente"}</span>
      </div>`;
    }).join("");

  lista.querySelectorAll("[data-abrir-despesa]").forEach(el => {
    el.addEventListener("click", () => {
      document.getElementById("modal-calendario-dia").classList.add("hidden");
      abrirModalDespesa(mes, el.dataset.abrirDespesa);
    });
  });

  document.getElementById("modal-calendario-dia").classList.remove("hidden");
}

function iniciarCalendarioFinanceiro(){
  document.getElementById("calendario-dia-fechar").addEventListener("click", () => {
    document.getElementById("modal-calendario-dia").classList.add("hidden");
  });
}
