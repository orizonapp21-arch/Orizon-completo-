/* ============================================================
   Orizon — tutorial.js  (v2.4)
   Tutoriais guiados: fundo desfocado, foco no item, balão com seta.
   · Cada aba (Painel, Mês, Cartões, Metas, Evolução) e cada janela
     importante (Backup/Configurações, Despesa, Renda, Cartão, Meta)
     tem o seu tutorial.
   · O tutorial abre sozinho na primeira vez que a pessoa entra.
   · "Pular" não perde nada: o tutorial fica PENDENTE (selinho 🎓 na
     tela e lista em Configurações) e retoma de onde parou.
   · Ao concluir, o tutorial some de vez.
   · Tudo é guardado só neste aparelho (localStorage), separado dos
     dados financeiros — não entra no backup e não mexe em nada do app.
   ============================================================ */
(function(){
"use strict";

const CHAVE = "orizon_tutoriais_v1";

/* ------------------------------------------------------------
   ROTEIROS
   alvo   : seletor do elemento a destacar (sem alvo = balão centralizado)
   pai    : sobe até esse ancestral (ex.: ".card", "label") para destacar o bloco todo
   rolar  : se o alvo estiver fora da tela, pede para a pessoa deslizar a tela
   botao  : texto do botão principal (padrão "OK")
   Passos cujo alvo não existe/está escondido são pulados sozinhos.
   ------------------------------------------------------------ */
const TUTORIAIS = {

  painel: {
    nome: "Painel (início)", icone: "🏠", ctx: { aba: "tab-painel" },
    abrir(){ irAba("tab-painel"); },
    fim: "Painel concluído! Agora toque na aba Mês 📅",
    passos: [
      { icone:"👋", titulo:"Bem-vindo ao Orizon!", botao:"Vamos lá",
        texto:"Em poucos toques eu te mostro o essencial. Pode pular quando quiser — fica guardado para depois." },
      { alvo:".home-kpis", icone:"📊", titulo:"Resumo do mês",
        texto:"Entradas, despesas, saldo e economia do mês, de relance." },
      { alvo:"#home-atencao", pai:".card", icone:"⚠️", titulo:"Atenção", rolar:true,
        texto:"Contas vencendo ou atrasadas aparecem aqui, para você não esquecer de nada." },
      { alvo:"#btn-config", icone:"🛡️", titulo:"Configurações e Backup",
        texto:"Seus dados ficam só neste aparelho. Aqui você cria o backup para não perder nada." },
      { alvo:'.nav-item[data-tab="tab-mes"]', icone:"📅", titulo:"Comece pela aba Mês",
        texto:"É lá que você cadastra a renda e as despesas. Toque nela agora!", botao:"Concluir ✓" }
    ]
  },

  mes: {
    nome: "Aba Mês", icone: "📅", ctx: { aba: "tab-mes" },
    abrir(){ irAba("tab-mes"); },
    fim: "Aba Mês concluída! Agora experimente + Adicionar despesa 💸",
    passos: [
      { alvo:"#meses-scroller", icone:"👆", titulo:"Escolha o mês",
        texto:"Deslize para o lado e toque no mês que quer cadastrar. Cada mês tem os seus valores." },
      { alvo:"#btn-add-renda", pai:".card", icone:"💰", titulo:"Cadastre sua renda", rolar:true,
        texto:"Toque em + Adicionar renda para lançar seu salário e outras entradas." },
      { alvo:"#btn-add-despesa", icone:"💸", titulo:"Cadastre suas despesas",
        texto:"Toque em + Adicionar despesa. Para corrigir depois, é só tocar na despesa.", botao:"Concluir ✓" }
    ]
  },

  cartoes: {
    nome: "Aba Cartões", icone: "💳", ctx: { aba: "tab-cartoes" },
    abrir(){ irAba("tab-cartoes"); },
    fim: "Aba Cartões concluída! Toque em + Adicionar cartão 💳",
    passos: [
      { alvo:"#cc-abas", pai:".card", icone:"🔀", titulo:"Crédito ou débito",
        texto:"Alterne entre os seus cartões de crédito e de débito." },
      { alvo:"#btn-cc-adicionar", icone:"➕", titulo:"Cadastre um cartão",
        texto:"Toque aqui para cadastrar. O limite vale para todos os meses e o disponível diminui a cada gasto.", botao:"Concluir ✓" }
    ]
  },

  metas: {
    nome: "Aba Metas", icone: "🎯", ctx: { aba: "tab-metas" },
    abrir(){ irAba("tab-metas"); },
    fim: "Aba Metas concluída! 🎯",
    passos: [
      { alvo:"#btn-nova-meta", icone:"🎯", titulo:"Crie uma meta",
        texto:"Uma viagem, uma reserva… Informe o valor desejado e acompanhe a barra de progresso enchendo.", botao:"Concluir ✓" }
    ]
  },

  evolucao: {
    nome: "Aba Evolução", icone: "📈", ctx: { aba: "tab-evolucao" },
    abrir(){ irAba("tab-evolucao"); },
    fim: "Aba Evolução concluída! 📈",
    passos: [
      { alvo:"#grafico-evolucao", pai:".card", icone:"📈", titulo:"Seu patrimônio mês a mês",
        texto:"A linha mostra quanto você foi acumulando no ano. Quanto mais para cima, melhor!", botao:"Concluir ✓" }
    ]
  },

  backup: {
    nome: "Backup", icone: "🛡️", ctx: { modal: "modal-configuracoes" },
    abrir(){ document.getElementById("btn-config")?.click(); },
    fim: "Agora você sabe proteger seus dados! 🛡️",
    passos: [
      { alvo:"#btn-exportar-backup", icone:"💾", titulo:"Crie seu backup",
        texto:"Baixa um arquivo com todos os seus dados. Guarde no Google Drive ou envie para você mesmo." },
      { alvo:"#btn-importar-backup", icone:"📂", titulo:"Restaurar backup",
        texto:"Trocou de celular? Escolha aqui o arquivo e tudo volta." },
      { alvo:"#btn-apagar-tudo", icone:"🗑️", titulo:"Cuidado com este botão",
        texto:"Apaga tudo do aparelho. Só use depois de criar um backup.", botao:"Concluir ✓" }
    ]
  },

  despesa: {
    nome: "Cadastrar despesa", icone: "💸", ctx: { modal: "modal-despesa" },
    abrir(){ irAba("tab-mes"); setTimeout(() => document.getElementById("btn-add-despesa")?.click(), 450); },
    fim: "Pronto! Agora é só preencher e salvar 💸",
    passos: [
      { alvo:"#despesa-descricao", pai:"label", icone:"✏️", titulo:"Nome e valor",
        texto:"Dê um nome fácil, como “Conta de luz”, e digite o valor logo abaixo. Se preferir, use o microfone 🎤." },
      { alvo:"#despesa-vencimento", pai:"label", icone:"📆", titulo:"Vencimento",
        texto:"O dia em que a conta vence. É com ele que o Orizon te avisa antes de vencer." },
      { alvo:"#despesa-recorrencia", pai:".linha-toggle", icone:"🔁", titulo:"Conta fixa?",
        texto:"Ligue para contas que se repetem (aluguel, internet…). Ela aparece sozinha no mês seguinte." },
      { alvo:"#despesa-confirmar", icone:"💾", titulo:"Salvar",
        texto:"Toque aqui para guardar a despesa.", botao:"Concluir ✓" }
    ]
  },

  cartao: {
    nome: "Cadastrar cartão", icone: "💳", ctx: { modal: "modal-cartao-central" },
    abrir(){ irAba("tab-cartoes"); setTimeout(() => document.getElementById("btn-cc-adicionar")?.click(), 450); },
    fim: "Pronto! Cartão cadastrado é cartão sob controle 💳",
    passos: [
      { alvo:"#cc-limite", pai:"label", icone:"📏", titulo:"Limite e disponível",
        texto:"Informe o limite total do cartão e, logo abaixo, quanto ainda tem disponível hoje." },
      { alvo:"#cc-fechamento", pai:".linha-dupla", icone:"📆", titulo:"Fechamento e vencimento",
        texto:"Os dias em que a fatura fecha e vence. Você encontra no app do seu banco." },
      { alvo:"#cc-salvar", icone:"💾", titulo:"Salvar",
        texto:"Toque para guardar. Daqui em diante o disponível diminui a cada gasto.", botao:"Concluir ✓" }
    ]
  }
};

const ORDEM = ["painel", "backup", "mes", "despesa", "cartoes", "cartao", "metas", "evolucao"];

/* ------------------------------------------------------------
   Armazenamento: c = concluídos · s = pulados · p = último passo
   ------------------------------------------------------------ */
function lerSt(){
  try{
    const o = JSON.parse(localStorage.getItem(CHAVE) || "{}");
    return { c: o.c || {}, s: o.s || {}, p: o.p || {} };
  }catch(e){ return { c:{}, s:{}, p:{} }; }
}
function gravarSt(st){ try{ localStorage.setItem(CHAVE, JSON.stringify(st)); }catch(e){} }

/* ------------------------------------------------------------
   Utilidades
   ------------------------------------------------------------ */
function irAba(idAba){
  const btn = document.querySelector('.nav-item[data-tab="' + idAba + '"]');
  if (btn) btn.click();
}
function toast(msg){ if (typeof mostrarToast === "function") mostrarToast(msg); }
function vibra(){ if (typeof vibrarLeve === "function") { try{ vibrarLeve(); }catch(e){} } }
function visivel(el){ return !!el && el.getClientRects().length > 0; }
function limitar(v, a, b){ return Math.max(a, Math.min(b, v)); }

function resolver(p){
  if (!p.alvo) return null;                 // passo sem alvo: balão centralizado
  let el = document.querySelector(p.alvo);
  if (!el) return undefined;                // alvo não existe: passo é pulado
  if (p.pai) el = el.closest(p.pai) || el;
  return el;
}

function modalAbertoDe(id){
  const m = document.getElementById(id);
  return !!m && !m.classList.contains("hidden");
}
function abaAtiva(){
  const t = document.querySelector(".tab-content.active");
  return t ? t.id : null;
}

/* Qual tutorial pertence ao que está na tela agora? */
function ctxAtual(){
  const abertos = document.querySelectorAll(".modal-overlay:not(.hidden)");
  if (abertos.length){
    for (const id of ORDEM){
      const c = TUTORIAIS[id].ctx;
      if (c.modal && modalAbertoDe(c.modal)) return id;
    }
    return null;                            // há um modal sem tutorial aberto: não interfere
  }
  const aba = abaAtiva();
  for (const id of ORDEM){ if (TUTORIAIS[id].ctx.aba === aba) return id; }
  return null;
}
function ctxEhModal(id){ return !!(TUTORIAIS[id] && TUTORIAIS[id].ctx.modal); }

/* O app está "livre" (sem abertura, boas-vindas ou alerta na frente)? */
function livre(){
  if (document.getElementById("splash-orizon")) return false;
  const bv = document.getElementById("tela-boas-vindas");
  if (bv && !bv.classList.contains("hidden")) return false;
  const al = document.getElementById("alerta-tela");
  if (al && !al.classList.contains("hidden")) return false;
  const tab = document.querySelector(".tab-content.active");
  if (tab && tab.querySelector(".skeleton-overlay")) return false;
  return true;
}
function inputFocado(){
  const a = document.activeElement;
  return !!a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName);
}

/* ------------------------------------------------------------
   DOM do tutorial (criado uma vez, sob demanda)
   ------------------------------------------------------------ */
let ui = null;
function montarDOM(){
  if (ui) return;
  const root = document.createElement("div");
  root.className = "tut-root";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Tutorial do Orizon");
  root.innerHTML =
    '<div class="tut-pn tut-pn-cheio"></div>' +
    '<div class="tut-pn tut-pn-t"></div><div class="tut-pn tut-pn-b"></div>' +
    '<div class="tut-pn tut-pn-l"></div><div class="tut-pn tut-pn-r"></div>' +
    '<div class="tut-anel"></div>' +
    '<div class="tut-balao">' +
      '<i class="tut-seta"></i>' +
      '<div class="tut-cab"><span class="tut-ic"></span>' +
        '<div class="tut-cab-t"><span class="tut-passo"></span><div class="tut-barra"><i></i></div></div></div>' +
      '<h4 class="tut-tit"></h4><p class="tut-txt"></p>' +
      '<div class="tut-acoes">' +
        '<button type="button" class="tut-pular">Pular</button><span class="tut-esp"></span>' +
        '<button type="button" class="tut-voltar" aria-label="Voltar">‹</button>' +
        '<button type="button" class="tut-ok">OK</button>' +
      '</div>' +
    '</div>' +
    '<div class="tut-dica">' +
      '<div class="tut-setas" aria-hidden="true"><i></i><i></i><i></i></div>' +
      '<div class="tut-dica-t"><strong></strong><span></span></div>' +
      '<div class="tut-dica-bt">' +
        '<button type="button" class="tut-pular">Pular</button>' +
        '<button type="button" class="tut-rolarbtn">Rolar pra mim</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(root);

  ui = {
    root,
    cheio: root.querySelector(".tut-pn-cheio"),
    t: root.querySelector(".tut-pn-t"), b: root.querySelector(".tut-pn-b"),
    l: root.querySelector(".tut-pn-l"), r: root.querySelector(".tut-pn-r"),
    anel: root.querySelector(".tut-anel"),
    balao: root.querySelector(".tut-balao"),
    seta: root.querySelector(".tut-seta"),
    ic: root.querySelector(".tut-ic"),
    passo: root.querySelector(".tut-passo"),
    barra: root.querySelector(".tut-barra i"),
    tit: root.querySelector(".tut-tit"),
    txt: root.querySelector(".tut-txt"),
    ok: root.querySelector(".tut-ok"),
    voltar: root.querySelector(".tut-voltar"),
    dica: root.querySelector(".tut-dica"),
    setas: root.querySelector(".tut-setas"),
    dicaT: root.querySelector(".tut-dica-t strong"),
    dicaS: root.querySelector(".tut-dica-t span")
  };

  root.querySelectorAll(".tut-pular").forEach(b => b.addEventListener("click", pular));
  ui.ok.addEventListener("click", () => { vibra(); avancar(1); });
  ui.voltar.addEventListener("click", () => { vibra(); avancar(-1); });
  root.querySelector(".tut-rolarbtn").addEventListener("click", rolarParaMim);

  // Bloqueia rolagem por trás enquanto o foco está no item (menos quando é pedido para rolar)
  const bloquear = (e) => { if (ativo && !root.classList.contains("rolar")) e.preventDefault(); };
  root.addEventListener("touchmove", bloquear, { passive: false });
  root.addEventListener("wheel", bloquear, { passive: false });
}

/* ------------------------------------------------------------
   Motor
   ------------------------------------------------------------ */
let ativo = null;   // { id, i, tok, el, raf, ultimo, modoRolar, alvoRolar, onScroll, centralizar }

function T(){ return TUTORIAIS[ativo.id]; }

function achar(i, dir){
  const ps = T().passos;
  for (; i >= 0 && i < ps.length; i += dir){
    const el = resolver(ps[i]);
    if (el === null || (el && visivel(el))) return i;
  }
  return -1;
}

function iniciar(id){
  if (ativo || !TUTORIAIS[id]) return;
  const st = lerSt();
  const total = TUTORIAIS[id].passos.length;
  ativo = { id, i: limitar(st.p[id] || 0, 0, total - 1), tok: 0, el: null, raf: 0, ultimo: "", modoRolar: false };
  montarDOM();
  document.body.classList.add("tut-aberto");
  ui.root.classList.add("on");
  esconderPill();
  mostrarPasso(ativo.i, 1);
  document.addEventListener("keydown", aoTeclar);
  window.addEventListener("resize", aoRedimensionar);
}

function fechar(){
  if (!ativo) return;
  cancelAnimationFrame(ativo.raf);
  sairModoRolar();
  document.removeEventListener("keydown", aoTeclar);
  window.removeEventListener("resize", aoRedimensionar);
  ui.root.classList.remove("on", "rolar", "sem-alvo");
  ui.balao.classList.remove("vis");
  document.body.classList.remove("tut-aberto");
  ativo = null;
  setTimeout(tick, 60);
}

function concluir(){
  const id = ativo.id, tut = TUTORIAIS[id];
  const st = lerSt();
  st.c[id] = true; delete st.p[id]; delete st.s[id];
  gravarSt(st);
  fechar();
  const faltam = ORDEM.filter(k => !st.c[k]).length;
  toast(faltam === 0 ? "🎉 Você concluiu todos os tutoriais do Orizon!" : "✅ " + (tut.fim || "Tutorial concluído!"));
  atualizarConfig(true);
}

function pular(){
  if (!ativo) return;
  const id = ativo.id, st = lerSt();
  st.s[id] = true; st.p[id] = ativo.i;
  gravarSt(st);
  fechar();
  pillLiberaEm = Date.now() + 3200;
  toast("Tutorial guardado como pendente 🎓 — retome quando quiser");
  atualizarConfig(true);
}

function aoTeclar(e){ if (e.key === "Escape") pular(); }
function aoRedimensionar(){ if (ativo){ ativo.ultimo = ""; } }

function avancar(dir){
  if (!ativo) return;
  const prox = achar(ativo.i + dir, dir);
  if (prox < 0){
    if (dir > 0) concluir();
    return;
  }
  mostrarPasso(prox, dir);
}

function mostrarPasso(i, dir){
  if (!ativo) return;
  let j = achar(i, dir);
  if (j < 0) j = achar(dir > 0 ? i : 0, 1);
  if (j < 0){ concluir(); return; }

  ativo.i = j;
  const tok = ++ativo.tok;
  const p = T().passos[j];
  const el = resolver(p);

  const st = lerSt(); st.p[ativo.id] = j; gravarSt(st);

  // Pede para a pessoa deslizar a tela quando o item ainda está fora dela
  if (el && p.rolar && !naTela(el)){
    entrarModoRolar(p, el);
    return;
  }
  sairModoRolar();
  const centralizar = !!ativo.centralizar; ativo.centralizar = false;
  if (el) garantirVisivel(el, centralizar, () => { if (ativo && ativo.tok === tok) revelar(p, el); });
  else revelar(p, null);
}

/* ---------- limites visíveis (descontando topo fixo e menu inferior) ---------- */
function limites(){
  const vh = window.innerHeight;
  if (ctxEhModal(ativo.id)){
    const m = document.querySelector("#" + T().ctx.modal + " .modal");
    if (m){ const r = m.getBoundingClientRect(); return { top: Math.max(8, r.top + 4), bottom: Math.min(vh - 8, r.bottom - 4) }; }
    return { top: 8, bottom: vh - 8 };
  }
  const tb = document.querySelector(".topbar"), nav = document.querySelector(".bottom-nav");
  // o topo do app sai da tela ao rolar: só conta quando está de fato visível
  const top = Math.max(8, tb ? tb.getBoundingClientRect().bottom + 8 : 8);
  const bottom = nav ? nav.getBoundingClientRect().top - 8 : vh - 8;
  return { top, bottom };
}
function naTela(el){
  const L = limites(), r = el.getBoundingClientRect();
  const alto = r.height > (L.bottom - L.top) * 0.7;
  if (alto) return r.top >= L.top - 2 && r.top <= L.bottom - 140;
  return r.top >= L.top - 2 && r.bottom <= L.bottom + 2;
}

function aguardarParar(el, cb){
  const t0 = performance.now(); let ultimo = null, estavel = 0;
  (function f(){
    const y = Math.round(el.getBoundingClientRect().top);
    estavel = (y === ultimo) ? estavel + 1 : 0; ultimo = y;
    if (estavel >= 7 || performance.now() - t0 > 1300) return cb();
    requestAnimationFrame(f);
  })();
}

function garantirVisivel(el, centralizar, cb){
  if (el.closest(".bottom-nav, .topbar")) return cb();   // itens fixos não precisam rolar
  const L = limites(), r = el.getBoundingClientRect();
  const alto = r.height > (L.bottom - L.top) * 0.7;
  if (!centralizar && naTela(el)) return cb();
  el.style.scrollMarginTop = (L.top + 10) + "px";
  el.style.scrollMarginBottom = (window.innerHeight - L.bottom + 10) + "px";
  el.scrollIntoView({ block: alto ? "start" : "center", behavior: "smooth" });
  aguardarParar(el, () => { el.style.scrollMarginTop = ""; el.style.scrollMarginBottom = ""; cb(); });
}

/* ---------- modo "deslize a tela" ---------- */
function entrarModoRolar(p, el){
  cancelAnimationFrame(ativo.raf);
  ativo.el = null;
  ativo.modoRolar = true;
  ativo.alvoRolar = el;
  const abaixo = el.getBoundingClientRect().top > window.innerHeight / 2;
  ui.dicaT.textContent = abaixo ? "Deslize a tela para cima" : "Deslize a tela para baixo";
  ui.dicaS.textContent = "para eu te mostrar: " + p.titulo;
  ui.setas.classList.toggle("desce", !abaixo);
  ui.root.classList.remove("sem-alvo");
  ui.root.classList.add("rolar");
  ui.balao.classList.remove("vis");

  let tm = 0;
  ativo.onScroll = () => {
    clearTimeout(tm);
    tm = setTimeout(() => {
      if (ativo && ativo.modoRolar && naTela(ativo.alvoRolar)){
        ativo.centralizar = true;
        mostrarPasso(ativo.i, 1);
      }
    }, 260);
  };
  window.addEventListener("scroll", ativo.onScroll, { passive: true });
}
function sairModoRolar(){
  if (!ativo || !ativo.modoRolar) return;
  window.removeEventListener("scroll", ativo.onScroll);
  ativo.modoRolar = false;
  ativo.alvoRolar = null;
  ui.root.classList.remove("rolar");
}
function rolarParaMim(){
  if (!ativo || !ativo.alvoRolar) return;
  vibra();
  const el = ativo.alvoRolar, L = limites();
  el.style.scrollMarginTop = (L.top + 10) + "px";
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  setTimeout(() => { el.style.scrollMarginTop = ""; }, 1200);
}

/* ---------- mostrar o balão do passo ---------- */
function revelar(p, el){
  if (!ativo) return;
  const ps = T().passos;
  // progresso considerando só os passos que realmente aparecem
  let pos = 0, total = 0;
  ps.forEach((q, k) => {
    const e = resolver(q);
    if (e === null || (e && visivel(e))){ total++; if (k <= ativo.i) pos++; }
  });
  const primeiro = achar(0, 1) === ativo.i;

  ui.ic.textContent = p.icone || T().icone;
  ui.passo.textContent = "Passo " + pos + " de " + total;
  ui.barra.style.width = Math.round(pos / total * 100) + "%";
  ui.tit.textContent = p.titulo;
  ui.txt.textContent = p.texto;
  ui.ok.textContent = p.botao || (pos === total ? "Concluir ✓" : "OK");
  ui.voltar.style.display = primeiro ? "none" : "";

  ui.root.classList.toggle("sem-alvo", !el);
  ui.balao.classList.remove("vis", "pop");
  void ui.balao.offsetWidth;
  ui.balao.classList.add("vis", "pop");

  ativo.el = el;
  ativo.ultimo = "";
  cancelAnimationFrame(ativo.raf);
  (function loop(){
    if (!ativo) return;
    posicionar();
    ativo.raf = requestAnimationFrame(loop);
  })();
  try{ ui.ok.focus({ preventScroll: true }); }catch(e){}
}

/* ---------- foco no item (buraco nítido no fundo desfocado) + balão ---------- */
function posicionar(){
  if (!ativo || ativo.modoRolar) return;
  const vw = window.innerWidth, vh = window.innerHeight;
  const el = ativo.el;
  let h = null;

  if (el){
    if (!visivel(el)) return;
    const r = el.getBoundingClientRect();
    const chave = [r.left, r.top, r.width, r.height, vw, vh].map(Math.round).join("|");
    if (chave === ativo.ultimo) return;
    ativo.ultimo = chave;
    const pad = 6;
    const x1 = limitar(r.left - pad, 0, vw), y1 = limitar(r.top - pad, 0, vh);
    const x2 = limitar(r.right + pad, 0, vw), y2 = limitar(r.bottom + pad, 0, vh);
    h = { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };

    ui.t.style.cssText = "left:0;top:0;width:100%;height:" + h.y + "px";
    ui.b.style.cssText = "left:0;top:" + (h.y + h.h) + "px;width:100%;height:" + Math.max(0, vh - h.y - h.h) + "px";
    ui.l.style.cssText = "left:0;top:" + (h.y - 1) + "px;width:" + h.x + "px;height:" + (h.h + 2) + "px";
    ui.r.style.cssText = "left:" + (h.x + h.w) + "px;top:" + (h.y - 1) + "px;width:" + Math.max(0, vw - h.x - h.w) + "px;height:" + (h.h + 2) + "px";

    const cs = getComputedStyle(el);
    const raio = (parseFloat(cs.borderTopLeftRadius) || 10) + pad;
    ui.anel.style.cssText = "left:" + h.x + "px;top:" + h.y + "px;width:" + h.w + "px;height:" + h.h + "px;border-radius:" + Math.min(raio, 28) + "px;opacity:1";
  } else {
    if (ativo.ultimo === "centro") return;
    ativo.ultimo = "centro";
    ui.anel.style.opacity = "0";
  }
  posicionarBalao(h);
}

function posicionarBalao(h){
  const vw = window.innerWidth, vh = window.innerHeight;
  const b = ui.balao, bw = b.offsetWidth, bh = b.offsetHeight;
  let left, top, lado = "centro";

  if (!h){
    left = (vw - bw) / 2; top = (vh - bh) / 2;
  } else {
    const gap = 16, precisa = bh + gap + 6;
    const abaixo = vh - (h.y + h.h), acima = h.y;
    const preferirAbaixo = (h.y + h.h / 2) < vh * 0.55;
    if (preferirAbaixo && abaixo >= precisa) lado = "abaixo";
    else if (acima >= precisa) lado = "acima";
    else if (abaixo >= precisa) lado = "abaixo";
    else lado = "dentro";

    const cx = h.x + h.w / 2;
    left = limitar(cx - bw / 2, 12, vw - bw - 12);
    if (lado === "abaixo") top = h.y + h.h + gap;
    else if (lado === "acima") top = h.y - bh - gap;
    else top = (h.y + h.h / 2 < vh / 2) ? vh - bh - 16 : 16;
    ui.seta.style.left = limitar(cx - left - 9, 20, bw - 38) + "px";
  }
  top = limitar(top, 10, Math.max(10, vh - bh - 10));
  b.style.left = Math.round(left) + "px";
  b.style.top = Math.round(top) + "px";
  ui.seta.className = "tut-seta" + (lado === "abaixo" ? " cima" : lado === "acima" ? " baixo" : "");
}

/* ------------------------------------------------------------
   Selinho "🎓 Tutorial pendente"
   ------------------------------------------------------------ */
let pill = null, dispensados = {}, pillLiberaEm = 0;   // pillLiberaEm: deixa o aviso (toast) sair antes do selinho aparecer
function montarPill(){
  if (pill) return;
  pill = document.createElement("div");
  pill.className = "tut-pill hidden";
  pill.innerHTML =
    '<button type="button" class="tut-pill-go"><span class="tut-pill-ponto"></span><span class="tut-pill-txt"></span></button>' +
    '<button type="button" class="tut-pill-x" aria-label="Esconder por agora">✕</button>';
  document.body.appendChild(pill);
  pill.querySelector(".tut-pill-go").addEventListener("click", () => { if (ctxId) iniciar(ctxId); });
  pill.querySelector(".tut-pill-x").addEventListener("click", () => { if (ctxId) dispensados[ctxId] = true; esconderPill(); });
}
function esconderPill(){ if (pill) pill.classList.add("hidden"); }
function atualizarPill(){
  if (ativo || !ctxId || !livre() || dispensados[ctxId] || Date.now() < pillLiberaEm){ esconderPill(); return; }
  const st = lerSt();
  if (st.c[ctxId]){ esconderPill(); return; }
  montarPill();
  const parou = (st.p[ctxId] || 0) > 0;
  pill.querySelector(".tut-pill-txt").textContent =
    (parou ? "Continuar tutorial" : "Tutorial pendente") + " · " + TUTORIAIS[ctxId].nome;
  pill.classList.toggle("topo", ctxEhModal(ctxId));
  pill.classList.remove("hidden");
}

/* ------------------------------------------------------------
   Lista de pendentes em Configurações (some quando tudo for concluído)
   ------------------------------------------------------------ */
let assinaturaConfig = "";
function montarConfig(){
  const modal = document.querySelector("#modal-configuracoes .modal");
  if (!modal || document.getElementById("tut-config-secao")) return;
  const sec = document.createElement("div");
  sec.className = "config-secao hidden";
  sec.id = "tut-config-secao";
  const acoes = modal.querySelector(".modal-actions");
  if (acoes) modal.insertBefore(sec, acoes); else modal.appendChild(sec);
  sec.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tut]");
    if (b) abrirTutorial(b.dataset.tut);
  });
}
function atualizarConfig(forcar){
  const sec = document.getElementById("tut-config-secao");
  if (!sec) return;
  const st = lerSt();
  const pend = ORDEM.filter(k => !st.c[k]);
  const ass = pend.join(",") + JSON.stringify(st.p);
  if (!forcar && ass === assinaturaConfig) return;
  assinaturaConfig = ass;
  sec.classList.toggle("hidden", pend.length === 0);
  if (!pend.length){ sec.innerHTML = ""; return; }
  sec.innerHTML =
    '<h4>🎓 Tutoriais pendentes</h4>' +
    '<p class="config-subtitulo">Toque para ver quando quiser. Cada tutorial some assim que você conclui.</p>' +
    '<div class="tut-lista">' +
    pend.map(k => {
      const t = TUTORIAIS[k], parou = (st.p[k] || 0) > 0;
      return '<button type="button" class="tut-item" data-tut="' + k + '">' +
        '<span class="tut-item-ic">' + t.icone + '</span>' +
        '<span class="tut-item-nome">' + t.nome + '</span>' +
        '<em>' + (parou ? "Continuar" : "Ver") + '</em></button>';
    }).join("") + '</div>';
}
function abrirTutorial(id){
  const t = TUTORIAIS[id];
  if (t.ctx.modal === "modal-configuracoes"){ iniciarQuandoPronto(id); return; }
  const fecha = document.getElementById("config-fechar");
  if (fecha) fecha.click();
  setTimeout(() => { t.abrir(); iniciarQuandoPronto(id); }, 300);
}
function iniciarQuandoPronto(id){
  let tentativas = 0;
  (function f(){
    if (ativo) return;
    if (ctxAtual() === id && livre()) return iniciar(id);
    if (++tentativas < 14) setTimeout(f, 150);
  })();
}

/* ------------------------------------------------------------
   Vigia: detecta onde a pessoa está e abre o tutorial pendente
   ------------------------------------------------------------ */
let ctxId = null, ctxDesde = 0, deb = 0;
function tick(){
  const atual = ctxAtual();
  if (atual !== ctxId){ ctxId = atual; ctxDesde = Date.now(); }

  if (ativo){
    if (atual !== ativo.id) { cancelAnimationFrame(ativo.raf); fechar(); }   // saiu do contexto: guarda o passo e fecha
    return;
  }
  atualizarPill();
  atualizarConfig(false);

  if (!atual) return;
  const st = lerSt();
  if (st.c[atual] || st.s[atual]) return;           // concluído ou pulado: não abre sozinho
  if (!livre() || inputFocado()) return;
  if (Date.now() - ctxDesde < 900) return;           // espera a animação da tela assentar
  iniciar(atual);
}
function agendarTick(){ clearTimeout(deb); deb = setTimeout(tick, 140); }

function iniciarTutoriais(){
  montarConfig();
  atualizarConfig(true);

  // Reage na hora quando uma aba muda ou um modal abre/fecha
  const obs = new MutationObserver(agendarTick);
  const vigiar = (el) => { if (el) obs.observe(el, { attributes: true, attributeFilter: ["class"] }); };
  document.querySelectorAll(".tab-content, .modal-overlay").forEach(vigiar);
  vigiar(document.getElementById("tela-boas-vindas"));
  vigiar(document.getElementById("alerta-tela"));

  setInterval(tick, 900);   // rede de segurança (abertura/skeleton saindo, etc.)
  setTimeout(tick, 600);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciarTutoriais);
else iniciarTutoriais();

/* Pequena API para testes/suporte */
window.TutorialOrizon = {
  iniciar: iniciar,
  pendentes(){ const st = lerSt(); return ORDEM.filter(k => !st.c[k]); },
  reiniciarTodos(){ try{ localStorage.removeItem(CHAVE); }catch(e){} dispensados = {}; atualizarConfig(true); tick(); }
};

})();
