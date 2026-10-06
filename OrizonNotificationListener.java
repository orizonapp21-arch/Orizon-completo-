package br.orizon.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

/**
 * Recebe as notificações do sistema (SÓ depois que o usuário autoriza em Configurações).
 * Para cada notificação de COMPRA no crédito de um app de banco:
 *   1) guarda título/texto/hora numa fila local;
 *   2) se o Orizon estiver aberto, entrega na hora; senão avisa com uma notificação própria.
 * Nunca lê senha, saldo ou o conteúdo do app do banco; nunca envia nada pela internet;
 * nunca escreve o conteúdo das notificações em log.
 */
public class OrizonNotificationListener extends NotificationListenerService {
    private static final String CANAL = "orizon_compras";

    private static volatile OrizonNotificationListener instancia;

    /** Chamado pelo Orizon ao abrir: confere as notificações de compra que JÁ estão na barra do Android. */
    static void varrerSePossivel() {
        final OrizonNotificationListener l = instancia;
        if (l == null) return;   // acesso às notificações ainda não autorizado/conectado
        new Thread(new Runnable() {
            @Override
            public void run() {
                l.varrerAtivas();
            }
        }).start();
    }

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        instancia = this;
        varrerAtivas();   // recém-autorizado ou reconectado: pega o que já estava na barra
    }

    private void varrerAtivas() {
        try {
            StatusBarNotification[] ativas = getActiveNotifications();
            if (ativas == null) return;
            boolean entrouAlgo = false;
            for (StatusBarNotification sbn : ativas) {
                if (processar(sbn, false)) entrouAlgo = true;   // sem aviso próprio: a pessoa está abrindo o Orizon
            }
            if (entrouAlgo) MainActivity.entregarFilaSePossivel();
        } catch (Exception e) {
            // sem permissão ou serviço desconectado: ignora
        }
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (processar(sbn, true)) MainActivity.entregarFilaSePossivel();
    }

    /** @return true se era uma compra nova e entrou na fila. */
    private boolean processar(StatusBarNotification sbn, boolean avisar) {
        try {
            if (sbn == null) return false;
            String pacote = sbn.getPackageName();
            if (!FiltroCompra.pacotePermitido(pacote)) return false;

            Notification n = sbn.getNotification();
            if (n == null || n.extras == null) return false;
            if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return false;

            CharSequence t = n.extras.getCharSequence(Notification.EXTRA_TITLE);
            CharSequence grande = n.extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
            CharSequence x = grande != null ? grande : n.extras.getCharSequence(Notification.EXTRA_TEXT);
            String titulo = t == null ? "" : t.toString();
            String texto = x == null ? "" : x.toString();

            if (!FiltroCompra.pareceCompraDeCartao(titulo, texto)) return false;

            boolean nova = FilaCompras.adicionar(getApplicationContext(), pacote, titulo, texto, sbn.getPostTime());
            if (!nova) return false;                 // já vista antes: ignora

            if (avisar && !MainActivity.emPrimeiroPlano) {
                avisar(FiltroCompra.nomeBanco(pacote), FiltroCompra.valorParaAviso(titulo, texto));
            }
            return true;
        } catch (Exception e) {
            return false;   // nunca derrubar o serviço nem registrar o conteúdo da notificação
        }
    }

    @Override
    public void onListenerDisconnected() {
        super.onListenerDisconnected();
        if (instancia == this) instancia = null;
        try {
            NotificationListenerService.requestRebind(new ComponentName(this, OrizonNotificationListener.class));
        } catch (Exception e) {
            // o sistema religa quando puder
        }
    }

    /** Notificação PRÓPRIA do Orizon: "Nova compra identificada". */
    private void avisar(String banco, String valor) {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;
        nm.createNotificationChannel(new NotificationChannel(CANAL, "Compras identificadas", NotificationManager.IMPORTANCE_HIGH));

        Intent abrir = new Intent(this, MainActivity.class);
        abrir.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, abrir, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        String linha = valor.isEmpty() ? banco : banco + " • " + valor;
        Notification aviso = new Notification.Builder(this, CANAL)
                .setSmallIcon(R.drawable.ic_notificacao)
                .setContentTitle("🔔 Nova compra identificada")
                .setContentText(linha)
                .setStyle(new Notification.BigTextStyle().bigText(linha + "\nAbra o Orizon para confirmar a fatura."))
                .setContentIntent(pi)
                .setAutoCancel(true)
                .build();
        nm.notify((int) (System.currentTimeMillis() % Integer.MAX_VALUE), aviso);
    }
}
