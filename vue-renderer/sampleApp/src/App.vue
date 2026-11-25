<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch, watchEffect } from "vue"
import {
    type Message, type Scheme, SchemeColors, SchemeMode, SchemeParser, SchemeView, SeatItem, validate
} from "@uz/schemgen-renderer-vue"

/*
 * A sample consumer of @uz/schemgen-renderer-vue: paste scheme JSON, pick a theme and a
 * mode, and tap seats. Everything outside <SchemeView> is the app's job, as it would be in
 * the bus admin: parsing input, the theme switch, which seats are available, and the
 * selection itself (D46) - the renderer only reports taps.
 */

// ---- sample schemes: the shared fixtures every renderer is tested on ----

const fixtures = import.meta.glob<object>("../../../shared-fixtures/*.json", { eager: true, import: "default" })
const SAMPLES = Object.entries(fixtures)
    .map(([path, json]) => ({ name: path.slice(path.lastIndexOf("/") + 1, -".json".length), text: JSON.stringify(json, null, 2) }))
    .sort((a, b) => (a.name === "kupe" ? -1 : b.name === "kupe" ? 1 : a.name.localeCompare(b.name)))

// ---- theme: colors only (D34); the app picks Light or Dark to match its own page ----

type ThemeChoice = "system" | "light" | "dark"
const themeChoice = ref<ThemeChoice>("system")
const media = window.matchMedia("(prefers-color-scheme: dark)")
const systemDark = ref(media.matches)
const onSystemChange = (e: MediaQueryListEvent) => { systemDark.value = e.matches }
media.addEventListener("change", onSystemChange)
onBeforeUnmount(() => media.removeEventListener("change", onSystemChange))

const dark = computed(() => themeChoice.value === "dark" || (themeChoice.value === "system" && systemDark.value))
const colors = computed(() => (dark.value ? SchemeColors.Dark : SchemeColors.Light))
watchEffect(() => { document.documentElement.dataset.theme = dark.value ? "dark" : "light" })

// ---- JSON field: the last scheme that parsed stays on screen while the text is broken ----

const sample = ref(SAMPLES[0]?.name ?? "")
const text = ref(SAMPLES[0]?.text ?? "")
watch(sample, name => {
    const s = SAMPLES.find(it => it.name === name)
    if (s) text.value = s.text
})

const parseError = ref<string | null>(null)
const scheme = shallowRef<Scheme | null>(null)
watch(text, value => {
    try {
        scheme.value = SchemeParser.parse(value)
        parseError.value = null
    } catch (e) {
        parseError.value = (e as Error).message
    }
}, { immediate: true })

const messages = computed<Message[]>(() => (scheme.value ? validate(scheme.value) : []))

function formatJson() {
    try { text.value = JSON.stringify(JSON.parse(text.value), null, 2) } catch { /* parseError already says why */ }
}

// ---- mode, availability and selection: runtime input, never part of the scheme (D45) ----

const mode = ref<SchemeMode>(SchemeMode.VIEW)

/** Every seat number in the scheme, in drawing order. Opaque strings - never sorted. */
const seats = computed(() => scheme.value?.decks.flatMap(d => d.columns.flatMap(c =>
    c.items.filter((it): it is SeatItem => it instanceof SeatItem).map(it => it.seat))) ?? [])

// kept as the unavailable ones, so seats added while editing the JSON start out available
const unavailableText = ref("")
const unavailable = computed(() => new Set(unavailableText.value.split(/[\s,]+/).filter(Boolean)))
const available = computed(() => new Set(seats.value.filter(s => !unavailable.value.has(s))))

function allAvailable() { unavailableText.value = "" }
function randomAvailability() {
    unavailableText.value = seats.value.filter(() => Math.random() < 0.4).join(", ")
}

const selected = ref<Set<string>>(new Set())
function toggle(seat: string) {
    const next = new Set(selected.value)
    if (next.has(seat)) next.delete(seat); else next.add(seat)
    selected.value = next
}
// a seat that stops being available drops out of the selection
watch(available, av => {
    if ([...selected.value].some(s => !av.has(s))) {
        selected.value = new Set([...selected.value].filter(s => av.has(s)))
    }
})
</script>

<template>
  <header class="topbar">
    <div class="brand">schemgen <span>Vue sample</span></div>
    <div class="spacer"></div>
    <div class="seg" role="group" aria-label="Theme">
      <button v-for="t in (['system', 'light', 'dark'] as const)" :key="t"
              :aria-pressed="themeChoice === t" @click="themeChoice = t">
        {{ t[0]!.toUpperCase() + t.slice(1) }}
      </button>
    </div>
  </header>

  <main class="layout">
    <section class="card editor">
      <div class="card-head">
        <h2>Scheme JSON</h2>
        <div class="spacer"></div>
        <label class="field-inline">
          Sample
          <select v-model="sample">
            <option v-for="s in SAMPLES" :key="s.name" :value="s.name">{{ s.name }}</option>
          </select>
        </label>
        <button class="btn" :disabled="parseError !== null" @click="formatJson">Format</button>
      </div>
      <textarea v-model="text" class="json" spellcheck="false" autocomplete="off"
                aria-label="Scheme JSON"></textarea>
      <ul class="messages">
        <li v-if="parseError" class="msg error">Can't parse: {{ parseError }}<template v-if="scheme">
          — showing the last scheme that parsed.</template></li>
        <li v-for="(m, i) in messages" :key="i" class="msg" :class="m.level">{{ m.text }}</li>
      </ul>
    </section>

    <section class="card preview">
      <div class="card-head">
        <h2>Preview</h2>
        <span v-if="scheme?.key" class="key">{{ scheme.key }}</span>
        <div class="spacer"></div>
        <div class="seg" role="group" aria-label="Mode">
          <button :aria-pressed="mode === SchemeMode.VIEW" @click="mode = SchemeMode.VIEW">View</button>
          <button :aria-pressed="mode === SchemeMode.SELECT" @click="mode = SchemeMode.SELECT">Select</button>
        </div>
      </div>

      <div v-if="mode === SchemeMode.SELECT" class="controls">
        <label class="field">
          <span>Unavailable seats</span>
          <input v-model="unavailableText" type="text" placeholder="e.g. 3, 4, 17" spellcheck="false">
        </label>
        <button class="btn" @click="allAvailable">All available</button>
        <button class="btn" @click="randomAvailability">Random</button>
      </div>

      <div class="canvas">
        <SchemeView v-if="scheme" :scheme="scheme" :mode="mode" :colors="colors"
                    :available="available" :selected="selected" @seat-click="toggle" />
        <p v-else class="empty">Paste a scheme on the left.</p>
      </div>

      <div v-if="mode === SchemeMode.SELECT" class="selection">
        <span class="label">Selected</span>
        <span v-if="selected.size === 0" class="none">none — tap an available seat</span>
        <span v-for="s in selected" :key="s" class="chip">{{ s }}</span>
        <div class="spacer"></div>
        <button v-if="selected.size" class="btn" @click="selected = new Set()">Clear</button>
      </div>
      <p v-else class="hint">View mode: every seat looks available and nothing is tappable.</p>
    </section>
  </main>
</template>
