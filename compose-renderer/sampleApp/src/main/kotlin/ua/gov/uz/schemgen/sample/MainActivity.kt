package ua.gov.uz.schemgen.sample

import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.Menu
import android.view.MenuItem
import android.widget.EditText
import android.widget.FrameLayout
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.fragment.app.commit
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButtonToggleGroup
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import ua.gov.uz.schemgen.layout.SchemeMode

/**
 * The shell: a Views activity, like the sales app, with a switch between the Views and the
 * Compose version of the same wagon list, a View/Select mode switch and a menu for adding
 * wagons, availability and the theme.
 */
class MainActivity : AppCompatActivity() {
    private val vm: WagonsViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        setSupportActionBar(findViewById<MaterialToolbar>(R.id.toolbar))

        // the fragment manager restores the shown screen itself after a recreation
        if (savedInstanceState == null) show(vm.screen)

        val screens = findViewById<MaterialButtonToggleGroup>(R.id.screen)
        screens.check(if (vm.screen == Screen.VIEWS) R.id.screen_views else R.id.screen_compose)
        screens.addOnButtonCheckedListener { _, id, checked ->
            if (!checked) return@addOnButtonCheckedListener
            vm.screen = if (id == R.id.screen_views) Screen.VIEWS else Screen.COMPOSE
            show(vm.screen)
        }

        val modes = findViewById<MaterialButtonToggleGroup>(R.id.mode)
        modes.check(if (vm.state.value.mode == SchemeMode.VIEW) R.id.mode_view else R.id.mode_select)
        modes.addOnButtonCheckedListener { _, id, checked ->
            if (checked) vm.setMode(if (id == R.id.mode_view) SchemeMode.VIEW else SchemeMode.SELECT)
        }
    }

    private fun show(screen: Screen) = supportFragmentManager.commit {
        replace(R.id.container, if (screen == Screen.VIEWS) ViewsFragment() else ComposeFragment())
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.main, menu)
        return true
    }

    override fun onPrepareOptionsMenu(menu: Menu): Boolean {
        val theme = when (AppCompatDelegate.getDefaultNightMode()) {
            AppCompatDelegate.MODE_NIGHT_NO -> R.id.theme_light
            AppCompatDelegate.MODE_NIGHT_YES -> R.id.theme_dark
            else -> R.id.theme_system
        }
        menu.findItem(theme).isChecked = true
        return super.onPrepareOptionsMenu(menu)
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        when (item.itemId) {
            R.id.add_wagon -> showAddDialog()
            R.id.add_random -> vm.addRandom(10)
            R.id.random_availability -> vm.randomAvailability()
            R.id.all_available -> vm.allAvailable()
            R.id.clear_selection -> vm.clearSelection()
            R.id.clear_list -> vm.clear()
            // recreates the activity; the view model keeps the list, the screen and the mode
            R.id.theme_system -> AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM)
            R.id.theme_light -> AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO)
            R.id.theme_dark -> AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES)
            else -> return super.onOptionsItemSelected(item)
        }
        return true
    }

    private fun showAddDialog() {
        val labels = vm.samples.map { it.label } + getString(R.string.paste_json)
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.add_wagon)
            .setItems(labels.toTypedArray()) { _, i ->
                if (i < vm.samples.size) vm.add(vm.samples[i]) else showPasteDialog()
            }
            .show()
    }

    /** Any scheme JSON, e.g. copied from the builder; it's added if it parses. */
    private fun showPasteDialog() {
        val input = EditText(this).apply {
            setHint(R.string.paste_json_hint)
            minLines = 6
            gravity = Gravity.TOP
            typeface = Typeface.MONOSPACE
            textSize = 12f
        }
        val pad = resources.getDimensionPixelSize(R.dimen.dialog_padding)
        val frame = FrameLayout(this).apply {
            setPadding(pad, pad / 2, pad, 0)
            addView(input)
        }
        val dialog = MaterialAlertDialogBuilder(this)
            .setTitle(R.string.paste_json)
            .setView(frame)
            .setPositiveButton(R.string.add, null)
            .setNegativeButton(android.R.string.cancel, null)
            .show()
        // set here rather than in the builder, so a scheme that doesn't parse keeps the dialog open
        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
            try {
                vm.addJson(input.text.toString())
                dialog.dismiss()
            } catch (e: RuntimeException) {
                input.error = e.message ?: getString(R.string.cant_parse)
            }
        }
    }
}
