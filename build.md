# Building

What CI has to produce, and how. The project is moving to the internal Azure DevOps
organization; this is the reference for whoever writes its pipeline. The GitHub Pages
workflow (`.github/workflows/pages.yml`) already does the same thing on GitHub and is
the working example to port from.

## What gets built

One static site, two parts:

| Part | Source | Build step | Ends up at |
|---|---|---|---|
| Web app (catalogue, builder, preview, docs) | `web/` | none, copied as-is | `/` |
| Compose Multiplatform preview (wasmJs) | `compose-renderer/` | Gradle | `/compose-preview/` |

The `compose-preview/` path is not arbitrary: the Preview tab in `web/js/app.js`
(`defaultComposeUrl`) loads the Compose build from `compose-preview/` next to
`index.html` whenever the page isn't served from `localhost`. Put it anywhere else and
the Compose option in Preview stops working without a manual URL.

Neither part needs a backend. Any static file server (nginx, a storage bucket) works.

## Prerequisites

- JDK 21 (CI on GitHub uses Temurin 21; newer JDKs also build locally).
- Network access to Maven Central, Google Maven and the Gradle Plugin Portal, and to
  `services.gradle.org` for the Gradle wrapper (`gradle-9.6.1`). If the Azure agents
  can't reach these directly, they need a proxying feed, and `settings.gradle.kts`
  repositories pointed at it. The Kotlin/Wasm build also downloads Node.js, Yarn and
  Binaryen on first run, which matters behind the same proxy.
- No Node.js setup on the agent: Gradle fetches its own.
- Python 3 only if CI checks generated files (see below).

## Compose preview

```
cd compose-renderer
./gradlew composeApp:wasmJsBrowserDistribution --no-daemon
```

Output: `compose-renderer/composeApp/build/dist/wasmJs/productionExecutable/` —
`index.html`, `schemgenPreview.js`, two `.wasm` files (app + Skiko, ~10 MB together)
and `composeResources/`. Copy the whole directory's contents.

On a small agent (4 cores / 8 GB), keep the Kotlin compiler in-process and cap the heap,
so Gradle, a separate Kotlin daemon and Binaryen don't all hold memory at once:

```
./gradlew composeApp:wasmJsBrowserDistribution --no-daemon --max-workers=4 \
  -Pkotlin.compiler.execution.strategy=in-process \
  "-Dorg.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=768m -Dfile.encoding=UTF-8"
```

Verified 2026-10-05: ~40 s on a warm cache with these flags.

Tests (`commonTest`, run in headless Chrome, so the agent needs Chrome/Chromium):

```
./gradlew composeApp:wasmJsBrowserTest --no-daemon
```

Caching: `~/.gradle` is worth caching between runs (dependencies, wrapper, Node/Yarn,
Binaryen); `gradle.properties` already turns on the build cache.

## Web app

No build. `web/` is plain HTML/CSS/JS, opened via `file://` during development and served
as-is when deployed.

Three files under `web/js/` are generated and checked in (`icons.js`, the `AUTO` array in
`schemes.js`, `docs.js`, see `web/tools/README.md`). CI does not regenerate them. One
cheap check is worth having: `docs.js` going stale after a spec edit, which is easy to
miss.

```
python3 web/tools/embed_docs.py
git diff --exit-code web/js/docs.js
```

## Assembling the site

```
mkdir -p _site/compose-preview
cp -r web/. _site/
cp -r compose-renderer/composeApp/build/dist/wasmJs/productionExecutable/. _site/compose-preview/
```

`_site/` is the deployable artifact (Docker image with nginx, or whatever the Azure
target is).

Serving notes:

- `.wasm` must be served as `application/wasm` (nginx's default `mime.types` has it).
- The `.wasm` file names are content-hashed and can be cached long-term. `index.html`,
  `schemgenPreview.js` and everything in `web/` are not hashed: serve them with
  revalidation, or a deploy leaves users with a stale page.
- Both parts must be same-origin; Preview talks to the Compose iframe via
  `postMessage`.

## ci-pipeline-test.yml

`ci-pipeline-test.yml` at the repo root is a sample Azure pipeline from another project
(`miv-kmp-web`), kept only as a template for agent pool, variable groups, Docker push and
Helm deploy. **Delete it once this repo has its own pipeline.** It does not build this
repo as-is: it calls a `:shared` module (here it's `:composeApp`, under
`compose-renderer/`), a `miv.wasm.fastOptimize` property that doesn't exist here, reads
output from `shared/build/dist/...`, and expects a `Dockerfile`, `charts/` and
`deploy/modules/` that this repo doesn't have. Its `MavenAuthenticate` step is only
needed if dependencies go through an Azure Artifacts feed.
