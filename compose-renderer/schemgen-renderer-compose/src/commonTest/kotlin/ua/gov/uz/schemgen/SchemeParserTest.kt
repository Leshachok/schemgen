package ua.gov.uz.schemgen

import ua.gov.uz.schemgen.layout.Level
import ua.gov.uz.schemgen.layout.validate
import ua.gov.uz.schemgen.model.SchemeParser
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Run with `./gradlew :schemgen-renderer-compose:wasmJsBrowserTest` (or iosSimulatorArm64Test). */
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
        assertEquals("driver", (driver as ua.gov.uz.schemgen.model.StructuralItem).type)
    }

    /** One cell is the driver's minimum, not its size (D51). */
    @Test
    fun driverResizesLikeAnyFacility() {
        val scheme = SchemeParser.parse(
            """{"decks":[{"rows":3,"columns":[{"items":[{"type":"driver","row":1,"span":{"rows":3,"cols":2}}]},{"items":[]}]}]}"""
        )
        val msgs = validate(scheme)
        assertTrue(msgs.none { it.level != Level.OK }, "a resized driver is valid: $msgs")
        val item = scheme.decks[0].columns[0].items[0]
        assertEquals(3, ua.gov.uz.schemgen.layout.clampedEndRow(item, 3))
        assertEquals(2, ua.gov.uz.schemgen.layout.spanCols(item))
    }

    @Test
    fun interactionModesFollowTheContract() {
        val scheme = SchemeParser.parse(
            """{"decks":[{"rows":1,"columns":[{"items":[
                {"seat":"1","kind":"sit","row":1}]},{"items":[
                {"seat":"2","kind":"sit","row":1}]},{"items":[
                {"seat":"3","kind":"hammock","row":1}]}]}]}"""
        )
        val seats = scheme.decks[0].columns.map { it.items.single() as ua.gov.uz.schemgen.model.SeatItem }
        val view = ua.gov.uz.schemgen.layout.Interaction()
        assertEquals(listOf("AVAILABLE", "AVAILABLE", "UNKNOWN"), seats.map { ua.gov.uz.schemgen.layout.seatState(it, view).name })
        assertTrue(seats.none { ua.gov.uz.schemgen.layout.seatTappable(it, view) }, "nothing is tappable in view mode")

        val select = ua.gov.uz.schemgen.layout.Interaction(
            ua.gov.uz.schemgen.layout.SchemeMode.SELECT, available = setOf("1", "3"), selected = setOf("1")
        )
        assertEquals(listOf("SELECTED", "UNAVAILABLE", "UNKNOWN"), seats.map { ua.gov.uz.schemgen.layout.seatState(it, select).name })
        assertEquals(listOf(true, false, false), seats.map { ua.gov.uz.schemgen.layout.seatTappable(it, select) })
    }

    @Test
    fun hitTestFindsTheSeatUnderAPoint() {
        val scheme = SchemeParser.parse(Fixtures.BUS)
        val deck = scheme.decks[0]
        val boxes = ua.gov.uz.schemgen.layout.itemBoxes(deck)
        val seat1 = boxes.first { (it.item as? ua.gov.uz.schemgen.model.SeatItem)?.seat == "1" }
        assertEquals("1", ua.gov.uz.schemgen.layout.seatAt(deck, seat1.x + seat1.w / 2, seat1.y + seat1.h / 2)?.seat)
        val driver = boxes.first { (it.item as? ua.gov.uz.schemgen.model.StructuralItem)?.type == "driver" }
        assertEquals(null, ua.gov.uz.schemgen.layout.seatAt(deck, driver.x + 1, driver.y + 1), "the driver is not a seat")
        assertEquals(null, ua.gov.uz.schemgen.layout.seatAt(deck, 1f, 1f), "padding hits nothing")
    }

    @Test
    fun wideItemsCoverTheirColumns() {
        val scheme = SchemeParser.parse(Fixtures.WIDE)
        val msgs = validate(scheme)
        assertTrue(msgs.none { it.level != Level.OK }, "unexpected messages: $msgs")
        val deck = scheme.decks[0]
        val L = ua.gov.uz.schemgen.layout.layout(deck)
        // a column only covered by a wide item is seat-wide, not a gap
        assertEquals(ua.gov.uz.schemgen.layout.T.SEAT, L.columns[1].w)
        val table = ua.gov.uz.schemgen.layout.itemBoxes(deck, L)
            .first { (it.item as? ua.gov.uz.schemgen.model.StructuralItem)?.type == "table" }
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

    /**
     * Item boxes and deck sizes must equal web/js/format.js's for the same fixtures - the
     * expected values are its own output (itemBox / layout under jsc). Until the golden
     * fixture suite exists (roadmap phase 3), this is what holds the port to format.js.
     */
    @Test
    fun geometryMatchesFormatJs() {
        data class Expect(val deck: String, val boxes: List<String>)
        val expected = mapOf(
            Fixtures.KUPE to Expect("1380x170", listOf("16,8,56,96", "84,2,10,110", "106,16,40,38")),
            Fixtures.PLATSKART to Expect("1312x220", listOf("16,8,56,146", "84,2,10,160", "106,16,40,38")),
            Fixtures.LUX to Expect("1312x120", listOf("16,8,56,104", "84,2,10,116", "106,16,40,88")),
            Fixtures.BUS to Expect("764x270", listOf("16,216,56,46", "84,16,40,38", "136,16,40,38")),
            Fixtures.WIDE to Expect("460x170", listOf("16,8,108,96", "136,2,10,110")),
            Fixtures.SMALLTABLE to Expect("978x170", listOf("16,8,56,96", "84,2,10,110", "106,16,40,38")),
        )
        fun f(v: Float) = if (v == v.toInt().toFloat()) v.toInt().toString() else v.toString()
        expected.forEach { (json, e) ->
            val deck = SchemeParser.parse(json).decks[0]
            val L = ua.gov.uz.schemgen.layout.layout(deck)
            assertEquals(e.deck, "${f(L.width)}x${f(L.height)}", "deck size of ${SchemeParser.parse(json).key}")
            val boxes = ua.gov.uz.schemgen.layout.itemBoxes(deck, L)
            // the first item of each of the first three non-empty columns, as the jsc dump took them
            val firsts = L.columns.take(3).filter { it.column.items.isNotEmpty() }
                .map { pc -> boxes.first { it.item === pc.column.items[0] } }
                .map { "${f(it.x)},${f(it.y)},${f(it.w)},${f(it.h)}" }
            assertEquals(e.boxes, firsts, "boxes of ${SchemeParser.parse(json).key}")
        }
    }

    /** Blocks on the same rows line up whatever is next to them (D51, the deck-edge overhang). */
    @Test
    fun facilityHeightDependsOnlyOnItsRows() {
        val deck = SchemeParser.parse(
            """{"decks":[{"rows":5,"columns":[
                {"items":[{"type":"toilet","row":3,"span":{"rows":3}}]},
                {"items":[{"type":"baggage","row":1,"span":{"rows":2}},{"type":"toilet","row":3,"span":{"rows":3}}]}]}]}"""
        ).decks[0]
        val toilets = ua.gov.uz.schemgen.layout.itemBoxes(deck)
            .filter { (it.item as ua.gov.uz.schemgen.model.StructuralItem).type == "toilet" }
        assertEquals(toilets[0].y, toilets[1].y)
        assertEquals(toilets[0].h, toilets[1].h)
        val baggage = ua.gov.uz.schemgen.layout.itemBoxes(deck)
            .first { (it.item as ua.gov.uz.schemgen.model.StructuralItem).type == "baggage" }
        assertEquals(12f, toilets[1].y - (baggage.y + baggage.h), "stacked blocks keep the row gap")
    }

    /** A partition is fixed to the vehicle wall; an end inside the deck stops 8 past its row. */
    @Test
    fun partitionRunsToTheWall() {
        fun ends(rows: Int, item: String): Pair<Float, Float> {
            val deck = SchemeParser.parse("""{"decks":[{"rows":$rows,"columns":[{"items":[$item]}]}]}""").decks[0]
            val L = ua.gov.uz.schemgen.layout.layout(deck)
            val b = ua.gov.uz.schemgen.layout.itemBoxes(deck, L).single()
            return b.y to (L.height - (b.y + b.h))
        }
        assertEquals(2f to 2f, ends(2, """{"type":"separator","row":1,"span":{"rows":2}}"""), "full height: wall to wall")
        assertEquals(2f, ends(3, """{"type":"separator","row":1,"span":{"rows":2}}""").first, "top end on the wall")
        assertEquals(58f, ends(5, """{"type":"separator","row":2,"span":{"rows":2}}""").first, "inner end: row 2 minus 8")
    }

    /** D52: the outlined seat is a kind, takes facing, and `inclusive` is no longer read. */
    @Test
    fun foldingSeatIsAKind() {
        val scheme = SchemeParser.parse(
            """{"decks":[{"rows":1,"columns":[{"items":[{"seat":"1","kind":"folding","facing":"left","inclusive":true,"row":1}]}]}]}"""
        )
        assertTrue(validate(scheme).none { it.level != Level.OK })
        val seat = scheme.decks[0].columns[0].items[0] as ua.gov.uz.schemgen.model.SeatItem
        assertEquals("AVAILABLE", ua.gov.uz.schemgen.layout.seatState(seat, ua.gov.uz.schemgen.layout.Interaction()).name)
    }

    @Test
    fun facilitiesBelowTheirMinimumWarn() {
        fun msgs(item: String) = validate(SchemeParser.parse("""{"decks":[{"rows":3,"columns":[{"items":[$item]}]}]}"""))
        assertTrue(msgs("""{"type":"toilet","row":1}""").any { it.level == Level.WARN && "at least 2 rows" in it.text })
        assertTrue(msgs("""{"type":"toilet","row":1,"span":{"rows":2}}""").none { it.level != Level.OK })
        assertTrue(msgs("""{"type":"driver","row":1}""").none { it.level != Level.OK }, "a driver may be one row")
    }

    /** D50: `chair` and `half_table` are gone with no alias - they draw as unknown types. */
    @Test
    fun removedNamesAreUnknownTypes() {
        listOf("chair", "half_table").forEach { type ->
            val msgs = validate(SchemeParser.parse("""{"decks":[{"rows":1,"columns":[{"items":[{"type":"$type","row":1}]}]}]}"""))
            assertTrue(msgs.any { it.level == Level.WARN && "unknown type \"$type\"" in it.text }, "$type: $msgs")
        }
    }

    /** Every non-seat item may be wide except separator, which only grows in length (D51). */
    @Test
    fun onlySeatsAndSeparatorsStayOneColumn() {
        fun msgs(type: String) =
            validate(SchemeParser.parse("""{"decks":[{"rows":1,"columns":[{"items":[{"type":"$type","row":1,"span":{"cols":2}}]},{"items":[]}]}]}"""))
        assertTrue(msgs("separator").any { it.level == Level.WARN && "one column wide" in it.text })
        listOf("small_table", "driver", "table").forEach { type ->
            assertTrue(msgs(type).none { it.level != Level.OK }, "$type may be wide: ${msgs(type)}")
        }
    }

    @Test
    fun everyFacilityHasArt() {
        val missing = ua.gov.uz.schemgen.model.Vocabulary.FACILITIES.filter { it !in ua.gov.uz.schemgen.render.ICONS }
        assertTrue(missing.isEmpty(), "no icon for $missing - regenerate with web/tools/figma_icons.py")
    }
}
