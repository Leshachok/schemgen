package schemgen.model

/**
 * Mirrors the wagon scheme JSON format 1:1 - see /docs/wagon-scheme-format.md.
 *
 * Deliberately NOT a clean tagged union: the JSON itself dispatches on field
 * presence (`seat` vs `type`), not a discriminator field, so the model does
 * the same. [SchemeParser] is what turns raw JSON into these types.
 */

/** Rows only - every item is exactly one column wide (D41). */
data class Span(val rows: Int = 1)

sealed interface Item {
    val row: Int
    val span: Span
}

/** A named seat: [seat] is its identifier (opaque string, per format decision D10 -
 *  never derive logic from it). [kind] is sit | sleep | luxury; unknown values render
 *  as an inert placeholder (format decision D6), never a crash. */
data class SeatItem(
    val seat: String,
    val kind: String,
    val berth: String? = null,     // lower | middle | upper, only for kind == "sleep"
    val facing: String? = null,    // left | right | top | bottom, only for kind == "sit"
    val inclusive: Boolean = false,
    override val row: Int = 1,
    override val span: Span = Span()
) : Item

/** Everything else - facility, table, half_table, separator - shares one shape
 *  (format decision D30): [type] names what it is, [facing] only applies to
 *  half_table (top | bottom). A null or unrecognized [type] renders inert. */
data class StructuralItem(
    val type: String?,
    val facing: String? = null,
    override val row: Int = 1,
    override val span: Span = Span(),
    val hasExplicitSpan: Boolean = false   // lets the validator flag a span on a one-cell type
) : Item

data class Column(val items: List<Item> = emptyList())

data class Deck(
    val level: String? = null,   // lower | upper; required only when a scheme has several decks
    val rows: Int,
    val columns: List<Column> = emptyList()
    // Deliberately no `aisleAfterRow` - the aisle concept was removed from the format
    // entirely (D24). Space is just a row nothing is placed on.
)

data class Scheme(
    val key: String?,
    val rev: Int?,
    val vehicle: String? = null,   // train | bus; absent means train
    val decks: List<Deck> = emptyList()
)

/** Known vocabulary - keep this in lockstep with web/js/format.js. */
object Vocabulary {
    val KINDS = listOf("sit", "sleep", "luxury")
    val BERTHS = listOf("lower", "middle", "upper")
    val FACING = listOf("left", "right", "top", "bottom")
    val LEVELS = listOf("lower", "upper")
    val VEHICLES = listOf("train", "bus")
    val FACILITIES = listOf(
        "wc", "wc_accessible", "luggage", "bicycle", "inclusive", "inclusive_marker",
        "electrical", "kid", "stairs_up", "stairs_down", "driver"
    )
    /** Always exactly one cell, whatever `span` says. */
    val ONE_CELL_TYPES = listOf("driver")
    val STRUCTURAL_TYPES = listOf("table", "half_table", "separator")
    val KNOWN_TYPES = FACILITIES + STRUCTURAL_TYPES
}
