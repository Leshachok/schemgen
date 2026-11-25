package ua.gov.uz.schemgen.sample

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ua.gov.uz.schemgen.layout.SchemeMode
import ua.gov.uz.schemgen.render.SchemeColors
import ua.gov.uz.schemgen.render.SchemeView

/** Theme is colors only (D34): the app passes the palette that matches its own light/dark. */
fun schemeColors(dark: Boolean): SchemeColors = if (dark) SchemeColors.Dark else SchemeColors.Light

/**
 * The renderer as both screens host it. A wagon is wider than a phone and the renderer
 * doesn't scroll by itself, so each wagon scrolls horizontally inside the vertical list.
 * [scroll] belongs to the wagon, not to the row showing it, so the position survives a
 * row being recycled for another wagon.
 */
@Composable
fun WagonScheme(
    wagon: Wagon,
    scroll: ScrollState,
    mode: SchemeMode,
    selected: Set<String>,
    dark: Boolean,
    onSeatClick: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    SchemeView(
        scheme = wagon.scheme,
        modifier = modifier.horizontalScroll(scroll).padding(horizontal = 16.dp),
        mode = mode,
        available = wagon.available,
        selected = selected,
        colors = schemeColors(dark),
        onSeatClick = onSeatClick,
    )
}

@Composable
fun SampleTheme(dark: Boolean, content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (dark) darkColorScheme() else lightColorScheme(), content = content)
}
