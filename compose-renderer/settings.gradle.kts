rootProject.name = "compose-renderer"
enableFeaturePreview("TYPESAFE_PROJECT_ACCESSORS")

pluginManagement {
    repositories {
        google()
        gradlePluginPortal()
        mavenCentral()
    }
}

@Suppress("UnstableApiUsage")
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

include(":schemgen-renderer-compose")   // the published library
include(":composeApp")         // wasm preview harness for web/index.html
