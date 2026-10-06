/* ============================================================
   Orizon — metas.js
   Aba "Metas": objetivos de economia com valor desejado, valor já
   guardado, data opcional, barra de progresso animada e mensagem
   automática de incentivo. Fica salvo em estado.metas (fora dos
   meses, já que uma meta pode atravessar vários meses).
   ============================================================ */

function progressoMeta(meta){
  const desejado = Number(meta.valorDesejado || 0);
  const guardado = Number(meta.valorGuardado || 0);
  const pct = desejado > 0 ? Math.min(100, (guardado / desejado) * 100) : 0;
  return { pct, desejado, guardado, falta: Math.max(0, desejado - guardado) };
}

function mensagemIncentivoMeta(meta){
  const { pct, falta } = progressoMeta(meta);
  if (pct >= 100) return "🎉 Meta concluída! Você conseguiu!";
  if (pct >= 75) return `🔥 Reta final! Faltam só ${formatarMoeda(falta)}.`;
  if (pct >= 50) return "💪 Você já passou da metade — continue assim!";
  if (pct >= 25) return "📈 Bom progresso! Cada aporte te deixa mais perto.";
  if (pct > 0) return "🚀 Todo começo é um passo importante!";
  return "✨ Comece guardando qualquer valor — o primeiro passo é o que importa.";
}

function diasRestantesMeta(meta){
  if (!meta.dataAlvo) return null;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const alvo = new Date(meta.dataAlvo + "T00:00:00");
  return Math.round((alvo - hoje) / (1000*60*60*24));
}

// ---------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------
function adicionarMeta(dados){
  const meta = {
    id: gerarId("meta"),
    nome: dados.nome,
    valorDesejado: Number(dados.valorDesejado),
    valorGuardado: Number(dados.valorGuardado || 0),
    dataAlvo: dados.dataAlvo || null,
    criadoEm: new Date().toISOString()
  };
  estado.metas.push(meta);
  salvarEstado();
  return meta;
}

function editarMeta(id, dados){
  const m = estado.metas.find(m => m.id === id);
  if (!m) return;
  m.nome = dados.nome;
  m.valorDesejado = Number(dados.valorDesejado);
  m.valorGuardado = Number(dados.valorGuardado || 0);
  m.dataAlvo = dados.dataAlvo || null;
  salvarEstado();
}

function removerMeta(id){
  estado.metas = estado.metas.filter(m => m.id !== id);
  salvarEstado();
}

// ---------------------------------------------------------------
// RENDERIZAÇÃO
// ---------------------------------------------------------------
function renderizarMetas(){
  const lista = document.getElementById("metas-lista");
  if (!lista) return;

  if (estado.metas.length === 0){
    lista.innerHTML = `<p class="lista-vazia">Nenhuma meta cadastrada ainda. Toque em "Nova meta" para começar a guardar dinheiro para algo importante.</p>`;
    return;
  }

  lista.innerHTML = estado.metas.map(meta => {
    const { pct, guardado, desejado } = progressoMeta(meta);
    const dias = diasRestantesMeta(meta);
    let dataInfo = "";
    if (dias != null){
      dataInfo = dias < 0
        ? `<span class="meta-data meta-data-atrasada">Prazo era ${formatarDataBR(meta.dataAlvo)}</span>`
        : `<span class="meta-data">🗓️ ${dias === 0 ? "Prazo é hoje" : `Faltam ${dias} dia(s)`} — ${formatarDataBR(meta.dataAlvo)}</span>`;
    }
    const concluida = pct >= 100;
    return `<div class="card card-meta ${concluida ? "meta-concluida" : ""}" data-meta="${meta.id}">
      <div class="meta-cabecalho">
        <span class="meta-titulo">🎯 ${escaparHTML(meta.nome)}</span>
        <div class="item-acoes">
          <button class="item-editar" data-editar-meta="${meta.id}">✎</button>
          <button class="item-remover" data-remover-meta="${meta.id}">✕</button>
        </div>
      </div>
      <p class="meta-valores">${formatarMoeda(guardado)} <span class="meta-de">de</span> ${formatarMoeda(desejado)}</p>
      <div class="meta-barra-fundo"><div class="meta-barra-preenchida" style="width:0%" data-largura-alvo="${pct}"></div></div>
      <div class="meta-rodape">
        <span class="meta-percentual">${Math.round(pct)}% concluído</span>
        ${dataInfo}
      </div>
      <p class="meta-incentivo">${mensagemIncentivoMeta(meta)}</p>
    </div>`;
  }).join("");

  // anima as barras de 0 até o valor real logo após inserir no DOM (efeito de preenchimento suave)
  requestAnimationFrame(() => {
    lista.querySelectorAll(".meta-barra-preenchida").forEach(barra => {
      const alvo = barra.dataset.larguraAlvo;
      requestAnimationFrame(() => { barra.style.width = alvo + "%"; });
    });
  });

  lista.querySelectorAll("[data-editar-meta]").forEach(btn => {
    btn.addEventListener("click", () => abrirModalMeta(btn.dataset.editarMeta));
  });
  lista.querySelectorAll("[data-remover-meta]").forEach(btn => {
    btn.addEventListener("click", () => {
      confirmarElegante("Remover esta meta? O progresso guardado nela será perdido.", () => {
        removerMeta(btn.dataset.removerMeta);
        renderizarMetas();
        mostrarToast("Meta removida.");
      });
    });
  });
}

// ---------------------------------------------------------------
// MODAL: nova/editar meta
// ---------------------------------------------------------------
let metaEmEdicaoId = null;

function abrirModalMeta(id){
  const meta = id ? estado.metas.find(m => m.id === id) : null;
  metaEmEdicaoId = meta ? meta.id : null;
  document.getElementById("meta-modal-titulo").textContent = meta ? "Editar meta" : "Nova meta";
  document.getElementById("meta-nome").value = meta ? meta.nome : "";
  document.getElementById("meta-valor-desejado").value = meta ? meta.valorDesejado : "";
  document.getElementById("meta-valor-guardado").value = meta ? meta.valorGuardado : "";
  document.getElementById("meta-data").value = meta && meta.dataAlvo ? meta.dataAlvo : "";
  document.getElementById("modal-meta").classList.remove("hidden");
}

function iniciarModalMeta(){
  ativarMicrofoneEm("btn-microfone-meta", "meta-nome");

  document.getElementById("btn-nova-meta").addEventListener("click", () => abrirModalMeta(null));
  document.getElementById("meta-cancelar").addEventListener("click", () => document.getElementById("modal-meta").classList.add("hidden"));

  document.getElementById("meta-confirmar").addEventListener("click", () => {
    const nome = document.getElementById("meta-nome").value.trim();
    const valorDesejado = parseFloat(document.getElementById("meta-valor-desejado").value);
    const valorGuardado = parseFloat(document.getElementById("meta-valor-guardado").value) || 0;
    const dataAlvo = document.getElementById("meta-data").value || null;

    if (!nome || !valorDesejado || valorDesejado <= 0){ mostrarToast("Dê um nome e um valor desejado para a meta."); return; }
    if (valorGuardado < 0){ mostrarToast("O valor já guardado não pode ser negativo."); return; }

    const dados = { nome, valorDesejado, valorGuardado, dataAlvo };
    if (metaEmEdicaoId){
      editarMeta(metaEmEdicaoId, dados);
      mostrarToast("Meta atualizada!");
    } else {
      adicionarMeta(dados);
      mostrarToast("Meta criada! 🎯");
    }
    vibrarLeve();
    document.getElementById("modal-meta").classList.add("hidden");
    renderizarMetas();
  });
}
