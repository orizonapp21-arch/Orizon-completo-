/* ============================================================
   Orizon — estado.js
   Estado global, salvamento automático (localStorage) e o motor
   de recorrência (quando uma despesa é marcada como recorrente,
   ela é replicada automaticamente para os meses seguintes do ano).
   ============================================================ */

const STORAGE_KEY = "controlefinanceiro_v1";

function mesVazio(){
  return { renda: [], despesas: [], cartoes: [] };
}

function estadoPadrao(){
  const meses = {};
  for (let m = 1; m <= 12; m++) meses[m] = mesVazio();
  return {
    tema: "escuro",
    mesSelecionado: new Date().getMonth() + 1,
    meses,
    cartoesCentral: [], // Central dos Cartões (cadastro único de crédito/débito)
    comprasCartao: [], // compras de cartão detectadas/lançadas (pendente → confirmada); ver compras-pendentes.js
    metas: [], // Metas financeiras (aba "Metas") — não amarradas a um mês específico
    ultimoBackup: null,
    notificacoes: {
      ativado: false,
      dias: { "5": true, "3": true, "1": true, "0": true },
      som: true,
      vibracao: true
    },
    alertasFinanceiros: {
      ativado: false,
      limite: 90
    },
    config: {
      nomeUsuario: "",
      estiloMensagem: "padrao"
    },
    notificacoesEnviadas: {} // chave -> true, evita reenviar o mesmo aviso
  };
}

let estado = carregarEstado();

function carregarEstado(){
  try{
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (!salvo) return estadoPadrao();
    const carregado = JSON.parse(salvo);
    const padrao = estadoPadrao();
    // garante que todos os 12 meses existem, mesmo em saves antigos/parciais
    padrao.meses = {};
    for (let m = 1; m <= 12; m++){
      padrao.meses[m] = (carregado.meses && carregado.meses[m]) ? carregado.meses[m] : mesVazio();
      if (!Array.isArray(padrao.meses[m].cartoes)) padrao.meses[m].cartoes = []; // saves antigos sem cartão
    }
    const mesclado = Object.assign({}, padrao, carregado, { meses: padrao.meses });
    // mescla profunda dos objetos de configuração (saves antigos podem não ter esses campos ainda)
    mesclado.notificacoes = Object.assign({}, padrao.notificacoes, carregado.notificacoes, {
      dias: Object.assign({}, padrao.notificacoes.dias, carregado.notificacoes && carregado.notificacoes.dias)
    });
    mesclado.alertasFinanceiros = Object.assign({}, padrao.alertasFinanceiros, carregado.alertasFinanceiros);
    mesclado.config = Object.assign({}, padrao.config, carregado.config);
    mesclado.notificacoesEnviadas = carregado.notificacoesEnviadas || {};
    mesclado.cartoesCentral = Array.isArray(carregado.cartoesCentral) ? carregado.cartoesCentral : []; // saves antigos não tinham a Central
    mesclado.comprasCartao = Array.isArray(carregado.comprasCartao) ? carregado.comprasCartao : []; // saves antigos não tinham compras detectadas
    mesclado.metas = Array.isArray(carregado.metas) ? carregado.metas : []; // saves antigos (v1) não tinham metas
    return mesclado;
  }catch(e){ console.warn("Não foi possível carregar os dados salvos:", e); }
  return estadoPadrao();
}

let salvarTimeout = null;
function salvarEstado(){
  clearTimeout(salvarTimeout);
  salvarTimeout = setTimeout(() => {
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(estado)); }
    catch(e){ console.warn("Falha ao salvar automaticamente:", e); }
  }, 250);
}

function mostrarToast(msg){
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.add("hidden"), 2200);
}

function gerarId(prefixo){
  return `${prefixo}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
}

function formatarMoeda(valor){
  return (valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ---------------------------------------------------------------
// ANO DE CADA MÊS (rolagem automática)
// O app é um "próximo ciclo de 12 meses" a partir de hoje, não um
// calendário fixo de janeiro a dezembro de um único ano: meses que
// já passaram neste ano civil (antes do mês atual) apontam para o
// PRÓXIMO ano. Ex: hoje é setembro/2026 → Setembro..Dezembro ainda
// são 2026, mas Janeiro..Agosto já são 2027 (a próxima ocorrência
// deles no calendário).
// ---------------------------------------------------------------
function anoParaMes(mesNum){
  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();
  return mesNum >= mesAtual ? anoAtual : anoAtual + 1;
}

function dataISOParaMes(mesNum, dia){
  const ano = anoParaMes(mesNum);
  const ultimoDiaDoMes = new Date(ano, mesNum, 0).getDate();
  const diaSeguro = Math.min(dia, ultimoDiaDoMes);
  return `${ano}-${String(mesNum).padStart(2,"0")}-${String(diaSeguro).padStart(2,"0")}`;
}

// ---------------------------------------------------------------
// MOTOR DE RECORRÊNCIA (mês a mês)
// Marcar "repetir no próximo mês" cria UMA cópia pendente no mês
// seguinte (dezembro -> janeiro do ciclo seguinte). A cópia é
// totalmente independente: dá pra editar valor, data, categoria,
// pagar, apagar... sem mexer no mês de origem. E ela nasce com a
// recorrência DESMARCADA — é lá que a pessoa decide se ela continua
// para o mês seguinte a esse (é só marcar de novo).
// ---------------------------------------------------------------
function proximoMesDoCiclo(mes){
  const prox = mes === 12 ? 1 : mes + 1;
  // Ano "de verdade" do mês seguinte vs. o ano do slot que o app guarda para ele.
  // Se não baterem, o mês seguinte cairia fora do ciclo de 12 meses do app (ex.: agosto/2027 -> setembro/2026 já passou).
  const anoRealDoProximo = mes === 12 ? anoParaMes(12) + 1 : anoParaMes(mes);
  return anoParaMes(prox) === anoRealDoProximo ? prox : null;
}

function copiaRecorrenteNoProximoMes(despesa, mesOrigem){
  const prox = proximoMesDoCiclo(mesOrigem);
  if (!prox || !despesa.recorrenciaId) return null;
  return estado.meses[prox].despesas.find(d => d.recorrenciaId === despesa.recorrenciaId && d.origemId === despesa.id) || null;
}

function criarCopiaRecorrente(despesaOriginal, mesOrigem){
  const prox = proximoMesDoCiclo(mesOrigem);
  if (!prox) return { ok:false, motivo:"fim-do-ciclo" };
  if (copiaRecorrenteNoProximoMes(despesaOriginal, mesOrigem)) return { ok:true, mes:prox, jaExistia:true };
  const dia = new Date(despesaOriginal.vencimento + "T00:00:00").getDate();
  estado.meses[prox].despesas.push({
    id: gerarId("desp"),
    descricao: despesaOriginal.descricao,
    valor: despesaOriginal.valor,
    valorPrevisto: despesaOriginal.valor,
    vencimento: dataISOParaMes(prox, dia),
    categoria: despesaOriginal.categoria,
    tipoPagamento: despesaOriginal.tipoPagamento,
    parcelas: despesaOriginal.parcelas || null,
    icone: despesaOriginal.icone || null,
    recorrenciaId: despesaOriginal.recorrenciaId,
    origemId: despesaOriginal.id,
    veioDeRecorrencia: true,
    recorrente: false,
    paga: false
  });
  return { ok:true, mes:prox };
}

// Desmarcou a recorrência: remove a cópia do mês seguinte, se ela ainda não foi paga
function removerCopiaRecorrente(despesa, mesOrigem){
  const prox = proximoMesDoCiclo(mesOrigem);
  if (!prox) return;
  estado.meses[prox].despesas = estado.meses[prox].despesas.filter(d => !(d.origemId === despesa.id && !d.paga));
}

// ---------------------------------------------------------------
// Limpa os avisos já enviados de uma despesa (usado quando o
// vencimento muda — a pessoa deve poder ser avisada de novo,
// agora em relação à nova data).
// ---------------------------------------------------------------
function limparNotificacoesEnviadasDe(despesaId){
  Object.keys(estado.notificacoesEnviadas).forEach(chave => {
    if (chave.startsWith(despesaId + ":")) delete estado.notificacoesEnviadas[chave];
  });
}

// ---------------------------------------------------------------
// Apaga TODOS os dados do dispositivo e volta ao estado inicial
// ---------------------------------------------------------------
function limparMes(mes){
  estado.meses[mes] = mesVazio();
  salvarEstado();
}

function apagarTodosOsDados(){
  localStorage.removeItem(STORAGE_KEY);
  estado = estadoPadrao();
  salvarEstado();
}
