package schemgen.render

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.min
import schemgen.layout.T
import schemgen.layout.clampedEndRow
import schemgen.layout.isSeparator
import schemgen.layout.itemWidth
import schemgen.layout.layout
import schemgen.layout.rowY
import schemgen.model.Deck
import schemgen.model.Item
import schemgen.model.Scheme
import schemgen.model.SeatItem
import schemgen.model.StructuralItem
import schemgen.model.Vocabulary

/**
 * Seat blocks (with seat-back bracket and berth bars), facility blocks with
 * icons, tables, half-tables and separators, using the JS reference's color
 * roles. Pixel parity with web/js/render.js is not yet fixture-verified.
 */

private val NAVY = Color(0xFF213786)
private val FILL = Color(0xFFF7F6F8)
private val BORDER = Color(0xFFD4D5D6)
private val OFF = Color(0xFFEDEEF0)
private val OFF_TEXT = Color(0xFF9AA0A6)
private val MUTED = Color(0xFF6B7078)

@Composable
fun SchemeView(scheme: Scheme) {
    Column(
        modifier = Modifier.padding(16.dp).verticalScroll(rememberScrollState())
    ) {
        scheme.decks.forEach { deck -> DeckCanvas(deck, scheme.hull) }
    }
}

@Composable
private fun DeckCanvas(deck: Deck, hull: String?) {
    val L = layout(deck)
    val textMeasurer = rememberTextMeasurer()
    Canvas(
        modifier = Modifier
            .padding(top = 8.dp)
            .size(width = L.width.dp, height = L.height.dp)
    ) {
        // hull - filled background plus a border, matching render.js's single
        // rect with both fill and stroke (Compose needs two draw calls for that).
        val hullRadius = if (hull == "plain") 12f else 24f
        drawRoundRect(
            color = Color.White,
            topLeft = Offset(2f, 2f),
            size = Size(L.width - 4f, L.height - 4f),
            cornerRadius = CornerRadius(hullRadius)
        )
        drawRoundRect(
            color = BORDER,
            topLeft = Offset(2f, 2f),
            size = Size(L.width - 4f, L.height - 4f),
            cornerRadius = CornerRadius(hullRadius),
            style = Stroke(width = 1f)
        )

        L.columns.forEach { pc ->
            pc.column.items.forEach { item ->
                val row = item.row
                val y = rowY(row)
                val yEnd = rowY(clampedEndRow(item, deck.rows.coerceAtLeast(1)))
                val h = yEnd + T.SEAT - y
                val w = itemWidth(item)
                val x = pc.x + (pc.w - w) / 2f
                drawItem(item, x, y, w, h, textMeasurer)
            }
        }
    }
}

private fun DrawScope.drawItem(item: Item, x: Float, y: Float, w: Float, h: Float, textMeasurer: TextMeasurer) {
    when (item) {
        is SeatItem -> drawSeat(item, x, y, w, h, textMeasurer)
        is StructuralItem -> when {
            isSeparator(item) -> drawSeparator(x, y, w, h)
            item.type == "half_table" -> drawHalfTable(x, y, w, h, item.facing)
            item.type == "table" -> drawBlock(x, y, w, h)
            item.type != null && item.type in Vocabulary.FACILITIES -> drawFacility(item.type, x, y, w, h, textMeasurer)
            else -> drawBlock(x, y, w, h) // unknown/null type - inert placeholder (D6)
        }
    }
}

private fun DrawScope.drawBlock(x: Float, y: Float, w: Float, h: Float) {
    drawRoundRect(
        color = FILL,
        topLeft = Offset(x, y),
        size = Size(w, h),
        cornerRadius = CornerRadius(4f)
    )
    drawRoundRect(
        color = BORDER,
        topLeft = Offset(x, y),
        size = Size(w, h),
        cornerRadius = CornerRadius(4f),
        style = Stroke(width = 1f)
    )
}

private fun DrawScope.drawSeparator(x: Float, y: Float, w: Float, h: Float) {
    drawLine(
        color = BORDER,
        start = Offset(x + w / 2f, y - 8f),
        end = Offset(x + w / 2f, y + h + 8f),
        strokeWidth = 1f
    )
}

/** Half the row's height, top or bottom half - fixed size, never resized (D29). */
private fun DrawScope.drawHalfTable(x: Float, y: Float, w: Float, h: Float, facing: String?) {
    val hh = h / 2f
    val hy = if (facing == "bottom") y + h - hh else y
    drawBlock(x, hy, w, hh)
}

/** render.js's drawFacility: the block, plus a fitted icon (or a text fallback if unknown). */
private fun DrawScope.drawFacility(type: String, x: Float, y: Float, w: Float, h: Float, textMeasurer: TextMeasurer) {
    drawBlock(x, y, w, h)
    val icon = FACILITY_ICONS[type]
    if (icon == null) {
        val layoutResult = textMeasurer.measure(
            text = FACILITY_LABEL[type] ?: "?",
            style = TextStyle(color = MUTED, fontSize = 8.sp, textAlign = TextAlign.Center)
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
        icon.paths.forEach { p ->
            val path = PathParser().parsePathString(p.d).toPath()
            if (p.evenOdd) path.fillType = PathFillType.EvenOdd
            if (p.fill != null) drawPath(path, color = p.fill)
            if (p.stroke != null) {
                drawPath(
                    path, color = p.stroke,
                    style = Stroke(width = p.strokeWidth, cap = StrokeCap.Round, join = StrokeJoin.Round)
                )
            }
        }
    }
}

private fun DrawScope.drawSeat(item: SeatItem, x: Float, y: Float, w: Float, h: Float, textMeasurer: TextMeasurer) {
    val known = item.kind in Vocabulary.KINDS
    val fill: Color
    val strokeColor: Color?
    val textColor: Color
    val backFill: Color
    when {
        !known -> { fill = Color(0xFFE3E4E7); strokeColor = Color(0xFFC7CAD1); textColor = OFF_TEXT; backFill = Color(0xFFC7CAD1) }
        item.inclusive -> { fill = Color.White; strokeColor = NAVY; textColor = NAVY; backFill = NAVY }
        else -> { fill = NAVY; strokeColor = null; textColor = Color.White; backFill = NAVY }
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
            cornerRadius = CornerRadius(4f), style = Stroke(width = 2f)
        )
    }
    // Seat label, always drawn (render.js's drawSeat: "?" for an unknown kind, the
    // seat id otherwise) - centered, matching the reference's 12sp/600 text.
    val label = if (known) item.seat else "?"
    val layoutResult = textMeasurer.measure(
        text = label,
        style = TextStyle(color = textColor, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
    )
    drawText(
        textLayoutResult = layoutResult,
        topLeft = Offset(x + (w - layoutResult.size.width) / 2f, y + (h - layoutResult.size.height) / 2f)
    )
}
