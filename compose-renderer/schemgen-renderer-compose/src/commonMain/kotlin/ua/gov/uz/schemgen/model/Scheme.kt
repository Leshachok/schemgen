package ua.gov.uz.schemgen.model

/**
 * Mirrors the wagon scheme JSON format 1:1 - see /docs/wagon-scheme-format.md.
 *
 * Deliberately NOT a clean tagged union: the JSON itself dispatches on field
 * presence (`seat` vs `type`), not a discriminator field, so the model does
 * the same. [SchemeParser] is what turns raw JSON into these types.
 */

/** As written in the JSON. [cols] only applies to items that may be wide (D48) -
 *  read it through `spanCols()`, which ignores it on everything else. */
data class Span(val rows: Int = 1, val cols: Int = 1)

sealed interface Item {
    val row: Int
    val span: Span
}

/** A named seat: [seat] is its identifier (opaque string, per format decision D10 -
 *  never derive logic from it). [kind] is sit | folding | sleep | luxury; unknown values
 *  render as an inert placeholder (format decision D6), never a crash. There is no
 *  `inclusive` seat (D52): accessibility belongs to the handicapped items only. */
data class SeatItem(
    val seat: String,
    val kind: String,
    val berth: String? = null,     // lower | middle | upper, only for kind == "sleep"
    val facing: String? = null,    // left | right | top | bottom, for sit and folding
    override val row: Int = 1,
    override val span: Span = Span()
) : Item

/** Everything else - facility, table, small_table, separator - shares one shape
 *  (format decision D30): [type] names what it is, [facing] only applies to
 *  small_table (top | bottom). A null or unrecognized [type] renders inert. */
data class StructuralItem(
    val type: String?,
    val facing: String? = null,
    override val row: Int = 1,
    override val span: Span = Span()
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
    val KINDS = listOf("sit", "folding", "sleep", "luxury")
    /** Kinds drawn as a seat body with a back bracket, turned by `facing`. */
    val FACING_KINDS = listOf("sit", "folding")
    val BERTHS = listOf("lower", "middle", "upper")
    val FACING = listOf("left", "right", "top", "bottom")
    val LEVELS = listOf("lower", "upper")
    val VEHICLES = listOf("train", "bus")
    /** The elements of the guidelines file "Wagon components" (D50), named after the
     *  Android sales app's drawables (D47). */
    val FACILITIES = listOf(
        "toilet", "invalid_toilet", "baggage", "bike", "handicapped", "handicapped_wheelchair",
        "shield", "steps_up", "steps_down", "wardrobe", "cafe", "coffee_machine", "kid", "driver"
    )
    val STRUCTURAL_TYPES = listOf("table", "small_table", "separator")
    val KNOWN_TYPES = FACILITIES + STRUCTURAL_TYPES
    /** Drawn as their own art with no facility block behind it. */
    val BARE_TYPES = listOf("steps_up", "steps_down", "handicapped_wheelchair")
    /** The guidelines' minimum heights in rows (D51); anything not listed may be one row. */
    val MIN_ROWS = mapOf(
        "toilet" to 2, "invalid_toilet" to 2, "baggage" to 2, "bike" to 2, "handicapped" to 2,
        "shield" to 2, "wardrobe" to 2, "cafe" to 2, "coffee_machine" to 2, "kid" to 2
    )
}
