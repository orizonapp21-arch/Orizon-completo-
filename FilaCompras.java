package br.orizon.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Fila local de compras detectadas enquanto o Orizon estava fechado.
 * Guarda SÓ o necessário: pacote, título, texto da notificação de compra e a hora.
 * Itens somem quando o Orizon os recebe, ou após 7 dias. No máximo 50 itens.
 */
public final class FilaCompras {
    private static final String PREFS = "orizon_fila";
    private static final String CHAVE = "itens";
    private static final String CHAVE_VISTAS = "vistas";
    private static final int MAX_VISTAS = 200;
    private static final int MAXIMO = 50;
    private static final long VALIDADE_MS = 7L * 24 * 60 * 60 * 1000;

    private FilaCompras() { }

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static JSONArray ler(Context c) {
        String bruto = prefs(c).getString(CHAVE, "[]");
        try {
            return new JSONArray(bruto);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static void gravar(Context c, JSONArray itens) {
        prefs(c).edit().putString(CHAVE, itens.toString()).commit();
    }

    private static List<String> lerVistas(Context c) {
        List<String> lista = new ArrayList<String>();
        try {
            JSONArray a = new JSONArray(prefs(c).getString(CHAVE_VISTAS, "[]"));
            for (int i = 0; i < a.length(); i++) lista.add(String.valueOf(a.opt(i)));
        } catch (JSONException e) {
            // lista corrompida: recomeça vazia
        }
        return lista;
    }

    private static void gravarVistas(Context c, List<String> vistas) {
        JSONArray a = new JSONArray();
        for (String v : vistas) a.put(v);
        prefs(c).edit().putString(CHAVE_VISTAS, a.toString()).commit();
    }

    /**
     * @return false se esta notificação já foi vista antes (não entra de novo na fila).
     * Isso permite varrer as notificações que já estão na barra a cada abertura sem repetir nada.
     */
    public static synchronized boolean adicionar(Context c, String pacote, String titulo, String texto, long timestamp) {
        List<String> vistas = lerVistas(c);
        if (!Dedupe.registrar(vistas, Dedupe.chave(pacote, timestamp, texto), MAX_VISTAS)) return false;
        gravarVistas(c, vistas);
        JSONArray atuais = limparVencidos(ler(c));
        for (int i = 0; i < atuais.length(); i++) {
            JSONObject o = atuais.optJSONObject(i);
            if (o != null && pacote.equals(o.optString("pacote")) && texto.equals(o.optString("texto"))
                    && o.optLong("timestamp") == timestamp) {
                return false;
            }
        }
        JSONObject novo = new JSONObject();
        try {
            novo.put("q", UUID.randomUUID().toString());
            novo.put("pacote", pacote);
            novo.put("titulo", titulo);
            novo.put("texto", texto);
            novo.put("timestamp", timestamp);
        } catch (JSONException e) {
            return false;
        }
        atuais.put(novo);
        gravar(c, cortar(atuais));
        return true;
    }

    public static synchronized JSONArray todos(Context c) {
        JSONArray itens = limparVencidos(ler(c));
        gravar(c, itens);
        return itens;
    }

    /** Remove da fila os itens cujo "q" está no conjunto (os que o Orizon já recebeu). */
    public static synchronized void remover(Context c, Set<String> ids) {
        JSONArray atuais = ler(c);
        JSONArray restantes = new JSONArray();
        for (int i = 0; i < atuais.length(); i++) {
            JSONObject o = atuais.optJSONObject(i);
            if (o != null && !ids.contains(o.optString("q"))) restantes.put(o);
        }
        gravar(c, restantes);
    }

    private static JSONArray limparVencidos(JSONArray itens) {
        long limite = System.currentTimeMillis() - VALIDADE_MS;
        JSONArray ok = new JSONArray();
        for (int i = 0; i < itens.length(); i++) {
            JSONObject o = itens.optJSONObject(i);
            if (o != null && o.optLong("timestamp") >= limite) ok.put(o);
        }
        return ok;
    }

    private static JSONArray cortar(JSONArray itens) {
        if (itens.length() <= MAXIMO) return itens;
        JSONArray ultimos = new JSONArray();
        for (int i = itens.length() - MAXIMO; i < itens.length(); i++) ultimos.put(itens.opt(i));
        return ultimos;
    }
}
