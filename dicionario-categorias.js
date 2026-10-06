/* ============================================================
   Orizon — dicionario-categorias.js
   Categorias, cores e a regra 50/30/20, extraídas da planilha
   original "Controle_Financeiro_Pessoal_Completa.xlsx".
   ============================================================ */

const CATEGORIAS = [
  { id: "moradia", nome: "Moradia", emoji: "🏠", cor: "#D4AF37", grupo: "necessidades" },
  { id: "alimentacao", nome: "Alimentação", emoji: "🍎", cor: "#10B981", grupo: "necessidades" },
  { id: "contas_basicas", nome: "Contas básicas", emoji: "💡", cor: "#F59E0B", grupo: "necessidades" },
  { id: "transporte", nome: "Transporte", emoji: "🚌", cor: "#3B82F6", grupo: "necessidades" },
  { id: "dividas", nome: "Dívidas", emoji: "💳", cor: "#EF4444", grupo: "necessidades" },
  { id: "saude", nome: "Saúde", emoji: "🏥", cor: "#EC4899", grupo: "necessidades" },
  { id: "educacao", nome: "Educação", emoji: "🎓", cor: "#8B5CF6", grupo: "desejos" },
  { id: "roupas", nome: "Roupas", emoji: "👕", cor: "#06B6D4", grupo: "desejos" },
  { id: "lazer", nome: "Lazer", emoji: "🎮", cor: "#F97316", grupo: "desejos" },
  { id: "pets", nome: "Pets", emoji: "🐶", cor: "#A855F7", grupo: "desejos" },
  { id: "assinaturas", nome: "Assinaturas", emoji: "📱", cor: "#14B8A6", grupo: "desejos" },
  { id: "cuidados_pessoais", nome: "Cuidados pessoais", emoji: "💇", cor: "#F43F5E", grupo: "desejos" },
  { id: "outros", nome: "Outros", emoji: "🛒", cor: "#9CA3AF", grupo: "desejos" },
  { id: "investimentos", nome: "Investimentos", emoji: "💰", cor: "#22C55E", grupo: "futuro" }
];

// Faturas de cartão entram nos gráficos/diagnóstico do mês como uma categoria própria
// (fica fora da lista CATEGORIAS para não aparecer no cadastro de despesa avulsa).
const CATEGORIA_CARTAO = { id: "cartao_credito", nome: "Cartão de crédito", emoji: "💳", cor: "#6366F1", grupo: "necessidades" };

function categoriaPorId(id){
  return CATEGORIAS.find(c => c.id === id) || CATEGORIAS[CATEGORIAS.length - 1];
}

// Regra 50/30/20, igual à planilha: Necessidades (50%), Desejos (30%), Futuro financeiro (20%)
const GRUPOS_5030_20 = [
  { id: "necessidades", nome: "Necessidades", percentualIdeal: 0.5 },
  { id: "desejos", nome: "Desejos", percentualIdeal: 0.3 },
  { id: "futuro", nome: "Futuro financeiro", percentualIdeal: 0.2 }
];

const NOMES_MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
