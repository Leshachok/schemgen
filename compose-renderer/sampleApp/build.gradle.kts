/*
 * Android demo of schemgen-renderer-compose: the same scrolling list of wagons twice, once
 * as legacy Views (RecyclerView, the renderer in a ComposeView per row, as the Android
 * sales app will host it) and once in Compose (LazyColumn). Not published.
 *
 *   ./gradlew :sampleApp:installDebug
 *   ./gradlew :sampleApp:installRelease    # R8-minified, signed with the debug key
 *
 * The wagon list comes from the web builder's samples, exported by export-samples.mjs.
 */

plugins {
    alias(libs.plugins.androidApplication)
    alias(libs.plugins.composeCompiler)
}

android {
    namespace = "ua.gov.uz.schemgen.sample"
    compileSdk = libs.versions.android.compileSdk.get().toInt()

    defaultConfig {
        applicationId = "ua.gov.uz.schemgen.sample"
        minSdk = libs.versions.android.minSdk.get().toInt()
        targetSdk = libs.versions.android.targetSdk.get().toInt()
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            // as a shipping app would build it, so scrolling is judged on optimized code;
            // signed with the debug key only so it installs without a keystore
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
    }
}

dependencies {
    implementation(project(":schemgen-renderer-compose"))

    implementation(libs.compose.foundation)
    implementation(libs.compose.material3)

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.fragment.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.recyclerview)
    implementation(libs.google.material)
}
