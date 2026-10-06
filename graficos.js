/* ============================================================
   Orizon — graficos.js
   Gráficos com efeito 3D (barras extrudadas, donut em camadas)
   desenhados diretamente em <canvas>, sem nenhuma biblioteca
   externa — funciona 100% offline.
   ============================================================ */

function limparCanvasAltaResolucao(canvas){
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || canvas.width;
  const cssHeight = canvas.clientHeight || (canvas.width ? (canvas.height / canvas.width) * cssWidth : 200);
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  return { ctx, w: cssWidth, h: cssHeight };
}

function corComOpacidade(hex, alpha){
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}
function escurecerCor(hex, fator){
  const r = Math.round(parseInt(hex.slice(1,3),16) * fator);
  const g = Math.round(parseInt(hex.slice(3,5),16) * fator);
  const b = Math.round(parseInt(hex.slice(5,7),16) * fator);
  return `rgb(${r},${g},${b})`;
}

// ---------------------------------------------------------------
// BARRAS 3D — cada barra desenhada como um "prisma": face frontal +
// topo em paralelogramo + lateral em paralelogramo, com gradiente
// e sombra, para dar sensação de profundidade.
// ---------------------------------------------------------------
function desenharGraficoBarras3D(canvas, series, opcoes){
  const { ctx, w, h } = limparCanvasAltaResolucao(canvas);
  const corTexto = opcoes.corTexto || "#9CA3AF";
  const profundidade = 10;
  const margemEsq = 48, margemBaixo = 34, margemTopo = 20, margemDir = 14;
  const areaW = w - margemEsq - margemDir - profundidade;
  const areaH = h - margemTopo - margemBaixo - profundidade;

  const valores = series.flatMap(s => s.valores);
  const maxValor = Math.max(1, ...valores.map(v => Math.abs(v)));
  const grupos = series[0].valores.length;
  const larguraGrupo = areaW / grupos;
  const numBarras = series.length;
  const larguraBarra = Math.min(22, (larguraGrupo * 0.6) / numBarras);
  const gapBarra = 4;

  // eixo base
  ctx.strokeStyle = corComOpacidade(corTexto, 0.25);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margemEsq, margemTopo + areaH);
  ctx.lineTo(margemEsq + areaW, margemTopo + areaH);
  ctx.stroke();

  for (let g = 0; g < grupos; g++){
    const centroGrupo = margemEsq + g * larguraGrupo + larguraGrupo / 2;
    const inicioBarras = centroGrupo - (numBarras * larguraBarra + (numBarras-1) * gapBarra) / 2;

    series.forEach((serie, si) => {
      const valor = serie.valores[g];
      const alturaBarra = (Math.abs(valor) / maxValor) * (areaH - profundidade);
      if (alturaBarra < 1) return; // evita desenhar "tampas" 3D fantasmas quando o valor é zero
      const x = inicioBarras + si * (larguraBarra + gapBarra);
      const yBase = margemTopo + areaH;
      const yTopo = yBase - alturaBarra;
      const cor = serie.cor;

      // sombra no chão
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath();
      ctx.ellipse(x + larguraBarra/2 + profundidade/2, yBase + 3, larguraBarra/2 + profundidade/2, 4, 0, 0, Math.PI*2);
      ctx.fill();

      // face lateral (direita)
      ctx.fillStyle = escurecerCor(cor, 0.55);
      ctx.beginPath();
      ctx.moveTo(x + larguraBarra, yTopo);
      ctx.lineTo(x + larguraBarra + profundidade, yTopo - profundidade);
      ctx.lineTo(x + larguraBarra + profundidade, yBase - profundidade);
      ctx.lineTo(x + larguraBarra, yBase);
      ctx.closePath();
      ctx.fill();

      // topo (paralelogramo)
      ctx.fillStyle = escurecerCor(cor, 0.85);
      ctx.beginPath();
      ctx.moveTo(x, yTopo);
      ctx.lineTo(x + profundidade, yTopo - profundidade);
      ctx.lineTo(x + larguraBarra + profundidade, yTopo - profundidade);
      ctx.lineTo(x + larguraBarra, yTopo);
      ctx.closePath();
      ctx.fill();

      // face frontal com gradiente
      const grad = ctx.createLinearGradient(0, yTopo, 0, yBase);
      grad.addColorStop(0, cor);
      grad.addColorStop(1, escurecerCor(cor, 0.7));
      ctx.fillStyle = grad;
      ctx.fillRect(x, yTopo, larguraBarra, alturaBarra);
      ctx.strokeStyle = corComOpacidade("#000000", 0.08);
      ctx.strokeRect(x, yTopo, larguraBarra, alturaBarra);
    });

    // rótulo do grupo
    ctx.fillStyle = corTexto;
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(opcoes.rotulos[g], centroGrupo, h - 10);
  }

  // legenda das séries
  if (opcoes.legenda !== false){
    let lx = margemEsq;
    const ly = 12;
    series.forEach(s => {
      ctx.fillStyle = s.cor;
      ctx.fillRect(lx, ly - 8, 9, 9);
      ctx.fillStyle = corTexto;
      ctx.font = "11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(s.nome, lx + 13, ly);
      lx += ctx.measureText(s.nome).width + 34;
    });
  }
}

// ---------------------------------------------------------------
// BARRAS INDIVIDUAIS 3D — uma barra por item (ex: cada despesa do
// mês), cada uma com sua própria cor (ex: cor da categoria).
// ---------------------------------------------------------------
function desenharBarrasIndividuais3D(canvas, itens, opcoes){
  opcoes = opcoes || {};
  const corTexto = opcoes.corTexto || "#9CA3AF";
  const profundidade = 8;
  const margemEsq = 44, margemBaixo = 46, margemTopo = 16, margemDir = 14;

  if (!itens.length){
    const { ctx, w, h } = limparCanvasAltaResolucao(canvas);
    ctx.fillStyle = corTexto;
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Nenhuma despesa cadastrada neste mês ainda", w/2, h/2);
    return;
  }

  const larguraBarra = 30, gapBarra = 18;
  const larguraMinima = margemEsq + margemDir + itens.length * (larguraBarra + gapBarra);
  const wrapper = canvas.parentElement;
  const larguraDisponivel = wrapper ? wrapper.clientWidth : canvas.clientWidth;
  canvas.style.width = Math.max(larguraMinima, larguraDisponivel) + "px";
  canvas.style.height = "230px"; // fixa a altura pra não esticar junto com a largura (que cresce pra rolagem)

  const { ctx, w, h } = limparCanvasAltaResolucao(canvas);
  const areaW = w - margemEsq - margemDir - profundidade;
  const areaH = h - margemTopo - margemBaixo - profundidade;
  const maxValor = Math.max(1, ...itens.map(i => i.valor));

  ctx.strokeStyle = corComOpacidade(corTexto, 0.25);
  ctx.beginPath();
  ctx.moveTo(margemEsq, margemTopo + areaH);
  ctx.lineTo(margemEsq + areaW, margemTopo + areaH);
  ctx.stroke();

  itens.forEach((item, i) => {
    const alturaBarra = Math.max(2, (item.valor / maxValor) * (areaH - profundidade));
    const x = margemEsq + i * (larguraBarra + gapBarra) + gapBarra/2;
    const yBase = margemTopo + areaH;
    const yTopo = yBase - alturaBarra;
    const cor = item.cor;

    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.beginPath();
    ctx.ellipse(x + larguraBarra/2 + profundidade/2, yBase + 3, larguraBarra/2 + profundidade/2, 4, 0, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = escurecerCor(cor, 0.55);
    ctx.beginPath();
    ctx.moveTo(x + larguraBarra, yTopo);
    ctx.lineTo(x + larguraBarra + profundidade, yTopo - profundidade);
    ctx.lineTo(x + larguraBarra + profundidade, yBase - profundidade);
    ctx.lineTo(x + larguraBarra, yBase);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = escurecerCor(cor, 0.85);
    ctx.beginPath();
    ctx.moveTo(x, yTopo);
    ctx.lineTo(x + profundidade, yTopo - profundidade);
    ctx.lineTo(x + larguraBarra + profundidade, yTopo - profundidade);
    ctx.lineTo(x + larguraBarra, yTopo);
    ctx.closePath(); ctx.fill();

    const grad = ctx.createLinearGradient(0, yTopo, 0, yBase);
    grad.addColorStop(0, cor);
    grad.addColorStop(1, escurecerCor(cor, 0.7));
    ctx.fillStyle = grad;
    ctx.fillRect(x, yTopo, larguraBarra, alturaBarra);

    ctx.fillStyle = corTexto;
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    const rotulo = item.nome.length > 8 ? item.nome.slice(0,7) + "…" : item.nome;
    ctx.fillText(rotulo, x + larguraBarra/2, h - margemBaixo + 14);
    ctx.font = "8px sans-serif";
    ctx.fillText(formatarMoedaCurta(item.valor), x + larguraBarra/2, h - margemBaixo + 26);
  });
}

// ---------------------------------------------------------------
// LINHA ANIMADA — usada no gráfico de patrimônio acumulado (aba
// Evolução). Curva suave (quadratic curve) com área preenchida em
// gradiente, desenhando progressivamente do zero até o valor real
// (efeito de animação, sem depender de nenhuma lib externa).
// ---------------------------------------------------------------
function desenharGraficoLinhaAnimado(canvas, valores, rotulos, opcoes){
  opcoes = opcoes || {};
  const corTexto = opcoes.corTexto || "#9CA3AF";
  const cor = opcoes.cor || "#3B82F6";
  const margemEsq = 52, margemDir = 14, margemTopo = 18, margemBaixo = 26;

  // cancela uma animação anterior nesse mesmo canvas (ex: troca de tema/aba rápida)
  if (canvas._animacaoId) cancelAnimationFrame(canvas._animacaoId);

  const min = Math.min(0, ...valores);
  const max = Math.max(0, ...valores);
  const amplitude = (max - min) || 1;

  function desenharFrame(progresso){
    const { ctx, w, h } = limparCanvasAltaResolucao(canvas);
    const areaW = w - margemEsq - margemDir;
    const areaH = h - margemTopo - margemBaixo;
    const passo = valores.length > 1 ? areaW / (valores.length - 1) : 0;
    const yDoValor = (v) => margemTopo + areaH - ((v - min) / amplitude) * areaH;

    // linha zero (referência)
    const yZero = yDoValor(0);
    ctx.strokeStyle = corComOpacidade(corTexto, 0.2);
    ctx.beginPath();
    ctx.moveTo(margemEsq, yZero);
    ctx.lineTo(margemEsq + areaW, yZero);
    ctx.stroke();

    const qtdVisivel = Math.max(1, Math.round(valores.length * progresso));
    const pontos = valores.slice(0, qtdVisivel).map((v, i) => ({ x: margemEsq + i * passo, y: yDoValor(v) }));
    if (pontos.length < 2){ pontos.push(pontos[0]); }

    // área preenchida sob a curva, com gradiente
    const grad = ctx.createLinearGradient(0, margemTopo, 0, margemTopo + areaH);
    grad.addColorStop(0, corComOpacidade(cor, 0.35));
    grad.addColorStop(1, corComOpacidade(cor, 0.02));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(pontos[0].x, yZero);
    pontos.forEach((p, i) => {
      if (i === 0){ ctx.lineTo(p.x, p.y); return; }
      const anterior = pontos[i-1];
      const meioX = (anterior.x + p.x) / 2;
      ctx.quadraticCurveTo(anterior.x, anterior.y, meioX, (anterior.y + p.y)/2);
      ctx.quadraticCurveTo(meioX, (anterior.y + p.y)/2, p.x, p.y);
    });
    ctx.lineTo(pontos[pontos.length-1].x, yZero);
    ctx.closePath();
    ctx.fill();

    // linha principal com sombra suave (glow)
    ctx.shadowColor = corComOpacidade(cor, 0.5);
    ctx.shadowBlur = 8;
    ctx.strokeStyle = cor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    pontos.forEach((p, i) => {
      if (i === 0){ ctx.moveTo(p.x, p.y); return; }
      const anterior = pontos[i-1];
      const meioX = (anterior.x + p.x) / 2;
      ctx.quadraticCurveTo(anterior.x, anterior.y, meioX, (anterior.y + p.y)/2);
      ctx.quadraticCurveTo(meioX, (anterior.y + p.y)/2, p.x, p.y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;

    // pontos + rótulos (só quando a animação já concluiu, pra não poluir enquanto desenha)
    if (progresso >= 1){
      valores.forEach((v, i) => {
        const x = margemEsq + i * passo, y = yDoValor(v);
        ctx.fillStyle = cor;
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = corTexto;
        ctx.font = "9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(rotulos[i], x, h - 8);
      });
    }
  }

  const duracao = 700;
  const inicio = performance.now();
  function passoAnimacao(agora){
    const progresso = Math.min(1, (agora - inicio) / duracao);
    desenharFrame(progresso < 1 ? 1 - Math.pow(1 - progresso, 3) : 1); // ease-out cúbico
    if (progresso < 1) canvas._animacaoId = requestAnimationFrame(passoAnimacao);
  }
  canvas._animacaoId = requestAnimationFrame(passoAnimacao);
}

function formatarMoedaCurta(valor){
  if (valor >= 1000) return "R$" + (valor/1000).toFixed(1).replace(".", ",") + "k";
  return "R$" + Math.round(valor);
}
function desenharDonut3D(canvas, fatias, opcoes){
  const { ctx, w, h } = limparCanvasAltaResolucao(canvas);
  opcoes = opcoes || {};
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  const cx = w / 2, cy = h / 2 - 16;
  const raioExterno = Math.min(w, h) * 0.30;
  const raioInterno = raioExterno * 0.55;
  const profundidade = 14;

  if (total <= 0){
    ctx.fillStyle = opcoes.corTexto || "#9CA3AF";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Sem despesas registradas ainda", w/2, h/2);
    return;
  }

  let anguloInicial = -Math.PI / 2;
  const camadas = 8;

  // sombra da base
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + profundidade + 4, raioExterno, raioExterno * 0.42, 0, 0, Math.PI*2);
  ctx.fill();

  // camadas laterais (dão o efeito de "altura")
  for (let c = camadas; c >= 1; c--){
    let angulo = -Math.PI / 2;
    fatias.forEach(f => {
      const fatiaAngulo = (f.valor / total) * Math.PI * 2;
      ctx.fillStyle = escurecerCor(f.cor, 0.45 + (c / camadas) * 0.25);
      ctx.beginPath();
      ctx.moveTo(cx, cy + (c / camadas) * profundidade);
      ctx.arc(cx, cy + (c / camadas) * profundidade, raioExterno, angulo, angulo + fatiaAngulo);
      ctx.closePath();
      ctx.fill();
      angulo += fatiaAngulo;
    });
  }

  // topo (com gradiente radial por fatia + separação)
  fatias.forEach(f => {
    const fatiaAngulo = (f.valor / total) * Math.PI * 2;
    const grad = ctx.createRadialGradient(cx, cy, raioInterno*0.5, cx, cy, raioExterno);
    grad.addColorStop(0, escurecerCor(f.cor, 1.15 > 1 ? 1 : 1.1));
    grad.addColorStop(1, f.cor);
    ctx.fillStyle = f.cor;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, raioExterno, anguloInicial, anguloInicial + fatiaAngulo);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.stroke();
    anguloInicial += fatiaAngulo;
  });

  // buraco central (donut) — usa a cor de fundo do card via opções
  ctx.fillStyle = opcoes.corFundo || "#1a2332";
  ctx.beginPath();
  ctx.arc(cx, cy, raioInterno, 0, Math.PI*2);
  ctx.fill();

  // texto central
  ctx.fillStyle = opcoes.corTexto || "#F9FAFB";
  ctx.font = "bold 15px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(opcoes.textoCentral || formatarMoeda(total), cx, cy + 5);
}
