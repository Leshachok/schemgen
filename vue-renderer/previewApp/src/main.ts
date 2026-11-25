import { createApp, defineComponent, h, reactive } from "vue"
import { type Scheme, SchemeColors, SchemeMode, SchemeParser, SchemeView } from "@uz/schemgen-renderer-vue"
import SAMPLE_SCHEME from "../../../shared-fixtures/kupe.json"

/**
 * Web entry point for the "Preview" tab in web/index.html - the Vue counterpart of
 * compose-renderer's composeApp/main.kt, and the same contract. Listens for the
 * postMessage envelope sent by that page's "Send current scheme" button:
 * `{ "type": "schemgen:scheme", "payload": <scheme JSON> }`, sent as a JSON string.
 *
 * Also usable standalone: `npm run dev` and open localhost:5173 directly without
 * web/index.html - if no postMessage arrives within SAMPLE_FALLBACK_DELAY_MS,
 * shared-fixtures/kupe.json renders instead. A real postMessage always overrides it.
 */

const SAMPLE_FALLBACK_DELAY_MS = 800

const PreviewState = reactive({
    scheme: null as Scheme | null,
    status: "Waiting for a scheme from the web app's Preview tab…",
    // optional envelope fields "mode": "select" and "available": [...]; this harness
    // then plays the app and owns the selection (D46)
    mode: SchemeMode.VIEW as SchemeMode,
    available: new Set<string>(),
    selected: new Set<string>(),
    // optional envelope field "theme": "dark" - the web builder sends its page theme
    dark: false
})

/**
 * The postMessage contract from web/js/app.js's "Send current scheme" button. Returns
 * null if [raw] isn't that envelope (e.g. some other message reached the frame).
 */
function parseEnvelope(raw: string): Scheme | null {
    let root: any
    try { root = JSON.parse(raw) } catch { return null }
    if (root === null || typeof root !== "object" || root.type !== "schemgen:scheme") return null
    const payload = root.payload
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return null
    return SchemeParser.parse(payload)
}

function readInteraction(raw: string) {
    const root = JSON.parse(raw)
    PreviewState.mode = root.mode === "select" ? SchemeMode.SELECT : SchemeMode.VIEW
    PreviewState.available = new Set(Array.isArray(root.available) ? root.available.map(String) : [])
    PreviewState.selected = new Set()
    PreviewState.dark = root.theme === "dark"
}

window.addEventListener("message", ev => {
    const raw = String(ev.data)
    try {
        const scheme = parseEnvelope(raw)
        if (scheme !== null) {
            readInteraction(raw)
            PreviewState.scheme = scheme
            PreviewState.status = `Showing ${scheme.key ?? "scheme"}`
        }
        // null means the message wasn't our envelope - ignore silently,
        // other things can legitimately postMessage to this frame.
    } catch (e) {
        PreviewState.status = `Failed to parse incoming scheme: ${(e as Error).message}`
    }
})

setTimeout(() => {
    if (PreviewState.scheme === null) {
        PreviewState.scheme = SchemeParser.parse(SAMPLE_SCHEME)
        PreviewState.status = "Showing sample scheme (open via web/index.html's Preview tab to send a real one)"
    }
}, SAMPLE_FALLBACK_DELAY_MS)

const App = defineComponent(() => () => {
    const scheme = PreviewState.scheme
    if (scheme === null) return h("p", { class: "status" }, PreviewState.status)
    // the builder's card colour behind the frame, light or dark (web/css/app.css --surface)
    document.body.style.background = PreviewState.dark ? "#15171C" : "#FFFFFF"
    return h("div", [
        h("div", { style: "overflow-x:auto;padding:16px" }, [
            h(SchemeView, {
                scheme,
                mode: PreviewState.mode,
                colors: PreviewState.dark ? SchemeColors.Dark : SchemeColors.Light,
                available: PreviewState.available,
                selected: PreviewState.selected,
                onSeatClick: (seat: string) => {
                    const next = new Set(PreviewState.selected)
                    if (next.has(seat)) next.delete(seat); else next.add(seat)
                    PreviewState.selected = next
                }
            })
        ]),
        PreviewState.mode === SchemeMode.SELECT
            ? h("p", { class: "status", style: { color: PreviewState.dark ? "#A0A4AB" : "#6B7078" } },
                "selected: " + ([...PreviewState.selected].sort().join(", ") || "none"))
            : null
    ])
})

createApp(App).mount("#app")
