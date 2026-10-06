/* ============================================================
   Orizon — onboarding.js
   Boas-vindas calorosa em 3 passos, mostrada só na PRIMEIRA vez
   que o app abre neste aparelho. Como os dados vivem no
   localStorage de cada celular, cada pessoa que recebe o link
   começa do zero e nunca enxerga os dados de outra.
   Passo 1: acolhida + nome · Passo 2: privacidade · Passo 3: backup.
   ============================================================ */

const ONBOARDING_KEY = "orizon_onboarding_v1";
const ONBOARDING_KEY_ANTIGA = "controlefinanceiro_onboarding_v1";

function primeiroAcessoConcluido(){
  return localStorage.getItem(ONBOARDING_KEY) === "concluido" || localStorage.getItem(ONBOARDING_KEY_ANTIGA) === "concluido";
}
function marcarPrimeiroAcessoConcluido(){
  try{ localStorage.setItem(ONBOARDING_KEY, "concluido"); }catch(e){}
}

function armazenamentoTemDados(){
  try{
    const bruto = localStorage.getItem(STORAGE_KEY);
    if (!bruto) return false;
    const d = JSON.parse(bruto);
    if (d.ultimoBackup || (d.metas && d.metas.length)) return true;
    for (let m = 1; m <= 12; m++){
      const mes = d.meses && d.meses[m];
      if (mes && ((mes.renda && mes.renda.length) || (mes.despesas && mes.despesas.length))) return true;
    }
  }catch(e){}
  return false;
}

function iniciarOnboarding(){
  const tela = document.getElementById("tela-boas-vindas");
  if (primeiroAcessoConcluido()) return;

  // Já existem dados de verdade (atualização de uma versão antiga): não incomoda ninguém.
  // (Só a existência da chave não basta: o app grava o estado vazio ao fechar.)
  if (armazenamentoTemDados()){
    marcarPrimeiroAcessoConcluido();
    return;
  }

  let passo = 1;
  const irPara = (n) => {
    passo = n;
    tela.querySelectorAll(".bv-passo").forEach(el => el.classList.toggle("hidden", Number(el.dataset.passo) !== n));
    tela.querySelectorAll(".bv-pontos i").forEach((p, i) => p.classList.toggle("ativo", i === n - 1));
    tela.querySelector(".boas-vindas-conteudo").scrollTop = 0;
  };

  tela.classList.remove("hidden");
  tela.querySelectorAll("[data-bv-proximo]").forEach(b => b.addEventListener("click", () => {
    if (passo === 1){
      const nome = document.getElementById("bv-nome").value.trim();
      if (nome){ estado.config.nomeUsuario = nome; salvarEstado(); }
    }
    irPara(passo + 1);
  }));
  tela.querySelectorAll("[data-bv-voltar]").forEach(b => b.addEventListener("click", () => irPara(passo - 1)));

  document.getElementById("btn-comecar").addEventListener("click", () => {
    marcarPrimeiroAcessoConcluido();
    tela.classList.add("hidden");
    if (typeof renderizarPainel === "function") renderizarPainel();
    const nome = estado.config.nomeUsuario;
    mostrarToast(nome ? `Bem-vindo, ${nome}! Vamos construir seus objetivos 💙` : "Bem-vindo ao Orizon! 💙");
  });

  const inputRestaurar = document.getElementById("input-restaurar-inicial");
  document.getElementById("btn-restaurar-inicial").addEventListener("click", () => inputRestaurar.click());
  inputRestaurar.addEventListener("change", () => {
    if (!inputRestaurar.files[0]) return;
    importarBackup(inputRestaurar.files[0], () => {
      marcarPrimeiroAcessoConcluido();
      tela.classList.add("hidden");
    });
    inputRestaurar.value = "";
  });
}
