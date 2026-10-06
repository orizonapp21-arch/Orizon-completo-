package br.orizon.app;

import java.util.List;

/** Lógica pura (sem Android) para não tratar a mesma notificação duas vezes. */
public final class Dedupe {
    private Dedupe() { }

    /** Identificador estável de uma notificação: app + hora em que foi postada + texto. */
    public static String chave(String pacote, long postTime, String texto) {
        return pacote + "|" + postTime + "|" + (texto == null ? 0 : texto.hashCode());
    }

    /**
     * Registra a chave na lista de "já vistas".
     * @return true se era nova; false se já tinha sido vista. Mantém só as {@code maximo} mais recentes.
     */
    public static boolean registrar(List<String> vistas, String chave, int maximo) {
        if (vistas.contains(chave)) return false;
        vistas.add(chave);
        while (vistas.size() > maximo) vistas.remove(0);
        return true;
    }
}
