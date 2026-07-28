package schemgen.layout

import schemgen.model.Column
import schemgen.model.Deck
import schemgen.model.Item
import schemgen.model.StructuralItem

/**
 * Platform layout constants - never part of the format itself, each renderer owns
 * its own values (see /docs/wagon-scheme-format.md, guardrails). These mirror
 * web/js/format.js's `T` object as a starting point so the two renderers produce
 * comparable output while there's no golden-fixture pixel contract yet.
 */
object T {
    const val SEAT = 30f
    const val COL_GAP = 11f
    const val SEP_W = 9f
    const val ROW_PITCH = 41f
    const val PAD_X = 16f
    const val PAD_Y = 16f
    const val GAP_W = 18f
    const val BAR_H = 3f
    const val BAR_GAP = 4f
}

fun rowY(row: Int): Float = T.PAD_Y + (row - 1) * T.ROW_PITCH

fun isSeparator(item: Item): Boolean = item is StructuralItem && item.type == "separator"

fun itemWidth(item: Item): Float {
    if (isSeparator(item)) return T.SEP_W
    val cols = item.span.cols
    return cols * T.SEAT + (cols - 1) * T.COL_GAP
}

fun colWidth(column: Column): Float {
    if (column.items.isEmpty()) return T.GAP_W
    return column.items.maxOf { itemWidth(it) }
}

data class PlacedColumn(val column: Column, val index: Int, val x: Float, val w: Float)

data class DeckLayout(val columns: List<PlacedColumn>, val width: Float, val height: Float)

fun layout(deck: Deck): DeckLayout {
    var x = T.PAD_X
    val placed = deck.columns.mapIndexed { i, col ->
        val w = colWidth(col)
        val p = PlacedColumn(col, i, x, w)
        x += w + T.COL_GAP
        p
    }
    val rows = deck.rows.coerceAtLeast(1)
    val width = (x - T.COL_GAP + T.PAD_X).coerceAtLeast(140f)
    val height = rowY(rows) + T.SEAT + T.PAD_Y
    return DeckLayout(placed, width, height)
}

/** Row span clamped to the item's own rows..rows+span-1 within [maxRow], matching
 *  the JS renderer's `Math.min(row+sp.rows-1, deck.rows)` clamp in the item loop. */
fun clampedEndRow(item: Item, maxRow: Int): Int =
    (item.row + item.span.rows - 1).coerceAtMost(maxRow)
