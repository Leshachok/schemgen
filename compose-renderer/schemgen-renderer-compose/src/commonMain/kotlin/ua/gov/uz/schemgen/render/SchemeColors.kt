package ua.gov.uz.schemgen.render

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

/**
 * The theme a consumer passes in - colors only, never sizes (D34). [Light] and [Dark] are
 * the guidelines file's two palettes (D50), the same values as web/css/app.css; an app with
 * its own light/dark switch passes the matching one, or its own copy of either.
 */
@Immutable
data class SchemeColors(
    /** Vehicle body. Not in the guidelines yet - a stand-in, like the web builder's. */
    val background: Color = Color.White,
    /** Vehicle outline. */
    val border: Color = Color(0xFFD4D5D6),
    /** Facility, table and small-table fill. */
    val block: Color = Color(0xFFF7F6F8),
    /** Facility icons and the fallback label of an element with no art. */
    val icon: Color = Color(0xFFB7BABC),
    /** Table outline, partitions and the steps. */
    val line: Color = Color(0xFFD4D5D6),
    /** The standalone wheelchair marker. */
    val marker: Color = Color(0xFFD4D5D6),
    /** Available seat; a folding seat's outline and number. */
    val seat: Color = Color(0xFF213786),
    val onSeat: Color = Color.White,
    val selected: Color = Color(0xFFEF9010),
    val onSelected: Color = Color.White,
    val unavailable: Color = Color(0xFFE3E5ED),
    /** Unavailable and unknown seat number. */
    val onUnavailable: Color = Color(0xFF6C6E75),
    /** Inside of a folding seat (D52). White in both palettes, as the guidelines draw it. */
    val folding: Color = Color.White,
    /** Seat of an unknown kind - an inert placeholder (D6). Not in the guidelines yet. */
    val unknown: Color = Color(0xFFE3E4E7),
) {
    companion object {
        val Light = SchemeColors()
        val Dark = SchemeColors(
            background = Color(0xFF15171C),
            border = Color(0xFF2C2E32),
            block = Color(0xFF04060B),
            icon = Color(0xFF686A6D),
            line = Color(0xFF2C2E32),
            marker = Color(0xFF686A6D),
            seat = Color(0xFF3A5BCF),
            unavailable = Color(0xFF252931),
            onUnavailable = Color(0xFFB7BABC),
            unknown = Color(0xFF3A3D44),
        )
    }
}
