# Consuming `schemgen-renderer-compose`

How another project depends on the Compose renderer, and a step-by-step hand-off for
wiring it into the web admin panel (`miv-multiplatform`). The second half is written so
an agent working in that repo can follow it without reading this one.

## The library

| | |
|---|---|
| Coordinates | `ua.gov.uz:schemgen-renderer-compose` |
| Feed | Azure Artifacts. Internal: `https://pkgs.dev.azure.com/UZmiv/_packaging/UZmiv/maven/v1`, the same one `ua.gov.uz:compose-ui-kit` comes from. External teams: `https://pkgs.dev.azure.com/UZmiv/uz-schemgen/_packaging/UZmiv-public/maven/v1`, see below |
| Targets | Android, iosArm64, iosSimulatorArm64, wasmJs |
| Built with | Kotlin 2.4.10, Compose Multiplatform 1.11.1. Consumers on these or newer are fine |
| Transitive API | `kotlinx-serialization-json`, because `SchemeParser.parse(JsonObject)` is public |

`ua.gov.uz:schemgen-compose` 0.1.0, also on the feed, is the same code published under the
earlier name. Don't depend on it; it gets no further versions.

It's published the same way as `uz-compose-ui-kit`: the vanniktech plugin, the same feed,
the same credential lookup (`azureUser`/`azureToken` Gradle properties or
`AZURE_ARTIFACTS_USER`/`SYSTEM_ACCESSTOKEN` env vars). Every version also goes to
`UZmiv-public`. See `build.md` for how to release.

### Outside the UZmiv teams

You get an Azure DevOps account with read access to the `UZmiv-public` feed only. Create a
Personal Access Token with the **Packaging (Read)** scope, then:

```kotlin
// settings.gradle.kts
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven {
            name = "UZmivPublic"
            url = uri("https://pkgs.dev.azure.com/UZmiv/uz-schemgen/_packaging/UZmiv-public/maven/v1")
            credentials(PasswordCredentials::class)  // UZmivPublicUsername / UZmivPublicPassword
        }
    }
}
```

and in `~/.gradle/gradle.properties` (not in the project):

```properties
UZmivPublicUsername=any-non-empty-string
UZmivPublicPassword=<the PAT>
```

The library's own dependencies (Compose, kotlinx-serialization) come from `google()` and
`mavenCentral()`; nothing else is needed from UZmiv.

### Public API (0.2.0)

```kotlin
import ua.gov.uz.schemgen.model.SchemeParser   // String or JsonObject -> Scheme
import ua.gov.uz.schemgen.model.Scheme         // + Deck, Column, SeatItem, StructuralItem, Span, Vocabulary
import ua.gov.uz.schemgen.layout.SchemeMode    // VIEW | SELECT
import ua.gov.uz.schemgen.layout.validate      // Scheme -> List<Message>, same rules as web/js/format.js
import ua.gov.uz.schemgen.layout.Level         // ERROR | WARN | OK
import ua.gov.uz.schemgen.render.SchemeView    // the composable
import ua.gov.uz.schemgen.render.SchemeColors  // theme: colors only (D34)

@Composable
fun SchemeView(
    scheme: Scheme,
    modifier: Modifier = Modifier,
    mode: SchemeMode = SchemeMode.VIEW,
    available: Set<String> = emptySet(),   // SELECT only: seats that can be picked
    selected: Set<String> = emptySet(),    // owned by the app (D46)
    colors: SchemeColors = SchemeColors.Light,  // or SchemeColors.Dark
    onSeatClick: (String) -> Unit = {},    // SELECT only: reports the tapped seat number
)
```

Rules a consumer needs to know:

- **`SchemeParser.parse` throws** on JSON that isn't an object or has the wrong shape
  (for example `decks` items that aren't objects). Wrap it in `runCatching`. A scheme can
  parse and still be invalid: `validate()` says why.
- **The renderer doesn't scroll by itself.** Each deck is drawn at a fixed size from the
  layout, and a 34-seat купе is about 1,100 dp wide. Put `Modifier.horizontalScroll(...)`
  on it. Don't add `verticalScroll` inside a screen that already scrolls vertically:
  nesting two vertical scrolls crashes Compose.
- **The renderer never changes `selected`.** In SELECT mode it calls `onSeatClick`, and
  the app updates its own set and passes it back.
- **Seat numbers are opaque strings.** Don't sort or derive anything from them.
- **No colours or sizes in the scheme.** Only `colors` changes appearance.
- **Light and dark come from the guidelines file** (D50). Pass `SchemeColors.Dark` when the
  host screen is dark; copy either one to change single colours.
- **The API is 0.x.** Expect breaks while the format settles; each one is listed below.

### Changes in 0.2.0 (guidelines file, D50–D52)

Breaking:
- `SchemeColors` was reshaped around the guidelines' colour roles: `line` and `marker` and
  `folding` are new; `unknownBorder` and `iconLabel` are gone. `SchemeColors()` is
  `SchemeColors.Light`. A consumer that only passed the default needs no change.
- `SeatItem.inclusive` is gone — there are no inclusive seats; the outlined seat is
  `kind: "folding"`. `StructuralItem.hasExplicitSpan` is gone too.
- `Vocabulary.ONE_CELL_TYPES` and `CHAIR_DEFAULT_FACING` are gone; `chair` and `half_table`
  are no longer known types (`half_table` is now `small_table`).

Look and layout: the guidelines' sizes (berth 40×38, rows 50 apart, facility blocks at
least 56 wide), real art for every element, icons at a fixed size, the seat-back bracket
at 50%. Every non-seat item can be resized, except a partition, which grows only in
length. Validation warns when a facility is shorter than its minimum rows.

### Trying a local build before it's on the feed

```
cd compose-renderer
./gradlew :schemgen-renderer-compose:publishToMavenLocal
```

Any consumer that lists `mavenLocal()` in its repositories (miv-multiplatform does) then
resolves the version from `~/.m2`. **Remove the local copy afterwards**
(`rm -rf ~/.m2/repository/ua/gov/uz/schemgen-renderer-compose*`). Otherwise the consumer keeps using
it and never notices whether the feed has the version.

---

## Hand-off: scheme preview in miv-multiplatform

**Goal.** The admin panel's Mockups (Схеми) create and edit screens already store a scheme
as JSON (`Mockup.scheme: JsonObject?`, edited as text in `MockupSchemeField`). Under the
JSON field, add a read-only preview drawn by `schemgen-renderer-compose`. It's for trying the
renderer on a handful of real schemes in the web panel. Nothing else changes: no
selection, no new API calls, no saving.

**This exact change has been compiled** against `0.1.0` from mavenLocal on 2026-10-06
(`:shared:compileKotlinWasmJs` and `:shared:compileAndroidMain` pass). It hasn't been
clicked through in a running panel yet. That's step 6.

### Before you start

- Read `miv-multiplatform/CLAUDE.md`. Its conventions apply: strings in `strings.xml`,
  shared components from the UI kit, no tests in that repo (verify by compiling and
  running the web target).
- Check that `ua.gov.uz:schemgen-renderer-compose:0.2.0` is on the feed (or in `~/.m2`, see above).
  No repository changes are needed: `settings.gradle.kts` already points at the UZmiv
  feed with the right credentials. If resolution fails with 401, the credentials are
  missing, not the repo.
- miv is on Kotlin 2.4.20 / Compose 1.12.0. That's newer than the library, which is the
  safe direction. Don't downgrade anything in miv for this.

### 1. Version catalog: `gradle/libs.versions.toml`

Next to the existing UI kit entries:

```toml
[versions]
uz-schemgen-renderer-compose = "0.2.0"

[libraries]
uz-schemgen-renderer-compose = { module = "ua.gov.uz:schemgen-renderer-compose", version.ref = "uz-schemgen-renderer-compose" }
```

### 2. Dependency: `shared/build.gradle.kts`

In `commonMain.dependencies`, under the UI kit:

```kotlin
// ui kit
implementation(libs.uz.compose.ui.kit)
// seat scheme renderer (uz-schemgen)
implementation(libs.uz.schemgen.renderer.compose)
```

### 3. Strings: `shared/src/commonMain/composeResources/values/strings.xml`

Put these next to the other `create_mockup_screen_scheme_*` strings, not at the end of the file:

```xml
<string name="create_mockup_screen_scheme_preview">Попередній перегляд схеми</string>
<string name="create_mockup_screen_scheme_preview_unreadable">Схему не вдалося відобразити</string>
```

### 4. New component: `presentation/ui/main/mainline/mockups/component/MockupSchemePreview.kt`

It derives the preview from the text that's already in screen state, so the ViewModels
don't change. It shows nothing while the text is blank or not yet valid JSON, because
`MockupSchemeField` already shows those errors. Validator errors go under the drawing.

```kotlin
package ua.gov.uz.miv.presentation.ui.main.mainline.mockups.component

import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import mivkmp.shared.generated.resources.Res
import mivkmp.shared.generated.resources.create_mockup_screen_scheme_preview
import mivkmp.shared.generated.resources.create_mockup_screen_scheme_preview_unreadable
import org.jetbrains.compose.resources.stringResource
import ua.gov.uz.miv.presentation.util.JsonObjectInput
import ua.gov.uz.miv.presentation.util.parseJsonObjectInput
import ua.gov.uz.schemgen.layout.Level
import ua.gov.uz.schemgen.layout.validate
import ua.gov.uz.schemgen.model.Scheme
import ua.gov.uz.schemgen.model.SchemeParser
import ua.gov.uz.schemgen.render.SchemeView

private sealed interface SchemePreview {
    data object None : SchemePreview
    data object Unreadable : SchemePreview
    data class Ready(val scheme: Scheme, val errors: List<String>) : SchemePreview
}

private fun String.toSchemePreview(): SchemePreview {
    val json = (parseJsonObjectInput() as? JsonObjectInput.Valid)?.value ?: return SchemePreview.None
    val scheme = runCatching { SchemeParser.parse(json) }.getOrNull() ?: return SchemePreview.Unreadable
    if (scheme.decks.isEmpty()) return SchemePreview.Unreadable
    val errors = validate(scheme).filter { it.level == Level.ERROR }.map { it.text }
    return SchemePreview.Ready(scheme, errors)
}

/** Read-only render of the scheme JSON being edited; nothing while the text isn't a valid JSON object. */
@Composable
fun MockupSchemePreview(text: String, modifier: Modifier = Modifier) {
    val preview = remember(text) { text.toSchemePreview() }
    if (preview == SchemePreview.None) return
    Column(modifier = modifier) {
        Text(
            text = stringResource(Res.string.create_mockup_screen_scheme_preview),
            style = MaterialTheme.typography.labelLarge,
        )
        Spacer(modifier = Modifier.height(8.dp))
        when (preview) {
            SchemePreview.None -> Unit
            SchemePreview.Unreadable -> Text(
                text = stringResource(Res.string.create_mockup_screen_scheme_preview_unreadable),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
            )
            is SchemePreview.Ready -> {
                SchemeView(
                    scheme = preview.scheme,
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(8.dp))
                        .horizontalScroll(rememberScrollState())
                        .padding(12.dp),
                )
                // validator messages are English, straight from the spec's rules
                preview.errors.forEach {
                    Text(text = it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}
```

Keep `horizontalScroll` and don't add `verticalScroll`. Both screens already scroll
vertically ("fixed scrolling in mockups", c1336b12), and a nested vertical scroll crashes.

### 5. Use it in both screens

In `mockups/create/CreateMockupScreen.kt` and `mockups/edit/EditMockupScreen.kt`, right
after the `MockupSchemeField(...)` call:

```kotlin
Spacer(modifier = Modifier.height(16.dp))
MockupSchemePreview(text = state.scheme, modifier = Modifier.fillMaxWidth())
```

and import
`ua.gov.uz.miv.presentation.ui.main.mainline.mockups.component.MockupSchemePreview`.

### 6. Verify

```
./gradlew :shared:compileKotlinWasmJs
./gradlew :shared:compileAndroidMain
./gradlew wasmJsBrowserDevelopmentRun
```

In the running panel, open a mockup (Схеми → edit) and paste a sample scheme into the
JSON field. Samples are in `uz-schemgen/shared-fixtures/`: `kupe.json`, `platskart.json`
and a bus. Check:

- the wagon draws under the field and scrolls sideways; the page still scrolls vertically;
- typing broken JSON hides the preview and shows the field's own error;
- `shared-fixtures/broken.json` draws and lists validator errors in red;
- an existing mockup that has a scheme shows it as soon as the edit screen opens.

### Don't

- Don't copy the renderer's code into miv, or fork it. Fixes go into `uz-schemgen`, get a
  new version, and miv bumps `uz-schemgen-renderer-compose`.
- Don't add colours or sizes to the scheme JSON to change the look. Pass `colors =
  SchemeColors.Dark` (or a copy of either palette) if the panel needs different colours.
- Don't put `Scheme` (a library type) into domain models or DTOs. The domain keeps
  `JsonObject`, and parsing happens at the UI edge, as above.
