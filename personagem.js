/* ============================================================
   Orizon — personagem.js
   Personagem com rosto (SVG com gradientes e sombra, para dar
   sensação de volume/3D) que muda de expressão conforme a saúde
   financeira do mês: feliz, neutro ou triste.
   ============================================================ */

function svgPersonagem(estadoEmocional){
  // estadoEmocional: "feliz" | "neutro" | "triste"
  const cores = {
    feliz: { principal: "#10B981", escura: "#0B7A57", bochecha: "#34D399" },
    neutro: { principal: "#D4AF37", escura: "#A67F1E", bochecha: "#E8C766" },
    triste: { principal: "#EF4444", escura: "#B02E2E", bochecha: "#F87171" }
  }[estadoEmocional] || { principal: "#D4AF37", escura: "#A67F1E", bochecha: "#E8C766" };

  const boca = {
    feliz: `<path d="M 68 118 Q 90 140 112 118" stroke="#111827" stroke-width="5" stroke-linecap="round" fill="none"/>`,
    neutro: `<line x1="70" y1="122" x2="110" y2="122" stroke="#111827" stroke-width="5" stroke-linecap="round"/>`,
    triste: `<path d="M 68 130 Q 90 110 112 130" stroke="#111827" stroke-width="5" stroke-linecap="round" fill="none"/>`
  }[estadoEmocional];

  const sobrancelhas = {
    feliz: `<path d="M 55 78 Q 65 70 75 76" stroke="#111827" stroke-width="4" stroke-linecap="round" fill="none"/>
            <path d="M 105 76 Q 115 70 125 78" stroke="#111827" stroke-width="4" stroke-linecap="round" fill="none"/>`,
    neutro: `<line x1="55" y1="78" x2="75" y2="78" stroke="#111827" stroke-width="4" stroke-linecap="round"/>
             <line x1="105" y1="78" x2="125" y2="78" stroke="#111827" stroke-width="4" stroke-linecap="round"/>`,
    triste: `<path d="M 55 74 Q 65 82 75 80" stroke="#111827" stroke-width="4" stroke-linecap="round" fill="none"/>
             <path d="M 105 80 Q 115 82 125 74" stroke="#111827" stroke-width="4" stroke-linecap="round" fill="none"/>`
  }[estadoEmocional];

  return `
  <svg width="150" height="150" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="gradRosto" cx="38%" cy="32%" r="75%">
        <stop offset="0%" stop-color="${cores.bochecha}"/>
        <stop offset="65%" stop-color="${cores.principal}"/>
        <stop offset="100%" stop-color="${cores.escura}"/>
      </radialGradient>
      <filter id="sombraPersonagem" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000" flood-opacity="0.35"/>
      </filter>
    </defs>
    <ellipse cx="90" cy="160" rx="46" ry="8" fill="#000" opacity="0.18"/>
    <circle cx="90" cy="95" r="62" fill="url(#gradRosto)" filter="url(#sombraPersonagem)"/>
    <circle cx="90" cy="95" r="62" fill="none" stroke="${cores.escura}" stroke-width="2" opacity="0.4"/>
    <circle cx="68" cy="92" r="8" fill="#111827"/>
    <circle cx="71" cy="89" r="2.4" fill="#fff"/>
    <circle cx="112" cy="92" r="8" fill="#111827"/>
    <circle cx="115" cy="89" r="2.4" fill="#fff"/>
    ${sobrancelhas}
    ${boca}
  </svg>`;
}

// Decide o estado emocional a partir do saldo do mês e do diagnóstico 50/30/20
function calcularEstadoEmocional(saldo, diagnostico){
  if (saldo < 0) return "triste";
  const algumAcima = diagnostico.some(d => d.situacao === "acima");
  if (algumAcima) return "triste";
  const algumAbaixo = diagnostico.some(d => d.situacao === "abaixo" && d.id !== "futuro");
  if (algumAbaixo) return "neutro";
  return "feliz";
}

function fraseParaEstado(estadoEmocional, saldo){
  if (estadoEmocional === "feliz") return "Suas finanças estão saudáveis esse mês! 🎉";
  if (estadoEmocional === "triste" && saldo < 0) return "Atenção: suas despesas passaram da sua renda.";
  if (estadoEmocional === "triste") return "Alguns grupos de gasto estão acima do ideal.";
  return "No caminho certo — ainda dá pra ajustar alguns pontos.";
}

function renderizarPersonagem(containerId, fraseId, saldo, diagnostico){
  const estadoEmocional = calcularEstadoEmocional(saldo, diagnostico);
  document.getElementById(containerId).innerHTML = svgPersonagem(estadoEmocional);
  document.getElementById(fraseId).textContent = fraseParaEstado(estadoEmocional, saldo);
}
