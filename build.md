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
two feeds as the Compose library, by hand for now (0.1.0 on `UZmiv-internal` since
2026-11-25, not yet on `UZmiv-public`). Commands, credentials and how consumers
point npm at the feed are in `vue-renderer/README.md`.

## Publishing the Compose library

`compose-renderer/schemgen-renderer-compose` is the published renderer (D32),
`ua.gov.uz:schemgen-renderer-compose` on two Azure Artifacts feeds: `UZmiv-internal`, for
internal consumers, and `UZmiv-public`, for external teams. An external team's account gets
Reader on `UZmiv-public` and nothing else, so it sees this library and not the internal
packages; feed permissions can't be narrowed per package, hence a second feed rather than a
role on the first. `UZmiv-public` is scoped to the `uz-schemgen` project, which is why its
URL has the project in it. `UZmiv-internal` replaced the `UZmiv` feed on 2026-11-25 (see
"Access for teams outside UZmiv" for why); `uz-compose-ui-kit` moved there too. It's set
up and released the same way as `uz-compose-ui-kit`, by hand from a developer machine for now:

```
cd compose-renderer
# bump `version` in schemgen-renderer-compose/build.gradle.kts first - a feed refuses a version twice
./gradlew :schemgen-renderer-compose:wasmJsBrowserTest :schemgen-renderer-compose:iosSimulatorArm64Test
./gradlew :schemgen-renderer-compose:publish        # both feeds
```

`publishAllPublicationsToUZmivInternalRepository` and `publishAllPublicationsToUZmivPublicRepository`
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

### Access for teams outside UZmiv

Not open yet (2026-11-25): it waits for the old `UZmiv` feed to be deleted, see below.
Teams outside UZmiv, such as the external team behind the sales apps, need to read the
renderer, but a personal access token can't be limited to one package or feed. Its scopes
are per area (**Packaging (Read)**) and per organization, and it can read whatever its owner
can. So the limit has to come from the token's owner, not the token. The external person
gets an account in the `UZmiv` organization with:

1. Access level **Stakeholder**. In a private project a Stakeholder can't open Repos at all,
   whatever group grants it, while Artifacts stays available. Basic would let them read
   code wherever some group gives Read.
2. Membership in `uz-schemgen` through one empty group, `Public feed readers`, and not
   through Readers or Contributors. A project-scoped feed in a private project follows the
   project's visibility, so they need to be in the project to reach `UZmiv-public` at all.
   The group is denied Read on the project's repositories, so an upgrade to Basic later
   doesn't open the code.
3. **Feed Reader** on `UZmiv-public`, given to that group.

They create their own PAT, Packaging (Read), and use it as `compose-renderer/INTEGRATION.md`
shows. If it leaks, all it reads is `UZmiv-public`; revoking it takes one click. The
organization isn't connected to Microsoft Entra, so any Microsoft account can be added and
no guest policy applies.

That only holds if no other feed in the organization is readable by everyone in it, and
`UZmiv` was. Its permissions list **Project Collection Valid Users** as Reader, marked as
inherited, so the feed settings can't remove it, and feed roles have no deny to cancel it
out. Any account added to the organization, the external one included, could read every
package on it, the UI kit among them. Hence `UZmiv-internal`: organization-scoped, created
with visibility "Specific people", so Project Collection Valid Users has no role on it
(checked through the feed permissions API, 2026-11-25), and all its views are private. The
renderers moved there on 2026-11-25: `@uz/schemgen-renderer-vue` 0.1.0 published again,
`schemgen-renderer-compose` 0.1.0 and 0.2.0 copied file for file from `UZmiv` (the copy
compared byte for byte), so `UZmiv-internal` and `UZmiv-public` hold the same build. The old
name `schemgen-compose` wasn't copied. The UI kit followed with 0.3.1 only, its latest: the
copy of its history was stopped, the missing wasm-js part was published from its repo, and
the incomplete older versions were deleted from `UZmiv-internal` again. Everything else on
`UZmiv` (older UI kit versions, its earlier name `kit`, `compose-wagon-kit`) goes with that
feed. A Project Collection Administrator deletes `UZmiv`, recycle bin included; only then
is the external account added. Deleting the feed needs Feed Owner, which a publisher doesn't have.

Pipelines that read `UZmiv-internal` need their build identity on it: Project Collection
Build Service is there as Collaborator, a project's own build service has to be added, and
publishing needs Contributor.

Rejected alternatives:

- **A dedicated reader account owned by UZ mobile** whose PAT the external team keeps in
  their CI. It's the same limit, but someone here has to own the account and renew the
  token before it expires, and their builds break on the day it does.
- **A separate Azure DevOps organization** holding only the public feed. The external
  account would never be in `UZmiv`, so nothing there could leak, but publishing would need
  a third URL and a second organization's token. It's the fallback if `UZmiv` can't be
  deleted.
- **A feed view on `UZmiv`** (restrict `@Release` to that account, promote only schemgen
  into it). It avoids a second feed, but it fails open: the account reads the whole feed
  through Project Collection Valid Users anyway.
- **A public feed.** It needs no token, but only a public project can have one, which
  publishes the renderer to everyone.
- **A zipped file-based Maven repository per release.** It needs no account or token, but
  every update is a manual hand-over.

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
