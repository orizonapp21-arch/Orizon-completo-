plugins {
    id("com.android.application")
}

// Endereço do Orizon (GitHub Pages). O workflow do GitHub preenche sozinho; para build local:
//   gradle assembleDebug -PORIZON_URL="https://seunome.github.io/seurepo/"
val orizonUrl: String = (project.findProperty("ORIZON_URL") as String?) ?: "https://SEU-USUARIO.github.io/SEU-REPOSITORIO/"

android {
    namespace = "br.orizon.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "br.orizon.app"
        minSdk = 29
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
        buildConfigField("String", "ORIZON_URL", "\"$orizonUrl\"")
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
