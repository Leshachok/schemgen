package schemgen.layout

import schemgen.model.Item
import schemgen.model.Scheme
import schemgen.model.SeatItem
import schemgen.model.StructuralItem
import schemgen.model.Vocabulary

enum class Level { ERROR, WARN, OK }

data class Message(val level: Level, val text: String)

/**
 * Structural validation - deliberately mirrors web/js/format.js's `validate()`
 * rule for rule. If this ever drifts from the JS version, the two renderers can
 * silently disagree about which schemes are valid; keep them in lockstep.
 */
fun validate(scheme: Scheme): List<Message> {
    val msgs = mutableListOf<Message>()
    if (scheme.decks.isEmpty()) return listOf(Message(Level.ERROR, "No decks in scheme."))

    val vehicle = scheme.vehicle
    if (vehicle != null && vehicle !in Vocabulary.VEHICLES) {
        msgs += Message(Level.WARN, "unknown vehicle \"$vehicle\" — treated as train.")
    }
    var seatCount = 0
    val multi = scheme.decks.size > 1
    val levelsSeen = mutableSetOf<String>()
    scheme.decks.forEachIndexed { di, deck ->
        val lvl = deck.level
        if (lvl != null && lvl !in Vocabulary.LEVELS) {
            msgs += Message(Level.WARN, "deck $di: unknown level \"$lvl\".")
        }
        if (multi && lvl == null) {
            msgs += Message(Level.ERROR, "deck $di: level is required when a scheme has several decks.")
        }
        if (lvl != null && !levelsSeen.add(lvl)) {
            msgs += Message(Level.ERROR, "two decks with level \"$lvl\".")
        }

        val seen = mutableSetOf<String>()
        val cells = mutableSetOf<String>()
        val maxRow = deck.rows.coerceAtLeast(1)

        deck.columns.forEachIndexed { ci, col ->
            col.items.forEach { item: Item ->
                val row = item.row
                val spanRows = spanRows(item)
                if (row + spanRows - 1 > maxRow) {
                    msgs += Message(
                        Level.ERROR,
                        "col $ci: item at row $row spans $spanRows rows, past rows=$maxRow."
                    )
                }
                for (r in row until row + spanRows) {
                    val key = "$ci:$r"
                    if (!cells.add(key)) {
                        msgs += Message(Level.ERROR, "col $ci row $r: two items in one cell.")
                    }
                }

                when (item) {
                    is SeatItem -> {
                        val id = item.seat
                        if (!seen.add(id)) {
                            msgs += Message(Level.ERROR, "duplicate seat number \"$id\".")
                        }
                        seatCount++
                        if (item.kind !in Vocabulary.KINDS) {
                            msgs += Message(
                                Level.WARN,
                                "seat $id: unknown kind \"${item.kind}\" — drawn as placeholder."
                            )
                        }
                        if (item.kind == "sleep" && item.berth !in Vocabulary.BERTHS) {
                            msgs += Message(Level.ERROR, "seat $id: kind=sleep needs berth.")
                        }
                        if (item.kind != "sleep" && item.berth != null) {
                            msgs += Message(Level.ERROR, "seat $id: berth only valid on kind=sleep.")
                        }
                        if (item.facing != null && item.facing !in Vocabulary.FACING) {
                            msgs += Message(
                                Level.WARN,
                                "seat $id: unknown facing \"${item.facing}\"."
                            )
                        }
                    }
                    is StructuralItem -> {
                        val type = item.type
                        if (type == null) {
                            msgs += Message(Level.WARN, "col $ci: item has no type — drawn as placeholder.")
                        } else if (type !in Vocabulary.KNOWN_TYPES) {
                            msgs += Message(Level.WARN, "unknown type \"$type\" — drawn as placeholder.")
                        }
                        if (type in Vocabulary.ONE_CELL_TYPES && item.hasExplicitSpan) {
                            msgs += Message(Level.WARN, "col $ci: $type is always one cell — span ignored.")
                        }
                    }
                }
            }
        }
    }

    if (msgs.isEmpty()) msgs += Message(Level.OK, "No structural problems. $seatCount seats.")
    return msgs
}
