/* ============================================================
   Orizon — backup.js
   Exporta/importa todos os dados como um arquivo .json. Como o
   app só guarda os dados no localStorage do aparelho (sem nuvem),
   isso é a única forma de a pessoa não perder tudo se trocar de
   celular, desinstalar o app, ou limpar os dados do navegador.
   ============================================================ */

function possuiDadosPreenchidos(){
  for (let m = 1; m <= 12; m++){
    if (estado.meses[m].renda.length || estado.meses[m].despesas.length) return true;
  }
  return false;
}

function exportarBackup(){
  const conteudo = JSON.stringify(estado, null, 2);
  const blob = new Blob([conteudo], { type: "application/json" });
  const hoje = new Date().toISOString().slice(0,10);
  const nomeArquivo = `orizon-backup-${hoje}.json`;

  let salvoNoAndroid = false;
  try{
    if (window.OrizonAndroid && typeof window.OrizonAndroid.salvarArquivo === "function") salvoNoAndroid = !!window.OrizonAndroid.salvarArquivo(nomeArquivo, conteudo);
  }catch(e){ salvoNoAndroid = false; }

  if (!salvoNoAndroid){
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  }

  estado.ultimoBackup = new Date().toISOString();
  salvarEstado();
  atualizarInfoBackup();
  document.getElementById("lembrete-backup").classList.add("hidden");
  mostrarToast(salvoNoAndroid ? "Backup salvo na pasta Downloads! Guarde esse arquivo em um lugar seguro." : "Backup exportado! Guarde esse arquivo em um lugar seguro.");
}

function validarFormatoBackup(objeto){
  if (!objeto || typeof objeto !== "object") return false;
  if (!objeto.meses || typeof objeto.meses !== "object") return false;
  for (let m = 1; m <= 12; m++){
    const mes = objeto.meses[m];
    if (!mes || !Array.isArray(mes.renda) || !Array.isArray(mes.despesas)) return false;
  }
  return true;
}

function importarBackup(arquivo, aoConcluir){
  const leitor = new FileReader();
  leitor.onload = () => {
    let dados;
    try{ dados = JSON.parse(leitor.result); }
    catch(e){ mostrarToast("Esse arquivo não é um backup válido (JSON inválido)."); return; }

    if (!validarFormatoBackup(dados)){
      mostrarToast("Esse arquivo não parece ser um backup do Orizon.");
      return;
    }

    confirmarElegante("Restaurar este backup substituirá os dados atuais deste dispositivo. Essa ação não pode ser desfeita.", () => {
      estado = Object.assign(estadoPadrao(), dados);
      try{ desfazerCartoesEspalhados(); }catch(err){}
      salvarEstado();
      atualizarInfoBackup();
      mostrarToast("Backup restaurado com sucesso!");

      if (document.getElementById("tab-painel").classList.contains("active")) renderizarPainel();
      if (document.getElementById("tab-mes").classList.contains("active")) renderizarMes(estado.mesSelecionado);
      if (aoConcluir) aoConcluir();
    }, { titulo: "📂 Restaurar backup", textoConfirmar: "Restaurar" });
  };
  leitor.readAsText(arquivo);
}

function atualizarInfoBackup(){
  const el = document.getElementById("backup-ultima-info");
  if (!el) return;
  if (!estado.ultimoBackup){
    el.textContent = "Você ainda não fez nenhum backup.";
  } else {
    const data = new Date(estado.ultimoBackup);
    el.textContent = "Último backup: " + data.toLocaleDateString("pt-BR", { day:"2-digit", month:"long", year:"numeric", hour:"2-digit", minute:"2-digit" });
  }
}

// Sugere backup se a pessoa já tem dados preenchidos e nunca fez (ou já faz mais de 14 dias)
function verificarLembreteBackup(){
  if (!possuiDadosPreenchidos()) return;
  const QUATORZE_DIAS_MS = 14 * 24 * 60 * 60 * 1000;
  const precisaLembrar = !estado.ultimoBackup || (Date.now() - new Date(estado.ultimoBackup).getTime() > QUATORZE_DIAS_MS);
  if (precisaLembrar) document.getElementById("lembrete-backup").classList.remove("hidden");
}

function iniciarBackup(){
  document.getElementById("btn-exportar-backup").addEventListener("click", exportarBackup);

  const inputImportar = document.getElementById("input-importar-backup");
  document.getElementById("btn-importar-backup").addEventListener("click", () => inputImportar.click());
  inputImportar.addEventListener("change", () => {
    if (inputImportar.files[0]) importarBackup(inputImportar.files[0]);
    inputImportar.value = "";
  });

  document.getElementById("btn-apagar-tudo").addEventListener("click", () => {
    const confirmacao1 = confirm(
      "ATENÇÃO\n\nTodos os dados financeiros salvos neste dispositivo serão apagados.\n\nEssa ação não poderá ser desfeita sem um backup."
    );
    if (!confirmacao1) return;
    const confirmacao2 = confirm("Tem certeza mesmo? Essa é a última confirmação — os dados serão apagados agora.");
    if (!confirmacao2) return;

    apagarTodosOsDados();
    document.getElementById("modal-configuracoes").classList.add("hidden");
    renderizarPainel();
    renderizarMes(estado.mesSelecionado);
    mostrarToast("Todos os dados foram apagados.");
  });

  document.getElementById("lembrete-backup-fechar").addEventListener("click", () => {
    document.getElementById("lembrete-backup").classList.add("hidden");
  });

  const agora = document.getElementById("lembrete-backup-agora");
  if (agora) agora.addEventListener("click", exportarBackup);

  verificarLembreteBackup();
}
