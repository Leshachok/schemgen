package ua.gov.uz.schemgen.render

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.min
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
 * Seat blocks (with seat-back bracket and berth bars), facility blocks with
 * icons, tables, half-tables and separators, using the JS reference's color
 * roles. Pixel parity with web/js/render.js is not yet fixture-verified.
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
    Canvas(
        modifier = Modifier
            .size(width = L.width.dp, height = L.height.dp)
            .semantics { contentDescription = label }
            .pointerInput(deck, interaction) {
                if (interaction.mode == SchemeMode.SELECT) {
                    detectTapGestures { p ->
                        // layout units are dp; pointer positions are px
                        val seat = seatAt(deck, p.x / density, p.y / density)
                        if (seat != null && seatTappable(seat, interaction)) onSeatClick(seat.seat)
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
            topLeft = Offset(2f, 2f),
            size = Size(L.width - 4f, L.height - 4f),
            cornerRadius = CornerRadius(outlineRadius)
        )
        drawRoundRect(
            color = colors.border,
            topLeft = Offset(2f, 2f),
            size = Size(L.width - 4f, L.height - 4f),
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
            item.type == "half_table" -> drawHalfTable(x, y, w, h, item.facing, colors)
            item.type == "table" -> drawBlock(x, y, w, h, colors)
            item.type == "chair" -> drawChair(x, y, w, h, item.facing, colors)
            item.type != null && item.type in Vocabulary.FACILITIES -> drawFacility(item.type, x, y, w, h, textMeasurer, colors)
            else -> drawBlock(x, y, w, h, colors) // unknown/null type - inert placeholder (D6)
        }
    }
}

private fun DrawScope.drawBlock(x: Float, y: Float, w: Float, h: Float, colors: SchemeColors) {
    drawRoundRect(
        color = colors.block,
        topLeft = Offset(x, y),
        size = Size(w, h),
        cornerRadius = CornerRadius(4f)
    )
    drawRoundRect(
        color = colors.border,
        topLeft = Offset(x, y),
        size = Size(w, h),
        cornerRadius = CornerRadius(4f),
        style = Stroke(width = 1f)
    )
}

private fun DrawScope.drawSeparator(x: Float, y: Float, w: Float, h: Float, colors: SchemeColors) {
    drawLine(
        color = colors.border,
        start = Offset(x + w / 2f, y - 8f),
        end = Offset(x + w / 2f, y + h + 8f),
        strokeWidth = 1f
    )
}

/** Half the row's height, top or bottom half - fixed size, never resized (D29). */
private fun DrawScope.drawHalfTable(x: Float, y: Float, w: Float, h: Float, facing: String?, colors: SchemeColors) {
    val hh = h / 2f
    val hy = if (facing == "bottom") y + h - hh else y
    drawBlock(x, hy, w, hh, colors)
}

/** render.js's drawChair: a free-standing stool, back arc turned by SeatBack.ANGLE (D47). */
private fun DrawScope.drawChair(x: Float, y: Float, w: Float, h: Float, facing: String?, colors: SchemeColors) {
    val f = if (facing in Vocabulary.FACING) facing!! else Vocabulary.CHAIR_DEFAULT_FACING
    val s = min(w / ChairIcon.W, h / ChairIcon.H)
    val cx = x + w / 2f
    val cy = y + h / 2f
    withTransform({
        rotate(degrees = SeatBack.ANGLE.getValue(f), pivot = Offset(cx, cy))
        translate(cx - ChairIcon.W * s / 2f, cy - ChairIcon.H * s / 2f)
        scale(s, s, pivot = Offset.Zero)
    }) {
        val c = Offset(ChairIcon.CX, ChairIcon.CY)
        drawCircle(color = colors.unavailable, radius = ChairIcon.R, center = c)
        drawCircle(color = colors.border, radius = ChairIcon.R, center = c, style = Stroke(width = 1f))
        drawPath(
            PathParser().parsePathString(ChairIcon.BACK).toPath(), color = colors.icon, alpha = 0.5f,
            style = Stroke(width = ChairIcon.BACK_WIDTH, cap = StrokeCap.Round)
        )
    }
}

/** render.js's drawFacility: the block, plus a fitted icon (or a text fallback if unknown). */
private fun DrawScope.drawFacility(
    type: String, x: Float, y: Float, w: Float, h: Float, textMeasurer: TextMeasurer, colors: SchemeColors
) {
    drawBlock(x, y, w, h, colors)
    val icon = FACILITY_ICONS[type]
    if (icon == null) {
        val layoutResult = textMeasurer.measure(
            text = FACILITY_LABEL[type] ?: "?",
            style = TextStyle(color = colors.iconLabel, fontSize = 8.sp, textAlign = TextAlign.Center),
            density = UNSCALED
        )
        drawText(
            textLayoutResult = layoutResult,
            topLeft = Offset(x + (w - layoutResult.size.width) / 2f, y + (h - layoutResult.size.height) / 2f)
        )
        return
    }
    val pad = 3f
    val s = min((w - pad * 2f) / icon.boxW, (h - pad * 2f) / icon.boxH)
    val tx = x + (w - icon.boxW * s) / 2f - icon.boxX * s
    val ty = y + (h - icon.boxH * s) / 2f - icon.boxY * s
    withTransform({
        translate(tx, ty)
        scale(s, s, pivot = Offset.Zero)
    }) {
        // every glyph is one colour (icons.js), so the theme's icon colour replaces it
        icon.paths.forEach { p ->
            val path = PathParser().parsePathString(p.d).toPath()
            if (p.evenOdd) path.fillType = PathFillType.EvenOdd
            if (p.fill != null) drawPath(path, color = colors.icon)
            if (p.stroke != null) {
                drawPath(
                    path, color = colors.icon,
                    style = Stroke(width = p.strokeWidth, cap = StrokeCap.Round, join = StrokeJoin.Round)
                )
            }
        }
    }
}

private fun DrawScope.drawSeat(
    item: SeatItem, x: Float, y: Float, w: Float, h: Float, textMeasurer: TextMeasurer, interaction: Interaction,
    colors: SchemeColors
) {
    val known = item.kind in Vocabulary.KINDS
    val fill: Color
    val strokeColor: Color?
    val textColor: Color
    val backFill: Color
    var outline = false
    // same precedence as render.js: unknown > selected > unavailable > inclusive > available
    when (seatState(item, interaction)) {
        SeatState.UNKNOWN -> { fill = colors.unknown; strokeColor = colors.unknownBorder; textColor = colors.onUnavailable; backFill = colors.unknownBorder }
        SeatState.SELECTED -> { fill = colors.selected; strokeColor = null; textColor = colors.onSelected; backFill = colors.selected }
        SeatState.UNAVAILABLE -> { fill = colors.unavailable; strokeColor = colors.border; textColor = colors.onUnavailable; backFill = colors.border }
        SeatState.AVAILABLE ->
            if (item.inclusive) { fill = colors.background; strokeColor = colors.seat; textColor = colors.seat; backFill = colors.seat; outline = true }
            else { fill = colors.seat; strokeColor = null; textColor = colors.onSeat; backFill = colors.seat }
    }

    // Seat-back bracket: rendered opposite the facing direction, behind the seat block.
    if (item.kind == "sit" && item.facing in Vocabulary.FACING) {
        val angle = SeatBack.ANGLE.getValue(item.facing!!)
        val k = w / SeatBack.SEAT_SIZE
        val cx = x + w / 2f
        val cy = y + h / 2f
        val backPath = PathParser().parsePathString(SeatBack.PATH).toPath()
        withTransform({
            rotate(degrees = angle, pivot = Offset(cx, cy))
            translate(x - SeatBack.SEAT_X * k, y - SeatBack.SEAT_Y * k)
            scale(k, k, pivot = Offset.Zero)
        }) {
            drawPath(backPath, color = backFill, alpha = 0.5f)
        }
    }

    // Berth bar: a short indicator above (upper) or below (lower) the seat block.
    if (item.kind == "sleep" && (item.berth == "upper" || item.berth == "lower")) {
        val barY = if (item.berth == "upper") y - T.BAR_GAP - T.BAR_H else y + h + T.BAR_GAP
        drawRoundRect(
            color = backFill,
            topLeft = Offset(x + 4f, barY),
            size = Size(w - 8f, T.BAR_H),
            cornerRadius = CornerRadius(1.5f)
        )
    }

    drawRoundRect(color = fill, topLeft = Offset(x, y), size = Size(w, h), cornerRadius = CornerRadius(4f))
    if (strokeColor != null) {
        drawRoundRect(
            color = strokeColor, topLeft = Offset(x, y), size = Size(w, h),
            cornerRadius = CornerRadius(4f),
            // inclusive outline is 2px, the grey unavailable/unknown border 1px - as in render.js
            style = Stroke(width = if (outline) 2f else 1f)
        )
    }
    // Seat label, always drawn (render.js's drawSeat: "?" for an unknown kind, the
    // seat id otherwise) - centered, matching the reference's 12sp/600 text.
    val label = if (known) item.seat else "?"
    val layoutResult = textMeasurer.measure(
        text = label,
        style = TextStyle(color = textColor, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center),
        density = UNSCALED
    )
    drawText(
        textLayoutResult = layoutResult,
        topLeft = Offset(x + (w - layoutResult.size.width) / 2f, y + (h - layoutResult.size.height) / 2f)
    )
}
