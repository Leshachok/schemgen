# vue-renderer

The Vue 3 renderer for schemgen (D31, D32, D53), as an npm workspace with two packages:

- **`schemgen-renderer-vue`** is the library, published as `@uz/schemgen-renderer-vue`. It
  works in any Vue 3.4+ app and in Nuxt 4 with server rendering. Its first consumer is the
  bus admin.
- **`previewApp`** is the preview harness that the Preview tab in `web/index.html` loads
  when "Vue 3 (Web)" is picked. It answers the same `postMessage` envelope as the Compose
  harness (`compose-renderer/composeApp`) and has no renderer code of its own.
- **`sampleApp`** is a sample consumer: a scheme JSON field, a Light / Dark / System theme
  switch and the preview in `view` or `select` mode, written as plain Vue single-file
  components the way a consuming team would. It's the place to see the app's side of the
  contract (parsing, theme, availability, owning the selection), not the builder's.

The library is a **file-for-file port of `compose-renderer/schemgen-renderer-compose`**
(D53): the same files, function names, constants, comments and public API. A change to one
native renderer has an obvious place in the other. When you change one, make the same change
in the other, in the same file and function. `web/js/format.js` is still canonical (CLAUDE.md):
a test runs it on every shared fixture and compares this port's geometry, validation and
seat states with it.

## Quick start

Needs Node 22.12 or newer (Vitest 5 requires it; Vite alone would take 20.19).

```
cd vue-renderer
npm install
npm test               # typecheck + Vitest (model, layout, parity with format.js, component)
npm run dev            # harness on http://localhost:5173
npm run build          # library -> schemgen-renderer-vue/dist
npm run build:preview  # harness -> previewApp/dist, deployed as vue-preview/
npm run sample         # sample app on http://localhost:5174
npm run build:sample   # vue-tsc + sample app -> sampleApp/dist
```

With the harness running, open `web/index.html` (served over http, or opened from disk).
In **Builder → Live preview** pick **Vue 3 (Web)**, and the current scheme is sent on every
edit and theme switch. The harness also works on its own: with no message within 800 ms
it draws `shared-fixtures/kupe.json`. The harness imports the library from source, so
library edits show up there without a build.

## Using it

```ts
import { SchemeParser, SchemeView, SchemeColors, SchemeMode, validate } from "@uz/schemgen-renderer-vue"

const scheme = SchemeParser.parse(jsonStringOrObject)   // throws on malformed JSON
```

```vue
<script setup lang="ts">
import { computed, ref } from "vue"
import { SchemeColors, SchemeParser, SchemeView } from "@uz/schemgen-renderer-vue"

const props = defineProps<{ json: string, available: string[], dark: boolean }>()
const scheme = computed(() => SchemeParser.parse(props.json))
const selected = ref(new Set<string>())

// the app owns the selection (D46): the renderer only reports taps
function toggle(seat: string) {
  const next = new Set(selected.value)
  next.has(seat) ? next.delete(seat) : next.add(seat)
  selected.value = next
}
</script>

<template>
  <div style="overflow-x: auto">
    <SchemeView
      :scheme="scheme"
      mode="select"
      :available="available"
      :selected="selected"
      :colors="dark ? SchemeColors.Dark : SchemeColors.Light"
      @seat-click="toggle"
    />
  </div>
</template>
```

| Prop | Type | Default | |
|---|---|---|---|
| `scheme` | `Scheme` | required | from `SchemeParser.parse`. A raw JSON object is rejected with a Vue warning. |
| `mode` | `"view"` \| `"select"` | `"view"` | `SchemeMode.VIEW` / `SchemeMode.SELECT` (D45) |
| `available` | `Set<string>` or `string[]` | empty | seats that can be picked, `select` only |
| `selected` | `Set<string>` or `string[]` | empty | owned by the app (D46) |
| `colors` | `SchemeColors` | `SchemeColors.Light` | colours only, never sizes (D34). Any CSS colour: `{ ...SchemeColors.Light, seat: "#123456" }` |
| `@seat-click` | `(seat: string)` | | a tap or Enter/Space on an available or selected seat, `select` only |

Like Compose's `SchemeView`, it draws one SVG per deck at a fixed size (CSS px = Compose dp)
and doesn't scroll or pad itself, so put it in an `overflow-x: auto` box. `class` and
`style` land on its root element. Seat numbers use the page's font.

**Nuxt 4.** Nothing to configure: it's plain ESM with no CSS and no browser globals, so it
renders on the server. Import it where it's used, as above, or register it once:

```ts
// app/plugins/schemgen.ts
import { SchemeView } from "@uz/schemgen-renderer-vue"
export default defineNuxtPlugin(nuxtApp => { nuxtApp.vueApp.component("SchemeView", SchemeView) })
```

**Without Vue.** `@uz/schemgen-renderer-vue/core` exports the model, parser, `validate` and
`SchemeMode` with no Vue import, for a consumer that draws schemes itself (the web sales
site, D49).

## Module map

Each file is the port of the Compose file with the same name. The public/internal split is
also the same: `src/index.ts` exports exactly what Kotlin makes public.

```
schemgen-renderer-vue/src/
  model/Scheme.ts          public: classes mirroring the JSON format 1:1, Vocabulary
  model/SchemeParser.ts    public: hand-written parser, with kotlinx's leniency
  layout/SeatState.ts      public SchemeMode; internal seat state rule (D45)
  layout/Validate.ts       public: structural validation, same rules and texts as format.js
  layout/Layout.ts         internal: layout math (T, itemBoxes, seatAt)
  render/SchemeCanvas.ts   public SchemeView component (Compose: SchemeCanvas.kt)
  render/SchemeColors.ts   public theme, colors only (D34), Light and Dark
  render/Icons.ts          internal: element art, generated by web/tools/figma_icons.py
  core.ts, index.ts        the two entry points
schemgen-renderer-vue/test/
  SchemeParser.test.ts     the Compose commonTest suite, test for test
  formatJs.test.ts         runs web/js/format.js and compares on every shared fixture
  SchemeView.test.ts       SSR, colours, taps, keyboard
previewApp/src/main.ts     harness entry point + postMessage listener (Compose: main.kt)
sampleApp/src/App.vue      sample consumer: JSON field, theme switch, view/select, selection
```

How it translates, so the next port is mechanical:

| Kotlin / Compose | TypeScript / Vue |
|---|---|
| `data class` | `class` with `readonly` constructor fields, same order and defaults |
| `sealed interface Item`, `is SeatItem` | `type Item = SeatItem \| StructuralItem`, `instanceof SeatItem` |
| `enum class SchemeMode { VIEW, SELECT }` | `SchemeMode.VIEW` = `"view"` (format.js's values) |
| `mapOf(...)`, `x in list` | `new Map(...)`, `isIn(x, list)` |
| `DrawScope.drawSeat(...)` painting a Canvas | `drawSeat(s, ...)` pushing SVG nodes onto `s` |
| `drawRoundRect` fill + stroke | one `<rect>` with `fill` and `stroke` |
| `detectTapGestures` + `seatAt` | an SVG `click` + the same `seatAt` |
| `onSeatClick: (String) -> Unit` | `@seat-click` / `onSeatClick` |
| `internal` | not exported from `index.ts` |

What only this renderer has, because SVG gives it for free: every seat gets its own
accessibility label (worded like `render.js`), and a tappable seat is a focusable button
that Enter and Space toggle.

## Publishing

`@uz/schemgen-renderer-vue` goes to the same two Azure Artifacts feeds as the Compose library,
`UZmiv-internal` and `UZmiv-public` (`build.md`). A feed holds npm packages next to Maven
ones. Nothing new goes to the old `UZmiv` feed, which every account in the organization can
read; 0.1.0 is there too, from before `UZmiv-internal` existed.

| Version | `UZmiv-internal` | `UZmiv-public` |
|---|---|---|
| 0.1.0 | 2026-11-25 | not yet |

```
cd vue-renderer/schemgen-renderer-vue
# bump "version" in package.json first - a feed refuses a version twice
npm publish --registry https://pkgs.dev.azure.com/UZmiv/_packaging/UZmiv-internal/npm/registry/
npm publish --registry https://pkgs.dev.azure.com/UZmiv/uz-schemgen/_packaging/UZmiv-public/npm/registry/
```

`prepublishOnly` typechecks, runs the tests and builds `dist/` first. Authentication is a
PAT with **Packaging (Read & write)** in your user `~/.npmrc`, never in the repo, as Azure's
"Connect to feed → npm" page shows. Consumers map the scope in their project `.npmrc`:

```
@uz:registry=https://pkgs.dev.azure.com/UZmiv/_packaging/UZmiv-internal/npm/registry/
```

(external teams: the `UZmiv-public` URL), with their read token in their user `~/.npmrc`.
`vue` is a peer dependency, so the consumer's own Vue is used.
