package schemgen.layout

import schemgen.model.SeatItem
import schemgen.model.Vocabulary

/**
 * Renderer contract - interaction modes (D45). Runtime input, never part of the
 * scheme (D4). Mirrors web/js/format.js's MODES / seatState() / seatTappable().
 */
enum class SchemeMode {
    /** Every known seat looks available; nothing is tappable. */
    VIEW,
    /** Only seats in `available` are available and tappable. */
    SELECT
}

enum class SeatState { UNKNOWN, AVAILABLE, UNAVAILABLE, SELECTED }

/** What the renderer is told at runtime. [selected] is owned by the app (D46): the
 *  renderer reports taps and never changes it. */
data class Interaction(
    val mode: SchemeMode = SchemeMode.VIEW,
    val available: Set<String> = emptySet(),
    val selected: Set<String> = emptySet()
)

fun seatState(item: SeatItem, interaction: Interaction): SeatState = when {
    item.kind !in Vocabulary.KINDS -> SeatState.UNKNOWN
    interaction.mode != SchemeMode.SELECT -> SeatState.AVAILABLE
    item.seat !in interaction.available -> SeatState.UNAVAILABLE
    item.seat in interaction.selected -> SeatState.SELECTED
    else -> SeatState.AVAILABLE
}

fun seatTappable(item: SeatItem, interaction: Interaction): Boolean {
    if (interaction.mode != SchemeMode.SELECT) return false
    val st = seatState(item, interaction)
    return st == SeatState.AVAILABLE || st == SeatState.SELECTED
}
