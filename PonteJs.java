package br.orizon.app;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.webkit.JavascriptInterface;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Objeto "OrizonAndroid" visível ao JavaScript do Orizon dentro da WebView.
 * Só expõe o necessário: saber se está no app Android, se a leitura de notificações foi
 * autorizada, abrir a tela de autorização do sistema e salvar o backup em Downloads.
 */
public class PonteJs {
    private static final int LIMITE_ARQUIVO = 10 * 1024 * 1024;
    private final Activity atividade;

    PonteJs(Activity atividade) {
        this.atividade = atividade;
    }

    @JavascriptInterface
    public boolean ativo() {
        return true;
    }

    @JavascriptInterface
    public String versao() {
        return "1";
    }

    /** O usuário já autorizou o Orizon em "Acesso às notificações"? */
    @JavascriptInterface
    public boolean temPermissao() {
        String lista = Settings.Secure.getString(atividade.getContentResolver(), "enabled_notification_listeners");
        return lista != null && lista.contains(atividade.getPackageName());
    }

    /** Abre a tela do Android onde o USUÁRIO liga o acesso às notificações (autorização explícita). */
    @JavascriptInterface
    public void abrirPermissao() {
        atividade.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    atividade.startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
                } catch (Exception e) {
                    // sem tela disponível: o Orizon mostra a orientação manual
                }
            }
        });
    }

    /** Salva o backup (.json) na pasta Downloads. */
    @JavascriptInterface
    public boolean salvarArquivo(String nome, String conteudo) {
        if (nome == null || conteudo == null || conteudo.length() > LIMITE_ARQUIVO) return false;
        String seguro = nome.replaceAll("[^A-Za-z0-9._-]", "_");
        if (!seguro.endsWith(".json")) return false;
        try {
            ContentValues v = new ContentValues();
            v.put(MediaStore.Downloads.DISPLAY_NAME, seguro);
            v.put(MediaStore.Downloads.MIME_TYPE, "application/json");
            v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            Uri uri = atividade.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            if (uri == null) return false;
            OutputStream saida = atividade.getContentResolver().openOutputStream(uri);
            if (saida == null) return false;
            try {
                saida.write(conteudo.getBytes(StandardCharsets.UTF_8));
            } finally {
                saida.close();
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
