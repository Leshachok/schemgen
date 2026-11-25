# Building

What CI has to produce, and how. The project is moving to the internal Azure DevOps
organization; this is the reference for whoever writes its pipeline. The GitHub Pages
workflow (`.github/workflows/pages.yml`) already does the same thing on GitHub and is
the working example to port from.

## What gets built

One static site, three parts:

| Part | Source | Build step | Ends up at |
|---|---|---|---|
| Web app (catalogue, builder, preview, docs) | `web/` | none, copied as-is | `/` |
| Compose Multiplatform preview (wasmJs) | `compose-renderer/` | Gradle | `/compose-preview/` |
| Vue preview | `vue-renderer/` | npm | `/vue-preview/` |

The two preview paths are not arbitrary: the Preview tab in `web/js/app.js` (`HARNESS`)
loads each build from that folder next to `index.html` whenever the page isn't served from
`localhost`. Put one anywhere else and its option in Preview stops working without a
manual URL.

Neither part needs a backend. Any static file server (nginx, a storage bucket) works.

## Prerequisites

- JDK 21 (CI on GitHub uses Temurin 21; newer JDKs also build locally).
- Network access to Maven Central, Google Maven and the Gradle Plugin Portal, and to
  `services.gradle.org` for the Gradle wrapper (`gradle-9.6.1`). If the Azure agents
  can't reach these directly, they need a proxying feed, and `settings.gradle.kts`
  repositories pointed at it. The Kotlin/Wasm build also downloads Node.js, Yarn and
  Binaryen on first run, which matters behind the same proxy.
- An Android SDK (`ANDROID_HOME`, or `sdk.dir` in an untracked
  `compose-renderer/local.properties`) with platform 37. The library module has an
  Android target, and Gradle won't configure the build without the SDK, even for a
  wasm-only task. GitHub's Ubuntu runners have one; an Azure agent may not.
- Node.js 22.12 or newer (Vitest 5 requires it; CI uses 24) and npm, for the Vue part. Gradle fetches its own Node
  for the Compose part; that one isn't on the PATH and can't be reused. Dependencies come
  from the npm registry, so behind a proxy npm needs a proxying feed too.
- Python 3 only if CI checks generated files (see below).

## Compose preview

```
cd compose-renderer
./gradlew :composeApp:wasmJsBrowserDistribution --no-daemon
```

Output: `compose-renderer/composeApp/build/dist/wasmJs/productionExecutable/` —
`index.html`, `schemgenPreview.js`, two `.wasm` files (app + Skiko, ~10 MB together)
and `composeResources/`. Copy the whole directory's contents.

On a small agent (4 cores / 8 GB), keep the Kotlin compiler in-process and cap the heap,
so Gradle, a separate Kotlin daemon and Binaryen don't all hold memory at once:

```
./gradlew :composeApp:wasmJsBrowserDistribution --no-daemon --max-workers=4 \
  -Pkotlin.compiler.execution.strategy=in-process \
  "-Dorg.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=768m -Dfile.encoding=UTF-8"
```

Verified 2026-10-05: ~40 s on a warm cache with these flags.

Tests (`commonTest`, run in headless Chrome, so the agent needs Chrome/Chromium):

```
./gradlew :schemgen-renderer-compose:wasmJsBrowserTest --no-daemon
```

Caching: `~/.gradle` is worth caching between runs (dependencies, wrapper, Node/Yarn,
Binaryen); `gradle.properties` already turns on the build cache.

## Vue preview

```
cd vue-renderer
npm ci
npm test               # typecheck + Vitest, including the parity check against web/js/format.js
npm run build:preview
```

Output: `vue-renderer/previewApp/dist/`: `index.html` and one hashed script under
`assets/`, ~100 kB. Copy the whole directory's contents. `npm test` reads `web/js/` and
`shared-fixtures/`, so it needs the whole checkout, not just `vue-renderer/`. Verified
2026-11-25: a few seconds on a warm npm cache.

## Publishing the Vue library

`vue-renderer/schemgen-renderer-vue` is published as `@uz/schemgen-renderer-vue` to the same
two feeds as the Compose library, by hand for now. Commands, credentials and how consumers
point npm at the feed are in `vue-renderer/README.md`.

## Publishing the Compose library

`compose-renderer/schemgen-renderer-compose` is the published renderer (D32),
`ua.gov.uz:schemgen-renderer-compose` on two Azure Artifacts feeds: `UZmiv`, next to
`uz-compose-ui-kit`, for internal consumers, and `UZmiv-public`, for external teams. An
external team's account gets Reader on `UZmiv-public` and nothing else, so it sees this
library and not the rest of `UZmiv`; feed permissions can't be narrowed per package, hence a
second feed rather than a role on the first. `UZmiv-public` is scoped to the `uz-schemgen`
project, which is why its URL has the project in it. It's set up and released the same way as `uz-compose-ui-kit`,
by hand from a developer machine for now:

```
cd compose-renderer
# bump `version` in schemgen-renderer-compose/build.gradle.kts first - a feed refuses a version twice
./gradlew :schemgen-renderer-compose:wasmJsBrowserTest :schemgen-renderer-compose:iosSimulatorArm64Test
./gradlew :schemgen-renderer-compose:publish        # both feeds
```

`publishAllPublicationsToUZmivRepository` and `publishAllPublicationsToUZmivPublicRepository`
publish to one feed each. If one of them fails halfway, rerun only that one: the feed that
succeeded already holds the version and would refuse it again.

Credentials: `azureUser`/`azureToken` in `~/.gradle/gradle.properties`, or
`AZURE_ARTIFACTS_USER`/`SYSTEM_ACCESSTOKEN` in the environment (what an Azure pipeline
provides). The same credentials serve both feeds; the account needs Contributor on each.
A pipeline publishing from another project needs its build identity added to
`UZmiv-public` as Contributor. The iOS publications need a Mac with Xcode, so a pipeline that publishes
needs a macOS agent. The site build above doesn't publish and doesn't need one.

To try a build in a consumer before releasing, use `publishToMavenLocal`. How consumers
depend on it, and the miv-multiplatform integration, are in
`compose-renderer/INTEGRATION.md`.

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
mkdir -p _site/compose-preview _site/vue-preview
cp -r web/. _site/
cp -r compose-renderer/composeApp/build/dist/wasmJs/productionExecutable/. _site/compose-preview/
cp -r vue-renderer/previewApp/dist/. _site/vue-preview/

# new asset URLs on every deploy - see the serving notes
v=$(git rev-parse --short=8 HEAD)
sed -E -i "s#(src=\"js/[A-Za-z0-9_-]+\.js)\"#\1?v=$v\"#g; s#(href=\"css/[A-Za-z0-9_-]+\.css)\"#\1?v=$v\"#g" _site/index.html
sed -E -i "s#(src=\"schemgenPreview\.js)\"#\1?v=$v\"#" _site/compose-preview/index.html
```

`_site/` is the deployable artifact (Docker image with nginx, or whatever the Azure
target is).

Serving notes:

- `.wasm` must be served as `application/wasm` (nginx's default `mime.types` has it).
- The `.wasm` file names are content-hashed and can be cached long-term. `index.html`,
  `schemgenPreview.js` and everything in `web/` are not hashed. The assembly step stamps
  their URLs in both `index.html` files with the commit (`js/app.js?v=2790cfd4`), so a
  deploy can't pair a new page with a cached old script. That happened on GitHub Pages on
  2026-11-24: a cached `app.js` looked for a checkbox the new page no longer had, and
  `init` crashed. Still serve the two `index.html` files with revalidation.
- The Vue preview's script name is content-hashed by Vite, so only its `index.html` needs
  revalidation; no stamping step.
- All parts must be same-origin; Preview talks to the preview iframes via `postMessage`.

## ci-pipeline-test.yml

`ci-pipeline-test.yml` at the repo root is a sample Azure pipeline from another project
(`miv-kmp-web`), kept only as a template for agent pool, variable groups, Docker push and
Helm deploy. **Delete it once this repo has its own pipeline.** It does not build this
repo as-is: it calls a `:shared` module (here the site build is `:composeApp`, under
`compose-renderer/`), a `miv.wasm.fastOptimize` property that doesn't exist here, reads
output from `shared/build/dist/...`, and expects a `Dockerfile`, `charts/` and
`deploy/modules/` that this repo doesn't have. Its `MavenAuthenticate` step is only
needed if dependencies go through an Azure Artifacts feed.

Its Vue step is this repo's own: Node 24, `npm ci`, `npm test` and `npm run build:preview` in
`vue-renderer/`, with the npm cache kept between runs. It runs before Gradle and doesn't
depend on it. Its output, `vue-renderer/previewApp/dist/`, still has to reach the image as
`vue-preview/` next to `index.html`, which is the Dockerfile's job.
