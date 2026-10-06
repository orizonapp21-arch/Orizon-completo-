package br.orizon.app;

import java.text.Normalizer;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Decide, só pelo texto, se uma notificação parece uma COMPRA APROVADA NO CRÉDITO.
 * Lógica pura (sem Android) e espelhada em compras-pendentes.js — quem decide de verdade
 * é o Orizon (JS); aqui é só um pré-filtro para não guardar/avisar sobre notificações que não são compra.
 */
public final class FiltroCompra {

    /** Apps de banco/carteira considerados. Ajuste conforme os seus bancos. */
    private static final Map<String, String> BANCOS = new HashMap<>();
    static {
        BANCOS.put("com.nu.production", "Nubank");
        BANCOS.put("com.itau", "Itaú");
        BANCOS.put("com.itau.iti", "Itaú");
        BANCOS.put("br.com.intermedium", "Inter");
        BANCOS.put("com.c6bank.app", "C6 Bank");
        BANCOS.put("com.bradesco", "Bradesco");
        BANCOS.put("br.com.bb.android", "Banco do Brasil");
        BANCOS.put("com.santander.app", "Santander");
        BANCOS.put("br.com.gabba.Caixa", "Caixa");
        BANCOS.put("com.mercadopago.wallet", "Mercado Pago");
        BANCOS.put("br.com.neon", "Next");
        BANCOS.put("br.com.sicredi.mobi", "Sicredi");
    }

    private static final Pattern RE_RECUSA = Pattern.compile("(recusad|negad|nao aprovad|cancelad|estorn|reembols|devolu)");
    private static final Pattern RE_NAO_COMPRA = Pattern.compile("(pagamento da fatura|fatura (fechou|fechada|disponivel|vence)|pix|transferencia|saque|deposito|boleto)");
    private static final Pattern RE_COMPRA = Pattern.compile("(compra|pagamento aprovado|transacao aprovada|transacao no credito)");
    private static final Pattern RE_VALOR = Pattern.compile("R\\$\\s*([0-9]{1,3}(?:\\.[0-9]{3})*(?:,[0-9]{1,2})?|[0-9]+(?:,[0-9]{1,2})?)");

    private FiltroCompra() { }

    /** Trechos de nome de pacote de apps de banco (cobre variações como com.itau.xxx). */
    private static final String[] TRECHOS = {"itau", "nubank", "com.nu.", "bradesco", "santander", "c6bank", "intermedium", "mercadopago", "br.com.bb.", "caixa", "sicredi", "neon"};

    public static boolean pacotePermitido(String pacote) {
        if (pacote == null) return false;
        if (BANCOS.containsKey(pacote)) return true;
        String p = pacote.toLowerCase(Locale.ROOT);
        for (String t : TRECHOS) if (p.contains(t)) return true;
        return false;
    }

    public static String nomeBanco(String pacote) {
        String n = pacote == null ? null : BANCOS.get(pacote);
        if (n != null) return n;
        String p = pacote == null ? "" : pacote.toLowerCase(Locale.ROOT);
        if (p.contains("itau")) return "Itaú";
        if (p.contains("nubank") || p.contains("com.nu.")) return "Nubank";
        if (p.contains("bradesco")) return "Bradesco";
        if (p.contains("santander")) return "Santander";
        return "Cartão";
    }

    static String norm(String s) {
        String base = s == null ? "" : s;
        return Normalizer.normalize(base, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).trim();
    }

    public static boolean pareceCompraDeCartao(String titulo, String texto) {
        String full = ((titulo == null ? "" : titulo) + " " + (texto == null ? "" : texto));
        String n = norm(full);
        if (n.isEmpty()) return false;
        if (RE_RECUSA.matcher(n).find()) return false;
        if (RE_NAO_COMPRA.matcher(n).find() && !n.contains("compra")) return false;
        if (!RE_COMPRA.matcher(n).find()) return false;
        if (n.contains("debito") && !n.contains("credito")) return false;
        return RE_VALOR.matcher(full).find();
    }

    /** Primeiro valor em reais encontrado, no formato "R$ 87,50" (para o aviso do Orizon). */
    public static String valorParaAviso(String titulo, String texto) {
        String full = (titulo == null ? "" : titulo) + " " + (texto == null ? "" : texto);
        Matcher m = RE_VALOR.matcher(full);
        return m.find() ? "R$ " + m.group(1) : "";
    }
}
