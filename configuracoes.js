/* ============================================================
   Orizon — configuracoes.js
   Controla o modal único de Configurações: Dados e Backup,
   Notificações e Alertas financeiros. A permissão de notificação
   só é pedida quando a pessoa liga o interruptor — nunca de cara,
   sem contexto.
   ============================================================ */

function sincronizarTelaConfiguracoes(){
  const cfg = estado.notificacoes;
  document.getElementById("cfg-notif-ativado").checked = cfg.ativado;
  document.getElementById("cfg-dias-5").checked = !!cfg.dias["5"];
  document.getElementById("cfg-dias-3").checked = !!cfg.dias["3"];
  document.getElementById("cfg-dias-1").checked = !!cfg.dias["1"];
  document.getElementById("cfg-dias-0").checked = !!cfg.dias["0"];
  document.getElementById("cfg-notif-som").checked = cfg.som;
  document.getElementById("cfg-notif-vibracao").checked = cfg.vibracao;

  document.getElementById("cfg-alerta-ativado").checked = estado.alertasFinanceiros.ativado;
  document.querySelectorAll("#modal-configuracoes [data-limite]").forEach(chip => {
    chip.classList.toggle("ativo", Number(chip.dataset.limite) === estado.alertasFinanceiros.limite);
  });

  document.getElementById("cfg-nome-usuario").value = estado.config.nomeUsuario || "";
  document.querySelectorAll("#modal-configuracoes [data-estilo]").forEach(chip => {
    chip.classList.toggle("ativo", chip.dataset.estilo === estado.config.estiloMensagem);
  });

  atualizarInfoBackup();
}

function iniciarConfiguracoes(){
  const modal = document.getElementById("modal-configuracoes");

  document.getElementById("btn-config").addEventListener("click", () => {
    sincronizarTelaConfiguracoes();
    modal.classList.remove("hidden");
  });
  document.getElementById("config-fechar").addEventListener("click", () => modal.classList.add("hidden"));

  // Notificações — pede permissão só quando a pessoa liga o interruptor
  document.getElementById("cfg-notif-ativado").addEventListener("change", async (e) => {
    if (e.target.checked){
      const concedida = await pedirPermissaoNotificacao();
      if (!concedida){
        e.target.checked = false;
        return;
      }
      mostrarToast("Notificações ativadas!");
    }
    estado.notificacoes.ativado = e.target.checked;
    salvarEstado();
    checarContasEAvisar();
  });

  ["5","3","1","0"].forEach(dia => {
    document.getElementById(`cfg-dias-${dia}`).addEventListener("change", (e) => {
      estado.notificacoes.dias[dia] = e.target.checked;
      salvarEstado();
    });
  });

  document.getElementById("cfg-notif-som").addEventListener("change", (e) => {
    estado.notificacoes.som = e.target.checked;
    salvarEstado();
  });
  document.getElementById("cfg-notif-vibracao").addEventListener("change", (e) => {
    estado.notificacoes.vibracao = e.target.checked;
    salvarEstado();
  });

  // Alertas financeiros
  document.getElementById("cfg-alerta-ativado").addEventListener("change", async (e) => {
    if (e.target.checked && estado.notificacoes.ativado === false){
      const concedida = await pedirPermissaoNotificacao();
      if (!concedida){ e.target.checked = false; return; }
    }
    estado.alertasFinanceiros.ativado = e.target.checked;
    salvarEstado();
  });

  document.querySelectorAll("#modal-configuracoes [data-limite]").forEach(chip => {
    chip.addEventListener("click", () => {
      estado.alertasFinanceiros.limite = Number(chip.dataset.limite);
      salvarEstado();
      document.querySelectorAll("#modal-configuracoes [data-limite]").forEach(c => c.classList.remove("ativo"));
      chip.classList.add("ativo");
    });
  });

  // Nome e estilo da saudação
  document.getElementById("cfg-nome-usuario").addEventListener("input", (e) => {
    estado.config.nomeUsuario = e.target.value;
    salvarEstado();
    renderizarSaudacao();
  });
  document.querySelectorAll("#modal-configuracoes [data-estilo]").forEach(chip => {
    chip.addEventListener("click", () => {
      estado.config.estiloMensagem = chip.dataset.estilo;
      salvarEstado();
      document.querySelectorAll("#modal-configuracoes [data-estilo]").forEach(c => c.classList.remove("ativo"));
      chip.classList.add("ativo");
      renderizarSaudacao();
    });
  });
}
