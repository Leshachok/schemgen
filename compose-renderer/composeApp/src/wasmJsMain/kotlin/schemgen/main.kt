package schemgen

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.ComposeViewport
import kotlin.js.ExperimentalWasmJsInterop
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import schemgen.layout.SchemeMode
import schemgen.model.Scheme
import schemgen.model.SchemeParser
import schemgen.render.SchemeView

/**
 * Web entry point for the "Preview" tab in web/index.html. Listens for the
 * postMessage envelope sent by that page's "Send current scheme" button:
 * `{ "type": "schemgen:scheme", "payload": <scheme JSON> }`, sent as a JSON
 * string (not a structured object - simpler across the Wasm/JS boundary).
 *
 * Also usable standalone: `./gradlew wasmJsBrowserDevelopmentRun` and open
 * localhost:8080 directly without web/index.html - if no postMessage arrives
 * within SAMPLE_FALLBACK_DELAY_MS, [SAMPLE_SCHEME] renders instead so there's
 * something on screen immediately. A real postMessage always overrides it.
 */

@OptIn(ExperimentalWasmJsInterop::class)
@JsFun("(cb) => { window.addEventListener('message', (ev) => cb(String(ev.data))); }")
private external fun registerMessageListener(callback: (String) -> Unit)

private const val SAMPLE_FALLBACK_DELAY_MS = 800L

/** shared-fixtures/kupe.json, inlined so the standalone fallback needs no fetch. */
private const val SAMPLE_SCHEME = """{"key":"KUP-34","rev":1,"decks":[{"rows":3,"columns":[{"items":[{"type":"wc","row":1,"span":{"rows":2}}]},{"items":[{"type":"separator","row":1,"span":{"rows":2}}]},{"items":[{"seat":"3","kind":"sleep","berth":"upper","row":1},{"seat":"1","kind":"sleep","berth":"lower","row":2}]},{"items":[{"seat":"4","kind":"sleep","berth":"upper","row":1},{"seat":"2","kind":"sleep","berth":"lower","row":2}]},{"items":[{"type":"separator","row":1,"span":{"rows":2}}]},{"items":[{"seat":"7","kind":"sleep","berth":"upper","row":1},{"seat":"5","kind":"sleep","berth":"lower","row":2}]},{"items":[{"seat":"8","kind":"sleep","berth":"upper","row":1},{"seat":"6","kind":"sleep","berth":"lower","row":2}]},{"items":[{"type":"separator","row":1,"span":{"rows":2}}]},{"items":[{"seat":"11","kind":"sleep","berth":"upper","row":1},{"seat":"9","kind":"sleep","berth":"lower","row":2}]},{"items":[{"seat":"12","kind":"sleep","berth":"upper","row":1},{"seat":"10","kind":"sleep","berth":"lower","row":2}]},{"items":[{"type":"separator","row":1,"span":{"rows":2}}]},{"items":[{"seat":"15","kind":"sleep","berth":"upper","row":1},{"seat":"13","kind":"sleep","berth":"lower","row":2}]},{"items":[{"seat":"16","kind":"sleep","berth":"upper","row":1},{"seat":"14","kind":"sleep","berth":"lower","row":2}]},{"items":[{"type":"separator","row":1,"span":{"rows":2}}]},{"items":[{"seat":"19","kind":"sleep","berth":"upper","row":1},{"seat":"17","kind":"sleep","berth":"lower","row":2}]},{"items":[{"seat":"20","kind":"sleep","berth":"upper","row":1},{"seat":"18","kind":"sleep","berth":"lower","row":2}]},{"items":[{"type":"separator","row":1,"span":{"rows":2}}]},{"items":[{"seat":"23","kind":"sleep","berth":"upper","row":1},{"seat":"21","kind":"sleep","berth":"lower","row":2}]},{"items":[{"seat":"24","kind":"sleep","berth":"upper","row":1},{"seat":"22","kind":"sleep","berth":"lower","row":2}]},{"items":[{"type":"separator","row":1,"span":{"rows":2}}]},{"items":[{"seat":"27","kind":"sleep","berth":"upper","row":1},{"seat":"25","kind":"sleep","berth":"lower","row":2}]},{"items":[{"seat":"28","kind":"sleep","berth":"upper","row":1},{"seat":"26","kind":"sleep","berth":"lower","row":2}]},{"items":[{"type":"separator","row":1,"span":{"rows":2}}]},{"items":[{"seat":"31","kind":"sleep","berth":"upper","row":1},{"seat":"29","kind":"sleep","berth":"lower","row":2}]},{"items":[{"seat":"32","kind":"sleep","berth":"upper","row":1},{"seat":"30","kind":"sleep","berth":"lower","row":2}]},{"items":[{"type":"separator","row":1,"span":{"rows":2}}]},{"items":[{"seat":"33","kind":"sleep","berth":"lower","row":1,"inclusive":true,"span":{"rows":2}}]},{"items":[{"seat":"34","kind":"sleep","berth":"lower","row":1,"inclusive":true,"span":{"rows":2}}]},{"items":[{"type":"inclusive","row":1,"span":{"rows":2}}]},{"items":[{"type":"separator","row":1,"span":{"rows":2}}]},{"items":[{"type":"luggage","row":1,"span":{"rows":2}}]}]}]}"""

private object PreviewState {
    var scheme: Scheme? by mutableStateOf(null)
    var status: String by mutableStateOf("Waiting for a scheme from the web app's Preview tab…")
    // optional envelope fields "mode": "select" and "available": [...]; this harness
    // then plays the app and owns the selection (D46)
    var mode: SchemeMode by mutableStateOf(SchemeMode.VIEW)
    var available: Set<String> by mutableStateOf(emptySet())
    var selected: Set<String> by mutableStateOf(emptySet())
}

private fun readInteraction(raw: String) {
    val root = runCatching { Json.parseToJsonElement(raw).jsonObject }.getOrNull() ?: return
    PreviewState.mode =
        if (root["mode"]?.jsonPrimitive?.contentOrNull == "select") SchemeMode.SELECT else SchemeMode.VIEW
    PreviewState.available = (root["available"] as? JsonArray)
        ?.mapNotNull { it.jsonPrimitive.contentOrNull }?.toSet() ?: emptySet()
    PreviewState.selected = emptySet()
}

@OptIn(ExperimentalComposeUiApi::class)
fun main() {
    registerMessageListener { raw ->
        val parsed = runCatching { SchemeParser.parseEnvelope(raw) }
        parsed.onSuccess { scheme ->
            if (scheme != null) {
                readInteraction(raw)
                PreviewState.scheme = scheme
                PreviewState.status = "Showing ${scheme.key ?: "scheme"}"
            }
            // scheme == null means the message wasn't our envelope - ignore silently,
            // other things can legitimately postMessage to this frame.
        }.onFailure { e ->
            PreviewState.status = "Failed to parse incoming scheme: ${e.message}"
        }
    }

    ComposeViewport(viewportContainerId = "webApp") {
        App()
    }
}

@Composable
private fun App() {
    LaunchedEffect(Unit) {
        delay(SAMPLE_FALLBACK_DELAY_MS)
        if (PreviewState.scheme == null) {
            PreviewState.scheme = SchemeParser.parse(SAMPLE_SCHEME)
            PreviewState.status = "Showing sample scheme (open via web/index.html's Preview tab to send a real one)"
        }
    }
    MaterialTheme {
        val scheme = PreviewState.scheme
        if (scheme == null) {
            Column(modifier = Modifier.padding(12.dp)) {
                Text(PreviewState.status, style = MaterialTheme.typography.bodySmall)
            }
        } else {
            Column {
                SchemeView(
                    scheme,
                    mode = PreviewState.mode,
                    available = PreviewState.available,
                    selected = PreviewState.selected,
                    onSeatClick = { seat ->
                        PreviewState.selected =
                            if (seat in PreviewState.selected) PreviewState.selected - seat
                            else PreviewState.selected + seat
                    }
                )
                if (PreviewState.mode == SchemeMode.SELECT) {
                    Text(
                        "selected: " + PreviewState.selected.sorted().joinToString(", ").ifEmpty { "none" },
                        modifier = Modifier.padding(horizontal = 16.dp),
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }
    }
}
