package ua.gov.uz.schemgen.sample

import android.content.res.Configuration
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.compose.foundation.ScrollState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.ComposeView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.isVisible
import androidx.core.view.updatePadding
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import androidx.recyclerview.widget.SimpleItemAnimator
import kotlinx.coroutines.launch
import ua.gov.uz.schemgen.layout.SchemeMode

/**
 * The wagon list in legacy Views, the way the Android sales app hosts the renderer: a
 * RecyclerView whose rows are ordinary Views with one ComposeView for the scheme.
 */
class ViewsFragment : Fragment(R.layout.fragment_views) {
    private val vm: WagonsViewModel by activityViewModels()

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val list = view as RecyclerView
        val dark = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        val adapter = WagonAdapter(dark, vm::toggle)
        list.layoutManager = LinearLayoutManager(requireContext())
        list.adapter = adapter
        // A tap changes the wagon's selection, and RecyclerView would animate that change by
        // cross-fading to a second holder: the whole scheme flickers, and the second holder
        // shows its own horizontal position. Without it the same row just recomposes.
        (list.itemAnimator as SimpleItemAnimator).supportsChangeAnimations = false

        val gap = resources.getDimensionPixelSize(R.dimen.list_gap)
        ViewCompat.setOnApplyWindowInsetsListener(list) { v, insets ->
            v.updatePadding(bottom = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom + gap)
            insets
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                var count = -1
                vm.state.collect { st ->
                    val grew = count >= 0 && st.wagons.size > count
                    count = st.wagons.size
                    val rows = st.wagons.map { Row(it, st.mode, st.selected[it.id].orEmpty()) }
                    // added wagons go to the end; follow them there
                    adapter.submitList(rows) { if (grew) list.smoothScrollToPosition(rows.lastIndex) }
                }
            }
        }
    }
}

private class Row(val wagon: Wagon, val mode: SchemeMode, val selected: Set<String>)

private class WagonAdapter(
    private val dark: Boolean,
    private val onSeatClick: (Long, String) -> Unit,
) : ListAdapter<Row, WagonHolder>(Diff) {
    /** Horizontal position per wagon. A holder is recycled for other wagons, so it can't keep it. */
    private val scrolls = mutableMapOf<Long, ScrollState>()

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        WagonHolder(LayoutInflater.from(parent.context).inflate(R.layout.item_wagon, parent, false), dark, onSeatClick)

    override fun onBindViewHolder(holder: WagonHolder, position: Int) {
        val row = getItem(position)
        holder.bind(row, scrolls.getOrPut(row.wagon.id) { ScrollState(0) })
    }

    override fun onCurrentListChanged(previous: List<Row>, current: List<Row>) {
        val ids = current.mapTo(mutableSetOf()) { it.wagon.id }
        scrolls.keys.retainAll(ids)
    }

    object Diff : DiffUtil.ItemCallback<Row>() {
        override fun areItemsTheSame(old: Row, new: Row) = old.wagon.id == new.wagon.id

        // a Wagon is replaced, never changed, so identity says whether it changed
        override fun areContentsTheSame(old: Row, new: Row) =
            old.wagon === new.wagon && old.mode == new.mode && old.selected == new.selected
    }
}

private class WagonHolder(
    view: View,
    dark: Boolean,
    onSeatClick: (Long, String) -> Unit,
) : RecyclerView.ViewHolder(view) {
    private val title: TextView = view.findViewById(R.id.title)
    private val meta: TextView = view.findViewById(R.id.meta)
    private val problems: TextView = view.findViewById(R.id.problems)
    private val selection: TextView = view.findViewById(R.id.selection)

    // content is set once per holder; binding only swaps this state, so scrolling doesn't
    // build a new composition for every row it binds
    private var row by mutableStateOf<Row?>(null)
    private var scroll by mutableStateOf(ScrollState(0))

    init {
        view.findViewById<ComposeView>(R.id.scheme).setContent {
            row?.let { r -> WagonScheme(r.wagon, scroll, r.mode, r.selected, dark, { seat -> onSeatClick(r.wagon.id, seat) }) }
        }
    }

    fun bind(r: Row, scroll: ScrollState) {
        row = r
        this.scroll = scroll
        title.text = r.wagon.label
        meta.text = r.wagon.summary
        problems.text = r.wagon.problems
        problems.isVisible = r.wagon.problems != null
        selection.text = selectionText(r.selected)
        selection.isVisible = r.mode == SchemeMode.SELECT
    }
}
