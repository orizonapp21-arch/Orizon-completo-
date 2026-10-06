/* ============================================================
   Orizon — cartoes.js
   Interface dos cartões de crédito: cadastro (com foto opcional),
   e o modal de detalhe onde dá pra lançar compras uma a uma ou
   simplesmente informar o total da fatura.
   ============================================================ */

let cartaoIconeAtual = null;
let cartaoEmEdicaoId = null; // id do cartão aberto no modal de detalhe

function renderizarCartoes(mes){
  sincronizarCartoesCentral();
  const lista = document.getElementById("cartoes-lista");
  const cartoes = estado.meses[mes].cartoes;
  const mesAtualNum = new Date().getMonth() + 1;
  lista.innerHTML = cartoes.length === 0
    ? `<p class="lista-vazia">Nenhum cartão cadastrado neste mês.</p>`
    : cartoes.map(c => {
      const total = totalCartao(c);
      const cc = c.centralId ? acharCentral(c.centralId) : null;
      const iconeHtml = cc
        ? logoBancoHtml(cc.bancoId, cc.foto, "p")
        : (c.icone ? `<img src="${c.icone}" class="item-icone-foto" alt="">` : `<span class="item-icone-emoji">💳</span>`);
      const pctUso = percentualUsoCartao(c);
      const disponivel = disponivelAtualCartao(c);

      let barraHtml;
      if (pctUso != null){
        const pctExibicao = Math.min(100, pctUso);
        const corBarra = pctUso > 100 ? "var(--vermelho)" : pctUso > 80 ? "var(--ambar)" : "var(--verde)";
        barraHtml = `
          <div class="cartao-disponivel">
            <span class="cartao-disponivel-rotulo">${cc ? "Disponível agora (faturas em aberto de todos os meses já descontadas)" : "Disponível para usar agora"}</span>
            <strong class="cartao-disponivel-valor" style="color:${disponivel < 0 ? "var(--vermelho)" : "var(--verde)"};">${formatarMoeda(disponivel)}</strong>
          </div>
          <div class="cartao-uso-linha">
            <span>Limite total: ${formatarMoeda(c.limite)}</span>
            <span class="cartao-uso-pct" style="color:${corBarra};">${Math.round(pctUso)}% usado</span>
          </div>
          <div class="meta-barra-fundo cartao-barra-fundo"><div class="meta-barra-preenchida" style="width:${pctExibicao}%; background:${corBarra};"></div></div>`;
      } else {
        barraHtml = `<span class="item-sub">Toque no cartão e informe o limite para ver quanto ainda dá pra usar.</span>`;
      }

      const chips = [
        c.fechamento ? `<span class="chip-status chip-pendente">Fecha dia ${c.fechamento}</span>` : "",
        c.vencimento ? `<span class="chip-status chip-vencendo">Vence dia ${c.vencimento}</span>` : "",
        c.recorrente ? `<span class="chip-status chip-pendente">🔁 repete no mês seguinte</span>` : "",
        c.veioDeRecorrencia ? `<span class="chip-status chip-pendente">↩ veio do mês anterior</span>` : ""
      ].join("");

      return `<div class="item-linha item-linha-despesa item-linha-expandida cartao-card" data-abrir-cartao="${c.id}" style="cursor:pointer;">
        <div class="item-linha-topo">
          <span class="item-titulo-grande">${iconeHtml} ${escaparHTML(c.nome)}</span>
          <span class="item-valor"><span class="swatch swatch-vermelho"></span>${formatarMoeda(total)}</span>
        </div>
        <span class="item-sub">${cc ? `Total do mês + parceladas · toque para lançar` : c.modo === "total" ? "Fatura lançada pelo total do mês" : c.modo === "semana" ? "Lançamento por semana" : `${c.compras.length} compra(s) lançada(s)`}</span>
        <div class="cartao-datas">${chips}<button type="button" class="chip-status ${c.paga ? "chip-pago" : "chip-pendente"} chip-clicavel" data-pagar-cartao="${c.id}">${c.paga ? (cc ? "✓ Paga — limite liberado" : "✓ Fatura paga") : "Fatura pendente"}</button></div>
        ${barraHtml}
      </div>`;
    }).join("");

  lista.querySelectorAll("[data-abrir-cartao]").forEach(el => {
    el.addEventListener("click", () => abrirModalCartaoDetalhe(mes, el.dataset.abrirCartao));
  });
  lista.querySelectorAll("[data-pagar-cartao]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const cartao = estado.meses[mes].cartoes.find(x => x.id === btn.dataset.pagarCartao);
      definirCartaoPago(mes, btn.dataset.pagarCartao, !cartao.paga);
      vibrarLeve();
      renderizarMes(mes);
    });
  });
}

// ---------------------------------------------------------------
// MODAL: novo cartão
// ---------------------------------------------------------------
function iniciarModalCartao(){
  ativarMicrofoneEm("btn-microfone-cartao", "cartao-nome");
  document.getElementById("btn-add-cartao").addEventListener("click", () => {
    document.getElementById("cartao-modal-titulo").textContent = "Adicionar cartão";
    document.getElementById("cartao-nome").value = "";
    document.getElementById("cartao-limite").value = "";
    document.getElementById("cartao-disponivel").value = "";
    document.getElementById("cartao-recorrencia").checked = false;
    document.getElementById("cartao-fechamento").value = "";
    document.getElementById("cartao-vencimento-dia").value = "";
    definirIconeCartaoAtual(null);
    document.getElementById("modal-cartao").classList.remove("hidden");
  });
  document.getElementById("cartao-cancelar").addEventListener("click", () => document.getElementById("modal-cartao").classList.add("hidden"));

  const inputIcone = document.getElementById("cartao-icone-input");
  document.getElementById("btn-escolher-icone-cartao").addEventListener("click", () => inputIcone.click());
  inputIcone.addEventListener("change", async () => {
    if (!inputIcone.files[0]) return;
    try{
      const base64 = await redimensionarImagem(inputIcone.files[0], 200);
      definirIconeCartaoAtual(base64);
    }catch(e){ mostrarToast("Não foi possível carregar essa imagem."); }
    inputIcone.value = "";
  });
  document.getElementById("btn-remover-icone-cartao").addEventListener("click", () => definirIconeCartaoAtual(null));

  document.getElementById("cartao-confirmar").addEventListener("click", () => {
    const nome = document.getElementById("cartao-nome").value.trim();
    if (!nome) { mostrarToast("Dê um nome pro cartão."); return; }
    const limite = parseFloat(document.getElementById("cartao-limite").value);
    if (!limite || limite <= 0) { mostrarToast("Informe o limite total do cartão."); return; }
    const dispTexto = document.getElementById("cartao-disponivel").value;
    if (dispTexto !== "" && parseFloat(dispTexto) > limite) mostrarToast("O disponível não pode passar do limite — ajustei para o limite.");
    const recorrente = document.getElementById("cartao-recorrencia").checked;
    const { copia } = adicionarCartao(estado.mesSelecionado, {
      nome,
      icone: cartaoIconeAtual,
      limite,
      disponivel: dispTexto,
      fechamento: document.getElementById("cartao-fechamento").value,
      vencimento: document.getElementById("cartao-vencimento-dia").value,
      recorrente
    });
    document.getElementById("modal-cartao").classList.add("hidden");
    renderizarCartoes(estado.mesSelecionado);
    renderizarMes(estado.mesSelecionado);
    mostrarToast(recorrente ? textoResultadoCartao(copia) : "Cartão adicionado!");
    vibrarLeve();
  });
}

function textoResultadoCartao(r){
  if (!r) return "Cartão atualizado!";
  if (!r.ok) return "Esse é o último mês do ciclo — não dá pra repetir no seguinte.";
  return `Cartão enviado para ${NOMES_MESES[r.mes-1]}! Lá ele começa com o que sobrar daqui.`;
}

function definirIconeCartaoAtual(base64){
  cartaoIconeAtual = base64;
  const preview = document.getElementById("cartao-icone-preview");
  const btnRemover = document.getElementById("btn-remover-icone-cartao");
  if (base64){
    preview.src = base64;
    preview.classList.remove("hidden");
    btnRemover.classList.remove("hidden");
  } else {
    preview.classList.add("hidden");
    btnRemover.classList.add("hidden");
  }
}

// ---------------------------------------------------------------
// MODAL: detalhe do cartão (compras ou total)
// ---------------------------------------------------------------
function abrirModalCartaoDetalhe(mes, cartaoId){
  const cartao = estado.meses[mes].cartoes.find(c => c.id === cartaoId);
  if (!cartao) return;
  cartaoEmEdicaoId = cartaoId;

  document.getElementById("cartao-detalhe-nome").textContent = cartao.nome;
  document.getElementById("cartao-total-manual").value = cartao.totalManual || "";
  document.getElementById("cartao-detalhe-limite").value = cartao.limite || "";
  document.getElementById("cartao-detalhe-fechamento").value = cartao.fechamento || "";
  document.getElementById("cartao-detalhe-vencimento").value = cartao.vencimento || "";
  document.getElementById("cartao-detalhe-disponivel").value = disponivelInicialCartao(cartao);
  document.getElementById("cartao-detalhe-paga").checked = !!cartao.paga;
  document.getElementById("cartao-detalhe-recorrencia").checked = !!cartao.recorrente;
  atualizarLimiteDisponivelExibido(cartao);
  alternarModoCartaoNaTela(cartao.modo);
  // Cartão da Central: limite/datas ficam na Central; aqui só total do mês + compras/parcelas
  const ligado = !!cartao.centralId;
  document.getElementById("modal-cartao-detalhe").classList.toggle("cartao-ligado", ligado);
  if (ligado){
    document.getElementById("cartao-modo-itens").classList.remove("hidden");
    document.getElementById("cartao-modo-total").classList.remove("hidden");
    document.getElementById("cartao-modo-semana").classList.add("hidden");
  }
  document.getElementById("compra-parcelas").value = "";
  renderizarSemanasCartao(cartao);
  renderizarComprasCartao(cartao);
  atualizarTotalExibidoCartao(cartao);

  document.getElementById("modal-cartao-detalhe").classList.remove("hidden");
}

function alternarModoCartaoNaTela(modo){
  document.querySelectorAll("#modal-cartao-detalhe .chip-opcao").forEach(chip => {
    chip.classList.toggle("ativo", chip.dataset.modo === modo);
  });
  document.getElementById("cartao-modo-itens").classList.toggle("hidden", modo !== "itens");
  document.getElementById("cartao-modo-semana").classList.toggle("hidden", modo !== "semana");
  document.getElementById("cartao-modo-total").classList.toggle("hidden", modo !== "total");
}

const FAIXAS_SEMANAS = ["Dias 1 a 7", "Dias 8 a 14", "Dias 15 a 21", "Dias 22 a 28", "Dia 29 em diante"];
function renderizarSemanasCartao(cartao){
  const box = document.getElementById("cartao-semanas-lista");
  if (!box) return;
  if (!Array.isArray(cartao.semanas)) cartao.semanas = [0,0,0,0,0];
  box.innerHTML = FAIXAS_SEMANAS.map((rotulo, i) => `
    <label class="linha-semana"><span><strong>Semana ${i+1}</strong> <small>${rotulo}</small></span>
      <input type="number" inputmode="decimal" min="0" step="0.01" placeholder="0,00" data-semana="${i}" value="${cartao.semanas[i] || ""}">
    </label>`).join("");
  box.querySelectorAll("[data-semana]").forEach(inp => {
    inp.addEventListener("input", () => {
      definirValorSemanaCartao(estado.mesSelecionado, cartaoEmEdicaoId, Number(inp.dataset.semana), inp.value);
      const atual = estado.meses[estado.mesSelecionado].cartoes.find(x => x.id === cartaoEmEdicaoId);
      atualizarTotalExibidoCartao(atual);
      atualizarLimiteDisponivelExibido(atual);
      renderizarCartoes(estado.mesSelecionado);
      renderizarMes(estado.mesSelecionado);
    });
  });
}

function renderizarComprasCartao(cartao){
  const lista = document.getElementById("cartao-compras-lista");
  lista.innerHTML = cartao.compras.length === 0
    ? `<p class="lista-vazia">Nenhuma compra lançada ainda.</p>`
    : cartao.compras.map(c => `
      <div class="item-linha">
        <div class="item-info"><span class="item-titulo">${escaparHTML(c.descricao)}</span>${c.dataCompra ? `<span class="item-sub">${dataBRCompra(c.dataCompra)}${c.horaCompra ? " · " + c.horaCompra : ""}${c.categoria ? " · " + categoriaPorId(c.categoria).emoji + " " + categoriaPorId(c.categoria).nome : ""}</span>` : ""}</div>
        <span class="item-valor">${formatarMoeda(c.valor)}</span>
        <button class="item-remover" data-remover-compra="${c.id}">✕</button>
      </div>`).join("");
  lista.querySelectorAll("[data-remover-compra]").forEach(btn => {
    btn.addEventListener("click", () => {
      removerCompraCartao(estado.mesSelecionado, cartaoEmEdicaoId, btn.dataset.removerCompra);
      const cartaoAtualizado = estado.meses[estado.mesSelecionado].cartoes.find(c => c.id === cartaoEmEdicaoId);
      renderizarComprasCartao(cartaoAtualizado);
      atualizarTotalExibidoCartao(cartaoAtualizado);
      atualizarLimiteDisponivelExibido(cartaoAtualizado);
      renderizarCartoes(estado.mesSelecionado);
      renderizarMes(estado.mesSelecionado);
    });
  });
}

function atualizarTotalExibidoCartao(cartao){
  document.getElementById("cartao-total-exibido").textContent = "Total: " + formatarMoeda(totalCartao(cartao));
}

function atualizarLimiteDisponivelExibido(cartao){
  const el = document.getElementById("cartao-limite-disponivel-exibido");
  if (!el) return;
  if (!(cartao.limite > 0)){ el.innerHTML = "Informe o limite total acima para acompanhar quanto ainda dá pra usar."; return; }
  const disp = disponivelAtualCartao(cartao);
  const origem = cartao.herdaDisponivel && cartao.origemId ? acharCartaoPorId(cartao.origemId) : null;
  const nota = origem ? `<br><small>O início veio de ${NOMES_MESES[origem.mes-1]}: foi o que sobrou lá. Se digitar outro valor, deixa de acompanhar.</small>` : "";
  el.innerHTML = `Disponível para usar agora: <strong style="color:${disp < 0 ? "var(--vermelho)" : "var(--verde)"};">${formatarMoeda(disp)}</strong> <small>(início ${formatarMoeda(disponivelInicialCartao(cartao))} − gastos ${formatarMoeda(totalCartao(cartao))})</small>${nota}`;
}

function iniciarModalCartaoDetalhe(){
  ativarMicrofoneEm("btn-microfone-compra", "compra-descricao");
  document.querySelectorAll("#modal-cartao-detalhe .chip-opcao").forEach(chip => {
    chip.addEventListener("click", () => {
      definirModoCartao(estado.mesSelecionado, cartaoEmEdicaoId, chip.dataset.modo);
      alternarModoCartaoNaTela(chip.dataset.modo);
      const cartao = estado.meses[estado.mesSelecionado].cartoes.find(c => c.id === cartaoEmEdicaoId);
      atualizarTotalExibidoCartao(cartao);
      atualizarLimiteDisponivelExibido(cartao);
      renderizarCartoes(estado.mesSelecionado);
      renderizarMes(estado.mesSelecionado);
    });
  });

  document.getElementById("btn-add-compra").addEventListener("click", () => {
    const descricao = document.getElementById("compra-descricao").value.trim();
    const valor = parseFloat(document.getElementById("compra-valor").value);
    if (!descricao || !valor || valor <= 0) { mostrarToast("Preencha a descrição e o valor da compra."); return; }
    const entradaAtual = estado.meses[estado.mesSelecionado].cartoes.find(c => c.id === cartaoEmEdicaoId);
    const parcelas = parseInt(document.getElementById("compra-parcelas").value, 10) || 1;
    if (entradaAtual && entradaAtual.centralId && parcelas > 1){
      const r = adicionarCompraParceladaCentral(estado.mesSelecionado, cartaoEmEdicaoId, descricao, valor, parcelas);
      mostrarToast(r.colocadas < r.total ? `Só coube ${r.colocadas} de ${r.total} parcelas no ciclo de 12 meses.` : `${r.total} parcelas lançadas nos meses seguintes.`);
    } else {
      adicionarCompraCartao(estado.mesSelecionado, cartaoEmEdicaoId, descricao, valor);
    }
    document.getElementById("compra-parcelas").value = "";
    document.getElementById("compra-descricao").value = "";
    document.getElementById("compra-valor").value = "";
    const cartao = estado.meses[estado.mesSelecionado].cartoes.find(c => c.id === cartaoEmEdicaoId);
    renderizarComprasCartao(cartao);
    atualizarTotalExibidoCartao(cartao);
    atualizarLimiteDisponivelExibido(cartao);
    renderizarCartoes(estado.mesSelecionado);
    renderizarMes(estado.mesSelecionado);
  });

  document.getElementById("cartao-total-manual").addEventListener("input", (e) => {
    definirTotalManualCartao(estado.mesSelecionado, cartaoEmEdicaoId, e.target.value);
    const cartao = estado.meses[estado.mesSelecionado].cartoes.find(c => c.id === cartaoEmEdicaoId);
    atualizarTotalExibidoCartao(cartao);
    atualizarLimiteDisponivelExibido(cartao);
    renderizarCartoes(estado.mesSelecionado);
    renderizarMes(estado.mesSelecionado);
  });

  // Limite, dia de fechamento e dia de vencimento — editáveis a qualquer momento
  ["cartao-detalhe-limite","cartao-detalhe-fechamento","cartao-detalhe-vencimento"].forEach(id => {
    document.getElementById(id).addEventListener("input", () => {
      editarLimiteDatasCartao(estado.mesSelecionado, cartaoEmEdicaoId, {
        limite: document.getElementById("cartao-detalhe-limite").value,
        fechamento: document.getElementById("cartao-detalhe-fechamento").value,
        vencimento: document.getElementById("cartao-detalhe-vencimento").value
      });
      const cartao = estado.meses[estado.mesSelecionado].cartoes.find(c => c.id === cartaoEmEdicaoId);
      atualizarLimiteDisponivelExibido(cartao);
      renderizarCartoes(estado.mesSelecionado);
    });
  });

  // Disponível no início do mês (ponto de partida; os gastos vão diminuindo)
  document.getElementById("cartao-detalhe-disponivel").addEventListener("input", (e) => {
    definirDisponivelInicialCartao(estado.mesSelecionado, cartaoEmEdicaoId, e.target.value);
    const cartao = estado.meses[estado.mesSelecionado].cartoes.find(c => c.id === cartaoEmEdicaoId);
    atualizarLimiteDisponivelExibido(cartao);
    renderizarCartoes(estado.mesSelecionado);
  });

  // Fatura paga neste mês?
  document.getElementById("cartao-detalhe-paga").addEventListener("change", (e) => {
    definirCartaoPago(estado.mesSelecionado, cartaoEmEdicaoId, e.target.checked);
    renderizarCartoes(estado.mesSelecionado);
    renderizarMes(estado.mesSelecionado);
  });

  // Repetir no mês seguinte?
  document.getElementById("cartao-detalhe-recorrencia").addEventListener("change", (e) => {
    const r = definirCartaoRecorrente(estado.mesSelecionado, cartaoEmEdicaoId, e.target.checked);
    if (e.target.checked && r && !r.ok) e.target.checked = false;
    if (e.target.checked) mostrarToast(textoResultadoCartao(r));
    else if (r && r.mantida) mostrarToast(`A cópia de ${NOMES_MESES[r.mes-1]} já tem gastos e foi mantida.`);
    else if (r && r.removida) mostrarToast(`Cartão removido de ${NOMES_MESES[r.mes-1]}.`);
    renderizarCartoes(estado.mesSelecionado);
  });

  document.getElementById("btn-remover-cartao").addEventListener("click", () => {
    confirmarElegante("Remover este cartão deste mês, com todas as compras lançadas nele? Os outros meses não são afetados.", () => {
      removerCartao(estado.mesSelecionado, cartaoEmEdicaoId);
      document.getElementById("modal-cartao-detalhe").classList.add("hidden");
      renderizarCartoes(estado.mesSelecionado);
      renderizarMes(estado.mesSelecionado);
      mostrarToast("Cartão removido.");
    });
  });

  document.getElementById("cartao-detalhe-fechar").addEventListener("click", () => {
    document.getElementById("modal-cartao-detalhe").classList.add("hidden");
  });
}
