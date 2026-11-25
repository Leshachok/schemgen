package ua.gov.uz.schemgen.sample

import android.os.Bundle
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.compose.ui.unit.dp
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ua.gov.uz.schemgen.layout.SchemeMode

/** The same wagon list written in Compose: a LazyColumn of cards. */
class ComposeFragment : Fragment() {
    private val vm: WagonsViewModel by activityViewModels()

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?) =
        ComposeView(requireContext()).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                val dark = isSystemInDarkTheme()
                SampleTheme(dark) {
                    Surface(Modifier.fillMaxSize()) { WagonList(vm, dark) }
                }
            }
        }
}

@Composable
private fun WagonList(vm: WagonsViewModel, dark: Boolean) {
    val st by vm.state.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()

    // added wagons go to the end; follow them there
    var count by remember { mutableIntStateOf(st.wagons.size) }
    LaunchedEffect(st.wagons.size) {
        if (st.wagons.size > count) listState.animateScrollToItem(st.wagons.lastIndex)
        count = st.wagons.size
    }

    val bottom = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    LazyColumn(
        state = listState,
        contentPadding = PaddingValues(top = 8.dp, bottom = bottom + 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(st.wagons, key = { it.id }) { w ->
            val selected = st.selected[w.id].orEmpty()
            WagonCard(w, st.mode, selected, dark) { seat -> vm.toggle(w.id, seat) }
        }
    }
}

@Composable
private fun WagonCard(wagon: Wagon, mode: SchemeMode, selected: Set<String>, dark: Boolean, onSeatClick: (String) -> Unit) {
    val text = Modifier.padding(horizontal = 16.dp)
    Card(Modifier.fillMaxWidth().padding(horizontal = 12.dp)) {
        Column(Modifier.padding(vertical = 12.dp)) {
            Text(wagon.label, text, style = MaterialTheme.typography.titleMedium)
            Text(wagon.summary, text, style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            wagon.problems?.let {
                Text(it, text, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
            }
            Spacer(Modifier.height(8.dp))
            // saveable, so LazyColumn keeps the position of a wagon scrolled out of view
            WagonScheme(wagon, rememberScrollState(), mode, selected, dark, onSeatClick)
            if (mode == SchemeMode.SELECT) {
                Spacer(Modifier.height(8.dp))
                Text(selectionText(selected), text, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}
