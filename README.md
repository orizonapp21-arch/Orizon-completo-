# Orizon

PWA de controle de gastos pessoais, 100% offline (sem servidor, sem Firebase, sem serviço pago). Nasceu como "Controle Financeiro" e virou **Orizon** na v2.0 — versão premium com metas, evolução patrimonial, cartões com limite, calendário financeiro e análise automática.

## v2.4 — Tutoriais guiados

- **Tutorial em cada aba** (Painel, Mês, Cartões, Metas, Evolução) e nas janelas importantes (**Backup**, **Cadastrar despesa**, **Cadastrar cartão**) — só o essencial, 1 a 5 passos cada. Abre sozinho na primeira vez que a pessoa entra.
- O fundo **fica desfocado** e só o item explicado fica nítido, com um anel luminoso e um **balão azul com seta** apontando para ele. Botões: **OK**, **‹ voltar** e **Pular**.
- Quando o item está fora da tela, o tutorial pede para **deslizar a tela** (seta animada) e continua sozinho assim que o item aparece. Há também o botão "Rolar pra mim".
- **Pular não perde nada**: o tutorial fica **pendente** — aparece o selinho "🎓 Tutorial pendente" na tela, e a lista de pendentes em Configurações. Ao retomar, continua de onde parou.
- **Ao concluir, o tutorial some de vez** (selinho e item da lista). Quando todos forem concluídos, a seção some de Configurações.
- Estado guardado só no aparelho (`orizon_tutoriais_v1`), separado dos dados financeiros: não entra no backup e não altera nenhum dado.
- Código em `tutorial.js` (motor + roteiros). Para mudar textos ou passos, edite o objeto `TUTORIAIS` no topo do arquivo. Para testar de novo no navegador: `TutorialOrizon.reiniciarTodos()` no console.

## v2.3 — Cartões por mês

- **Cada mês tem os seus cartões** (nada de cartão espalhado nos 12 meses). Quem usou a v2.2 tem isso desfeito automaticamente: ficam só os meses com lançamentos.
- **Ao cadastrar o cartão** o app pergunta: limite total, quanto tem disponível para uso agora, dias de fechamento/vencimento e **"Repetir este cartão no mês seguinte?"**.
- **O disponível diminui a cada gasto** (o valor informado é só o ponto de partida). No mês seguinte o cartão começa com o que sobrou.
- Lançamento: compra a compra, total da semana ou total do mês; com "Fatura já paga?" e "Repetir no mês seguinte?".
- Faturas pagas/pendentes entram nos totais de pago e pendente do mês.

## v2.2 — Correções e novidades

- **Tema claro refeito**: fundo azul-gelo, cartões brancos, texto escuro e cores com bom contraste (azul, verde, vermelho, âmbar) em todas as telas, modais e no menu.
- **Recorrência mês a mês**: ao ligar "Repetir no mês seguinte", a conta aparece no próximo mês (dezembro → janeiro), pendente e 100% editável. A cópia nasce com a recorrência desligada — lá você decide se ela continua. Desligar remove a cópia ainda não paga; apagar uma não apaga as outras.
- **Cartões de crédito**: o cartão vale para todos os meses (mesmo limite e datas, cada mês com a sua fatura). Mostra "Disponível para usar agora" (limite − fatura) e tem 3 formas de lançar: compra a compra, **total da semana** (5 faixas) ou total do mês.
- **Alerta vermelho em tela cheia** com fundo embaçado: aparece ao abrir o app quando há conta não paga vencendo amanhã, hoje ou já atrasada, com botão "Já paguei".
- **Boas-vindas calorosa em 3 passos** (acolhida com nome, privacidade, backup) e aviso de backup com botão "Fazer agora".
- **Privacidade**: os dados ficam no localStorage de cada aparelho. Quem receber o link começa do zero e nunca vê os dados de outra pessoa.

## Visual Neon (v2.1)

Nova identidade visual inspirada no mockup: fundo azul-noite com brilho, cartões de vidro com borda neon, card de **Saldo disponível** em destaque (com botão de olho para ocultar valores), blocos coloridos de Receitas/Despesas/Saldo/Economia, barras de progresso verdes nas metas e menu inferior em pílula com ícones desenhados. A **logo** (`logo-emblema.png` / `logo-orizon.png`) aparece no topo do app e na tela de boas-vindas, e os ícones do app (`icon-*.png`) foram refeitos com ela. Nenhuma função ou dado foi alterado — só o visual.

## Novidades da v2.0 — Atualização Premium

Tudo abaixo foi adicionado **sem remover nenhuma função da v1** e sem mudar onde os dados ficam salvos (mesmo `localStorage`, backup no mesmo formato — um backup antigo importa normalmente).

1. **Aba Metas** — crie metas de economia (nome, valor desejado, valor já guardado, data opcional), com barra de progresso animada, % concluído e mensagem automática de incentivo.
2. **Aba Evolução** — gráfico de patrimônio acumulado mês a mês (linha animada, sem biblioteca externa), total economizado no ano, melhor mês, pior mês, média de gastos, média de renda e crescimento % desde o primeiro mês com dados.
3. **Cartões melhorados** — agora com limite total, dia de fechamento, dia de vencimento e limite disponível calculado automaticamente. Barra de uso fica laranja acima de 80% e vermelha acima de 100%.
4. **Busca inteligente** — campo de busca acima das despesas do mês, filtrando por nome, categoria ou forma de pagamento em tempo real.
5. **Filtros rápidos** — chips: Todas, Pagas, Pendentes, Pix, Crédito, Boleto, Parceladas.
6. **Calendário financeiro** — grade do mês com a quantidade de contas e o valor total de cada dia, verde quando tudo está pago e vermelho quando há pendência; toque no dia pra ver as despesas dele.
7. **Análise automática** — frases geradas a partir dos seus números reais: % da renda economizado, categoria que mais subiu em relação ao mês anterior, maior despesa, situação na regra 50/30/20 e, se você tiver uma meta ativa, em quantos meses ela fica pronta no ritmo atual.
8. **Estatísticas do mês** — maior gasto, categoria mais cara, total pago, total pendente, média diária de gastos, quantidade de lançamentos e economia acumulada no ano.
9. **UX premium** — duplicar uma despesa com um toque, editar tocando em qualquer parte do item (não só no lápis), confirmação elegante (modal no lugar do alerta feio do navegador) ao excluir/formatar, skeleton de carregamento ao trocar de aba, vibração leve em ações importantes (quando o aparelho suporta) e rolagem mais fluida.
10. Nome do app trocado para **Orizon** (título, ícone da aba, tela de boas-vindas, `manifest.json`).

## Como usar

1. Extraia o ZIP numa pasta de verdade (não abra direto de dentro do gerenciador de arquivos do celular — ver aviso abaixo).
2. Abra `index.html` no Chrome. Funciona 100% offline.
3. Na aba **Mês**, escolha o mês pelo seletor no topo, cadastre a renda e as despesas.
4. A aba **Painel** mostra o resumo do ano inteiro, com gráfico e tabela mês a mês.
5. Na aba **Metas**, crie seus objetivos de economia. Na aba **Evolução**, acompanhe o patrimônio acumulado.

Tudo fica salvo automaticamente no seu navegador (localStorage) — feche e abra de novo que o trabalho continua lá.

## Backup e restauração (proteção contra perda de dados)

Como o app roda 100% local (sem servidor, sem nuvem), toque no ícone 💾 no topo pra:

- **Exportar backup**: baixa um arquivo `.json` com tudo (renda, despesas, cartões, metas, categorias). Guarde esse arquivo em algum lugar seguro — Google Drive, e-mail pra você mesmo, etc.
- **Restaurar de um backup**: lê um arquivo `.json` exportado antes e devolve todos os dados — útil se a pessoa trocar de celular, reinstalar o app, ou limpar os dados por engano. Um backup exportado da v1 (antes de existir a aba Metas) é restaurado normalmente — as metas simplesmente começam vazias.

O app também mostra um aviso discreto no topo sugerindo fazer backup se já tiver dados preenchidos e fizer mais de 14 dias desde o último (ou nunca ter feito nenhum).

**Importante para quem for vender/distribuir este app**: sem essa exportação manual, os dados de cada pessoa ficam presos ao aparelho dela. Isso é uma limitação de qualquer app 100% local (sem conta/login na nuvem) — a troca seria adicionar login + banco de dados na nuvem (ex: Firebase/Supabase), o que é um projeto maior à parte e traz responsabilidade extra sobre a privacidade de terceiros.

## O que já existia na v1 (mantido integralmente)

- Renda e despesas por mês: descrição, valor, vencimento, categoria (com emoji), forma de pagamento (incluindo Pix), parcelas, status pago/pendente.
- Recorrência real: despesa recorrente cria cópias pendentes automaticamente nos meses seguintes.
- Contas a vencer em 5 dias, destacadas na aba Mês e como aviso no Painel.
- Diagnóstico financeiro 50/30/20 (Necessidades, Desejos, Futuro), calculado sobre a renda.
- Personagem emocional que muda de expressão conforme o saldo do mês.
- Gráficos com efeito 3D desenhados do zero em `<canvas>` (barras e donut), sem biblioteca nenhuma.
- Dois temas: escuro (padrão) e claro.
- `manifest.json` e `sw.js` prontos para instalar como app / gerar APK (PWABuilder + hospedagem estática).

## Sobre as notificações — limite técnico, sendo direto

O app avisa (faixa vermelha no topo + notificação do sistema, se autorizado) sempre que é aberto e há algo vencendo em até 5 dias. O que não é possível garantir é notificação chegando com o app **completamente fechado** — isso exigiria um servidor rodando de forma contínua ("push notification" de verdade), o que foge do escopo de um PWA estático 100% offline.

## Sobre os "gráficos 3D"

Não são WebGL/three.js — são gráficos 2D em canvas com sombra, gradiente e um "prisma" desenhado à mão pra dar sensação de profundidade. Fica leve, funciona 100% offline e roda liso em qualquer celular.

## Estrutura de arquivos

```
ControleFinanceiro/  (agora "Orizon")
├── index.html                  ← arquivo que você abre (CSS/JS já embutidos)
├── index_source.html           ← estrutura HTML "limpa", referenciando os módulos
├── build.py                    ← remonta index.html a partir dos módulos abaixo
├── style.css                    estilos (tema premium claro/escuro)
├── dicionario-categorias.js     categorias, cores, regra 50/30/20
├── estado.js                    estado global, salvamento automático, motor de recorrência
├── graficos.js                  gráficos em canvas (barras/donut 3D + linha animada da Evolução)
├── personagem.js                 personagem emocional (SVG)
├── despesas.js                   CRUD de renda/despesas/cartões, cálculos e diagnóstico
├── cartoes.js                    cartões de crédito (limite, fechamento, vencimento, uso)
├── metas.js                      aba Metas financeiras
├── evolucao.js                   aba Evolução (patrimônio acumulado)
├── calendario.js                 calendário financeiro do mês
├── analise.js                    estatísticas do mês + análise automática
├── ui-premium.js                 confirmação elegante, vibração, skeleton
├── notificacoes.js               notificações locais de vencimento
├── backup.js                     exportar/restaurar backup .json
├── configuracoes.js              modal de configurações
├── onboarding.js                 tela de boas-vindas (primeiro acesso)
├── tutorial.js                   tutoriais guiados (spotlight + balão + pendentes)
├── saudacao.js                   saudação por voz/texto no Painel
├── script.js                     navegação, telas, modais, busca/filtros, inicialização
├── logo-emblema.png, logo-orizon.png   logo usada no topo e nas boas-vindas
├── manifest.json, sw.js, icon-*.png
└── README.md
```

**Por que `index.html` tem tudo embutido?** Abrir o HTML de dentro de gerenciadores de arquivo do Android (`content://...`) pode quebrar o carregamento de `.css`/`.js` externos. Pra editar o projeto: mexa nos módulos separados e rode `python3 build.py` (ou peça pra eu remontar), ou edite direto dentro do `index.html`.

---

## v2.1 — Central dos Cartões

Nova aba **Cartões** (entre Mês e Metas):
- Cadastro único de cartão **Crédito** ou **Débito**, escolhendo o banco (Caixa, Bradesco, Itaú, Inter, Santander, Banco do Brasil, Nubank, C6, Next, Sicredi, Credicard, Mercado Pago), com logo, ou foto própria opcional e nome livre.
- Só cartão de **crédito** tem limite. Fórmula: `disponível = limite + ajuste − faturas ainda não pagas (de qualquer mês)`.
- O cartão de crédito aparece sozinho em **todos os 12 meses**. Dentro do mês você lança o **total** e/ou compras **parceladas** (valor total + nº de parcelas: cada parcela cai num mês seguinte e já prende limite).
- Marcar a fatura do mês como **paga libera o limite**.
- "Disponível agora" editável: digite o valor que o app do banco mostra e o Orizon guarda o ajuste.
- Backup/formato antigo continuam compatíveis (campo novo: `cartoesCentral`). Cartões antigos criados direto no mês continuam funcionando.

Arquivos novos: `bancos.js`, `cartoes-central.js`. Cache do service worker: `orizon-cache-v7`.

---

## v2.6 — Nova Home (Painel geral)

A Home responde "como está minha vida financeira agora?" — só hoje e o mês atual:
saudação por horário, frase do dia (730 frases: 2 por dia do ano, toque na frase para ver a outra), resumo do mês (entradas, despesas, saldo, economia), saldo do mês com cor por situação, atenção (contas e faturas de cartão até 5 dias do vencimento ou atrasadas), seu momento financeiro (reaproveita `gerarAnaliseAutomatica`), resumo dos cartões (reaproveita `resumoCentralCredito`), minha meta, dica do ORIZON e mensagem final.

- Arquivos novos: `frases.js` (frases + dicas), `home.js` (lógica da Home).
- O gráfico "Renda x Despesas por mês" e a "Tabela de controle anual" saíram da Home e foram para a aba **Evolução** (mesmos IDs, mesma função de desenho).
- O botão "Formatar tudo" saiu da Home; a mesma ação continua em Configurações → "Apagar todos os dados".
- Nada novo é gravado: a Home lê os dados que já existem (renda, despesas, cartões, metas).
- Cache do service worker: `orizon-cache-v12`.

---

## v2.7 — Abertura animada (splash)

Ao abrir o app: linha de horizonte → luz azul suave → a logo "nasce" do horizonte → ORIZON → "Seu dinheiro. Seu futuro." → some e a Home aparece (~2,4 s). Só CSS (transform/opacity) + um timer curto; sem vídeo, spinner ou texto de carregamento. Respeita "reduzir movimento" (só fade, ~1,5 s) e usa o tema claro/escuro salvo. Roda a cada abertura do app; navegar entre abas não repete. Cache do service worker: `orizon-cache-v13`.

---

## v2.8 — Entrada animada em todas as abas

Ao entrar em qualquer aba (Painel, Mês, Cartões, Metas, Evolução), os blocos sobem de baixo para cima e vão se organizando em sequência (~0,6 s, só transform/opacity). Também roda ao tocar na aba em que você já está. Respeita "reduzir movimento" (só fade). A tela vai para o topo ao trocar de aba.
Correção: a camada de "esqueleto" que cobria a aba por 0,24 s foi removida da navegação (ela escondia a animação). `sw.js` restaurado (a v2.7 foi entregue com ele vazio). Cache: `orizon-cache-v14`.


## v2.12 — Compras de cartão pendentes (detecção → confirmação → fatura)
- Compra detectada **nunca** é lançada sozinha: entra em "🔔 Compras pendentes" na Home até você confirmar a fatura.
- `compras-pendentes.js`: interpretação do texto da notificação, anti-duplicidade, sugestão de fatura (fechamento/vencimento do cartão), confirmação, lançamento no cartão da Central (reaproveita parcelamento, limite e faturas existentes).
- Entradas: ponte Android (`android-bridge/`, **não compilada**), link de automação (`?compra=1&valor=…`), registro manual e modo de teste (Configurações → Compras do cartão).
- iPhone: o iOS não permite ler notificações de outros apps; funciona registro manual, pendências e confirmação.
- Conferência antes de lançar (checklist no modal): cartão, valor/parcelas, fatura (vs. sugestão), parcelas dentro do ciclo de 12 meses e limite do cartão (mesmo cálculo da aba Cartões). ⛔ bloqueia o botão; ⚠️ avisa; compra acima do limite pede "Confirmar mesmo assim". Depois de lançar, o app confere se o limite da aba Cartões bate com a soma lançada.
- Android: arquivos `*.java`, `*.gradle.kts`, `AndroidManifest.xml`, `montar_android.py` (app com WebView + leitor de notificações) e `android.yml` (workflow que gera o APK no GitHub). Veja `INSTALAR-ANDROID.md`. PWABuilder (TWA) não consegue ler notificações.
