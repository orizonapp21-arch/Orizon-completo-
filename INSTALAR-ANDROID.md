# Orizon no Android com captura automática de compras

## Qual caminho usar?
| | PWABuilder (TWA) | App Android do Orizon (`android-app/`) |
|---|---|---|
| Vira app instalável | ✅ | ✅ |
| Lê notificações do banco | ❌ **não** | ✅ (depois de você autorizar) |
| Como gerar | site pwabuilder.com | GitHub Actions (botão "Run workflow") |

O PWABuilder gera um *Trusted Web Activity*: o app só abre o site dentro do Chrome, sem nenhum código nativo.
Por isso ele **não consegue ler notificações**. Para a captura automática use o app Android do Orizon (arquivos `.java`, `.gradle.kts` etc. deste pacote).

## Gerar o APK (sem Android Studio, pelo celular ou PC)
Todos os arquivos deste pacote ficam **soltos, sem pastas**. O script `montar_android.py` cria a pasta `android-app/` sozinho na hora de gerar o APK.
1. Suba **todos** os arquivos do ZIP para a raiz do seu repositório do GitHub (os mesmos do GitHub Pages).
2. Crie o arquivo do workflow pelo site do GitHub: *Add file → Create new file*, no nome digite
   `.github/workflows/android.yml` e cole o conteúdo do arquivo `android.yml` deste pacote. Salve (*Commit*).
3. Aba **Actions** → "Gerar APK do Orizon (Android)" → **Run workflow**. Leva uns 5–10 minutos.
4. Quando ficar verde, abra a execução → **Artifacts** → baixe **Orizon-APK** (vem num .zip; extraia).
5. Instale o `app-debug.apk` (o Android pede para permitir instalar de fonte desconhecida).

## Autorizar a leitura das notificações (obrigatório, você decide)
1. Abra o app Orizon → ⚙️ Configurações → **Compras do cartão** → **Autorizar leitura das notificações de compra**.
2. Na tela do Android, ligue **Orizon**.
3. **Se a opção estiver cinza** (comum no Android 13+ com APK instalado fora da Play Store):
   Configurações do Android → Apps → Orizon → ⋮ (canto superior) → **Permitir configurações restritas**; depois repita o passo 2.
4. Se o seu celular mata apps em segundo plano (Xiaomi, Samsung, etc.), deixe o Orizon em **Sem restrições** na bateria.

## Notificações que já estão na barra
Ao abrir o Orizon (e logo depois de você autorizar o acesso), o app confere as notificações de compra que **já estão** na barra do celular e cria pendências para elas. Cada notificação é lida uma vez só: abrir o app de novo não repete nada.

## Seus dados
O app Android tem armazenamento próprio: **não herda** os dados do PWA que você instalou pelo Chrome.
No PWA: Configurações → Backup → Exportar. No app Android: Configurações → Backup → Importar.

## Limites e honestidade
- **O que foi verificado do app Android:** o código Java compila contra stubs das APIs do Android que escrevi à mão (sintaxe e tipos);
  o filtro de notificações rodou numa JVM e deu o mesmo resultado que o do Orizon em 20 textos; o lado web foi testado com uma ponte simulada.
- **O que NÃO foi verificado:** o build do Gradle, o uso real das APIs do Android e o comportamento num aparelho. Nunca rodou num celular.
  Se o build falhar ou algo não funcionar, mande a mensagem de erro que eu corrijo.
- Funciona só em Android. iPhone não permite ler notificações de outros apps.
- A lista de apps de banco está em `FiltroCompra.java` — ajuste se o seu banco não estiver lá.
