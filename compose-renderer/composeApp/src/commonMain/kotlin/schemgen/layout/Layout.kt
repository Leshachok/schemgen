package schemgen.layout

import schemgen.model.Column
import schemgen.model.Deck
import schemgen.model.Item
import schemgen.model.StructuralItem
import schemgen.model.Vocabulary

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
    return if (isSeparator(item)) T.SEP_W else T.SEAT
}

/** A column holding nothing of its own but covered by a wide item is as wide as a
 *  seat, not a gap - otherwise the item would squash it. Mirrors format.js. */
fun colWidth(column: Column, covered: Boolean = false): Float {
    if (column.items.isEmpty()) return if (covered) T.SEAT else T.GAP_W
    val w = column.items.maxOf { itemWidth(it) }
    return if (covered) maxOf(w, T.SEAT) else w
}

data class PlacedColumn(val column: Column, val index: Int, val x: Float, val w: Float)

data class DeckLayout(val columns: List<PlacedColumn>, val width: Float, val height: Float)

fun layout(deck: Deck): DeckLayout {
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
    val height = rowY(rows) + T.SEAT + T.PAD_Y
    return DeckLayout(placed, width, height)
}

/** Row span clamped to the item's own rows..rows+span-1 within [maxRow], matching
 *  the JS renderer's `Math.min(row+sp.rows-1, deck.rows)` clamp in the item loop. */
fun clampedEndRow(item: Item, maxRow: Int): Int =
    (item.row + spanRows(item) - 1).coerceAtMost(maxRow)

/** Rows an item covers - one-cell types (driver) ignore their span, like format.js's itemSpan. */
fun spanRows(item: Item): Int =
    if (item is StructuralItem && item.type in Vocabulary.ONE_CELL_TYPES) 1 else item.span.rows

/** Only these may be several columns wide (D48): seats, separators, half-tables and
 *  one-cell items stay one column, whatever `span.cols` says. */
fun canSpanCols(item: Item): Boolean =
    item is StructuralItem && item.type != "separator" && item.type != "half_table" &&
        item.type !in Vocabulary.ONE_CELL_TYPES

/** Columns an item covers, counting its own. */
fun spanCols(item: Item): Int = if (canSpanCols(item)) item.span.cols.coerceAtLeast(1) else 1

/** Where one item lands on a deck - the single geometry both drawing and tap
 *  hit-testing use, so what you see is exactly what you can tap. */
data class ItemBox(val item: Item, val x: Float, val y: Float, val w: Float, val h: Float) {
    fun contains(px: Float, py: Float): Boolean = px >= x && px <= x + w && py >= y && py <= y + h
}

fun itemBoxes(deck: Deck, deckLayout: DeckLayout = layout(deck)): List<ItemBox> =
    deckLayout.columns.flatMap { pc ->
        pc.column.items.map { item ->
            val y = rowY(item.row)
            val yEnd = rowY(clampedEndRow(item, deck.rows.coerceAtLeast(1)))
            val h = yEnd + T.SEAT - y
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
fun seatAt(deck: Deck, px: Float, py: Float): schemgen.model.SeatItem? =
    itemBoxes(deck).firstOrNull { it.item is schemgen.model.SeatItem && it.contains(px, py) }?.item
        as? schemgen.model.SeatItem

