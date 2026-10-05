package schemgen

import schemgen.layout.Level
import schemgen.layout.validate
import schemgen.model.SchemeParser
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Run with `./gradlew composeApp:wasmJsBrowserTest`. */
class SchemeParserTest {

    @Test
    fun kupeParsesWithNoStructuralErrors() {
        val scheme = SchemeParser.parse(Fixtures.KUPE)
        val msgs = validate(scheme)
        val errors = msgs.filter { it.level == Level.ERROR }
        assertTrue(errors.isEmpty(), "unexpected errors: $errors")
        assertEquals("KUP-34", scheme.key)
    }

    @Test
    fun platskartParsesWithNoStructuralErrors() {
        val scheme = SchemeParser.parse(Fixtures.PLATSKART)
        val msgs = validate(scheme)
        val errors = msgs.filter { it.level == Level.ERROR }
        assertTrue(errors.isEmpty(), "unexpected errors: $errors")
    }

    /** The deliberately-broken fixture must still surface as broken here -
     *  the JS renderer flags exactly 4 errors (row-1 clamps for it.type=="table"
     *  removed unused seatTags check); if this ever reports 0, the Kotlin
     *  validator has silently gone out of sync with format.js. */
    @Test
    fun brokenFixtureStillReportsStructuralErrors() {
        val scheme = SchemeParser.parse(Fixtures.BROKEN)
        val errors = validate(scheme).filter { it.level == Level.ERROR }
        assertTrue(errors.isNotEmpty(), "the broken fixture should never validate clean")
    }

    @Test
    fun severalDecksNeedDistinctLevels() {
        val deck = """{"rows":1,"columns":[{"items":[{"seat":"1","kind":"sit","row":1}]}]}"""
        fun errors(decks: String) = validate(SchemeParser.parse("""{"decks":[$decks]}"""))
            .filter { it.level == Level.ERROR }

        assertTrue(errors(deck).isEmpty(), "a single deck needs no level")
        assertTrue(errors("$deck,$deck").isNotEmpty(), "two decks without level must fail")
        val lower = deck.replaceFirst("{", """{"level":"lower",""")
        val upper = deck.replaceFirst("{", """{"level":"upper",""")
        assertTrue(errors("$lower,$upper").isEmpty(), "lower + upper is valid")
        assertTrue(errors("$lower,$lower").isNotEmpty(), "duplicate levels must fail")
        assertEquals("lower", SchemeParser.parse("""{"decks":[$lower]}""").decks[0].level)
    }

    @Test
    fun busParsesWithDriverAndNoErrors() {
        val scheme = SchemeParser.parse(Fixtures.BUS)
        val msgs = validate(scheme)
        assertTrue(msgs.none { it.level != Level.OK }, "unexpected messages: $msgs")
        assertEquals("bus", scheme.vehicle)
        val driver = scheme.decks[0].columns[0].items.single()
        assertEquals("driver", (driver as schemgen.model.StructuralItem).type)
    }

    @Test
    fun driverIsAlwaysOneCell() {
        val scheme = SchemeParser.parse(
            """{"decks":[{"rows":3,"columns":[{"items":[{"type":"driver","row":1,"span":{"rows":3}}]}]}]}"""
        )
        val msgs = validate(scheme)
        assertTrue(msgs.none { it.level == Level.ERROR }, "span on driver must not error: $msgs")
        assertTrue(msgs.any { it.level == Level.WARN && "driver" in it.text })
        assertEquals(1, schemgen.layout.clampedEndRow(scheme.decks[0].columns[0].items[0], 3))
    }

    @Test
    fun interactionModesFollowTheContract() {
        val scheme = SchemeParser.parse(
            """{"decks":[{"rows":1,"columns":[{"items":[
                {"seat":"1","kind":"sit","row":1}]},{"items":[
                {"seat":"2","kind":"sit","row":1}]},{"items":[
                {"seat":"3","kind":"hammock","row":1}]}]}]}"""
        )
        val seats = scheme.decks[0].columns.map { it.items.single() as schemgen.model.SeatItem }
        val view = schemgen.layout.Interaction()
        assertEquals(listOf("AVAILABLE", "AVAILABLE", "UNKNOWN"), seats.map { schemgen.layout.seatState(it, view).name })
        assertTrue(seats.none { schemgen.layout.seatTappable(it, view) }, "nothing is tappable in view mode")

        val select = schemgen.layout.Interaction(
            schemgen.layout.SchemeMode.SELECT, available = setOf("1", "3"), selected = setOf("1")
        )
        assertEquals(listOf("SELECTED", "UNAVAILABLE", "UNKNOWN"), seats.map { schemgen.layout.seatState(it, select).name })
        assertEquals(listOf(true, false, false), seats.map { schemgen.layout.seatTappable(it, select) })
    }

    @Test
    fun hitTestFindsTheSeatUnderAPoint() {
        val scheme = SchemeParser.parse(Fixtures.BUS)
        val deck = scheme.decks[0]
        val boxes = schemgen.layout.itemBoxes(deck)
        val seat1 = boxes.first { (it.item as? schemgen.model.SeatItem)?.seat == "1" }
        assertEquals("1", schemgen.layout.seatAt(deck, seat1.x + seat1.w / 2, seat1.y + seat1.h / 2)?.seat)
        val driver = boxes.first { (it.item as? schemgen.model.StructuralItem)?.type == "driver" }
        assertEquals(null, schemgen.layout.seatAt(deck, driver.x + 1, driver.y + 1), "the driver is not a seat")
        assertEquals(null, schemgen.layout.seatAt(deck, 1f, 1f), "padding hits nothing")
    }

    @Test
    fun wideItemsCoverTheirColumns() {
        val scheme = SchemeParser.parse(Fixtures.WIDE)
        val msgs = validate(scheme)
        assertTrue(msgs.none { it.level != Level.OK }, "unexpected messages: $msgs")
        val deck = scheme.decks[0]
        val L = schemgen.layout.layout(deck)
        // a column only covered by a wide item is seat-wide, not a gap
        assertEquals(schemgen.layout.T.SEAT, L.columns[1].w)
        val table = schemgen.layout.itemBoxes(deck, L)
            .first { (it.item as? schemgen.model.StructuralItem)?.type == "table" }
        assertEquals(L.columns[4].x, table.x)
        assertEquals(L.columns[5].x + L.columns[5].w, table.x + table.w)
    }

    @Test
    fun wideItemRules() {
        fun msgs(cols: String) = validate(SchemeParser.parse("""{"decks":[{"rows":1,"columns":[$cols]}]}"""))
        val table2 = """{"items":[{"type":"table","row":1,"span":{"cols":2}}]}"""
        val seat = """{"items":[{"seat":"1","kind":"sit","row":1}]}"""
        assertTrue(msgs("$table2,$seat").any { it.level == Level.ERROR && "two items" in it.text },
            "a wide item overlapping the next column's item must fail")
        assertTrue(msgs(table2).any { it.level == Level.ERROR && "past the last column" in it.text })
        val wideSeat = msgs("""{"items":[{"seat":"1","kind":"sit","row":1,"span":{"cols":2}}]},{"items":[]}""")
        assertTrue(wideSeat.none { it.level == Level.ERROR }, "cols on a seat is ignored, not an error: $wideSeat")
        assertTrue(wideSeat.any { it.level == Level.WARN && "one column wide" in it.text })
    }
}
