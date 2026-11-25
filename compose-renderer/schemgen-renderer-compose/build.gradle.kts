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
version = "0.2.0"

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
        // UZmiv (organization-scoped): internal consumers, next to compose-ui-kit.
        // UZmiv-public (scoped to the uz-schemgen project): the feed external teams get
        // Reader on, so they see this library and nothing else. Release to both.
        mapOf(
            "UZmiv" to "UZmiv/_packaging/UZmiv",
            "UZmivPublic" to "UZmiv/uz-schemgen/_packaging/UZmiv-public",
        ).forEach { (repoName, feed) ->
            maven {
                url = uri("https://pkgs.dev.azure.com/$feed/maven/v1")

                name = repoName

                credentials {
                    username = System.getenv("AZURE_ARTIFACTS_USER") ?: findProperty("azureUser") as String? ?: ""
                    password = System.getenv("SYSTEM_ACCESSTOKEN") ?: findProperty("azureToken") as String? ?: ""
                }
            }
        }
    }
}
