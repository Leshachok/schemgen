package ua.gov.uz.schemgen.sample

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import ua.gov.uz.schemgen.layout.Level
import ua.gov.uz.schemgen.layout.Message
import ua.gov.uz.schemgen.layout.SchemeMode
import ua.gov.uz.schemgen.layout.validate
import ua.gov.uz.schemgen.model.Scheme
import ua.gov.uz.schemgen.model.SchemeParser
import ua.gov.uz.schemgen.model.SeatItem
import kotlin.random.Random

/*
 * The app's side of the contract, shared by both screens: the wagon list, the mode, which
 * seats are available and the selection. As in vue-renderer/sampleApp, everything here is
 * the app's job - the renderer only draws and reports taps (D45, D46).
 */

/** One entry of the web builder's sample list (assets/samples.json, see export-samples.mjs). */
class Sample(val label: String, val scheme: Scheme)

object Samples {
    fun load(context: Context): List<Sample> {
        val text = context.assets.open("samples.json").bufferedReader().use { it.readText() }
        return Json.parseToJsonElement(text).jsonArray.map { el ->
            val o = el.jsonObject
            Sample(o.getValue("label").jsonPrimitive.content, SchemeParser.parse(o.getValue("scheme").jsonObject))
        }
    }
}

/** A wagon in the list. [available] is runtime input, never part of the scheme (D45). */
class Wagon(
    val id: Long,
    val label: String,
    val scheme: Scheme,
    /** Every seat number, in drawing order. Opaque strings - never sorted. */
    val seats: List<String>,
    val messages: List<Message>,
    val available: Set<String>,
) {
    fun copy(available: Set<String>) = Wagon(id, label, scheme, seats, messages, available)

    val summary: String get() = "${scheme.key ?: "no key"} · ${seats.size} seats"

    /** Validation errors and warnings, one per line, or null when there are none. */
    val problems: String?
        get() = messages.filter { it.level != Level.OK }
            .joinToString("\n") { (if (it.level == Level.ERROR) "Error: " else "Warning: ") + it.text }
            .ifEmpty { null }
}

fun selectionText(selected: Set<String>): String =
    if (selected.isEmpty()) "Selected: none, tap an available seat" else "Selected: " + selected.joinToString(", ")

data class UiState(
    val wagons: List<Wagon> = emptyList(),
    val mode: SchemeMode = SchemeMode.VIEW,
    /** Selection per wagon id. The app owns it; a tap only reports the seat (D46). */
    val selected: Map<Long, Set<String>> = emptyMap(),
)

enum class Screen { VIEWS, COMPOSE }

class WagonsViewModel(app: Application) : AndroidViewModel(app) {
    val samples: List<Sample> = Samples.load(app)
    private var nextId = 1L

    private val _state = MutableStateFlow(UiState(wagons = samples.map { wagonOf(it.label, it.scheme) }))
    val state: StateFlow<UiState> = _state

    /** Which screen is shown; kept here so it survives the recreation a theme switch causes. */
    var screen = Screen.VIEWS

    fun add(sample: Sample) = append(listOf(wagonOf(sample.label, sample.scheme)))

    fun addRandom(count: Int) = append(List(count) { samples.random().let { wagonOf(it.label, it.scheme) } })

    /** Throws when [text] isn't a JSON object; the caller shows why. */
    fun addJson(text: String) {
        val scheme = SchemeParser.parse(text)
        append(listOf(wagonOf(scheme.key ?: "Pasted scheme", scheme)))
    }

    fun clear() = _state.update { UiState(mode = it.mode) }

    fun setMode(mode: SchemeMode) = _state.update { it.copy(mode = mode) }

    fun toggle(wagonId: Long, seat: String) = _state.update { st ->
        val current = st.selected[wagonId].orEmpty()
        st.copy(selected = st.selected + (wagonId to if (seat in current) current - seat else current + seat))
    }

    fun clearSelection() = _state.update { it.copy(selected = emptyMap()) }

    fun allAvailable() = setAvailability { it.toSet() }

    fun randomAvailability() = setAvailability { seats -> seats.filterTo(mutableSetOf()) { Random.nextFloat() >= 0.4f } }

    private fun setAvailability(pick: (List<String>) -> Set<String>) = _state.update { st ->
        val wagons = st.wagons.map { it.copy(available = pick(it.seats)) }
        val available = wagons.associate { it.id to it.available }
        // a seat that stops being available drops out of the selection
        st.copy(
            wagons = wagons,
            selected = st.selected.mapValues { (id, sel) -> sel.filterTo(mutableSetOf()) { it in available[id].orEmpty() } }
        )
    }

    private fun append(wagons: List<Wagon>) = _state.update { it.copy(wagons = it.wagons + wagons) }

    private fun wagonOf(label: String, scheme: Scheme): Wagon {
        val seats = scheme.decks.flatMap { d -> d.columns.flatMap { c -> c.items.filterIsInstance<SeatItem>().map { it.seat } } }
        return Wagon(nextId++, label, scheme, seats, validate(scheme), seats.toSet())
    }
}
