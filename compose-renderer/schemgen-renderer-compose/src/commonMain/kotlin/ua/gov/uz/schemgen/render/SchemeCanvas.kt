package ua.gov.uz.schemgen.render

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ua.gov.uz.schemgen.layout.Interaction
import ua.gov.uz.schemgen.layout.SchemeMode
import ua.gov.uz.schemgen.layout.SeatState
import ua.gov.uz.schemgen.layout.T
import ua.gov.uz.schemgen.layout.itemBoxes
import ua.gov.uz.schemgen.layout.seatAt
import ua.gov.uz.schemgen.layout.seatState
import ua.gov.uz.schemgen.layout.seatTappable
import ua.gov.uz.schemgen.layout.isSeparator
import ua.gov.uz.schemgen.layout.layout
import ua.gov.uz.schemgen.model.Deck
import ua.gov.uz.schemgen.model.Item
import ua.gov.uz.schemgen.model.Scheme
import ua.gov.uz.schemgen.model.SeatItem
import ua.gov.uz.schemgen.model.StructuralItem
import ua.gov.uz.schemgen.model.Vocabulary

/**
 * Seats (with seat-back bracket and berth bars), facility blocks with icons, tables,
 * small tables and separators: a port of web/js/render.js, drawn to the guidelines file
 * (D50-D52). Pixel parity with it is not yet fixture-verified.
 */

/** Text is measured unscaled: the deck's DrawScope is already scaled by density. */
private val UNSCALED = Density(1f)

/**
 * Draws a scheme, one canvas per deck stacked top to bottom. [mode] VIEW: every seat
 * looks available, nothing reacts. [mode] SELECT: seats in [available] are tappable
 * and each tap calls [onSeatClick] with the seat number - the app owns [selected] and
 * passes the updated set back in (D45, D46).
 *
 * Each deck has a fixed size from the layout, so a long wagon is wider than a phone.
 * The renderer doesn't scroll by itself - scrolling inside a consumer's already
 * scrolling screen would crash - so wrap it in `horizontalScroll` (and
 * `verticalScroll`, if the screen doesn't already scroll) as the screen needs.
 */
@Composable
fun SchemeView(
    scheme: Scheme,
    modifier: Modifier = Modifier,
    mode: SchemeMode = SchemeMode.VIEW,
    available: Set<String> = emptySet(),
    selected: Set<String> = emptySet(),
    colors: SchemeColors = SchemeColors(),
    onSeatClick: (String) -> Unit = {}
) {
    val interaction = Interaction(mode, available, selected)
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        scheme.decks.forEach { deck -> DeckCanvas(deck, deckLabel(scheme, deck), interaction, colors, onSeatClick) }
    }
}

/** Accessibility label, same wording as render.js: "Bus BUS-53, lower deck". */
private fun deckLabel(scheme: Scheme, deck: Deck): String =
    (if (scheme.vehicle == "bus") "Bus " else "Wagon ") + (scheme.key ?: "") +
        (deck.level?.let { ", $it deck" } ?: "")

@Composable
private fun DeckCanvas(
    deck: Deck, label: String, interaction: Interaction, colors: SchemeColors, onSeatClick: (String) -> Unit
) {
    val L = layout(deck)
    val textMeasurer = rememberTextMeasurer()
    // The tap handler below only restarts when the deck or the seat state changes, so it
    // reads the callback through this rather than capturing it. Otherwise a host that
    // reuses this composition for another wagon with the same scheme and seat state (a
    // recycled RecyclerView row) kept reporting taps to the first wagon's callback.
    val currentOnSeatClick by rememberUpdatedState(onSeatClick)
    Canvas(
        modifier = Modifier
            .size(width = L.width.dp, height = L.height.dp)
            .semantics { contentDescription = label }
            .pointerInput(deck, interaction) {
                if (interaction.mode == SchemeMode.SELECT) {
                    detectTapGestures { p ->
                        // layout units are dp; pointer positions are px
                        val seat = seatAt(deck, p.x / density, p.y / density)
                        if (seat != null && seatTappable(seat, interaction)) currentOnSeatClick(seat.seat)
                    }
                }
            }
    ) {
        // outline - filled background plus a border, matching render.js's single
        // rect with both fill and stroke (Compose needs two draw calls for that).
      // layout math is in dp (the Canvas is sized in dp), DrawScope draws in px
      val d = density
      withTransform({ scale(d, d, pivot = Offset.Zero) }) {
        val outlineRadius = 12f
        drawRoundRect(
            color = colors.background,
            topLeft = Offset(T.WALL, T.WALL),
            size = Size(L.width - T.WALL * 2f, L.height - T.WALL * 2f),
            cornerRadius = CornerRadius(outlineRadius)
        )
        drawRoundRect(
            color = colors.border,
            topLeft = Offset(T.WALL, T.WALL),
            size = Size(L.width - T.WALL * 2f, L.height - T.WALL * 2f),
            cornerRadius = CornerRadius(outlineRadius),
            style = Stroke(width = 1f)
        )

        itemBoxes(deck, L).forEach { b -> drawItem(b.item, b.x, b.y, b.w, b.h, textMeasurer, interaction, colors) }
      }
    }
}

private fun DrawScope.drawItem(
    item: Item, x: Float, y: Float, w: Float, h: Float, textMeasurer: TextMeasurer, interaction: Interaction,
    colors: SchemeColors
) {
    when (item) {
        is SeatItem -> drawSeat(item, x, y, w, h, textMeasurer, interaction, colors)
        is StructuralItem -> when {
            isSeparator(item) -> drawSeparator(x, y, w, h, colors)
            item.type == "small_table" -> drawSmallTable(x, y, w, h, item.facing, colors)
            item.type == "table" -> drawTable(x, y, w, h, colors)
            // an unknown type gets its fallback label, no type at all a "?" (D6)
            item.type != null -> drawFacility(item.type, x, y, w, h, textMeasurer, colors)
            else -> drawBlock(x, y, w, h, colors, "?", textMeasurer)
        }
    }
}

private fun DrawScope.drawBlock(
    x: Float, y: Float, w: Float, h: Float, colors: SchemeColors, label: String? = null, textMeasurer: TextMeasurer? = null
) {
    drawRoundRect(color = colors.block, topLeft = Offset(x, y), size = Size(w, h), cornerRadius = CornerRadius(T.RADIUS))
    if (label != null && textMeasurer != null) drawLabel(label, x, y, w, h, textMeasurer, colors.icon)
}

private fun DrawScope.drawLabel(text: String, x: Float, y: Float, w: Float, h: Float, textMeasurer: TextMeasurer, color: Color) {
    val r = textMeasurer.measure(
        text = text, style = TextStyle(color = color, fontSize = 8.sp, textAlign = TextAlign.Center), density = UNSCALED
    )
    drawText(textLayoutResult = r, topLeft = Offset(x + (w - r.size.width) / 2f, y + (h - r.size.height) / 2f))
}

/** Tables carry a 2px outline drawn inside their box, as in the guidelines. */
private fun DrawScope.drawTable(x: Float, y: Float, w: Float, h: Float, colors: SchemeColors) {
    val topLeft = Offset(x + 1f, y + 1f)
    val size = Size(w - 2f, h - 2f)
    drawRoundRect(color = colors.block, topLeft = topLeft, size = size, cornerRadius = CornerRadius(T.RADIUS))
    drawRoundRect(
        color = colors.line, topLeft = topLeft, size = size, cornerRadius = CornerRadius(T.RADIUS), style = Stroke(width = 2f)
    )
}

/** Half the height of the rows it covers, in their top or bottom half. */
private fun DrawScope.drawSmallTable(x: Float, y: Float, w: Float, h: Float, facing: String?, colors: SchemeColors) {
    val hh = h / 2f
    drawTable(x, if (facing == "bottom") y + h - hh else y, w, hh, colors)
}

/** The box already runs to the wall or past its rows (overhangs() in Layout.kt). */
private fun DrawScope.drawSeparator(x: Float, y: Float, w: Float, h: Float, colors: SchemeColors) {
    drawRoundRect(color = colors.line, topLeft = Offset(x + w / 2f - 1f, y), size = Size(2f, h), cornerRadius = CornerRadius(1f))
}

/** A facility block with its icon centred at its own size - icons never scale (D51). Steps
 *  and the wheelchair marker are their own art, with no block. */
private fun DrawScope.drawFacility(
    type: String, x: Float, y: Float, w: Float, h: Float, textMeasurer: TextMeasurer, colors: SchemeColors
) {
    val bare = type in Vocabulary.BARE_TYPES
    val icon = ICONS[type]
    if (!bare || icon == null) drawBlock(x, y, w, h, colors)
    if (icon == null) {
        drawLabel(FACILITY_LABEL[type] ?: "?", x, y, w, h, textMeasurer, colors.icon)
        return
    }
    val color = when {
        type == "handicapped_wheelchair" -> colors.marker
        bare -> colors.line
        else -> colors.icon
    }
    withTransform({ translate(x + (w - icon.w) / 2f, y + (h - icon.h) / 2f) }) {
        icon.paths.forEach { p ->
            withTransform({ translate(p.tx, p.ty) }) {
                if (p.fill) drawPath(p.path, color = color)
                if (p.stroke > 0f) {
                    drawPath(
                        p.path, color = color,
                        style = Stroke(
                            width = p.stroke,
                            cap = if (p.roundCap) StrokeCap.Round else StrokeCap.Butt,
                            join = if (p.roundJoin) StrokeJoin.Round else StrokeJoin.Miter
                        )
                    )
                }
            }
        }
    }
}

/** render.js's drawSeat: sit and folding seats are a 32 px body with the back bracket at
 *  50% (D50); a berth carries its bar above (upper) or below (lower); a folding seat is an
 *  outline in the state colour (D52). */
private fun DrawScope.drawSeat(
    item: SeatItem, x: Float, y: Float, w: Float, h: Float, textMeasurer: TextMeasurer, interaction: Interaction,
    colors: SchemeColors
) {
    val state = seatState(item, interaction)
    val c = when (state) {
        SeatState.UNKNOWN -> colors.unknown
        SeatState.SELECTED -> colors.selected
        SeatState.UNAVAILABLE -> colors.unavailable
        SeatState.AVAILABLE -> colors.seat
    }
    var textColor = when (state) {
        SeatState.UNKNOWN, SeatState.UNAVAILABLE -> colors.onUnavailable
        SeatState.SELECTED -> colors.onSelected
        SeatState.AVAILABLE -> colors.onSeat
    }
    val folding = item.kind == "folding" && state != SeatState.UNKNOWN

    var bx = x; var by = y; var bw = w; var bh = h
    if (item.kind in Vocabulary.FACING_KINDS) {
        bx = x + (w - T.SQUARE) / 2f; by = y + (h - T.SQUARE) / 2f; bw = T.SQUARE; bh = T.SQUARE
        val facing = item.facing
        if (facing != null && facing in Vocabulary.FACING) {
            val k = T.SQUARE / SeatBack.SEAT_SIZE
            withTransform({
                rotate(degrees = SeatBack.ANGLE.getValue(facing), pivot = Offset(bx + bw / 2f, by + bh / 2f))
                translate(bx - SeatBack.SEAT_X * k, by - SeatBack.SEAT_Y * k)
                scale(k, k, pivot = Offset.Zero)
            }) {
                drawPath(SeatBack.path, color = c, alpha = T.BACK_OPACITY)
            }
        }
    } else if (item.kind == "sleep" && (item.berth == "upper" || item.berth == "lower")) {
        val upper = item.berth == "upper"
        drawRoundRect(
            color = c, topLeft = Offset(x, if (upper) y else y + h - T.BAR_H), size = Size(w, T.BAR_H),
            cornerRadius = CornerRadius(T.BAR_H / 2f)
        )
        val bar = T.BAR_H + T.BAR_GAP
        by = if (upper) y + bar else y
        bh = h - bar
    }

    if (folding) {
        val topLeft = Offset(bx + 1f, by + 1f)
        val size = Size(bw - 2f, bh - 2f)
        drawRoundRect(color = colors.folding, topLeft = topLeft, size = size, cornerRadius = CornerRadius(T.RADIUS))
        drawRoundRect(color = c, topLeft = topLeft, size = size, cornerRadius = CornerRadius(T.RADIUS), style = Stroke(width = 2f))
        if (state != SeatState.UNAVAILABLE) textColor = c
    } else {
        drawRoundRect(color = c, topLeft = Offset(bx, by), size = Size(bw, bh), cornerRadius = CornerRadius(T.RADIUS))
    }

    val label = if (item.kind in Vocabulary.KINDS) item.seat else "?"
    val r = textMeasurer.measure(
        text = label,
        style = TextStyle(color = textColor, fontSize = T.FONT.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center),
        density = UNSCALED
    )
    drawText(textLayoutResult = r, topLeft = Offset(bx + (bw - r.size.width) / 2f, by + (bh - r.size.height) / 2f))
}
