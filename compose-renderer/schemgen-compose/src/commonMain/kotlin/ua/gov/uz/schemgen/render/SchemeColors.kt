package ua.gov.uz.schemgen.render

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

/**
 * The theme a consumer passes in - colors only, never sizes (D34). Defaults are the
 * web reference's colors (web/js/render.js) until the shared token file exists
 * (roadmap phase 4); that file will replace these defaults, not this shape.
 */
@Immutable
data class SchemeColors(
    /** Vehicle outline fill; also the fill of an available inclusive seat. */
    val background: Color = Color.White,
    /** Vehicle outline, block borders, separators, unavailable seat border. */
    val border: Color = Color(0xFFD4D5D6),
    /** Facility, table and half-table fill. */
    val block: Color = Color(0xFFF7F6F8),
    /** Available seat fill; inclusive seat outline and number. */
    val seat: Color = Color(0xFF213786),
    val onSeat: Color = Color.White,
    val selected: Color = Color(0xFFEA580C),
    val onSelected: Color = Color.White,
    /** Unavailable seat fill; chair seat fill. */
    val unavailable: Color = Color(0xFFEDEEF0),
    /** Unavailable and unknown seat number. */
    val onUnavailable: Color = Color(0xFF9AA0A6),
    /** Seat of an unknown kind - an inert placeholder (D6). */
    val unknown: Color = Color(0xFFE3E4E7),
    val unknownBorder: Color = Color(0xFFC7CAD1),
    /** Facility glyphs and the chair's back. */
    val icon: Color = Color(0xFF7E8386),
    /** Text drawn in place of a facility glyph that has no art. */
    val iconLabel: Color = Color(0xFF6B7078),
)
