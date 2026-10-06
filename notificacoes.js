/* ============================================================
   Orizon — notificacoes.js
   Motor de notificações locais (Notification API). Dispara toda
   vez que o app é aberto/reaberto — não é push em segundo plano
   com o app fechado (isso exigiria um servidor próprio, fora do
   escopo de um app 100% estático). Ver limitações no README.
   ============================================================ */

async function pedirPermissaoNotificacao(){
  if (!("Notification" in window)){
    mostrarToast("Seu navegador não suporta notificações.");
    return false;
  }
  if (Notification.permission === "granted") return true;
  // Sempre tenta pedir, mesmo que o navegador reporte "denied" antes do primeiro pedido —
  // se a pessoa já negou de verdade antes, o navegador resolve isso sozinho sem mostrar
  // pop-up nenhum (retorna "denied" de novo, sem incomodar ninguém).
  const resposta = await Notification.requestPermission();
  if (resposta !== "granted") {
    mostrarToast("Notificações não foram ativadas. Você pode tentar de novo quando quiser.");
  }
  return resposta === "granted";
}

function opcoesNotificacao(corpo){
  const cfg = estado.notificacoes;
  const opcoes = { body: corpo, icon: "icon-192.png", badge: "icon-96.png" };
  if (!cfg.som && !cfg.vibracao) opcoes.silent = true;
  if (cfg.vibracao) opcoes.vibrate = [200, 100, 200];
  return opcoes;
}

function dispararNotificacao(titulo, corpo){
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try{
    if (navigator.serviceWorker && navigator.serviceWorker.ready){
      navigator.serviceWorker.ready.then(reg => reg.showNotification(titulo, opcoesNotificacao(corpo))).catch(() => {
        new Notification(titulo, opcoesNotificacao(corpo));
      });
    } else {
      new Notification(titulo, opcoesNotificacao(corpo));
    }
  }catch(e){ console.warn("Não foi possível mostrar a notificação:", e); }
}

function jaFoiEnviada(chave){
  return !!estado.notificacoesEnviadas[chave];
}
function marcarComoEnviada(chave){
  estado.notificacoesEnviadas[chave] = true;
  salvarEstado();
}

// ---------------------------------------------------------------
// CONTAS A VENCER — respeita os limites de dias marcados em
// Configurações e nunca repete o mesmo aviso duas vezes (a não
// ser que a data de vencimento mude, ver limparNotificacoesEnviadasDe).
// ---------------------------------------------------------------
function checarContasEAvisar(){
  const alertaEl = document.getElementById("alerta-vencimento");
  const todas = todasContasProximasOuAtrasadas();

  if (todas.length === 0){
    alertaEl.classList.add("hidden");
  } else {
    const primeira = todas[0];
    const textoUrgencia = primeira.diasRestantes < 0 ? `atrasada há ${Math.abs(primeira.diasRestantes)} dia(s)`
      : primeira.diasRestantes === 0 ? "vence hoje" : `vence em ${primeira.diasRestantes} dia(s)`;
    const texto = todas.length === 1
      ? `⚠️ "${primeira.descricao}" ${textoUrgencia} (${formatarMoeda(primeira.valor)}).`
      : `⚠️ ${todas.length} conta(s) precisam de atenção — a mais urgente é "${primeira.descricao}" (${textoUrgencia}).`;
    alertaEl.textContent = texto;
    alertaEl.classList.remove("hidden");
  }

  if (!estado.notificacoes.ativado || !("Notification" in window) || Notification.permission !== "granted") return;

  const cfg = estado.notificacoes;
  todas.forEach(conta => {
    if (conta.diasRestantes < 0){
      const chave = `${conta.id}:atrasada`;
      if (!jaFoiEnviada(chave)){
        dispararNotificacao("🚨 Conta atrasada — Orizon",
          `A conta de ${conta.descricao} está atrasada.\nValor: ${formatarMoeda(conta.valor)}`);
        marcarComoEnviada(chave);
      }
      return;
    }
    const dia = String(conta.diasRestantes);
    if (!cfg.dias[dia]) return; // esse limite de dias não está marcado nas configurações
    const chave = `${conta.id}:${dia}`;
    if (jaFoiEnviada(chave)) return;

    const emoji = conta.diasRestantes === 0 ? "⚠️" : "🔔";
    const quando = conta.diasRestantes === 0 ? "vence hoje" : conta.diasRestantes === 1 ? "vence amanhã" : `vence em ${conta.diasRestantes} dias`;
    dispararNotificacao(`${emoji} Orizon`,
      `Sua conta de ${conta.descricao} ${quando}.\nValor: ${formatarMoeda(conta.valor)}`);
    marcarComoEnviada(chave);
  });
}

// Todas as contas não pagas, de qualquer mês, vencendo em até 5 dias OU já atrasadas
function todasContasProximasOuAtrasadas(){
  let resultado = [];
  for (let m = 1; m <= 12; m++){
    estado.meses[m].despesas.filter(d => !d.paga).forEach(d => {
      const dias = diasAteVencimento(d.vencimento);
      if (dias <= 5) resultado.push({ ...d, diasRestantes: dias });
    });
  }
  return resultado.sort((a,b) => a.diasRestantes - b.diasRestantes);
}

// ---------------------------------------------------------------
// ALERTAS DE ORÇAMENTO — avisa quando as despesas do mês atual
// atingem X% da renda do mês. Um aviso por limite por mês (não
// fica repetindo a cada nova despesa).
// ---------------------------------------------------------------
function checarAlertaOrcamento(mes){
  if (!estado.alertasFinanceiros.ativado) return;
  const renda = totalRenda(mes);
  if (renda <= 0) return;
  const despesa = totalDespesas(mes);
  const percentual = (despesa / renda) * 100;
  const limite = estado.alertasFinanceiros.limite;
  if (percentual < limite) return;

  const chave = `orcamento:${anoParaMes(mes)}-${mes}:${limite}`;
  if (jaFoiEnviada(chave)) return;
  if (!estado.notificacoes.ativado || !("Notification" in window) || Notification.permission !== "granted") { marcarComoEnviada(chave); return; }

  if (limite >= 100){
    dispararNotificacao("🚨 Orizon", "Suas despesas já ultrapassaram sua renda mensal.");
  } else {
    dispararNotificacao("🔔 Orizon", `Você já utilizou ${Math.round(percentual)}% da sua renda deste mês.\n⚠️ Cuidado com novas despesas.`);
  }
  marcarComoEnviada(chave);
}

function iniciarNotificacoes(){
  checarContasEAvisar();
}


// ---------------------------------------------------------------
// ALERTA VERMELHO EM TELA CHEIA (fundo embaçado)
// Aparece ao abrir o app (e ao voltar pra ele) quando alguma conta
// NÃO PAGA vence amanhã, vence hoje ou já está atrasada.
// ---------------------------------------------------------------
function contasParaAlertaEmTela(){
  const lista = [];
  for (let m = 1; m <= 12; m++){
    estado.meses[m].despesas.forEach(d => {
      if (d.paga) return;
      const dias = diasAteVencimento(d.vencimento);
      if (dias <= 1) lista.push({ ...d, mes: m, diasRestantes: dias });
    });
  }
  return lista.sort((a, b) => a.diasRestantes - b.diasRestantes);
}

function textoPrazoConta(dias){
  if (dias < 0) return `Atrasada há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? "" : "s"}`;
  if (dias === 0) return "Vence HOJE";
  return "Vence AMANHÃ";
}

function mostrarAlertaEmTela(){
  const tela = document.getElementById("alerta-tela");
  if (!tela) return;
  const onboarding = document.getElementById("tela-boas-vindas");
  if (onboarding && !onboarding.classList.contains("hidden")) return; // primeiro acesso: nada pra alertar ainda
  const contas = contasParaAlertaEmTela();
  if (contas.length === 0){ tela.classList.add("hidden"); document.body.classList.remove("alerta-aberto"); return; }

  const hoje = contas.filter(c => c.diasRestantes === 0).length;
  document.getElementById("alerta-tela-titulo").textContent = hoje > 0 ? "Conta vence hoje!" : contas.every(c => c.diasRestantes > 0) ? "Conta vence amanhã!" : "Conta precisa de atenção!";
  document.getElementById("alerta-tela-sub").textContent = contas.length === 1 ? "Não deixe passar — pague e marque como paga." : `${contas.length} contas precisam de você agora.`;
  document.getElementById("alerta-tela-lista").innerHTML = contas.map(c => `
    <div class="alerta-conta ${c.diasRestantes < 0 ? "alerta-conta-atrasada" : ""}">
      <div class="alerta-conta-info">
        <strong>${escaparHTML(c.descricao)}</strong>
        <span>${textoPrazoConta(c.diasRestantes)} · ${formatarDataBR(c.vencimento)}</span>
      </div>
      <div class="alerta-conta-lado">
        <b>${formatarMoeda(c.valor)}</b>
        <button class="alerta-pagar" data-pagar="${c.id}" data-mes="${c.mes}">Já paguei</button>
      </div>
    </div>`).join("");
  tela.querySelectorAll("[data-pagar]").forEach(btn => {
    btn.addEventListener("click", () => {
      alternarDespesaPaga(Number(btn.dataset.mes), btn.dataset.pagar);
      vibrarLeve();
      mostrarToast("Conta marcada como paga!");
      if (typeof renderizarPainel === "function" && document.getElementById("tab-painel").classList.contains("active")) renderizarPainel();
      if (document.getElementById("tab-mes").classList.contains("active")) renderizarMes(estado.mesSelecionado);
      checarContasEAvisar();
      mostrarAlertaEmTela();
    });
  });
  tela.classList.remove("hidden");
  document.body.classList.add("alerta-aberto");
  if (navigator.vibrate && estado.notificacoes.vibracao) { try{ navigator.vibrate([200,100,200]); }catch(e){} }
}

function iniciarAlertaEmTela(){
  const fechar = document.getElementById("alerta-tela-fechar");
  if (fechar) fechar.addEventListener("click", () => {
    document.getElementById("alerta-tela").classList.add("hidden");
    document.body.classList.remove("alerta-aberto");
  });
  setTimeout(mostrarAlertaEmTela, 350);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") mostrarAlertaEmTela(); });
}
