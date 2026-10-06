import org.jetbrains.kotlin.gradle.ExperimentalWasmDsl
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

/*
 * The published Compose renderer (D32). Same shape as uz-compose-ui-kit: one KMP
 * library, published with vanniktech to the UZmiv Azure Artifacts feed as
 * ua.gov.uz:schemgen-renderer-compose (artifactId = this module's name).
 *
 *   ./gradlew :schemgen-renderer-compose:publishToMavenLocal                       # try it locally
 *   ./gradlew :schemgen-renderer-compose:publishAllPublicationsToUZmivRepository   # release
 *
 * Bump `version` on every release - the feed rejects re-publishing a version.
 */

plugins {
    alias(libs.plugins.androidKotlinMultiplatformLibrary)
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
    alias(libs.plugins.vanniktechMavenPublish)
}

group = "ua.gov.uz"
version = "0.1.0"

kotlin {
    android {
        namespace = "ua.gov.uz.schemgen"
        compileSdk = libs.versions.android.compileSdk.get().toInt()
        minSdk = libs.versions.android.minSdk.get().toInt()

        compilerOptions {
            jvmTarget = JvmTarget.JVM_17
        }
    }
    iosArm64()
    iosSimulatorArm64()

    @OptIn(ExperimentalWasmDsl::class)
    wasmJs {
        browser()
    }

    sourceSets {
        commonMain.dependencies {
            implementation(libs.compose.runtime)
            implementation(libs.compose.foundation)
            implementation(libs.compose.ui)
            // api: SchemeParser.parse(JsonObject) is part of the public surface
            api(libs.kotlinx.serialization.json)
        }
        commonTest.dependencies {
            implementation(kotlin("test"))
        }
    }
    withSourcesJar()
}

publishing {
    repositories {
        maven {
            url = uri("https://pkgs.dev.azure.com/UZmiv/_packaging/UZmiv/maven/v1")

            name = "UZmiv"

            credentials {
                username = System.getenv("AZURE_ARTIFACTS_USER") ?: findProperty("azureUser") as String? ?: ""
                password = System.getenv("SYSTEM_ACCESSTOKEN") ?: findProperty("azureToken") as String? ?: ""
            }
        }
    }
}
