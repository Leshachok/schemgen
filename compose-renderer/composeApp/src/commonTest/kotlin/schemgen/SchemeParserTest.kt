package schemgen

import schemgen.layout.Level
import schemgen.layout.validate
import schemgen.model.SchemeParser
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * NOT YET RUN - this sandbox has no network access to fetch the Kotlin/Compose
 * toolchain, so these tests have never actually executed. They're written to the
 * same standard as the checks already run against the JS reference (see the
 * node-based smoke tests referenced in docs/wagon-scheme-format.md's history) -
 * please run `./gradlew allTests` locally and fix whatever this sandbox couldn't
 * catch before trusting this module.
 */
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
}
