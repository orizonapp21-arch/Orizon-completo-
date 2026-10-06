/* ============================================================
   Orizon — cartoes-central.js
   CENTRAL DOS CARTÕES: cadastro único (crédito ou débito, com logo
   do banco ou foto própria) + regra do limite.

   Regra do limite (só cartão de CRÉDITO mexe no limite):
     disponível = limite + ajuste − faturas ainda NÃO pagas
   • Toda fatura/parcela lançada em QUALQUER mês (inclusive meses
     futuros) já "prende" limite até ser marcada como paga.
   • Marcou a fatura do mês como paga → o limite daquele valor volta.
   • "Ajuste" = diferença que você informa para o disponível bater
     com o app do banco (disponível agora digitado − calculado).
   • Dentro de cada mês o cartão aparece sozinho; o disponível dele
     mostra o limite livre a partir daquele mês (já descontando as
     faturas daquele mês em diante).
   ============================================================ */

let centralTipoAtivo = "credito";   // aba Crédito/Débito da Central
let centralEditandoId = null;       // null = cadastrando cartão novo
let centralFotoAtual = null;
let centralBancoAtual = null;
let centralTipoModal = "credito";

// ---------------------------------------------------------------
// LÓGICA
// ---------------------------------------------------------------
function ordemCronologicaMes(m){ return anoParaMes(m) * 100 + m; }
function mesesEmOrdem(){
  return [1,2,3,4,5,6,7,8,9,10,11,12].sort((a, b) => ordemCronologicaMes(a) - ordemCronologicaMes(b));
}
function acharCentral(id){
  return (estado.cartoesCentral || []).find(c => c.id === id) || null;
}

function entradasDoCartaoCentral(centralId){
  return mesesEmOrdem()
    .map(m => ({ mes: m, entrada: estado.meses[m].cartoes.find(c => c.centralId === centralId) }))
    .filter(x => x.entrada);
}

// Soma das faturas NÃO pagas (de qualquer mês, ou só dos meses a partir de "aPartirDoMes")
function usoCartaoCentral(centralId, aPartirDoMes){
  const min = aPartirDoMes ? ordemCronologicaMes(aPartirDoMes) : 0;
  return entradasDoCartaoCentral(centralId)
    .filter(x => !x.entrada.paga && ordemCronologicaMes(x.mes) >= min)
    .reduce((s, x) => s + totalCartao(x.entrada), 0);
}
// Limite total = limite normal + limite adicional de Pix no crédito (ex.: Nubank)
function limiteTotalCentral(cc){
  return Number(cc.limite || 0) + Number(cc.limiteAdicional || 0);
}
function disponivelCentral(cc, aPartirDoMes){
  return limiteTotalCentral(cc) + Number(cc.ajusteDisponivel || 0) - usoCartaoCentral(cc.id, aPartirDoMes);
}

// Garante 1 entrada por mês para cada cartão de crédito da Central e espelha nome/limite/datas.
function sincronizarCartoesCentral(){
  if (!Array.isArray(estado.cartoesCentral)) estado.cartoesCentral = [];
  let mudou = false;
  estado.cartoesCentral.forEach(cc => {
    if (cc.tipo !== "credito") return;
    for (let m = 1; m <= 12; m++){
      let e = estado.meses[m].cartoes.find(c => c.centralId === cc.id);
      if (!e){
        e = novoCartao({ nome: cc.nome, limite: cc.limite, modo: "total" });
        e.centralId = cc.id;
        estado.meses[m].cartoes.push(e);
        mudou = true;
      }
      const lim = limiteTotalCentral(cc);
      const fech = cc.fechamento ? Number(cc.fechamento) : null;
      const venc = cc.vencimento ? Number(cc.vencimento) : null;
      if (e.nome !== cc.nome || e.limite !== lim || e.fechamento !== fech || e.vencimento !== venc || e.icone){
        e.nome = cc.nome; e.limite = lim; e.fechamento = fech; e.vencimento = venc; e.icone = null;
        mudou = true;
      }
    }
  });
  if (mudou) salvarEstado();
}

function criarCartaoCentral(d){
  const tipo = d.tipo === "debito" ? "debito" : "credito";
  const cc = {
    id: gerarId("cc"), tipo,
    bancoId: d.bancoId || null, nome: d.nome, foto: d.foto || null,
    limite: tipo === "credito" ? Number(d.limite || 0) : 0,
    limiteAdicional: tipo === "credito" ? Math.max(0, Number(d.limiteAdicional || 0)) : 0,
    ajusteDisponivel: 0,
    fechamento: d.fechamento ? Number(d.fechamento) : null,
    vencimento: d.vencimento ? Number(d.vencimento) : null
  };
  estado.cartoesCentral.push(cc);
  sincronizarCartoesCentral();
  if (tipo === "credito" && d.disponivel !== "" && d.disponivel != null && !isNaN(Number(d.disponivel))){
    definirDisponivelAgoraCentral(cc.id, Number(d.disponivel));
  }
  salvarEstado();
  return cc;
}

function editarCartaoCentral(id, d){
  const cc = acharCentral(id);
  if (!cc) return;
  cc.nome = d.nome; cc.bancoId = d.bancoId || null; cc.foto = d.foto || null;
  if (cc.tipo === "credito"){
    cc.limite = Number(d.limite || 0);
    cc.limiteAdicional = Math.max(0, Number(d.limiteAdicional || 0));
    cc.fechamento = d.fechamento ? Number(d.fechamento) : null;
    cc.vencimento = d.vencimento ? Number(d.vencimento) : null;
  }
  sincronizarCartoesCentral();
  salvarEstado();
}

// Você digita o disponível que o app do banco mostra; guardamos só a diferença (ajuste).
function definirDisponivelAgoraCentral(id, valor){
  const cc = acharCentral(id);
  if (!cc) return;
  const calculado = limiteTotalCentral(cc) - usoCartaoCentral(id);
  cc.ajusteDisponivel = Math.max(0, Number(valor || 0)) - calculado;
  salvarEstado();
}

function removerCartaoCentral(id){
  estado.cartoesCentral = estado.cartoesCentral.filter(c => c.id !== id);
  for (let m = 1; m <= 12; m++) estado.meses[m].cartoes = estado.meses[m].cartoes.filter(c => c.centralId !== id);
  salvarEstado();
}

// Compra parcelada: cada parcela cai num mês seguinte e já prende limite desde agora.
function adicionarCompraParceladaCentral(mesInicial, entradaId, descricao, valorTotal, parcelas, extras){
  const e = estado.meses[mesInicial].cartoes.find(c => c.id === entradaId);
  if (!e || !e.centralId) return { ok: false };
  const n = Math.max(1, Math.floor(Number(parcelas) || 1));
  const centavos = Math.round(Number(valorTotal) * 100);
  const base = Math.floor(centavos / n), resto = centavos - base * n;
  const grupo = gerarId("pg");
  let m = mesInicial, colocadas = 0;
  for (let i = 0; i < n; i++){
    if (i > 0){ m = proximoMesDoCiclo(m); if (!m) break; }
    const alvo = estado.meses[m].cartoes.find(c => c.centralId === e.centralId);
    if (!alvo) break;
    alvo.compras.push({
      id: gerarId("compra"),
      descricao: n > 1 ? `${descricao} (${i+1}/${n})` : descricao,
      valor: (base + (i === n - 1 ? resto : 0)) / 100,
      pg: n > 1 ? grupo : null, parcela: i + 1, de: n, base: descricao,
      ...(extras || {}) // opcional: dataCompra, horaCompra, categoria, origem… (compras detectadas/confirmadas)
    });
    colocadas++;
  }
  salvarEstado();
  return { ok: true, colocadas, total: n };
}

// Lista de compras parceladas ainda com parcelas em aberto (para a Central)
function comprasParceladasEmAberto(){
  const grupos = {};
  (estado.cartoesCentral || []).forEach(cc => {
    entradasDoCartaoCentral(cc.id).forEach(({ mes, entrada }) => {
      (entrada.compras || []).forEach(c => {
        if (!c.pg) return;
        const g = grupos[c.pg] = grupos[c.pg] || { descricao: c.base || c.descricao, cartao: cc, de: c.de, valorParcela: c.valor, restantes: 0, valorRestante: 0, proximoMes: null, proximaParcela: null };
        if (!entrada.paga){
          g.restantes++; g.valorRestante += Number(c.valor || 0);
          if (g.proximoMes === null){ g.proximoMes = mes; g.proximaParcela = c.parcela; }
        }
      });
    });
  });
  return Object.values(grupos).filter(g => g.restantes > 0);
}

// ---------------------------------------------------------------
// TELA: Central dos Cartões
// ---------------------------------------------------------------
function resumoCentralCredito(){
  const creditos = (estado.cartoesCentral || []).filter(c => c.tipo === "credito");
  const limite = creditos.reduce((s, c) => s + limiteTotalCentral(c), 0);
  const disponivel = creditos.reduce((s, c) => s + disponivelCentral(c), 0);
  const emUso = Math.max(0, limite - disponivel);
  return { limite, disponivel, emUso, pct: limite > 0 ? Math.min(100, (emUso / limite) * 100) : 0, qtd: creditos.length };
}

function corPorUso(pct){ return pct > 100 ? "var(--vermelho)" : pct > 80 ? "var(--ambar)" : "var(--verde)"; }

function renderizarCentralCartoes(){
  sincronizarCartoesCentral();
  document.querySelectorAll("#cc-abas button").forEach(b => b.classList.toggle("ativo", b.dataset.tipo === centralTipoAtivo));

  const resumo = document.getElementById("cc-resumo");
  if (centralTipoAtivo === "credito"){
    const r = resumoCentralCredito();
    const cor = corPorUso(r.pct);
    resumo.classList.remove("hidden");
    resumo.innerHTML = r.qtd === 0
      ? `<p class="config-desc" style="margin:0;">Cadastre seu primeiro cartão de crédito para acompanhar o limite total, o que está em uso e o que ainda dá pra gastar.</p>`
      : `<div class="cc-resumo">
          <div class="cc-resumo-info">
            <span class="cc-rotulo">Limite total dos cartões</span>
            <strong class="cc-grande">${formatarMoeda(r.limite)}</strong>
            <div class="cc-duplo">
              <div><span class="cc-rotulo">● Disponível</span><strong style="color:${r.disponivel < 0 ? "var(--vermelho)" : "var(--verde)"};">${formatarMoeda(r.disponivel)}</strong></div>
              <div><span class="cc-rotulo">● Em uso</span><strong style="color:var(--vermelho);">${formatarMoeda(r.emUso)}</strong></div>
            </div>
          </div>
          <div class="cc-anel" style="--p:${r.pct}; --cor:${cor};"><span>${Math.round(r.pct)}%</span></div>
        </div>`;
  } else {
    resumo.classList.add("hidden");
  }

  const lista = document.getElementById("cc-lista");
  const cartoes = (estado.cartoesCentral || []).filter(c => c.tipo === centralTipoAtivo);
  lista.innerHTML = cartoes.length === 0
    ? `<p class="lista-vazia">Nenhum cartão de ${centralTipoAtivo === "credito" ? "crédito" : "débito"} cadastrado.</p>`
    : cartoes.map(cc => {
        let detalhe;
        if (cc.tipo === "credito"){
          const disp = disponivelCentral(cc);
          const lt = limiteTotalCentral(cc), pct = lt > 0 ? ((lt - disp) / lt) * 100 : 0;
          detalhe = `<span class="cc-linha-limite">Limite ${formatarMoeda(limiteTotalCentral(cc))}${cc.limiteAdicional > 0 ? ` (inclui ${formatarMoeda(cc.limiteAdicional)} de Pix no crédito)` : ""}</span>
            <span class="cc-linha-disp">Disponível: <strong style="color:${disp < 0 ? "var(--vermelho)" : "var(--verde)"};">${formatarMoeda(disp)}</strong></span>
            <div class="meta-barra-fundo cartao-barra-fundo" style="margin-top:6px;"><div class="meta-barra-preenchida" style="width:${Math.max(0, Math.min(100, pct))}%; background:${corPorUso(pct)};"></div></div>`;
        } else {
          detalhe = `<span class="cc-linha-limite">Débito — não usa limite</span>`;
        }
        return `<div class="cc-cartao" data-abrir-central="${cc.id}">
          ${logoBancoHtml(cc.bancoId, cc.foto, "g")}
          <div class="cc-cartao-info"><span class="cc-cartao-nome">${escaparHTML(cc.nome)}</span>${detalhe}</div>
          <span class="chip-status chip-pendente">${cc.tipo === "credito" ? "Crédito" : "Débito"}</span>
        </div>`;
      }).join("");
  lista.querySelectorAll("[data-abrir-central]").forEach(el => el.addEventListener("click", () => abrirModalCartaoCentral(el.dataset.abrirCentral)));

  // Compras parceladas em aberto
  const parc = comprasParceladasEmAberto();
  const boxParc = document.getElementById("cc-parceladas-card");
  boxParc.classList.toggle("hidden", parc.length === 0);
  document.getElementById("cc-parceladas-lista").innerHTML = parc.map(g => `
    <div class="item-linha">
      <div class="item-info">
        <span class="item-titulo">${escaparHTML(g.descricao)}</span>
        <span class="item-sub">${escaparHTML(g.cartao.nome)} · próxima: parcela ${g.proximaParcela}/${g.de} em ${NOMES_MESES[g.proximoMes-1]}</span>
      </div>
      <div style="text-align:right;"><span class="item-valor">${formatarMoeda(g.valorParcela)}</span><br><span class="item-sub">restam ${g.restantes} (${formatarMoeda(g.valorRestante)})</span></div>
    </div>`).join("");
}

// ---------------------------------------------------------------
// MODAL: cadastrar / editar cartão da Central
// ---------------------------------------------------------------
function renderizarGradeBancos(filtro){
  const termo = (filtro || "").trim().toLowerCase();
  const grade = document.getElementById("cc-bancos");
  grade.innerHTML = BANCOS.filter(b => !termo || b.nome.toLowerCase().includes(termo)).map(b => `
    <button type="button" class="cc-banco ${centralBancoAtual === b.id ? "ativo" : ""}" data-banco="${b.id}">
      ${logoBancoHtml(b.id, null, "")}<span>${b.nome}</span>
    </button>`).join("") || `<p class="lista-vazia" style="grid-column:1/-1;">Nenhum banco encontrado — use "Outro banco" abaixo.</p>`;
  grade.querySelectorAll("[data-banco]").forEach(btn => btn.addEventListener("click", () => {
    centralBancoAtual = btn.dataset.banco;
    const b = bancoPorId(centralBancoAtual);
    const nomeEl = document.getElementById("cc-nome");
    const nomesBanco = BANCOS.map(x => x.nome);
    if (!nomeEl.value.trim() || nomesBanco.includes(nomeEl.value.trim())) nomeEl.value = b.nome;
    renderizarGradeBancos(document.getElementById("cc-busca-banco").value);
    atualizarPreviaLogoCentral();
  }));
}

function atualizarPreviaLogoCentral(){
  document.getElementById("cc-logo-previa").innerHTML = logoBancoHtml(centralBancoAtual, centralFotoAtual, "g");
  document.getElementById("btn-cc-remover-foto").classList.toggle("hidden", !centralFotoAtual);
}

function definirTipoModalCentral(tipo){
  centralTipoModal = tipo;
  document.querySelectorAll("#cc-tipo-seg button").forEach(b => b.classList.toggle("ativo", b.dataset.tipo === tipo));
  document.getElementById("cc-bloco-credito").classList.toggle("hidden", tipo !== "credito");
}

function abrirModalCartaoCentral(id){
  const cc = id ? acharCentral(id) : null;
  centralEditandoId = cc ? cc.id : null;
  centralFotoAtual = cc ? cc.foto : null;
  centralBancoAtual = cc ? cc.bancoId : null;
  document.getElementById("cc-modal-titulo").textContent = cc ? "Detalhes do cartão" : "Adicionar cartão";
  document.getElementById("cc-nome").value = cc ? cc.nome : "";
  document.getElementById("cc-busca-banco").value = "";
  document.getElementById("cc-limite").value = cc && cc.limite ? cc.limite : "";
  document.getElementById("cc-limite-adicional").value = cc && cc.limiteAdicional ? cc.limiteAdicional : "";
  document.getElementById("cc-fechamento").value = cc && cc.fechamento ? cc.fechamento : "";
  document.getElementById("cc-vencimento").value = cc && cc.vencimento ? cc.vencimento : "";
  definirTipoModalCentral(cc ? cc.tipo : centralTipoAtivo);
  // categoria só pode ser escolhida no cadastro (trocar depois apagaria as faturas dos meses)
  document.getElementById("cc-tipo-seg").classList.toggle("hidden", !!cc);
  document.getElementById("cc-tipo-fixo").classList.toggle("hidden", !cc);
  if (cc) document.getElementById("cc-tipo-fixo").textContent = cc.tipo === "credito" ? "Categoria: Crédito" : "Categoria: Débito";
  document.getElementById("btn-cc-excluir").classList.toggle("hidden", !cc);
  document.getElementById("cc-disponivel").value = cc && cc.tipo === "credito" ? Number(disponivelCentral(cc).toFixed(2)) : "";
  document.getElementById("cc-disponivel-dica").textContent = cc
    ? "Igual ao do app do banco? Se estiver diferente, digite o valor do banco aqui e salve."
    : "Em branco = limite inteiro livre. Se já tem gasto no cartão, digite o disponível que o app do banco mostra.";
  document.getElementById("cc-faturas-bloco").classList.toggle("hidden", !(cc && cc.tipo === "credito"));
  renderizarGradeBancos("");
  atualizarPreviaLogoCentral();
  if (cc && cc.tipo === "credito") renderizarFaturasCentral(cc);
  document.getElementById("modal-cartao-central").classList.remove("hidden");
}

function renderizarFaturasCentral(cc){
  const disp = disponivelCentral(cc);
  document.getElementById("cc-faturas-resumo").innerHTML =
    `Disponível agora: <strong style="color:${disp < 0 ? "var(--vermelho)" : "var(--verde)"};">${formatarMoeda(disp)}</strong> <small>(limite ${formatarMoeda(limiteTotalCentral(cc))} − faturas em aberto ${formatarMoeda(usoCartaoCentral(cc.id))}${cc.ajusteDisponivel ? ` ${cc.ajusteDisponivel > 0 ? "+" : "−"} ajuste ${formatarMoeda(Math.abs(cc.ajusteDisponivel))}` : ""})</small>`;
  const box = document.getElementById("cc-faturas-lista");
  box.innerHTML = entradasDoCartaoCentral(cc.id).map(({ mes, entrada }) => {
    const total = totalCartao(entrada);
    return `<div class="cc-fatura">
      <span class="cc-fatura-mes">${NOMES_MESES[mes-1].slice(0,3)}/${String(anoParaMes(mes)).slice(2)}</span>
      <span class="cc-fatura-valor">${formatarMoeda(total)}</span>
      <button type="button" class="chip-status ${entrada.paga ? "chip-pago" : "chip-pendente"} chip-clicavel" data-fatura-mes="${mes}" data-fatura-id="${entrada.id}">${entrada.paga ? "✓ Paga" : "Em aberto"}</button>
    </div>`;
  }).join("");
  box.querySelectorAll("[data-fatura-id]").forEach(btn => btn.addEventListener("click", () => {
    const mes = Number(btn.dataset.faturaMes);
    const e = estado.meses[mes].cartoes.find(x => x.id === btn.dataset.faturaId);
    definirCartaoPago(mes, e.id, !e.paga);
    vibrarLeve();
    renderizarFaturasCentral(cc);
    document.getElementById("cc-disponivel").value = Number(disponivelCentral(cc).toFixed(2));
    renderizarCentralCartoes();
  }));
}

function iniciarCentralCartoes(){
  sincronizarCartoesCentral();

  document.querySelectorAll("#cc-abas button").forEach(b => b.addEventListener("click", () => {
    centralTipoAtivo = b.dataset.tipo;
    renderizarCentralCartoes();
  }));
  document.getElementById("btn-cc-adicionar").addEventListener("click", () => abrirModalCartaoCentral(null));
  document.getElementById("btn-cc-ir-mes").addEventListener("click", () => document.querySelector('.nav-item[data-tab="tab-mes"]').click());

  document.querySelectorAll("#cc-tipo-seg button").forEach(b => b.addEventListener("click", () => definirTipoModalCentral(b.dataset.tipo)));
  document.getElementById("cc-busca-banco").addEventListener("input", (e) => renderizarGradeBancos(e.target.value));
  document.getElementById("btn-cc-outro").addEventListener("click", () => {
    centralBancoAtual = null;
    renderizarGradeBancos(document.getElementById("cc-busca-banco").value);
    atualizarPreviaLogoCentral();
    document.getElementById("cc-nome").focus();
  });

  const inputFoto = document.getElementById("cc-foto-input");
  document.getElementById("btn-cc-foto").addEventListener("click", () => inputFoto.click());
  inputFoto.addEventListener("change", async () => {
    if (!inputFoto.files[0]) return;
    try{
      centralFotoAtual = await redimensionarImagem(inputFoto.files[0], 200);
      atualizarPreviaLogoCentral();
    }catch(e){ mostrarToast("Não foi possível carregar essa imagem."); }
    inputFoto.value = "";
  });
  document.getElementById("btn-cc-remover-foto").addEventListener("click", () => { centralFotoAtual = null; atualizarPreviaLogoCentral(); });

  document.getElementById("cc-cancelar").addEventListener("click", () => document.getElementById("modal-cartao-central").classList.add("hidden"));

  document.getElementById("cc-salvar").addEventListener("click", () => {
    const nome = document.getElementById("cc-nome").value.trim();
    if (!nome){ mostrarToast("Dê um nome pro cartão."); return; }
    const credito = centralTipoModal === "credito";
    const limite = parseFloat(document.getElementById("cc-limite").value);
    if (credito && (!limite || limite <= 0)){ mostrarToast("Informe o limite do cartão."); return; }
    const dados = {
      tipo: centralTipoModal, nome, bancoId: centralBancoAtual, foto: centralFotoAtual, limite,
      limiteAdicional: document.getElementById("cc-limite-adicional").value,
      fechamento: document.getElementById("cc-fechamento").value,
      vencimento: document.getElementById("cc-vencimento").value,
      disponivel: document.getElementById("cc-disponivel").value
    };
    if (centralEditandoId){
      editarCartaoCentral(centralEditandoId, dados);
      const cc = acharCentral(centralEditandoId);
      if (cc.tipo === "credito" && dados.disponivel !== ""){
        const atual = Number(disponivelCentral(cc).toFixed(2));
        if (Math.abs(Number(dados.disponivel) - atual) > 0.005) definirDisponivelAgoraCentral(cc.id, Number(dados.disponivel));
      }
      mostrarToast("Cartão atualizado!");
    } else {
      criarCartaoCentral(dados);
      centralTipoAtivo = dados.tipo;
      mostrarToast(credito ? "Cartão adicionado — já aparece em todos os meses!" : "Cartão de débito adicionado!");
    }
    vibrarLeve();
    document.getElementById("modal-cartao-central").classList.add("hidden");
    renderizarCentralCartoes();
  });

  document.getElementById("btn-cc-excluir").addEventListener("click", () => {
    const cc = acharCentral(centralEditandoId);
    if (!cc) return;
    confirmarElegante(`Excluir o cartão "${cc.nome}"${cc.tipo === "credito" ? " e todas as faturas e parcelas lançadas nele em todos os meses" : ""}?`, () => {
      removerCartaoCentral(cc.id);
      document.getElementById("modal-cartao-central").classList.add("hidden");
      renderizarCentralCartoes();
      mostrarToast("Cartão excluído.");
    });
  });
}
