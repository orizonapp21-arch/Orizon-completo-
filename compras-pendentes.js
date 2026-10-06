/* ============================================================
   Orizon — compras-pendentes.js
   COMPRAS DE CARTÃO: detecção → PENDENTE → confirmação → fatura.

   Regra de ouro: uma compra detectada NUNCA vira despesa sozinha.
   Ela entra em "Compras pendentes" (aparece na Home) e só é lançada
   quando o usuário confirma a fatura.

   Este módulo REAPROVEITA o que já existe:
   • Central dos Cartões  → cartoesCentral, fechamento/vencimento, limite
   • Faturas por mês      → estado.meses[m].cartoes[].compras (cada mês = uma fatura)
   • Parcelamento         → adicionarCompraParceladaCentral()
   • Limite disponível    → disponivelCentral() (atualiza sozinho)
   • Categorias           → CATEGORIAS
   • Notificações         → dispararNotificacao()

   ENTRADA DE COMPRAS (todas passam por receberCompraDetectada):
   • Android nativo (ver /android-bridge)  → OrizonCompras.receberNotificacao(...)
   • Link de automação (Atalhos/MacroDroid) → ?compra=1&valor=...&loja=...
   • Registro manual e modo de teste (Configurações)
   O módulo que captura notificações do Android é SEPARADO e ainda
   não vem pronto neste pacote — ver android-bridge/README.md.
   ============================================================ */

const COMPRAS_MAX_HISTORICO = 200;      // guarda só as últimas N (confirmadas/ignoradas) p/ evitar duplicidade
const COMPRAS_JANELA_DUP_MIN = 3;       // mesma compra em até 3 min = "possível duplicata"
const COMPRAS_DIAS_URGENTE = 2;         // pendente há mais de 2 dias = vermelho

let compraEmEdicao = null;              // rascunho/entrada aberta no modal
let compraEhManual = false;
let compraFaturaManual = false;         // usuário mexeu no mês da fatura (não sobrescrever a sugestão)
let compraCategoriaManual = false;      // usuário escolheu a categoria (não sobrescrever a sugestão)
let compraSucessoTimer = null;

// ---------------------------------------------------------------
// UTILIDADES
// ---------------------------------------------------------------
function comprasLista(){
  if (!Array.isArray(estado.comprasCartao)) estado.comprasCartao = [];
  return estado.comprasCartao;
}
function comprasPendentes(){
  return comprasLista().filter(c => c.status === "pendente").sort((a, b) => (a.dataDeteccao || 0) - (b.dataDeteccao || 0));
}
function semAcentoCompra(s){
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function lerValorBRL(txt){
  if (typeof txt === "number") return txt;
  let s = String(txt || "").replace(/[^\d.,]/g, "");
  if (!s) return NaN;
  if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, "");
  return Number(s);
}
function dataISOHoje(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function horaAgora(){
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function dataBRCompra(iso){
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
}
function rotuloFatura(mes, ano){ return `${NOMES_MESES[mes - 1]}/${ano}`; }

// ---------------------------------------------------------------
// INTERPRETAÇÃO DO TEXTO DA NOTIFICAÇÃO (só valor, local, data… — nada além disso é lido)
// ---------------------------------------------------------------
const PACOTES_BANCOS = {
  "com.nu.production": "Nubank", "com.itau": "Itaú", "com.itau.iti": "Itaú", "br.com.intermedium": "Inter",
  "com.c6bank.app": "C6 Bank", "com.bradesco": "Bradesco", "br.com.bb.android": "Banco do Brasil",
  "com.santander.app": "Santander", "br.com.gabba.Caixa": "Caixa", "com.mercadopago.wallet": "Mercado Pago",
  "br.com.neon": "Next", "br.com.sicredi.mobi": "Sicredi"
};

function interpretarNotificacaoCompra(n){
  n = n || {};
  const titulo = String(n.titulo || n.title || "");
  const texto = String(n.texto || n.text || n.corpo || "");
  const full = (titulo + " " + texto).replace(/\s+/g, " ").trim();
  const norm = semAcentoCompra(full);
  if (!full) return { ok: false, motivo: "vazio" };

  if (/(recusad|negad|nao aprovad|cancelad|estorn|reembols|devolu)/.test(norm)) return { ok: false, motivo: "nao-e-compra-aprovada" };
  if (/(pagamento da fatura|fatura (fechou|fechada|disponivel|vence)|pix|transferencia|saque|deposito|boleto)/.test(norm) && !/compra/.test(norm)) return { ok: false, motivo: "nao-e-compra" };
  if (!/(compra|pagamento aprovado|transacao aprovada|transacao no credito)/.test(norm)) return { ok: false, motivo: "nao-e-compra" };
  if (/debito/.test(norm) && !/credito/.test(norm)) return { ok: false, motivo: "debito" };

  // valores em reais
  const valores = [];
  const re = /R\$\s*([\d]{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/gi;
  let m;
  while ((m = re.exec(full))) { const v = lerValorBRL(m[1]); if (v > 0) valores.push(v); }
  if (!valores.length) return { ok: false, motivo: "sem-valor" };

  // parcelas
  let parcelas = 1, parcelaAtual = null, totalParcelas = null, valor = valores[0], valorParcela = null;
  const mx = /(?:em\s+)?(\d{1,2})\s*(?:x|vezes|parcelas)\b/i.exec(full);
  if (mx && Number(mx[1]) > 1 && Number(mx[1]) <= 48){
    parcelas = Number(mx[1]);
    const parcelaForma = /\d{1,2}\s*x\s*de\s*R\$/i.test(full);
    if (valores.length >= 2){ valor = valores[0]; valorParcela = valores[1]; }
    else if (parcelaForma){ valorParcela = valores[0]; valor = Math.round(valores[0] * parcelas * 100) / 100; }
    else { valor = valores[0]; valorParcela = Math.round((valor / parcelas) * 100) / 100; }
  }
  const mp = /parcela\s+(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/i.exec(full);
  if (mp){ parcelaAtual = Number(mp[1]); totalParcelas = Number(mp[2]); }

  // estabelecimento: último "em XXXX" que não seja "em 6x" nem "em R$"
  let estab = "";
  const reEm = /\bem\s+(?!\d{1,2}\s*(?:x|vezes|parcelas)\b)(?!R\$)([^.\n!]+?)(?=\s*(?:[.!]|$|,|\s+às\s|\s+as\s|\s+no\s+cart|\s+no\s+dia\b|\s+dia\s+\d|\s+hoje\b|\s+ontem\b|\s+com\s+final|\s+\d{1,2}\/\d{1,2}|\s+em\s+\d{1,2}\s*x))/gi;
  while ((m = reEm.exec(full))) estab = m[1].trim();
  if (!estab){ const ml = /(?:estabelecimento|local)[:\s]+([^.\n]+)/i.exec(full); if (ml) estab = ml[1].trim(); }
  estab = estab.replace(/\s+/g, " ").replace(/[.\s]+$/, "");

  // banco / cartão
  let banco = (n.pacote && PACOTES_BANCOS[n.pacote]) || "";
  if (!banco && typeof BANCOS !== "undefined"){
    const b = BANCOS.find(x => norm.indexOf(semAcentoCompra(x.nome)) >= 0);
    if (b) banco = b.nome;
  }
  const mf = /final\s+(\d{4})/i.exec(full);
  let cartao = "";
  const mc = /cart[aã]o\s+(?:de\s+cr[eé]dito\s+)?([A-Za-zÀ-ú0-9]+(?:\s+[A-Za-zÀ-ú0-9]+)?)/i.exec(full);
  if (mc && !/^(no|de|com|final)$/i.test(mc[1].trim())) cartao = mc[1].replace(/\s+(no|de|com|final)$/i, "").trim();
  if (!banco && cartao) banco = cartao;

  // data/hora: se o texto diz ("no dia 04/10 às 20:03"), vale o texto; senão a hora em que a notificação chegou
  const quando = n.timestamp ? new Date(Number(n.timestamp)) : new Date();
  let ano = quando.getFullYear(), mesC = quando.getMonth() + 1, diaC = quando.getDate();
  let horaCompra = `${String(quando.getHours()).padStart(2, "0")}:${String(quando.getMinutes()).padStart(2, "0")}`;
  const mData = /(?:no\s+dia|\bdia|\bem)\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i.exec(full);
  if (mData){
    const dd = Number(mData[1]), mm = Number(mData[2]);
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12){
      diaC = dd; mesC = mm;
      if (mData[3]){ ano = Number(mData[3]) < 100 ? 2000 + Number(mData[3]) : Number(mData[3]); }
      else if (new Date(ano, mesC - 1, diaC).getTime() > quando.getTime() + 86400000) ano -= 1;   // compra de dezembro vista em janeiro
    }
  }
  const mHora = /(?:^|\s)(?:às|as|a)\s*(\d{1,2})[:h](\d{2})/i.exec(full) || /(?:^|\s)(\d{1,2}):(\d{2})(?:\s|$|[.,])/.exec(full);
  if (mHora && Number(mHora[1]) < 24 && Number(mHora[2]) < 60) horaCompra = `${String(Number(mHora[1])).padStart(2, "0")}:${mHora[2]}`;
  const dataCompra = `${ano}-${String(mesC).padStart(2, "0")}-${String(diaC).padStart(2, "0")}`;

  return {
    ok: true, banco, cartao, finalCartao: mf ? mf[1] : "", estabelecimento: estab,
    valor: Math.round(valor * 100) / 100, parcelas, valorParcela, parcelaAtual, totalParcelas,
    tipo: "credito", dataCompra, horaCompra, identificadorNotificacao: n.id ? String(n.id) : ""
  };
}

// ---------------------------------------------------------------
// CARTÃO DA CENTRAL + CATEGORIA
// ---------------------------------------------------------------
function cartoesCreditoCentral(){ return (estado.cartoesCentral || []).filter(c => c.tipo === "credito"); }

function acharCartaoCentralParaCompra(banco, cartao, final){
  const lista = cartoesCreditoCentral();
  if (!lista.length) return null;
  const nb = semAcentoCompra(banco), nc = semAcentoCompra(cartao);
  const pontuar = (cc) => {
    const nome = semAcentoCompra(cc.nome);
    const bk = cc.bancoId && typeof bancoPorId === "function" ? bancoPorId(cc.bancoId) : null;
    const nomeBanco = bk ? semAcentoCompra(bk.nome) : "";
    let p = 0;
    if (nb && (nome.indexOf(nb) >= 0 || (nomeBanco && (nomeBanco.indexOf(nb) >= 0 || nb.indexOf(nomeBanco) >= 0)))) p += 2;
    if (nc && nome.indexOf(nc) >= 0) p += 1;
    if (final && nome.indexOf(final) >= 0) p += 2;
    return p;
  };
  const pont = lista.map(cc => ({ cc, p: pontuar(cc) })).filter(x => x.p > 0).sort((a, b) => b.p - a.p);
  if (!pont.length) return null;
  if (pont.length > 1 && pont[0].p === pont[1].p) return null;   // ambíguo: o usuário escolhe
  return pont[0].cc;
}

const REGRAS_CATEGORIA_COMPRA = [
  ["alimentacao", /(mercado|supermerc|atacad|padaria|restaur|lanch|ifood|pizza|acougue|hortifruti|sacolao|cafe|burger|sorvet|doceria|bar )/],
  ["transporte", /(posto|combust|uber|99|taxi|estaciona|pedagio|metro|onibus|gasolina|sem parar|ipiranga|shell)/],
  ["saude", /(farmac|drog|hospital|clinica|medic|dentis|laborat|odonto|raia|pacheco)/],
  ["assinaturas", /(netflix|spotify|prime|disney|assinatura|youtube|apple|google|hbo|deezer|icloud)/],
  ["lazer", /(cinema|ingresso|steam|playstation|xbox|jogo|show|teatro|parque|viagem|hotel|airbnb)/],
  ["educacao", /(escola|curso|faculdade|livraria|udemy|colegio|universidade|alura)/],
  ["pets", /(pet|veterin|racao)/],
  ["roupas", /(roupa|moda|renner|riachuelo|c&a|zara|calcad|shein|nike|adidas|centauro)/],
  ["cuidados_pessoais", /(salao|barbear|cosmet|perfum|boticario|natura|sephora)/],
  ["contas_basicas", /(energia|enel|cemig|copel|sabesp|agua|internet|vivo|claro|tim |oi )/]
];
function sugerirCategoriaCompra(estabelecimento){
  const n = semAcentoCompra(estabelecimento) + " ";
  for (const [id, re] of REGRAS_CATEGORIA_COMPRA) if (re.test(n)) return id;
  return "outros";
}

// ---------------------------------------------------------------
// QUAL FATURA? (respeita o modelo do app: cada mês do ciclo = a fatura que vence naquele mês)
// ---------------------------------------------------------------
function ordemAnoMes(ano, mes){ return ano * 12 + (mes - 1); }

function entradaFaturaDoCartao(cc, mes){
  return cc ? estado.meses[mes].cartoes.find(c => c.centralId === cc.id) || null : null;
}

function sugerirFaturaCompra(cc, dataISO){
  const mm = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataISO || "");
  const hoje = new Date();
  const y = mm ? Number(mm[1]) : hoje.getFullYear(), m = mm ? Number(mm[2]) : hoje.getMonth() + 1, d = mm ? Number(mm[3]) : hoje.getDate();
  const F = cc && cc.fechamento ? Number(cc.fechamento) : null;
  const V = cc && cc.vencimento ? Number(cc.vencimento) : null;
  let certeza = "alta", nota = "";

  // 1) em que mês a fatura FECHA
  let fy = y, fm = m;
  if (F){
    if (d >= F){ fm = m + 1; if (fm > 12){ fm = 1; fy = y + 1; } }
    if (d === F){ certeza = "baixa"; nota = "Compra feita no dia do fechamento: alguns bancos lançam na fatura que fecha, outros na próxima. Confira no app do banco."; }
  } else {
    certeza = "baixa"; nota = "Este cartão não tem dia de fechamento cadastrado. Usei o mês da compra.";
  }
  // 2) em que mês ela VENCE (vencimento antes/igual ao fechamento = mês seguinte)
  let vy = fy, vm = fm;
  if (F && V && V <= F){ vm = fm + 1; if (vm > 12){ vm = 1; vy = fy + 1; } }
  else if (F && !V){ if (certeza === "alta") certeza = "media"; nota = nota || "Este cartão não tem dia de vencimento cadastrado. Usei o mês do fechamento."; }

  // 3) precisa existir no ciclo de 12 meses do app
  const ordem = mesesEmOrdem();
  const primeiro = ordem[0], ultimo = ordem[ordem.length - 1];
  const oPrimeiro = ordemAnoMes(anoParaMes(primeiro), primeiro), oUltimo = ordemAnoMes(anoParaMes(ultimo), ultimo);
  let alvo = ordemAnoMes(vy, vm);
  if (alvo < oPrimeiro){ alvo = oPrimeiro; certeza = "baixa"; nota = "Essa fatura está antes do ciclo de 12 meses do app. Usei o primeiro mês disponível."; }
  else if (alvo > oUltimo){ alvo = oUltimo; certeza = "baixa"; nota = "Essa fatura está depois do ciclo de 12 meses do app. Usei o último mês disponível."; }
  let mes = (alvo % 12) + 1, ano = Math.floor(alvo / 12);

  // 4) fatura já paga não segura limite: sugere a próxima aberta
  let e = entradaFaturaDoCartao(cc, mes);
  if (e && e.paga){
    const pagaRotulo = rotuloFatura(mes, ano);
    let idx = ordem.indexOf(mes), achou = false;
    while (++idx < ordem.length){
      const e2 = entradaFaturaDoCartao(cc, ordem[idx]);
      if (e2 && !e2.paga){ mes = ordem[idx]; ano = anoParaMes(mes); achou = true; break; }
    }
    certeza = "baixa";
    nota = achou ? `A fatura de ${pagaRotulo} já está marcada como paga. Sugeri a próxima em aberto.` : `A fatura de ${pagaRotulo} já está marcada como paga e não há uma próxima em aberto.`;
  }
  return { mes, ano, rotulo: rotuloFatura(mes, ano), certeza, nota };
}

// ---------------------------------------------------------------
// RECEBER COMPRA (única porta de entrada) + ANTI-DUPLICIDADE
// ---------------------------------------------------------------
function chaveCompra(c){
  const base = [semAcentoCompra(c.banco), semAcentoCompra(c.cartao), Number(c.valor).toFixed(2), c.dataCompra || "", c.horaCompra || "", semAcentoCompra(c.estabelecimento)];
  if (c.identificadorNotificacao) return "id:" + semAcentoCompra(c.banco) + ":" + c.identificadorNotificacao;
  return base.join("|");
}
function minutosDe(c){
  const t = new Date(`${c.dataCompra}T${c.horaCompra || "00:00"}:00`).getTime();
  return isNaN(t) ? null : t / 60000;
}

function receberCompraDetectada(dados, opcoes){
  opcoes = opcoes || {};
  if (typeof dados === "string"){ try{ dados = JSON.parse(dados); }catch(e){ return { ok: false, motivo: "json-invalido" }; } }
  dados = dados || {};
  const valor = lerValorBRL(dados.valor);
  if (!(valor > 0)) return { ok: false, motivo: "sem-valor" };
  if (dados.tipo && semAcentoCompra(dados.tipo) === "debito") return { ok: false, motivo: "debito" };

  const c = {
    id: gerarId("pend"),
    banco: String(dados.banco || "").trim(),
    cartao: String(dados.cartao || "").trim(),
    finalCartao: String(dados.finalCartao || "").trim(),
    estabelecimento: String(dados.estabelecimento || dados.loja || "").trim(),
    valor: Math.round(valor * 100) / 100,
    dataCompra: /^\d{4}-\d{2}-\d{2}/.test(dados.dataCompra || "") ? String(dados.dataCompra).slice(0, 10) : dataISOHoje(),
    horaCompra: /^\d{2}:\d{2}/.test(dados.horaCompra || "") ? String(dados.horaCompra).slice(0, 5) : horaAgora(),
    parcelaAtual: dados.parcelaAtual || null,
    totalParcelas: Math.max(1, Math.floor(Number(dados.parcelas || dados.totalParcelas || 1))) || 1,
    valorParcela: dados.valorParcela || null,
    categoria: dados.categoria || "",
    identificadorNotificacao: String(dados.identificadorNotificacao || ""),
    origem: opcoes.origem || "automatica",
    canal: opcoes.canal || dados.canal || "",
    simulada: !!opcoes.simulada,
    status: "pendente",
    faturaSugerida: null, faturaConfirmada: null,
    dataDeteccao: Date.now(), dataConfirmacao: null,
    possivelDuplicata: false, centralId: null
  };
  c.chave = chaveCompra(c);
  if (!c.categoria) c.categoria = sugerirCategoriaCompra(c.estabelecimento);

  // anti-duplicidade: mesma notificação chegando de novo NÃO cria outra pendência
  const lista = comprasLista();
  const igual = lista.find(x => x.chave === c.chave);
  if (igual) return { ok: false, duplicada: true, existente: igual, motivo: "duplicada" };
  const mc = minutosDe(c);
  c.possivelDuplicata = lista.some(x => x.status !== "ignorada" && semAcentoCompra(x.banco) === semAcentoCompra(c.banco)
    && Number(x.valor).toFixed(2) === c.valor.toFixed(2) && semAcentoCompra(x.estabelecimento) === semAcentoCompra(c.estabelecimento)
    && mc !== null && minutosDe(x) !== null && Math.abs(minutosDe(x) - mc) <= COMPRAS_JANELA_DUP_MIN);

  const cc = acharCartaoCentralParaCompra(c.banco, c.cartao, c.finalCartao);
  if (cc){ c.centralId = cc.id; c.faturaSugerida = sugerirFaturaCompra(cc, c.dataCompra); }

  lista.push(c);
  while (lista.length > COMPRAS_MAX_HISTORICO){
    const i = lista.findIndex(x => x.status !== "pendente");
    if (i < 0) break;
    lista.splice(i, 1);
  }
  salvarEstado();
  notificarCompraDetectada(c);
  atualizarTelasCompras();
  return { ok: true, compra: c };
}

// vindo do módulo nativo Android (ou de qualquer outra ponte): texto da notificação → pendência
function receberNotificacaoBanco(n){
  if (typeof n === "string"){ try{ n = JSON.parse(n); }catch(e){ return { ok: false, motivo: "json-invalido" }; } }
  const p = interpretarNotificacaoCompra(n);
  if (!p.ok) return p;
  return receberCompraDetectada(p, { origem: "automatica", canal: "android" });
}
function receberLoteNotificacoes(lote){
  if (typeof lote === "string"){ try{ lote = JSON.parse(lote); }catch(e){ return []; } }
  return (lote || []).map(receberNotificacaoBanco);
}

function notificarCompraDetectada(c){
  try{
    if (c.simulada && document.visibilityState === "visible") return;
    if (document.visibilityState === "visible"){ mostrarToast(`🔔 Nova compra identificada · ${formatarMoeda(c.valor)}`); return; }
    if (!estado.notificacoes || !estado.notificacoes.ativado) return;
    const chave = "compra_" + c.id;
    if (jaFoiEnviada(chave)) return;
    marcarComoEnviada(chave);
    dispararNotificacao("🔔 Nova compra identificada", `${c.banco || "Cartão"} • ${formatarMoeda(c.valor)}\nAbra o Orizon para confirmar a fatura.`);
  }catch(e){ console.warn("Notificação de compra:", e); }
}

// ---------------------------------------------------------------
// CONFIRMAR / IGNORAR
// ---------------------------------------------------------------
function confirmarCompraPendente(c, f){
  const cc = acharCentral(f.centralId);
  if (!cc || cc.tipo !== "credito") return { ok: false, erro: "Escolha o cartão de crédito da compra." };
  const mes = Number(f.mes);
  if (!(mes >= 1 && mes <= 12)) return { ok: false, erro: "Escolha a fatura." };
  const entrada = entradaFaturaDoCartao(cc, mes);
  if (!entrada) return { ok: false, erro: "Esse cartão não tem fatura nesse mês." };
  if (entrada.paga) return { ok: false, erro: `A fatura de ${rotuloFatura(mes, anoParaMes(mes))} já está paga. Escolha outro mês.` };
  const valor = Number(f.valor);
  if (!(valor > 0)) return { ok: false, erro: "Informe o valor da compra." };
  const n = Math.max(1, Math.floor(Number(f.parcelas) || 1));
  const descricao = (f.estabelecimento || "").trim() || "Compra no cartão";

  const antes = disponivelCentral(cc);
  const r = adicionarCompraParceladaCentral(mes, entrada.id, descricao, valor, n, {
    dataCompra: f.dataCompra, horaCompra: f.horaCompra, categoria: f.categoria, origem: c.origem || "manual",
    compraPendenteId: c.id, bancoOrigem: c.banco || ""
  });
  if (!r || !r.ok) return { ok: false, erro: "Não foi possível lançar a compra." };
  const depois = disponivelCentral(cc);
  // conferência final: o que ficou lançado nas faturas deve ser igual ao que saiu do limite
  let somaLancada = 0;
  for (let m = 1; m <= 12; m++){
    const e = entradaFaturaDoCartao(cc, m);
    if (e) (e.compras || []).forEach(x => { if (x.compraPendenteId === c.id) somaLancada += Number(x.valor || 0); });
  }
  const conferido = Math.abs((antes - depois) - somaLancada) < 0.01 && somaLancada > 0 && (r.colocadas < r.total || Math.abs(somaLancada - valor) < 0.02);

  c.status = "confirmada"; c.centralId = cc.id; c.estabelecimento = descricao; c.valor = valor; c.totalParcelas = n;
  c.dataCompra = f.dataCompra; c.horaCompra = f.horaCompra; c.categoria = f.categoria;
  c.faturaConfirmada = { mes, ano: anoParaMes(mes), rotulo: rotuloFatura(mes, anoParaMes(mes)) };
  c.dataConfirmacao = Date.now();
  if (!comprasLista().includes(c)) comprasLista().push(c);   // registro manual entra já confirmado
  salvarEstado();
  atualizarTelasCompras();
  return { ok: true, antes, depois, somaLancada, conferido, colocadas: r.colocadas, total: r.total, cc, fatura: c.faturaConfirmada };
}

function ignorarCompraPendente(c){
  c.status = "ignorada"; c.dataConfirmacao = Date.now();
  salvarEstado();
  atualizarTelasCompras();
}

function atualizarTelasCompras(){
  const seguro = (fn) => { try{ fn(); }catch(e){ console.warn("Atualizar tela:", e); } };
  seguro(() => renderizarHome());
  seguro(() => renderizarCentralCartoes());
  seguro(() => renderizarCartoes(estado.mesSelecionado));
  seguro(() => renderizarMes(estado.mesSelecionado));
  seguro(() => atualizarResumoConfigCompras());
  seguro(() => renderizarListaComprasPendentes());
}

// ---------------------------------------------------------------
// HOME: card "Compras pendentes"
// ---------------------------------------------------------------
function textoIdadePendencia(c){
  const dias = Math.floor((Date.now() - (c.dataDeteccao || Date.now())) / 86400000);
  if (dias <= 0) return "Nova";
  return `Aguardando há ${dias} dia${dias === 1 ? "" : "s"}`;
}
function classeUrgenciaCompra(c){
  const dias = (Date.now() - (c.dataDeteccao || Date.now())) / 86400000;
  return dias > COMPRAS_DIAS_URGENTE ? "urg-vermelho" : "urg-laranja";
}
function itemPendenteHtml(c){
  const cls = classeUrgenciaCompra(c);
  const bolinha = cls === "urg-vermelho" ? "🔴" : "🟠";
  const status = `${bolinha} ${textoIdadePendencia(c)}${c.possivelDuplicata ? " · ⚠️ possível duplicata" : ""}`;
  const parc = c.totalParcelas > 1 ? ` · ${c.totalParcelas}x` : "";
  return `<div class="pend-item ${cls}" data-pend="${c.id}" role="button" tabindex="0">
    <span class="pend-ico">🛒</span>
    <div class="pend-info">
      <strong>${escaparHTML(c.estabelecimento || "Compra no cartão")}</strong>
      <span>💳 ${escaparHTML(c.banco || c.cartao || "Cartão")}${c.cartao && c.banco && c.cartao !== c.banco ? " · " + escaparHTML(c.cartao) : ""}</span>
      <span>📅 Compra realizada em ${dataBRCompra(c.dataCompra)}${c.horaCompra ? " às " + c.horaCompra : ""}</span>
      <span class="pend-status">${status}</span>
    </div>
    <b class="home-valor">${formatarMoeda(c.valor)}${parc}</b>
  </div>`;
}

function renderizarPendentesHome(){
  const box = document.getElementById("home-pendentes");
  const card = document.getElementById("home-pendentes-card");
  const badge = document.getElementById("pend-badge");
  if (!box || !card) return;
  const lista = comprasPendentes();
  card.classList.toggle("tem-pendencia", lista.length > 0);
  if (badge){ badge.textContent = lista.length; badge.classList.toggle("hidden", lista.length === 0); }

  if (lista.length === 0){
    box.innerHTML = `<div class="home-tudo-certo"><span>🟢</span><div><strong>Tudo organizado</strong><p>Nenhuma compra de cartão aguardando confirmação.</p></div></div>
      <button class="pend-link" id="pend-btn-manual">＋ Registrar compra manualmente</button>`;
  } else {
    const urg = lista.some(c => classeUrgenciaCompra(c) === "urg-vermelho");
    const titulo = lista.length === 1 ? "1 compra aguardando confirmação" : `${lista.length} compras aguardando confirmação`;
    const mostrar = lista.slice(0, 3);
    box.innerHTML = `<p class="pend-resumo">${urg ? "🔴" : "🟠"} ${titulo}</p>`
      + mostrar.map(itemPendenteHtml).join("")
      + (lista.length > 3 ? `<button class="pend-link" id="pend-btn-todas">Ver todas as ${lista.length} compras →</button>` : "")
      + `<button class="btn-primary pend-revisar" id="pend-btn-revisar">Revisar compra</button>
         <button class="pend-link" id="pend-btn-manual">＋ Registrar compra manualmente</button>`;
  }
  box.querySelectorAll("[data-pend]").forEach(el => {
    const abrir = () => abrirCompraPendente(el.dataset.pend);
    el.addEventListener("click", abrir);
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " "){ e.preventDefault(); abrir(); } });
  });
  const rev = document.getElementById("pend-btn-revisar");
  if (rev) rev.addEventListener("click", () => abrirCompraPendente(comprasPendentes()[0].id));
  const todas = document.getElementById("pend-btn-todas");
  if (todas) todas.addEventListener("click", abrirListaComprasPendentes);
  const man = document.getElementById("pend-btn-manual");
  if (man) man.addEventListener("click", abrirNovaCompraManual);
}

// ---------------------------------------------------------------
// MODAL: lista de todas as pendentes
// ---------------------------------------------------------------
function abrirListaComprasPendentes(){
  renderizarListaComprasPendentes();
  document.getElementById("modal-compras-pendentes").classList.remove("hidden");
}
function renderizarListaComprasPendentes(){
  const box = document.getElementById("pc-lista");
  if (!box) return;
  const lista = comprasPendentes();
  box.innerHTML = lista.length
    ? lista.map(itemPendenteHtml).join("")
    : `<div class="home-tudo-certo"><span>🟢</span><div><strong>Tudo organizado</strong><p>Nenhuma compra aguardando confirmação.</p></div></div>`;
  const rec = comprasLista().filter(c => c.status === "confirmada").sort((a, b) => (b.dataConfirmacao || 0) - (a.dataConfirmacao || 0)).slice(0, 3);
  const boxRec = document.getElementById("pc-recentes");
  if (boxRec) boxRec.innerHTML = rec.length
    ? `<h4 class="pend-sub">🟢 Lançadas recentemente</h4>` + rec.map(c => `<div class="pend-item pend-ok"><span class="pend-ico">✅</span><div class="pend-info"><strong>${escaparHTML(c.estabelecimento || "Compra")}</strong><span>${c.faturaConfirmada ? "Fatura " + c.faturaConfirmada.rotulo : ""}</span></div><b class="home-valor">${formatarMoeda(c.valor)}</b></div>`).join("")
    : "";
  box.querySelectorAll("[data-pend]").forEach(el => el.addEventListener("click", () => {
    document.getElementById("modal-compras-pendentes").classList.add("hidden");
    abrirCompraPendente(el.dataset.pend);
  }));
}

// ---------------------------------------------------------------
// CONFERÊNCIA ANTES DE LANÇAR (checklist mostrado no modal)
// ok = verde · aviso = amarelo (pode seguir) · erro = vermelho (bloqueia o botão)
// ---------------------------------------------------------------
function parcelasQueCabem(cc, mes, n){
  let m = mes, k = 0;
  for (let i = 0; i < n; i++){
    if (i > 0){ m = proximoMesDoCiclo(m); if (!m) break; }
    if (!entradaFaturaDoCartao(cc, m)) break;
    k++;
  }
  return k;
}

function conferirCompra(f, c){
  const itens = []; let bloqueia = false, estourou = false;
  const add = (nivel, texto) => { itens.push({ nivel, texto }); if (nivel === "erro") bloqueia = true; };
  const cc = acharCentral(f.centralId);
  const valor = Number(f.valor), n = Math.max(1, Math.floor(Number(f.parcelas) || 1));
  const mes = Number(f.mes);

  // 1) cartão
  if (!cc) add("erro", "Escolha o cartão de crédito da compra.");
  else {
    const detectado = c && (c.banco || c.cartao) ? `${c.banco || ""}${c.cartao && c.cartao !== c.banco ? " " + c.cartao : ""}`.trim() : "";
    if (!c || compraEhManual || !detectado) add("ok", `Cartão: ${cc.nome}`);
    else if (c.centralId && c.centralId === cc.id) add("ok", `Cartão identificado: ${cc.nome} (a notificação dizia "${detectado}")`);
    else if (c.centralId && c.centralId !== cc.id) add("aviso", `Você escolheu ${cc.nome}, mas a notificação indicava "${detectado}". Confira se é o cartão certo.`);
    else add("aviso", `Não consegui ligar "${detectado}" a um cartão seu automaticamente. Confira se ${cc.nome} é o cartão certo.`);
  }
  // 2) valor / parcelas
  if (!(valor > 0)) add("erro", "Informe o valor da compra.");
  else {
    add("ok", n > 1 ? `Valor: ${formatarMoeda(valor)} em ${n}x de ${formatarMoeda(valor / n)}` : `Valor: ${formatarMoeda(valor)}`);
    if (cc && limiteTotalCentral(cc) > 0 && valor > limiteTotalCentral(cc)) add("aviso", `O valor é maior que o limite total do cartão (${formatarMoeda(limiteTotalCentral(cc))}). Confira se digitou certo.`);
  }
  // 3) data
  if (f.dataCompra && f.dataCompra > dataISOHoje()) add("aviso", "A data da compra está no futuro.");
  // 4) fatura
  if (cc){
    if (!(mes >= 1 && mes <= 12)) add("erro", "Escolha a fatura.");
    else {
      const entrada = entradaFaturaDoCartao(cc, mes);
      const rot = rotuloFatura(mes, anoParaMes(mes));
      if (!entrada) add("erro", `Esse cartão não tem fatura em ${rot}.`);
      else if (entrada.paga) add("erro", `A fatura de ${rot} já está paga. Escolha outro mês.`);
      else {
        const s = sugerirFaturaCompra(cc, f.dataCompra);
        if (s.mes === mes) add(s.certeza === "alta" ? "ok" : "aviso", `Fatura de ${rot}${s.certeza === "alta" ? " (igual à sugestão do Orizon)" : ": " + s.nota}`);
        else add("aviso", `Você escolheu ${rot}; a sugestão do Orizon era ${s.rotulo}. Tudo bem se você sabe que é essa.`);
        if (n > 1){
          const cabem = parcelasQueCabem(cc, mes, n);
          if (cabem < n) add("aviso", `Só ${cabem} de ${n} parcelas cabem nos 12 meses do app; as outras não serão lançadas.`);
          else add("ok", `As ${n} parcelas caem nos meses seguintes a ${rot}.`);
        }
      }
    }
    // 5) limite (o mesmo cálculo da aba Cartões)
    const total = limiteTotalCentral(cc), antes = disponivelCentral(cc);
    if (total <= 0) add("aviso", "Este cartão está sem limite cadastrado: não dá para conferir o limite disponível. Cadastre na aba Cartões.");
    else if (valor > 0){
      const depois = antes - valor;
      if (depois < 0){ estourou = true; add("aviso", `Limite disponível: ${formatarMoeda(antes)} → ${formatarMoeda(depois)}. Esta compra passa do limite do cartão (${formatarMoeda(total)}).`); }
      else add("ok", `Limite disponível: ${formatarMoeda(antes)} → ${formatarMoeda(depois)} (de ${formatarMoeda(total)})`);
    } else add("ok", `Limite disponível agora: ${formatarMoeda(antes)} (de ${formatarMoeda(total)})`);
  }
  return { itens, bloqueia, estourou, aviso: itens.some(i => i.nivel === "aviso") };
}

function renderizarConferenciaCompra(){
  const box = document.getElementById("pc-conferencia"), btn = document.getElementById("pc-confirmar");
  if (!box || !compraEmEdicao) return;
  const r = conferirCompra(lerFormularioCompra(), compraEmEdicao);
  const ico = { ok: "✅", aviso: "⚠️", erro: "⛔" };
  box.innerHTML = `<span class="pc-conf-titulo">🔎 Conferência antes de lançar</span>` + r.itens.map(i => `<div class="pc-conf-item pc-conf-${i.nivel}"><span>${ico[i.nivel]}</span><span>${escaparHTML(i.texto)}</span></div>`).join("");
  btn.disabled = r.bloqueia;
  btn.textContent = r.estourou ? "Confirmar mesmo assim" : r.aviso ? "✓ Confirmar lançamento (conferi os avisos)" : "✓ Confirmar lançamento";
}

// ---------------------------------------------------------------
// MODAL: confirmação
// ---------------------------------------------------------------
function abrirCompraPendente(id){
  const c = comprasLista().find(x => x.id === id && x.status === "pendente");
  if (!c) return;
  compraEhManual = false;
  if (!c.centralId){   // o cartão pode ter sido cadastrado depois da detecção: tenta ligar de novo
    const cc = acharCartaoCentralParaCompra(c.banco, c.cartao, c.finalCartao);
    if (cc){ c.centralId = cc.id; c.faturaSugerida = sugerirFaturaCompra(cc, c.dataCompra); salvarEstado(); }
  }
  abrirModalCompra(c);
}
function abrirNovaCompraManual(){
  compraEhManual = true;
  abrirModalCompra({
    id: gerarId("pend"), banco: "", cartao: "", finalCartao: "", estabelecimento: "", valor: 0, totalParcelas: 1,
    dataCompra: dataISOHoje(), horaCompra: horaAgora(), categoria: "outros", origem: "manual", status: "pendente",
    faturaSugerida: null, faturaConfirmada: null, dataDeteccao: Date.now(), centralId: null, possivelDuplicata: false
  });
}

function popularSelectCartoesCompra(c){
  const sel = document.getElementById("pc-cartao");
  const cartoes = cartoesCreditoCentral();
  sel.innerHTML = cartoes.length
    ? (c.centralId ? "" : `<option value="">Escolha o cartão…</option>`) + cartoes.map(cc => `<option value="${cc.id}">${escaparHTML(cc.nome)}</option>`).join("")
    : `<option value="">Nenhum cartão de crédito cadastrado</option>`;
  if (c.centralId) sel.value = c.centralId;
}
function popularSelectCategoriasCompra(sel){
  const el = document.getElementById("pc-categoria");
  el.innerHTML = CATEGORIAS.map(x => `<option value="${x.id}">${x.emoji} ${x.nome}</option>`).join("");
  el.value = sel || "outros";
}
function popularSelectFaturasCompra(centralId, selecionado){
  const el = document.getElementById("pc-fatura");
  const cc = acharCentral(centralId);
  if (!cc){ el.innerHTML = `<option value="">Escolha o cartão primeiro</option>`; return; }
  el.innerHTML = mesesEmOrdem().map(m => {
    const e = entradaFaturaDoCartao(cc, m);
    const rot = rotuloFatura(m, anoParaMes(m)) + (cc.vencimento ? ` · vence dia ${cc.vencimento}` : "") + (e && e.paga ? " · paga" : "");
    return `<option value="${m}" ${e && e.paga ? "disabled" : ""}>${rot}</option>`;
  }).join("");
  if (selecionado) el.value = String(selecionado);
}

function abrirModalCompra(c){
  compraEmEdicao = c;
  compraFaturaManual = false;
  compraCategoriaManual = false;
  document.getElementById("pc-titulo").textContent = compraEhManual ? "➕ Registrar compra no cartão" : "💳 Nova compra identificada";
  const aviso = document.getElementById("pc-aviso");
  aviso.classList.toggle("hidden", !c.possivelDuplicata);
  aviso.textContent = "⚠️ Parece com uma compra já registrada (mesmo cartão, valor e local em poucos minutos). Confira antes de confirmar ou toque em Ignorar.";
  document.getElementById("pc-origem").textContent = compraEhManual ? "" : (c.simulada ? "🧪 Compra de teste" : "🔔 Detectada pelo Orizon — ainda não lançada");
  popularSelectCartoesCompra(c);
  popularSelectCategoriasCompra(c.categoria);
  document.getElementById("pc-estab").value = c.estabelecimento || "";
  document.getElementById("pc-valor").value = c.valor ? String(c.valor) : "";
  document.getElementById("pc-parcelas").value = String(c.totalParcelas || 1);
  document.getElementById("pc-data").value = c.dataCompra || dataISOHoje();
  document.getElementById("pc-hora").value = c.horaCompra || horaAgora();
  document.getElementById("pc-banco-txt").textContent = compraEhManual ? "" : `${c.banco || "Banco não identificado"}${c.cartao && c.cartao !== c.banco ? " · " + c.cartao : ""}`;
  document.getElementById("pc-ignorar").classList.toggle("hidden", compraEhManual);
  document.getElementById("pc-erro").textContent = "";
  recalcularFaturaCompra(true);
  document.getElementById("modal-compra-pendente").classList.remove("hidden");
}

function recalcularFaturaCompra(reiniciar){
  const centralId = document.getElementById("pc-cartao").value;
  const cc = acharCentral(centralId);
  const dataISO = document.getElementById("pc-data").value;
  popularSelectFaturasCompra(centralId, null);
  const boxSug = document.getElementById("pc-sugestao");
  if (!cc){
    boxSug.innerHTML = cartoesCreditoCentral().length
      ? `<span class="pc-sug-tag">Escolha o cartão</span><small>Assim o Orizon calcula a fatura.</small>`
      : `<span class="pc-sug-tag pc-sug-aviso">Nenhum cartão de crédito cadastrado</span><small>Cadastre o cartão na Central dos Cartões para lançar a compra.</small>`;
    atualizarPreviaLimiteCompra();
    return;
  }
  const s = sugerirFaturaCompra(cc, dataISO);
  if (compraEmEdicao) compraEmEdicao.faturaSugerida = s;
  if (reiniciar || !compraFaturaManual) document.getElementById("pc-fatura").value = String(s.mes);
  const fechaVence = `${cc.fechamento ? "Fecha dia " + cc.fechamento : "Fechamento não cadastrado"} · ${cc.vencimento ? "vence dia " + cc.vencimento : "vencimento não cadastrado"}`;
  boxSug.innerHTML = `<span class="pc-sug-tag ${s.certeza === "alta" ? "" : "pc-sug-aviso"}">${s.certeza === "alta" ? "🟢" : "🟠"} Sugestão do Orizon: <b>🧾 Fatura de ${s.rotulo}</b></span>
    <small>${fechaVence}${s.nota ? "<br>" + escaparHTML(s.nota) : (s.certeza === "alta" ? "<br>Você pode alterar o mês abaixo." : "")}</small>`;
  atualizarPreviaLimiteCompra();
}

function atualizarPreviaLimiteCompra(){
  renderizarConferenciaCompra();
  const el = document.getElementById("pc-limite");
  const cc = acharCentral(document.getElementById("pc-cartao").value);
  const valor = Number(document.getElementById("pc-valor").value);
  if (!cc){ el.textContent = ""; return; }
  const antes = disponivelCentral(cc);
  el.innerHTML = valor > 0
    ? `Limite disponível: <b>${formatarMoeda(antes)}</b> → <b style="color:${antes - valor < 0 ? "var(--vermelho)" : "var(--verde)"};">${formatarMoeda(antes - valor)}</b>`
    : `Limite disponível agora: <b>${formatarMoeda(antes)}</b>`;
}

function lerFormularioCompra(){
  return {
    centralId: document.getElementById("pc-cartao").value,
    mes: document.getElementById("pc-fatura").value,
    estabelecimento: document.getElementById("pc-estab").value,
    valor: document.getElementById("pc-valor").value,
    parcelas: document.getElementById("pc-parcelas").value,
    dataCompra: document.getElementById("pc-data").value,
    horaCompra: document.getElementById("pc-hora").value,
    categoria: document.getElementById("pc-categoria").value
  };
}

function fecharModalCompra(){
  document.getElementById("modal-compra-pendente").classList.add("hidden");
  compraEmEdicao = null;
}

function mostrarCompraLancada(r, c){
  const el = document.getElementById("compra-lancada");
  const parc = r.total > 1 ? `${r.total}x de ${formatarMoeda(c.valor / r.total)} · total ${formatarMoeda(c.valor)}` : formatarMoeda(c.valor);
  el.innerHTML = `<strong>✅ Compra lançada</strong>
    <span>💳 ${escaparHTML(r.cc.nome)}</span>
    <span>🛒 ${escaparHTML(c.estabelecimento)}</span>
    <span>💰 ${parc}</span>
    <span>🧾 Fatura: ${r.fatura.rotulo}</span>
    ${r.colocadas < r.total ? `<span class="pc-alerta">⚠️ Só ${r.colocadas} de ${r.total} parcelas cabem nos 12 meses do app.</span>` : ""}
    <span>Limite disponível: <b>${formatarMoeda(r.depois)}</b></span>
    <span class="${r.conferido ? "pc-conf-ok-txt" : "pc-alerta"}">${r.conferido ? "✔ Conferido: o limite da aba Cartões bate com a compra." : "⚠️ Confira a aba Cartões: o limite não bateu com o esperado."}</span>`;
  el.classList.remove("hidden");
  clearTimeout(compraSucessoTimer);
  compraSucessoTimer = setTimeout(() => el.classList.add("hidden"), 5000);
}

// ---------------------------------------------------------------
// CONFIGURAÇÕES: bloco "Compras do cartão"
// ---------------------------------------------------------------
function pontePermissaoAndroid(){
  const A = window.OrizonAndroid;
  if (!A || typeof A.temPermissao !== "function") return null;   // não está dentro do app Android do Orizon
  try{ return !!A.temPermissao(); }catch(e){ return false; }
}

function atualizarResumoConfigCompras(){
  const el = document.getElementById("cfg-compras-status");
  if (!el) return;
  const n = comprasPendentes().length;
  const perm = pontePermissaoAndroid();
  const btn = document.getElementById("cfg-android-permissao");
  if (btn) btn.classList.toggle("hidden", perm !== false);   // só aparece no app Android, quando falta autorizar
  let linha;
  if (perm === true) linha = "✅ <b>Captura automática ativa</b>: o Orizon lê só as notificações de compra dos apps de banco e cria uma pendência para você confirmar.";
  else if (perm === false) linha = "⚠️ <b>Falta autorizar</b> o acesso às notificações. Sem isso o Orizon não vê as compras. Toque no botão abaixo e ative o Orizon na lista.";
  else linha = "ℹ️ Captura automática de notificações: <b>disponível só no app Android do Orizon</b> (pasta <code>android-app</code>). No navegador/PWA e no iPhone o sistema não permite ler notificações de outros apps — use o registro manual ou o link de automação.";
  el.innerHTML = linha + `<br>Compras aguardando confirmação: <b>${n}</b>`;
}

function simularCompraTeste(){
  return receberCompraDetectada({
    banco: "Nubank", cartao: "Nubank Crédito", estabelecimento: "Mercado XYZ", valor: 87.5,
    dataCompra: "2026-10-04", horaCompra: "14:35", tipo: "credito"
  }, { origem: "automatica", canal: "teste", simulada: true });
}

// ---------------------------------------------------------------
// LINK DE AUTOMAÇÃO (Atalhos do iPhone, MacroDroid/Tasker…):
//   index.html?compra=1&valor=87,50&loja=Mercado%20XYZ&banco=Nubank&cartao=Nubank&parcelas=1
// Só cria uma PENDÊNCIA — nada é lançado sem sua confirmação.
// ---------------------------------------------------------------
function processarLinkCompra(){
  try{
    const q = new URLSearchParams(location.search);
    if (!q.has("compra")) return;
    const r = receberCompraDetectada({
      valor: q.get("valor"), estabelecimento: q.get("loja") || q.get("estabelecimento"), banco: q.get("banco"), cartao: q.get("cartao"),
      parcelas: q.get("parcelas"), dataCompra: q.get("data"), horaCompra: q.get("hora"), identificadorNotificacao: q.get("id")
    }, { origem: "automatica", canal: "link" });
    history.replaceState(null, "", location.pathname + location.hash);   // limpa o link (evita repetir ao recarregar)
    if (r.duplicada) mostrarToast("Essa compra já estava registrada.");
  }catch(e){ console.warn("Link de compra:", e); }
}

// ---------------------------------------------------------------
// INICIALIZAÇÃO
// ---------------------------------------------------------------
function iniciarComprasPendentes(){
  comprasLista();
  const $ = (id) => document.getElementById(id);

  ["pc-cartao"].forEach(id => $(id).addEventListener("change", () => { compraFaturaManual = false; recalcularFaturaCompra(true); }));
  $("pc-data").addEventListener("change", () => recalcularFaturaCompra(false));
  $("pc-fatura").addEventListener("change", () => { compraFaturaManual = true; atualizarPreviaLimiteCompra(); });
  $("pc-parcelas").addEventListener("input", atualizarPreviaLimiteCompra);
  $("pc-valor").addEventListener("input", atualizarPreviaLimiteCompra);
  $("pc-categoria").addEventListener("change", () => { compraCategoriaManual = true; });
  $("pc-estab").addEventListener("input", () => { if (!compraCategoriaManual) $("pc-categoria").value = sugerirCategoriaCompra($("pc-estab").value); });
  $("pc-fechar").addEventListener("click", fecharModalCompra);
  $("modal-compra-pendente").addEventListener("click", (e) => { if (e.target.id === "modal-compra-pendente") fecharModalCompra(); });

  $("pc-confirmar").addEventListener("click", () => {
    if (!compraEmEdicao) return;
    const c = compraEmEdicao;
    if (conferirCompra(lerFormularioCompra(), c).bloqueia){ renderizarConferenciaCompra(); return; }
    const r = confirmarCompraPendente(c, lerFormularioCompra());
    if (!r.ok){ $("pc-erro").textContent = r.erro; return; }
    fecharModalCompra();
    mostrarCompraLancada(r, c);
  });
  $("pc-ignorar").addEventListener("click", () => {
    if (!compraEmEdicao || compraEhManual) return;
    ignorarCompraPendente(compraEmEdicao);
    fecharModalCompra();
    mostrarToast("Compra ignorada");
  });

  $("pc-lista-fechar").addEventListener("click", () => $("modal-compras-pendentes").classList.add("hidden"));
  $("modal-compras-pendentes").addEventListener("click", (e) => { if (e.target.id === "modal-compras-pendentes") e.target.classList.add("hidden"); });

  const man = $("cfg-compra-manual");
  if (man) man.addEventListener("click", () => { $("modal-configuracoes").classList.add("hidden"); abrirNovaCompraManual(); });
  const sim = $("cfg-compra-teste");
  if (sim) sim.addEventListener("click", () => {
    const r = simularCompraTeste();
    if (r.duplicada) mostrarToast("Compra de teste já registrada — duplicidade evitada ✔");
    else if (r.ok) mostrarToast("Compra de teste criada: veja na Home");
    atualizarResumoConfigCompras();
  });
  const perm = $("cfg-android-permissao");
  if (perm) perm.addEventListener("click", () => { try{ window.OrizonAndroid.abrirPermissao(); }catch(e){ mostrarToast("Abra as configurações do Android e ative o acesso às notificações para o Orizon."); } });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") atualizarResumoConfigCompras(); });   // voltou das configurações do Android
  atualizarResumoConfigCompras();
  processarLinkCompra();
}

// Interface pública para a ponte nativa do Android (e para testes)
window.OrizonCompras = {
  versao: 1,
  receberNotificacao: receberNotificacaoBanco,
  receberLote: receberLoteNotificacoes,
  receberCompraDetectada,
  interpretarNotificacao: interpretarNotificacaoCompra,
  sugerirFatura: sugerirFaturaCompra,
  simularTeste: simularCompraTeste,
  pendentes: comprasPendentes
};
