import { describe, expect, test } from "vitest"
import { Level, validate } from "../src/layout/Validate.js"
import { Interaction, SchemeMode, seatState, seatTappable } from "../src/layout/SeatState.js"
import { T, clampedEndRow, itemBoxes, layout, seatAt, spanCols } from "../src/layout/Layout.js"
import { SeatItem, StructuralItem, Vocabulary } from "../src/model/Scheme.js"
import { SchemeParser } from "../src/model/SchemeParser.js"
import { ICONS } from "../src/render/Icons.js"
import { Fixtures } from "./Fixtures.js"

/** Port of compose-renderer's commonTest SchemeParserTest.kt, test for test. */
describe("SchemeParser", () => {
    const errorsOf = (json: string) => validate(SchemeParser.parse(json)).filter(m => m.level === Level.ERROR)

    test("kupe parses with no structural errors", () => {
        const scheme = SchemeParser.parse(Fixtures.KUPE)
        expect(errorsOf(Fixtures.KUPE)).toEqual([])
        expect(scheme.key).toBe("KUP-34")
    })

    test("platskart parses with no structural errors", () => {
        expect(errorsOf(Fixtures.PLATSKART)).toEqual([])
    })

    /** The deliberately-broken fixture must still surface as broken here; if this ever
     *  reports 0, the validator has silently gone out of sync with format.js. */
    test("broken fixture still reports structural errors", () => {
        expect(errorsOf(Fixtures.BROKEN).length).toBeGreaterThan(0)
    })

    test("several decks need distinct levels", () => {
        const deck = `{"rows":1,"columns":[{"items":[{"seat":"1","kind":"sit","row":1}]}]}`
        const errors = (decks: string) => errorsOf(`{"decks":[${decks}]}`)

        expect(errors(deck), "a single deck needs no level").toEqual([])
        expect(errors(`${deck},${deck}`).length, "two decks without level must fail").toBeGreaterThan(0)
        const lower = deck.replace("{", `{"level":"lower",`)
        const upper = deck.replace("{", `{"level":"upper",`)
        expect(errors(`${lower},${upper}`), "lower + upper is valid").toEqual([])
        expect(errors(`${lower},${lower}`).length, "duplicate levels must fail").toBeGreaterThan(0)
        expect(SchemeParser.parse(`{"decks":[${lower}]}`).decks[0]!.level).toBe("lower")
    })

    test("bus parses with driver and no errors", () => {
        const scheme = SchemeParser.parse(Fixtures.BUS)
        const msgs = validate(scheme)
        expect(msgs.filter(m => m.level !== Level.OK)).toEqual([])
        expect(scheme.vehicle).toBe("bus")
        const items = scheme.decks[0]!.columns[0]!.items
        expect(items.length).toBe(1)
        expect((items[0] as StructuralItem).type).toBe("driver")
    })

    /** One cell is the driver's minimum, not its size (D51). */
    test("driver resizes like any facility", () => {
        const scheme = SchemeParser.parse(
            `{"decks":[{"rows":3,"columns":[{"items":[{"type":"driver","row":1,"span":{"rows":3,"cols":2}}]},{"items":[]}]}]}`
        )
        expect(validate(scheme).filter(m => m.level !== Level.OK), "a resized driver is valid").toEqual([])
        const item = scheme.decks[0]!.columns[0]!.items[0]!
        expect(clampedEndRow(item, 3)).toBe(3)
        expect(spanCols(item)).toBe(2)
    })

    test("interaction modes follow the contract", () => {
        const scheme = SchemeParser.parse(
            `{"decks":[{"rows":1,"columns":[{"items":[
                {"seat":"1","kind":"sit","row":1}]},{"items":[
                {"seat":"2","kind":"sit","row":1}]},{"items":[
                {"seat":"3","kind":"hammock","row":1}]}]}]}`
        )
        const seats = scheme.decks[0]!.columns.map(c => c.items[0] as SeatItem)
        const view = new Interaction()
        expect(seats.map(it => seatState(it, view))).toEqual(["available", "available", "unknown"])
        expect(seats.some(it => seatTappable(it, view)), "nothing is tappable in view mode").toBe(false)

        const select = new Interaction(SchemeMode.SELECT, new Set(["1", "3"]), new Set(["1"]))
        expect(seats.map(it => seatState(it, select))).toEqual(["selected", "unavailable", "unknown"])
        expect(seats.map(it => seatTappable(it, select))).toEqual([true, false, false])
    })

    test("hit test finds the seat under a point", () => {
        const deck = SchemeParser.parse(Fixtures.BUS).decks[0]!
        const boxes = itemBoxes(deck)
        const seat1 = boxes.find(it => it.item instanceof SeatItem && it.item.seat === "1")!
        expect(seatAt(deck, seat1.x + seat1.w / 2, seat1.y + seat1.h / 2)?.seat).toBe("1")
        const driver = boxes.find(it => it.item instanceof StructuralItem && it.item.type === "driver")!
        expect(seatAt(deck, driver.x + 1, driver.y + 1), "the driver is not a seat").toBeNull()
        expect(seatAt(deck, 1, 1), "padding hits nothing").toBeNull()
    })

    test("wide items cover their columns", () => {
        const scheme = SchemeParser.parse(Fixtures.WIDE)
        expect(validate(scheme).filter(m => m.level !== Level.OK)).toEqual([])
        const deck = scheme.decks[0]!
        const L = layout(deck)
        // a column only covered by a wide item is seat-wide, not a gap
        expect(L.columns[1]!.w).toBe(T.SEAT)
        const table = itemBoxes(deck, L).find(it => it.item instanceof StructuralItem && it.item.type === "table")!
        expect(table.x).toBe(L.columns[4]!.x)
        expect(table.x + table.w).toBe(L.columns[5]!.x + L.columns[5]!.w)
    })

    test("wide item rules", () => {
        const msgs = (cols: string) => validate(SchemeParser.parse(`{"decks":[{"rows":1,"columns":[${cols}]}]}`))
        const table2 = `{"items":[{"type":"table","row":1,"span":{"cols":2}}]}`
        const seat = `{"items":[{"seat":"1","kind":"sit","row":1}]}`
        expect(msgs(`${table2},${seat}`).some(m => m.level === Level.ERROR && m.text.includes("two items")),
            "a wide item overlapping the next column's item must fail").toBe(true)
        expect(msgs(table2).some(m => m.level === Level.ERROR && m.text.includes("past the last column"))).toBe(true)
        const wideSeat = msgs(`{"items":[{"seat":"1","kind":"sit","row":1,"span":{"cols":2}}]},{"items":[]}`)
        expect(wideSeat.filter(m => m.level === Level.ERROR), "cols on a seat is ignored, not an error").toEqual([])
        expect(wideSeat.some(m => m.level === Level.WARN && m.text.includes("one column wide"))).toBe(true)
    })

    /** The same expected values as Compose's geometryMatchesFormatJs; formatJs.test.ts
     *  checks every box of every fixture against format.js itself. */
    test("geometry matches format.js", () => {
        const expected: [string, string, string[]][] = [
            [Fixtures.KUPE, "1380x170", ["16,8,56,96", "84,2,10,110", "106,16,40,38"]],
            [Fixtures.PLATSKART, "1312x220", ["16,8,56,146", "84,2,10,160", "106,16,40,38"]],
            [Fixtures.LUX, "1312x120", ["16,8,56,104", "84,2,10,116", "106,16,40,88"]],
            [Fixtures.BUS, "764x270", ["16,216,56,46", "84,16,40,38", "136,16,40,38"]],
            [Fixtures.WIDE, "460x170", ["16,8,108,96", "136,2,10,110"]],
            [Fixtures.SMALLTABLE, "978x170", ["16,8,56,96", "84,2,10,110", "106,16,40,38"]],
        ]
        for (const [json, size, firstBoxes] of expected) {
            const deck = SchemeParser.parse(json).decks[0]!
            const L = layout(deck)
            expect(`${L.width}x${L.height}`).toBe(size)
            const boxes = itemBoxes(deck, L)
            // the first item of each of the first three non-empty columns
            const firsts = L.columns.slice(0, 3).filter(pc => pc.column.items.length > 0)
                .map(pc => boxes.find(b => b.item === pc.column.items[0])!)
                .map(b => `${b.x},${b.y},${b.w},${b.h}`)
            expect(firsts).toEqual(firstBoxes)
        }
    })

    /** Blocks on the same rows line up whatever is next to them (D51, the deck-edge overhang). */
    test("facility height depends only on its rows", () => {
        const deck = SchemeParser.parse(
            `{"decks":[{"rows":5,"columns":[
                {"items":[{"type":"toilet","row":3,"span":{"rows":3}}]},
                {"items":[{"type":"baggage","row":1,"span":{"rows":2}},{"type":"toilet","row":3,"span":{"rows":3}}]}]}]}`
        ).decks[0]!
        const boxes = itemBoxes(deck)
        const toilets = boxes.filter(it => (it.item as StructuralItem).type === "toilet")
        expect(toilets[0]!.y).toBe(toilets[1]!.y)
        expect(toilets[0]!.h).toBe(toilets[1]!.h)
        const baggage = boxes.find(it => (it.item as StructuralItem).type === "baggage")!
        expect(toilets[1]!.y - (baggage.y + baggage.h), "stacked blocks keep the row gap").toBe(12)
    })

    /** A partition is fixed to the vehicle wall; an end inside the deck stops 8 past its row. */
    test("partition runs to the wall", () => {
        const ends = (rows: number, item: string): [number, number] => {
            const deck = SchemeParser.parse(`{"decks":[{"rows":${rows},"columns":[{"items":[${item}]}]}]}`).decks[0]!
            const L = layout(deck)
            const b = itemBoxes(deck, L)[0]!
            return [b.y, L.height - (b.y + b.h)]
        }
        expect(ends(2, `{"type":"separator","row":1,"span":{"rows":2}}`), "full height: wall to wall").toEqual([2, 2])
        expect(ends(3, `{"type":"separator","row":1,"span":{"rows":2}}`)[0], "top end on the wall").toBe(2)
        expect(ends(5, `{"type":"separator","row":2,"span":{"rows":2}}`)[0], "inner end: row 2 minus 8").toBe(58)
    })

    /** D52: the outlined seat is a kind, takes facing, and `inclusive` is no longer read. */
    test("folding seat is a kind", () => {
        const scheme = SchemeParser.parse(
            `{"decks":[{"rows":1,"columns":[{"items":[{"seat":"1","kind":"folding","facing":"left","inclusive":true,"row":1}]}]}]}`
        )
        expect(validate(scheme).filter(m => m.level !== Level.OK)).toEqual([])
        const seat = scheme.decks[0]!.columns[0]!.items[0] as SeatItem
        expect(seatState(seat, new Interaction())).toBe("available")
    })

    test("facilities below their minimum warn", () => {
        const msgs = (item: string) => validate(SchemeParser.parse(`{"decks":[{"rows":3,"columns":[{"items":[${item}]}]}]}`))
        expect(msgs(`{"type":"toilet","row":1}`).some(m => m.level === Level.WARN && m.text.includes("at least 2 rows"))).toBe(true)
        expect(msgs(`{"type":"toilet","row":1,"span":{"rows":2}}`).filter(m => m.level !== Level.OK)).toEqual([])
        expect(msgs(`{"type":"driver","row":1}`).filter(m => m.level !== Level.OK), "a driver may be one row").toEqual([])
    })

    /** D50: `chair` and `half_table` are gone with no alias - they draw as unknown types. */
    test("removed names are unknown types", () => {
        for (const type of ["chair", "half_table"]) {
            const msgs = validate(SchemeParser.parse(`{"decks":[{"rows":1,"columns":[{"items":[{"type":"${type}","row":1}]}]}]}`))
            expect(msgs.some(m => m.level === Level.WARN && m.text.includes(`unknown type "${type}"`)), type).toBe(true)
        }
    })

    /** Every non-seat item may be wide except separator, which only grows in length (D51). */
    test("only seats and separators stay one column", () => {
        const msgs = (type: string) => validate(SchemeParser.parse(
            `{"decks":[{"rows":1,"columns":[{"items":[{"type":"${type}","row":1,"span":{"cols":2}}]},{"items":[]}]}]}`))
        expect(msgs("separator").some(m => m.level === Level.WARN && m.text.includes("one column wide"))).toBe(true)
        for (const type of ["small_table", "driver", "table"]) {
            expect(msgs(type).filter(m => m.level !== Level.OK), `${type} may be wide`).toEqual([])
        }
    })

    test("every facility has art", () => {
        const missing = Vocabulary.FACILITIES.filter(it => !ICONS.has(it))
        expect(missing, "regenerate with web/tools/figma_icons.py").toEqual([])
    })

    /** Kotlin's kotlinx leniency, which SchemeParser.ts reproduces: numbers read as text
     *  where a string is expected, numeric text as a number where one is expected. */
    test("parses leniently like kotlinx", () => {
        const scheme = SchemeParser.parse(`{"rev":"3","decks":[{"rows":"2","columns":[{"items":[{"seat":12,"kind":"sit","row":2}]}]}]}`)
        expect(scheme.rev).toBe(3)
        expect(scheme.decks[0]!.rows).toBe(2)
        expect((scheme.decks[0]!.columns[0]!.items[0] as SeatItem).seat).toBe("12")
        expect(() => SchemeParser.parse("[]")).toThrow()
        expect(SchemeParser.parse({ key: "OBJ", decks: [] }).key, "takes an already-parsed object").toBe("OBJ")
    })
})
