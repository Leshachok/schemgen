import org.jetbrains.kotlin.gradle.ExperimentalWasmDsl
import org.jetbrains.kotlin.gradle.targets.js.webpack.KotlinWebpackConfig

plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
    alias(libs.plugins.kotlinxSerialization)
}

kotlin {
    // Web/Wasm first - this is what the "Preview" tab in web/index.html talks to.
    // Android and iOS targets are commented scaffolding for the next roadmap phases
    // (see /docs/wagon-scheme-format.md, "Prototype status" / roadmap section) -
    // uncomment once this module has a fixture-verified renderer.
    //
    // androidTarget()
    // iosArm64()
    // iosSimulatorArm64()

    @OptIn(ExperimentalWasmDsl::class)
    wasmJs {
        outputModuleName = "schemgenPreview"
        browser {
            commonWebpackConfig {
                outputFileName = "schemgenPreview.js"
                devServer = (devServer ?: KotlinWebpackConfig.DevServer()).apply {
                    open = false
                    port = 8080
                }
            }
        }
        binaries.executable()
    }

    sourceSets {
        val commonMain by getting {
            dependencies {
                implementation(compose.runtime)
                implementation(compose.foundation)
                implementation(compose.material3)
                implementation(compose.ui)
                implementation(libs.kotlinx.serialization.json)
            }
        }
        val commonTest by getting {
            dependencies {
                implementation(kotlin("test"))
            }
        }
    }
}
