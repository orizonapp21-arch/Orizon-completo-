#!/usr/bin/env python3
"""Monta a pasta android-app/ (estrutura exigida pelo Gradle) a partir dos arquivos soltos deste repositório.
Roda sozinho no GitHub Actions (android.yml); também funciona no seu computador: python3 montar_android.py"""
import os, shutil, sys

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)))
DEST = os.path.join(BASE, "android-app")
JAVA = "app/src/main/java/br/orizon/app/"

MAPA = {
    "android-settings.gradle.kts": "settings.gradle.kts",
    "android-build.gradle.kts": "build.gradle.kts",
    "android-gradle.properties": "gradle.properties",
    "android-app-build.gradle.kts": "app/build.gradle.kts",
    "AndroidManifest.xml": "app/src/main/AndroidManifest.xml",
    "styles.xml": "app/src/main/res/values/styles.xml",
    "ic_notificacao.xml": "app/src/main/res/drawable/ic_notificacao.xml",
    "icon-192.png": "app/src/main/res/mipmap-xxhdpi/ic_launcher.png",   # ícone do app = ícone do Orizon
    "MainActivity.java": JAVA + "MainActivity.java",
    "PonteJs.java": JAVA + "PonteJs.java",
    "FilaCompras.java": JAVA + "FilaCompras.java",
    "FiltroCompra.java": JAVA + "FiltroCompra.java",
    "Dedupe.java": JAVA + "Dedupe.java",
    "OrizonNotificationListener.java": JAVA + "OrizonNotificationListener.java",
}

faltando = [o for o in MAPA if not os.path.isfile(os.path.join(BASE, o))]
if faltando:
    sys.exit("Faltam arquivos no repositório: " + ", ".join(faltando))

shutil.rmtree(DEST, ignore_errors=True)
for origem, destino in MAPA.items():
    caminho = os.path.join(DEST, destino)
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    shutil.copyfile(os.path.join(BASE, origem), caminho)
print("android-app/ montado com", len(MAPA), "arquivos")
