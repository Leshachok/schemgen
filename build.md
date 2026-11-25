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
- An Android SDK (`ANDROID_HOME`, or `sdk.dir` in an untracked
  `compose-renderer/local.properties`) with platform 37. The library module has an
  Android target, and Gradle won't configure the build without the SDK, even for a
  wasm-only task. GitHub's Ubuntu runners have one; an Azure agent may not.
- No Node.js setup on the agent: Gradle fetches its own.
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

## Publishing the Compose library

`compose-renderer/schemgen-renderer-compose` is the published renderer (D32),
`ua.gov.uz:schemgen-renderer-compose` on the UZmiv Azure Artifacts feed. It's set up the same way
as `uz-compose-ui-kit` and released the same way, by hand from a developer machine for now:

```
cd compose-renderer
# bump `version` in schemgen-renderer-compose/build.gradle.kts first - the feed refuses a version twice
./gradlew :schemgen-renderer-compose:wasmJsBrowserTest :schemgen-renderer-compose:iosSimulatorArm64Test
./gradlew :schemgen-renderer-compose:publishAllPublicationsToUZmivRepository
```

Credentials: `azureUser`/`azureToken` in `~/.gradle/gradle.properties`, or
`AZURE_ARTIFACTS_USER`/`SYSTEM_ACCESSTOKEN` in the environment (what an Azure pipeline
provides). The iOS publications need a Mac with Xcode, so a pipeline that publishes
needs a macOS agent. The site build above doesn't publish and doesn't need one.

To try a build in a consumer before releasing, use `publishToMavenLocal`. How consumers
depend on it, and the miv-multiplatform integration, are in
`compose-renderer/INTEGRATION.md`.

### Access for teams outside UZmiv

Planned, not set up yet (2026-11-25). Teams outside Azure DevOps, such as the external
team behind the sales apps, need to read the renderer, but a personal access token can't
be limited to one package or feed. Its scopes are per area (**Packaging (Read)**) and per
organization, and it can read whatever its owner can. So the limit has to come from the
token's owner, not the token:

1. A separate feed, e.g. `schemgen`, holding only `schemgen-renderer-compose`. The renderer
   depends on nothing from the `UZmiv` feed (serialization and Compose come from Maven
   Central and Google), so this feed is complete on its own, and nothing else on `UZmiv`,
   such as the UI kit, is exposed.
2. A dedicated account (`schemgen-reader`, owned by UZ mobile) that is **Feed Reader** on
   `schemgen` and has no other permissions. Check that its access level can read feeds;
   Stakeholder is free, and Basic is free for the first 5 users.
3. A PAT created as that account: Packaging (Read), organization `UZmiv`, longest expiry
   allowed (at most a year). The external team keeps it in their CI secrets and adds the
   feed as a credentialed `maven {}` repository. If it leaks, all it reads is the renderer,
   and revoking it takes one click.
4. Publishing to both feeds: a second repository named `Schemgen` next to `UZmiv` in
   `schemgen-renderer-compose/build.gradle.kts`, released with
   `publishAllPublicationsToSchemgenRepository` as well.

The cost is owning that account and renewing the token before it expires; their builds
break on the day it does. Organization policy can block guest accounts or PAT creation, so
check with the `UZmiv` administrator first.

Rejected alternatives:

- **A feed view on `UZmiv`** (restrict `@Release` to that account, promote only schemgen
  into it). It avoids a second feed, but it fails open: give the account Reader on the feed
  itself, even by mistake, and it reads all of `UZmiv`.
- **A public feed.** It needs no token, but only a public project can have one, which
  publishes the renderer to everyone.
- **A zipped file-based Maven repository per release.** It needs no account or token, and
  it's a fallback if the account can't be created. But every update is a manual hand-over.

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
- Both parts must be same-origin; Preview talks to the Compose iframe via
  `postMessage`.

## ci-pipeline-test.yml

`ci-pipeline-test.yml` at the repo root is a sample Azure pipeline from another project
(`miv-kmp-web`), kept only as a template for agent pool, variable groups, Docker push and
Helm deploy. **Delete it once this repo has its own pipeline.** It does not build this
repo as-is: it calls a `:shared` module (here the site build is `:composeApp`, under
`compose-renderer/`), a `miv.wasm.fastOptimize` property that doesn't exist here, reads
output from `shared/build/dist/...`, and expects a `Dockerfile`, `charts/` and
`deploy/modules/` that this repo doesn't have. Its `MavenAuthenticate` step is only
needed if dependencies go through an Azure Artifacts feed.
