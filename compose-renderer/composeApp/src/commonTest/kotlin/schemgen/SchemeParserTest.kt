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
}
