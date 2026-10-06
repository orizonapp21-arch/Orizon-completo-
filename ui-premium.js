/* ============================================================
   Orizon — ui-premium.js
   Utilitários de experiência premium reaproveitados em várias
   telas: confirmação elegante (substitui o confirm() nativo do
   navegador), feedback tátil (vibração, quando o aparelho suporta)
   e skeleton de carregamento ao trocar de aba.
   ============================================================ */

// ---------------------------------------------------------------
// CONFIRMAÇÃO ELEGANTE
// Substitui window.confirm() por um modal no mesmo visual do app.
// Uso: confirmarElegante("Remover isso?", () => { ...ação... });
// ---------------------------------------------------------------
function confirmarElegante(mensagem, aoConfirmar, opcoes){
  opcoes = opcoes || {};
  const modal = document.getElementById("modal-confirmacao");
  if (!modal){ if (confirm(mensagem)) aoConfirmar(); return; } // fallback de segurança

  document.getElementById("confirmacao-titulo").textContent = opcoes.titulo || "⚠️ Confirmar ação";
  document.getElementById("confirmacao-mensagem").textContent = mensagem;

  const btnConfirmarAntigo = document.getElementById("confirmacao-confirmar");
  const btnCancelarAntigo = document.getElementById("confirmacao-cancelar");
  btnConfirmarAntigo.textContent = opcoes.textoConfirmar || "Confirmar";

  // clona os botões pra descartar listeners de usos anteriores (evita empilhar callbacks)
  const btnConfirmar = btnConfirmarAntigo.cloneNode(true);
  btnConfirmarAntigo.parentNode.replaceChild(btnConfirmar, btnConfirmarAntigo);
  const btnCancelar = btnCancelarAntigo.cloneNode(true);
  btnCancelarAntigo.parentNode.replaceChild(btnCancelar, btnCancelarAntigo);

  const fechar = () => modal.classList.add("hidden");
  btnConfirmar.addEventListener("click", () => { fechar(); vibrarLeve(15); aoConfirmar(); });
  btnCancelar.addEventListener("click", fechar);

  modal.classList.remove("hidden");
}

// ---------------------------------------------------------------
// FEEDBACK TÁTIL
// Vibração curta em ações importantes — silenciosamente ignorado
// em aparelhos/navegadores sem suporte (ex: iPhone/Safari).
// ---------------------------------------------------------------
function vibrarLeve(ms){
  try{ if (navigator.vibrate) navigator.vibrate(ms || 10); }catch(e){ /* sem suporte, tudo bem */ }
}

// ---------------------------------------------------------------
// SKELETON DE CARREGAMENTO
// Efeito visual breve ao entrar numa aba, dando sensação de app
// nativo carregando os dados (mesmo o cálculo sendo instantâneo).
// ---------------------------------------------------------------
function mostrarSkeletonEm(idTab, blocos){
  const tab = document.getElementById(idTab);
  if (!tab) return;
  const overlayAntigo = tab.querySelector(".skeleton-overlay");
  if (overlayAntigo) overlayAntigo.remove();

  const overlay = document.createElement("div");
  overlay.className = "skeleton-overlay";
  const alturas = blocos || [90, 200, 120, 160];
  overlay.innerHTML = alturas.map(alt => `<div class="skeleton-bloco" style="height:${alt}px;"></div>`).join("");
  tab.appendChild(overlay);

  setTimeout(() => {
    overlay.classList.add("saindo");
    setTimeout(() => overlay.remove(), 260);
  }, 240);
}
