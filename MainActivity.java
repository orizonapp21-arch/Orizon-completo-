package br.orizon.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.lang.ref.WeakReference;
import java.util.HashSet;
import java.util.Set;

/** Abre o Orizon numa WebView e faz a ponte com o leitor de notificações. */
public class MainActivity extends Activity {
    private static final int PEDIDO_ARQUIVO = 42;
    private static final int PEDIDO_NOTIFICACOES = 43;

    private static WeakReference<MainActivity> ativa = new WeakReference<MainActivity>(null);
    static volatile boolean emPrimeiroPlano = false;

    private WebView web;
    private boolean paginaPronta = false;
    private ValueCallback<Uri[]> seletorArquivo;

    /** Chamado pelo leitor de notificações: se o Orizon estiver carregado, entrega a fila agora. */
    static void entregarFilaSePossivel() {
        final MainActivity a = ativa.get();
        if (a == null) return;
        a.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                a.descarregarFila();
            }
        });
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ativa = new WeakReference<MainActivity>(this);

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        web.addJavascriptInterface(new PonteJs(this), "OrizonAndroid");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri destino = request.getUrl();
                String hostBase = Uri.parse(BuildConfig.ORIZON_URL).getHost();
                if (hostBase != null && hostBase.equalsIgnoreCase(destino.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, destino));   // links externos abrem no navegador
                } catch (Exception e) {
                    // sem app para abrir: ignora
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                paginaPronta = true;
                descarregarFila();
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            // Importar backup (.json): abre o seletor de arquivos do Android
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (seletorArquivo != null) seletorArquivo.onReceiveValue(null);
                seletorArquivo = callback;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                try {
                    startActivityForResult(Intent.createChooser(i, "Escolha o backup do Orizon (.json)"), PEDIDO_ARQUIVO);
                } catch (Exception e) {
                    seletorArquivo = null;
                    return false;
                }
                return true;
            }
        });

        web.loadUrl(BuildConfig.ORIZON_URL);

        if (Build.VERSION.SDK_INT >= 33) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, PEDIDO_NOTIFICACOES);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        emPrimeiroPlano = true;
        OrizonNotificationListener.varrerSePossivel();   // confere as notificações de compra que já estão na barra
        descarregarFila();
    }

    @Override
    protected void onPause() {
        emPrimeiroPlano = false;
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (ativa.get() == this) ativa = new WeakReference<MainActivity>(null);
        if (web != null) web.destroy();
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onActivityResult(int pedido, int resultado, Intent dados) {
        super.onActivityResult(pedido, resultado, dados);
        if (pedido == PEDIDO_ARQUIVO && seletorArquivo != null) {
            Uri[] escolhidos = null;
            if (resultado == RESULT_OK && dados != null && dados.getData() != null) {
                escolhidos = new Uri[]{dados.getData()};
            }
            seletorArquivo.onReceiveValue(escolhidos);
            seletorArquivo = null;
        }
    }

    /**
     * Entrega ao Orizon as compras guardadas na fila. Só apaga da fila o que o Orizon confirmou ter recebido
     * (se o Orizon ainda não carregou, a fila fica intacta). Roda na thread principal.
     */
    private void descarregarFila() {
        if (!paginaPronta || web == null) return;
        JSONArray itens = FilaCompras.todos(this);
        if (itens.length() == 0) return;

        final Set<String> ids = new HashSet<String>();
        JSONArray envio = new JSONArray();
        try {
            for (int i = 0; i < itens.length(); i++) {
                JSONObject o = itens.optJSONObject(i);
                if (o == null) continue;
                ids.add(o.optString("q"));
                JSONObject limpo = new JSONObject();
                limpo.put("pacote", o.optString("pacote"));
                limpo.put("titulo", o.optString("titulo"));
                limpo.put("texto", o.optString("texto"));
                limpo.put("timestamp", o.optLong("timestamp"));
                envio.put(limpo);
            }
        } catch (JSONException e) {
            return;
        }

        String js = "(function(){try{return window.OrizonCompras?JSON.stringify(OrizonCompras.receberLote("
                + JSONObject.quote(envio.toString()) + ")):null;}catch(e){return null;}})()";
        web.evaluateJavascript(js, new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String resultado) {
                if (resultado != null && !"null".equals(resultado)) {
                    FilaCompras.remover(MainActivity.this, ids);
                }
            }
        });
    }
}
