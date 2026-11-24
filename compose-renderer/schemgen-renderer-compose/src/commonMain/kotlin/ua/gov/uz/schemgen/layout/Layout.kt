package ua.gov.uz.schemgen.layout

import ua.gov.uz.schemgen.model.Column
import ua.gov.uz.schemgen.model.Deck
import ua.gov.uz.schemgen.model.Item
import ua.gov.uz.schemgen.model.SeatItem
import ua.gov.uz.schemgen.model.StructuralItem
import ua.gov.uz.schemgen.model.Vocabulary

/**
 * Platform layout constants - never part of the format itself, each renderer owns its
 * own values (see /docs/wagon-scheme-format.md, guardrails). The mobile preset measured
 * from the guidelines file "Wagon components" (D50), the same numbers as web/js/icons.js's
 * `T`: berth 40x38, rows 50 apart, a facility block at least 56 wide.
 */
internal object T {
    /** Cell width and height. */
    const val SEAT = 40f
    const val SEAT_H = 38f
    /** A sitting seat's body inside its cell. */
    const val SQUARE = 32f
    const val ROW_PITCH = 50f
    const val COL_GAP = 12f
    const val SEP_W = 10f
    const val PAD_X = 16f
    const val PAD_Y = 16f
    const val GAP_W = 18f
    const val BAR_H = 4f
    const val BAR_GAP = 2f
    /** How far a facility block on the deck's first or last row reaches into the padding (D51),
     *  and how far a partition reaches past a row inside the deck. */
    const val OVERHANG = 8f
    /** Inset of the vehicle outline, where a partition on an edge row ends. */
    const val WALL = 2f
    const val RADIUS = 4f
    const val FONT = 15f
    /** The seat-back bracket, in the seat's colour, in every state and theme. */
    const val BACK_OPACITY = 0.5f
}

/** The narrowest each element may be drawn, which sets its column's width (D51);
 *  anything not listed is one seat wide. */
private val ITEM_W = mapOf(
    "toilet" to 56f, "invalid_toilet" to 61f, "baggage" to 56f, "bike" to 56f, "handicapped" to 56f,
    "shield" to 56f, "wardrobe" to 56f, "cafe" to 56f, "coffee_machine" to 56f, "kid" to 56f,
    "driver" to 56f, "steps_up" to 56f, "steps_down" to 56f, "separator" to T.SEP_W
)

internal fun rowY(row: Int): Float = T.PAD_Y + (row - 1) * T.ROW_PITCH

internal fun isSeparator(item: Item): Boolean = item is StructuralItem && item.type == "separator"

internal fun itemWidth(item: Item): Float =
    (item as? StructuralItem)?.type?.let { ITEM_W[it] } ?: T.SEAT

/** A column holding nothing of its own but covered by a wide item is as wide as a
 *  seat, not a gap - otherwise the item would squash it. Mirrors format.js. */
internal fun colWidth(column: Column, covered: Boolean = false): Float {
    if (column.items.isEmpty()) return if (covered) T.SEAT else T.GAP_W
    val w = column.items.maxOf { itemWidth(it) }
    return if (covered) maxOf(w, T.SEAT) else w
}

internal data class PlacedColumn(val column: Column, val index: Int, val x: Float, val w: Float)

internal data class DeckLayout(val columns: List<PlacedColumn>, val width: Float, val height: Float)

internal fun layout(deck: Deck): DeckLayout {
    val covered = mutableSetOf<Int>()
    deck.columns.forEachIndexed { i, col ->
        col.items.forEach { item -> for (c in 1 until spanCols(item)) covered += i + c }
    }
    var x = T.PAD_X
    val placed = deck.columns.mapIndexed { i, col ->
        val w = colWidth(col, i in covered)
        val p = PlacedColumn(col, i, x, w)
        x += w + T.COL_GAP
        p
    }
    val rows = deck.rows.coerceAtLeast(1)
    val width = (x - T.COL_GAP + T.PAD_X).coerceAtLeast(140f)
    val height = rowY(rows) + T.SEAT_H + T.PAD_Y
    return DeckLayout(placed, width, height)
}

/** Row span clamped to the item's own rows..rows+span-1 within [maxRow], matching
 *  the JS renderer's `Math.min(row+sp.rows-1, deck.rows)` clamp in the item loop. */
internal fun clampedEndRow(item: Item, maxRow: Int): Int =
    (item.row + spanRows(item) - 1).coerceAtMost(maxRow)

internal fun spanRows(item: Item): Int = item.span.rows

/** Seats are one column wide (D48); a partition only grows in length (D51). */
internal fun canSpanCols(item: Item): Boolean = item is StructuralItem && item.type != "separator"

/** Columns an item covers, counting its own. */
internal fun spanCols(item: Item): Int = if (canSpanCols(item)) item.span.cols.coerceAtLeast(1) else 1

/** The guidelines' minimum height in rows (D51). */
internal fun minRows(item: Item): Int = (item as? StructuralItem)?.type?.let { Vocabulary.MIN_ROWS[it] } ?: 1

/** A facility on the deck's first or last row reaches [T.OVERHANG] past it into the deck
 *  padding, as the guidelines draw it: a block spanning the deck is 2 rows + 2 x 8 = 104.
 *  Never into a gap between rows and never depending on its neighbours, so blocks on the
 *  same rows line up and can't overlap (D51). Mirrors format.js's overhangs(). */
private fun overhangs(deck: Deck, item: Item): Pair<Float, Float> {
    val last = item.row + spanRows(item) - 1
    val rows = deck.rows.coerceAtLeast(1)
    // a partition is fixed to the vehicle wall: an end on the first or last row runs to the
    // outline, an end inside the deck reaches OVERHANG past its row
    if (isSeparator(item)) {
        val wall = T.PAD_Y - T.WALL
        return (if (item.row == 1) wall else T.OVERHANG) to (if (last >= rows) wall else T.OVERHANG)
    }
    if (item !is StructuralItem || item.type !in Vocabulary.FACILITIES) return 0f to 0f
    return (if (item.row == 1) T.OVERHANG else 0f) to (if (last >= rows) T.OVERHANG else 0f)
}

/** Where one item lands on a deck - the single geometry both drawing and tap
 *  hit-testing use, so what you see is exactly what you can tap. */
internal data class ItemBox(val item: Item, val x: Float, val y: Float, val w: Float, val h: Float) {
    fun contains(px: Float, py: Float): Boolean = px >= x && px <= x + w && py >= y && py <= y + h
}

internal fun itemBoxes(deck: Deck, deckLayout: DeckLayout = layout(deck)): List<ItemBox> =
    deckLayout.columns.flatMap { pc ->
        pc.column.items.map { item ->
            val (top, bottom) = overhangs(deck, item)
            val y = rowY(item.row) - top
            val yEnd = rowY(clampedEndRow(item, deck.rows.coerceAtLeast(1)))
            val h = yEnd + T.SEAT_H + bottom - y
            val cols = spanCols(item)
            if (cols > 1) {
                // clipped at the deck's last column, like the row clamp above
                val last = deckLayout.columns[minOf(pc.index + cols - 1, deckLayout.columns.lastIndex)]
                ItemBox(item, pc.x, y, last.x + last.w - pc.x, h)
            } else {
                val w = itemWidth(item)
                ItemBox(item, pc.x + (pc.w - w) / 2f, y, w, h)
            }
        }
    }

/** The seat under a point in deck coordinates, or null. */
internal fun seatAt(deck: Deck, px: Float, py: Float): SeatItem? =
    itemBoxes(deck).firstOrNull { it.item is SeatItem && it.contains(px, py) }?.item
        as? SeatItem
