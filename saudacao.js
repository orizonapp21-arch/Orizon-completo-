/* ============================================================
   Orizon — saudacao.js
   Mensagem no topo do Painel, que muda pelo horário (bom dia/boa
   tarde/boa noite) e por dia (uma mensagem "do dia", que troca
   sozinha amanhã), respeitando o estilo escolhido em Configurações
   (padrão, animado, divertido, piadista ou bravo/rabugento) e o
   nome da pessoa, se ela tiver preenchido.
   ============================================================ */

const MENSAGENS_SAUDACAO = {
  padrao: {
    manha: [
      "Bom dia{virgula} {nome}! Vamos organizar as finanças de hoje?",
      "Bom dia{virgula} {nome}. Um bom começo de dia é um bom começo de mês.",
      "Bom dia{virgula} {nome}! Hora de dar uma olhada nas contas.",
      "Bom dia{virgula} {nome}. Que tal revisar o que vence essa semana?",
      "Bom dia{virgula} {nome}! Pequenos ajustes hoje, grandes resultados no fim do mês."
    ],
    tarde: [
      "Boa tarde{virgula} {nome}! Como estão indo as finanças hoje?",
      "Boa tarde{virgula} {nome}. Já deu uma olhada nas contas de hoje?",
      "Boa tarde{virgula} {nome}! Segue o jogo, as contas não se pagam sozinhas.",
      "Boa tarde{virgula} {nome}. Um respiro rápido pra organizar os gastos?",
      "Boa tarde{virgula} {nome}! Metade do dia já foi — e o orçamento, como tá?"
    ],
    noite: [
      "Boa noite{virgula} {nome}. Que tal fechar o dia revisando os gastos?",
      "Boa noite{virgula} {nome}! Hora de ver como ficou o dia financeiro.",
      "Boa noite{virgula} {nome}. Um resuminho antes de descansar?",
      "Boa noite{virgula} {nome}! Fechando o dia com as contas em dia.",
      "Boa noite{virgula} {nome}. Amanhã é outro dia — mas hoje ainda dá tempo de organizar."
    ]
  },
  animado: {
    manha: [
      "Bom dia{virgula} {nome}! 🚀 Bora dominar esse mês financeiramente!",
      "Levanta e organiza, {nome}! Hoje o dia é seu (e o orçamento também) ☀️",
      "Bom dia{virgula} {nome}! Energia total pra colocar as contas em ordem 💪",
      "Acordou, {nome}? As finanças também acordaram e estão te esperando! 🔥",
      "Bom dia{virgula} {nome}! Hoje é dia de vitória financeira, bora!"
    ],
    tarde: [
      "Boa tarde{virgula} {nome}! Ainda dá tempo de arrasar no controle financeiro hoje 💥",
      "Segue firme, {nome}! A tarde é perfeita pra colocar tudo em dia ⚡",
      "Boa tarde{virgula} {nome}! Bora dar aquela geral nas despesas?",
      "Boa tarde{virgula} {nome}! Foco total — falta pouco pro dia perfeito.",
      "Boa tarde{virgula} {nome}! Hora de revisar os gastos com aquele gás todo 🙌"
    ],
    noite: [
      "Boa noite{virgula} {nome}! Fecha o dia com chave de ouro revisando as contas 🌟",
      "Boa noite{virgula} {nome}! Mais um dia vencido — confere como ficaram os gastos!",
      "Boa noite{virgula} {nome}! Última missão do dia: dar uma olhada no saldo 🎯",
      "Boa noite{virgula} {nome}! Você chegou até aqui, agora só falta o check financeiro.",
      "Boa noite{virgula} {nome}! Amanhã tem mais — hoje, bora fechar tudo certinho."
    ]
  },
  divertido: {
    manha: [
      "Bom dia{virgula} {nome}! Café na mão, contas em dia ☕",
      "Bom dia{virgula} {nome}! Hoje o dinheiro entra e a gente controla pra onde ele vai 😄",
      "Bom dia{virgula} {nome}! Sua carteira mandou um oi e pediu pra você dar uma olhada nela.",
      "Bom dia{virgula} {nome}! Bora fazer as contas se comportarem hoje?",
      "Bom dia{virgula} {nome}! O saldo tá curioso pra saber como você tá hoje."
    ],
    tarde: [
      "Boa tarde{virgula} {nome}! Que tal um cafézinho e uma espiadinha nas despesas?",
      "Boa tarde{virgula} {nome}! O orçamento sente sua falta, passa lá pra visitar.",
      "Boa tarde{virgula} {nome}! Hora do lanche da tarde... e de checar o saldo, né?",
      "Boa tarde{virgula} {nome}! Suas finanças estão logo ali, só um toque de distância.",
      "Boa tarde{virgula} {nome}! Bora ver se o dinheiro tá se comportando direitinho?"
    ],
    noite: [
      "Boa noite{virgula} {nome}! O dia foi longo, mas as contas não tiraram folga.",
      "Boa noite{virgula} {nome}! Antes de dormir, um carinho rapidinho no orçamento?",
      "Boa noite{virgula} {nome}! Seu saldo quer dar boa noite também, dá uma olhada nele.",
      "Boa noite{virgula} {nome}! Fechando as cortinas do dia (e conferindo os gastos).",
      "Boa noite{virgula} {nome}! Hora do resumo: gastou, guardou ou só olhou e suspirou?"
    ]
  },
  piadista: {
    manha: [
      "Bom dia{virgula} {nome}! Dizem que dinheiro não traz felicidade... mas dá pra checar mesmo assim.",
      "Bom dia{virgula} {nome}! Hoje seu extrato promete ser uma comédia ou um terror — só abrindo pra saber.",
      "Bom dia{virgula} {nome}! Café custa caro, mas olhar o saldo é de graça. Bora?",
      "Bom dia{virgula} {nome}! A boa notícia: hoje é um novo dia. A má: as contas continuam as mesmas.",
      "Bom dia{virgula} {nome}! Seu saldo e eu estávamos aqui, conversando sobre você."
    ],
    tarde: [
      "Boa tarde{virgula} {nome}! Alguém aqui gastou mais do que devia hoje de manhã? Sem julgamento.",
      "Boa tarde{virgula} {nome}! O delivery é bom, mas o extrato depois não perdoa.",
      "Boa tarde{virgula} {nome}! Diz aí: o cartão de crédito hoje foi amigo ou inimigo?",
      "Boa tarde{virgula} {nome}! Seu dinheiro pediu um advogado depois do que rolou essa semana.",
      "Boa tarde{virgula} {nome}! Vamos ver se seu saldo ainda te reconhece."
    ],
    noite: [
      "Boa noite{virgula} {nome}! Hora de descobrir se hoje foi dia de economia ou de tragédia.",
      "Boa noite{virgula} {nome}! Seu extrato tá pedindo um momento de silêncio.",
      "Boa noite{virgula} {nome}! Antes de dormir: coragem pra abrir o app e ver os danos do dia.",
      "Boa noite{virgula} {nome}! Se o saldo tivesse voz, será que ele te chamaria pra conversar?",
      "Boa noite{virgula} {nome}! Fechando o dia... e talvez fechando os olhos pro extrato também."
    ]
  },
  bravo: {
    manha: [
      "Bom dia{virgula} {nome}. Vamos logo, as contas não vão se organizar sozinhas.",
      "Bom dia{virgula} {nome}. Chega de enrolação, dá uma olhada nas finanças agora.",
      "Bom dia{virgula} {nome}. Levanta, café e direto pro orçamento. Sem desculpa hoje.",
      "Bom dia{virgula} {nome}. Menos preguiça, mais controle. Bora.",
      "Bom dia{virgula} {nome}. O dia começou — e as contas não vão esperar por você."
    ],
    tarde: [
      "Boa tarde{virgula} {nome}. Já era pra ter dado uma olhada nas contas hoje, não acha?",
      "Boa tarde{virgula} {nome}. Menos distração, mais atenção no orçamento.",
      "Boa tarde{virgula} {nome}. Tá esperando o quê pra checar os gastos de hoje?",
      "Boa tarde{virgula} {nome}. Sem procrastinar — dá uma olhada nas despesas agora.",
      "Boa tarde{virgula} {nome}. O dinheiro não se organiza sozinho, sabia?"
    ],
    noite: [
      "Boa noite{virgula} {nome}. Antes de deitar, confere se gastou mais do que devia hoje.",
      "Boa noite{virgula} {nome}. Sem fugir: dá uma última olhada nas contas do dia.",
      "Boa noite{virgula} {nome}. O dia acabou, mas a responsabilidade com o dinheiro não.",
      "Boa noite{virgula} {nome}. Última chance do dia de colocar tudo em ordem.",
      "Boa noite{virgula} {nome}. Durma tranquilo só depois de checar o saldo, viu?"
    ]
  }
};

function obterPeriodoDoDia(){
  const hora = new Date().getHours();
  if (hora < 12) return "manha";
  if (hora < 18) return "tarde";
  return "noite";
}

// Escolhe uma mensagem "do dia" (mesma o dia inteiro, muda amanhã) usando o
// dia do ano como semente — assim percorre o pacote de mensagens aos poucos,
// sem repetir a mesma toda hora nem todo dia.
function obterMensagemDoDia(){
  const estilo = (estado.config && estado.config.estiloMensagem) || "padrao";
  const periodo = obterPeriodoDoDia();
  const pacote = (MENSAGENS_SAUDACAO[estilo] || MENSAGENS_SAUDACAO.padrao)[periodo];

  const hoje = new Date();
  const diaDoAno = Math.floor((hoje - new Date(hoje.getFullYear(), 0, 0)) / 86400000);
  const indice = diaDoAno % pacote.length;

  const nome = (estado.config && estado.config.nomeUsuario) ? estado.config.nomeUsuario.trim() : "";
  return pacote[indice]
    .replace("{virgula}", nome ? "," : "")
    .replace("{nome}", nome)
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?])/g, "$1") // tira espaço sobrando antes de pontuação quando não há nome
    .trim();
}

function renderizarSaudacao(){
  const el = document.getElementById("saudacao-texto");
  if (el) el.textContent = obterMensagemDoDia();
}
