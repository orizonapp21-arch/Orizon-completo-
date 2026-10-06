/* ============================================================
   Orizon — home.js
   HOME / PAINEL GERAL: "Como está minha vida financeira agora?"
   Só mostra HOJE e o MÊS ATUAL. Tudo vem dos dados que já existem
   (renda, despesas, cartões, metas) e reaproveita funções dos outros
   módulos: totalRenda/totalDespesas, gerarAnaliseAutomatica,
   resumoCentralCredito, progressoMeta. Nada é guardado aqui.
   (Visão anual: aba Evolução.)
   ============================================================ */

let homeRotacaoFrase = 0;   // sobe a cada toque na frase (alterna entre a Frase A e a Frase B do dia)
let homeIniciada = false;

function mesAtualDaHome(){ return new Date().getMonth() + 1; }

function irParaAbaHome(idAba){
  const btn = document.querySelector(`.nav-item[data-tab="${idAba}"]`);
  if (btn) btn.click();
}
function irParaMesHome(mes){
  estado.mesSelecionado = mes;
  salvarEstado();
  irParaAbaHome("tab-mes");
}

function pctTextoHome(p){
  return (Math.abs(p) >= 10 ? p.toFixed(0) : p.toFixed(1)).replace(".", ",") + "%";
}

// ---------- 1 e 2: saudação e frase do dia ----------
function renderizarSaudacaoHome(){
  const agora = new Date(), h = agora.getHours();
  const periodo = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  const nome = (estado.config && estado.config.nomeUsuario ? estado.config.nomeUsuario : "").trim();
  document.getElementById("home-saudacao").textContent = nome ? `${periodo}, ${nome} 👋` : `${periodo} 👋`;
  const data = agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  document.getElementById("home-data").textContent = data.charAt(0).toUpperCase() + data.slice(1);
}

function renderizarFraseHome(animar){
  const { frase } = frasesDoDia(new Date(), homeRotacaoFrase);
  const caixa = document.getElementById("home-frase");
  document.getElementById("home-frase-texto").textContent = `“${frase[0]}”`;
  document.getElementById("home-frase-autor").textContent = frase[1] === "ORIZON" ? "ORIZON" : `Autor: ${frase[1]} · tradução livre`;
  document.getElementById("home-dica-texto").textContent = dicaDoDia(new Date(), frase[0]);
  if (animar){ caixa.classList.remove("trocando"); void caixa.offsetWidth; caixa.classList.add("trocando"); }
}

// ---------- 3 e 4: resumo do mês e saldo ----------
function renderizarResumoMesHome(mes){
  const renda = totalRenda(mes), despesa = totalDespesas(mes), saldo = renda - despesa;
  document.getElementById("home-mes-titulo").textContent = `📅 ${NOMES_MESES[mes - 1]}`;
  document.getElementById("home-entradas").textContent = formatarMoeda(renda);
  document.getElementById("home-despesas").textContent = formatarMoeda(despesa);
  const saldoKpi = document.getElementById("home-saldo-kpi");
  saldoKpi.textContent = formatarMoeda(saldo);
  saldoKpi.classList.toggle("negativo", saldo < 0);
  document.getElementById("home-economia").textContent = renda > 0 ? (saldo < 0 ? "-" : "") + pctTextoHome(Math.abs(saldo / renda * 100)) : "—";

  const card = document.getElementById("home-saldo");
  const valor = document.getElementById("home-saldo-valor");
  const status = document.getElementById("home-saldo-status");
  valor.textContent = formatarMoeda(saldo);
  card.classList.remove("home-saldo-pos", "home-saldo-neg", "home-saldo-zero");
  if (renda === 0 && despesa === 0){
    card.classList.add("home-saldo-zero");
    status.textContent = "Sem lançamentos neste mês ainda";
  } else if (Math.abs(saldo) <= Math.max(50, renda * 0.02)){
    card.classList.add("home-saldo-zero");
    status.textContent = "🟡 Saldo próximo de zero";
  } else if (saldo > 0){
    card.classList.add("home-saldo-pos");
    status.textContent = "🟢 Saldo positivo";
  } else {
    card.classList.add("home-saldo-neg");
    status.textContent = "🔴 Saldo negativo";
  }
}

// ---------- 5: atenção (contas e faturas perto do vencimento) ----------
function itensAtencaoHome(){
  const itens = [];
  for (let m = 1; m <= 12; m++){
    estado.meses[m].despesas.filter(d => !d.paga && d.vencimento).forEach(d => {
      const dias = diasAteVencimento(d.vencimento);
      if (dias <= 5) itens.push({ nome: d.descricao, valor: Number(d.valor || 0), dias, mes: m });
    });
    estado.meses[m].cartoes.filter(c => !c.paga && c.vencimento).forEach(c => {
      const valor = totalCartao(c);
      if (valor <= 0) return;
      const dias = diasAteVencimento(dataISOParaMes(m, Number(c.vencimento)));
      if (dias <= 5) itens.push({ nome: `Cartão ${c.nome}`, valor, dias, mes: m });
    });
  }
  return itens.sort((a, b) => a.dias - b.dias);
}

function textoPrazoHome(dias){
  if (dias < 0) return `Atrasada há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? "" : "s"}`;
  if (dias === 0) return "Vence hoje";
  if (dias === 1) return "Vence amanhã";
  return `Vence em ${dias} dias`;
}

function renderizarAtencaoHome(){
  const box = document.getElementById("home-atencao");
  const itens = itensAtencaoHome();
  if (itens.length === 0){
    box.innerHTML = `<div class="home-tudo-certo"><span>🟢</span><div><strong>Tudo em dia!</strong><p>Nenhuma conta exige atenção no momento.</p></div></div>`;
    return;
  }
  const mostrar = itens.slice(0, 3);
  box.innerHTML = mostrar.map((it, i) => {
    const cls = it.dias <= 0 ? "urg-vermelho" : it.dias <= 2 ? "urg-laranja" : "urg-amarelo";
    const bolinha = it.dias <= 0 ? "🔴" : it.dias <= 2 ? "🟠" : "🟡";
    return `<div class="home-conta ${cls}" data-home-mes="${it.mes}" role="button" tabindex="0">
      <span class="home-conta-ico">${bolinha}</span>
      <div class="home-conta-info"><strong>${escaparHTML(it.nome)}</strong><span>${textoPrazoHome(it.dias)}</span></div>
      <b class="home-valor">${formatarMoeda(it.valor)}</b>
    </div>`;
  }).join("") + (itens.length > 3 ? `<p class="home-mais">e mais ${itens.length - 3} conta${itens.length - 3 === 1 ? "" : "s"} — toque para ver</p>` : "");
  box.querySelectorAll("[data-home-mes]").forEach(el => el.addEventListener("click", () => irParaMesHome(Number(el.dataset.homeMes))));
  const mais = box.querySelector(".home-mais");
  if (mais) mais.addEventListener("click", () => irParaMesHome(itens[3].mes));
}

// ---------- 6: seu momento financeiro (reaproveita a análise automática) ----------
function renderizarMomentoHome(mes){
  const box = document.getElementById("home-momento");
  if (totalRenda(mes) === 0 && totalDespesas(mes) === 0){
    box.innerHTML = `<p>Cadastre sua renda e suas despesas deste mês para ver aqui uma análise do seu momento financeiro.</p>`;
    return;
  }
  const todas = gerarAnaliseAutomatica(mes).filter(f => !f.startsWith("Mantendo essa média")); // projeção de meta fica em outra área
  const escolhidas = [];
  if (todas[0]) escolhidas.push(todas[0]);
  const maior = todas.find(f => f.startsWith("Sua maior despesa"));
  if (maior && !escolhidas.includes(maior)) escolhidas.push(maior);
  todas.forEach(f => { if (escolhidas.length < 3 && !escolhidas.includes(f)) escolhidas.push(f); });
  box.innerHTML = escolhidas.length
    ? escolhidas.map(f => `<p>${escaparHTML(f)}</p>`).join("")
    : `<p>Continue lançando seus gastos: a análise aparece conforme o mês avança.</p>`;
}

// ---------- 7: resumo dos cartões ----------
function renderizarCartoesHome(){
  const box = document.getElementById("home-cartoes");
  const todos = estado.cartoesCentral || [];
  if (todos.length === 0){
    box.innerHTML = `<p class="home-vazio">Você ainda não cadastrou nenhum cartão.</p><button class="btn-primary-outline" id="home-btn-cartoes">Adicionar cartão →</button>`;
  } else {
    const r = resumoCentralCredito();
    const n = `${todos.length} cartão${todos.length === 1 ? "" : "es"} cadastrado${todos.length === 1 ? "" : "s"}`;
    if (r.qtd === 0){
      box.innerHTML = `<p class="home-vazio">${n} — somente débito, sem limite para acompanhar.</p><button class="btn-primary-outline" id="home-btn-cartoes">Ver cartões →</button>`;
    } else {
      const alerta = r.pct >= 100 ? "🔴 Limite estourado" : r.pct >= 80 ? "⚠️ Perto do limite" : "";
      box.innerHTML = `
        <p class="home-cartoes-qtd">${n}</p>
        <div class="home-cartoes-grade">
          <div><span>Limite total</span><strong class="home-valor">${formatarMoeda(r.limite)}</strong></div>
          <div><span>Utilizado</span><strong class="home-valor" style="color:var(--vermelho);">${formatarMoeda(r.emUso)}</strong></div>
          <div><span>Disponível</span><strong class="home-valor" style="color:${r.disponivel < 0 ? "var(--vermelho)" : "var(--verde)"};">${formatarMoeda(r.disponivel)}</strong></div>
        </div>
        <div class="meta-barra-fundo"><div class="meta-barra-preenchida" style="width:${Math.min(100, r.pct)}%; background:${corPorUso(r.pct)};"></div></div>
        <div class="home-barra-legenda"><span>${Math.round(r.pct)}% do limite usado</span>${alerta ? `<b class="home-alerta-limite">${alerta}</b>` : ""}</div>
        <button class="btn-primary-outline" id="home-btn-cartoes">Ver cartões →</button>`;
    }
  }
  const btn = document.getElementById("home-btn-cartoes");
  if (btn) btn.addEventListener("click", () => irParaAbaHome("tab-cartoes"));
}

// ---------- 8: meta ----------
function renderizarMetaHome(){
  const box = document.getElementById("home-meta");
  const metas = estado.metas || [];
  const meta = metas.find(m => progressoMeta(m).pct < 100) || metas[0];
  if (!meta){
    box.innerHTML = `<p class="home-vazio">Você ainda não possui uma meta financeira.</p><button class="btn-primary-outline" id="home-btn-meta">Criar meta</button>`;
    document.getElementById("home-btn-meta").addEventListener("click", () => { irParaAbaHome("tab-metas"); abrirModalMeta(null); });
    return;
  }
  const p = progressoMeta(meta);
  box.innerHTML = `
    <div class="home-meta-corpo" role="button" tabindex="0" id="home-meta-corpo">
      <strong class="home-meta-nome">${escaparHTML(meta.nome)}</strong>
      <span class="home-meta-valores"><b class="home-valor">${formatarMoeda(p.guardado)}</b> / <span class="home-valor">${formatarMoeda(p.desejado)}</span></span>
      <div class="meta-barra-fundo"><div class="meta-barra-preenchida" style="width:${p.pct}%;"></div></div>
      <span class="home-meta-pct">${p.pct >= 100 ? "🎉 Meta concluída!" : `${pctTextoHome(p.pct)} concluído`}</span>
    </div>`;
  document.getElementById("home-meta-corpo").addEventListener("click", () => irParaAbaHome("tab-metas"));
}

// ---------- tudo junto ----------
function renderizarHome(){
  if (!homeIniciada){
    homeIniciada = true;
    const frase = document.getElementById("home-frase");
    const trocar = () => { homeRotacaoFrase++; renderizarFraseHome(true); vibrarLeve(); };
    frase.addEventListener("click", trocar);
    frase.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " "){ e.preventDefault(); trocar(); } });
  }
  const mes = mesAtualDaHome();
  renderizarSaudacaoHome();
  renderizarFraseHome(false);
  renderizarResumoMesHome(mes);
  if (typeof renderizarPendentesHome === "function") renderizarPendentesHome();
  renderizarAtencaoHome();
  renderizarMomentoHome(mes);
  renderizarCartoesHome();
  renderizarMetaHome();
  document.getElementById("home-final").textContent = MENSAGENS_FINAIS_HOME[diaDoAnoHome() % MENSAGENS_FINAIS_HOME.length];
}
