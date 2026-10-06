import org.jetbrains.kotlin.gradle.ExperimentalWasmDsl
import org.jetbrains.kotlin.gradle.targets.js.webpack.KotlinWebpackConfig

plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
}

kotlin {
    // The wasm preview harness the "Preview" tab in web/index.html talks to. All
    // renderer code is in :schemgen-renderer-compose; this module is only the page around it.
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
        commonMain.dependencies {
            implementation(projects.schemgenRendererCompose)
            implementation(libs.compose.runtime)
            implementation(libs.compose.foundation)
            implementation(libs.compose.ui)
            implementation(libs.compose.material3)
            implementation(libs.kotlinx.serialization.json)
        }
    }
}
