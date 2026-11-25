import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { createContext, runInContext } from "node:vm"
import { describe, expect, test } from "vitest"
import { Interaction, SchemeMode, seatState } from "../src/layout/SeatState.js"
import { itemBoxes, layout } from "../src/layout/Layout.js"
import { validate } from "../src/layout/Validate.js"
import { SeatItem } from "../src/model/Scheme.js"
import { SchemeParser } from "../src/model/SchemeParser.js"
import { FIXTURES_DIR } from "./Fixtures.js"

/**
 * format.js is canonical (CLAUDE.md): this runs web/js/format.js itself, with the tokens
 * from icons.js and countSeats from render.js, and checks the port against it on every
 * shared fixture - every deck size, column, item box, validation message and seat state.
 * A stand-in for the golden fixtures of roadmap phase 3 until they exist.
 */
const WEB_JS = fileURLToPath(new URL("../../../web/js/", import.meta.url))
const js = createContext({})
for (const f of ["icons.js", "format.js", "render.js"]) runInContext(readFileSync(WEB_JS + f, "utf8"), js, { filename: f })
const ref = js as unknown as {
    layout(deck: unknown): { cols: { index: number, x: number, w: number }[], width: number, height: number }
    itemBox(deck: unknown, L: unknown, pc: unknown, it: unknown): { x: number, y: number, w: number, h: number }
    validate(scheme: unknown): { level: string, text: string }[]
    seatState(it: unknown, opts: unknown): string
}
const LEVEL: Record<string, string> = { e: "error", w: "warn", ok: "ok" }

const fixtures = readdirSync(FIXTURES_DIR).filter(f => f.endsWith(".json"))

describe("parity with web/js/format.js", () => {
    test("there are fixtures to compare", () => {
        expect(fixtures.length).toBeGreaterThanOrEqual(8)
    })

    for (const file of fixtures) {
        const raw = readFileSync(FIXTURES_DIR + file, "utf8")
        const json = JSON.parse(raw)
        const scheme = SchemeParser.parse(raw)

        test(`${file}: deck sizes, columns and every item box`, () => {
            scheme.decks.forEach((deck, di) => {
                const jsDeck = json.decks[di]
                const jsL = ref.layout(jsDeck)
                const L = layout(deck)
                expect([L.width, L.height], `deck ${di} size`).toEqual([jsL.width, jsL.height])
                expect(L.columns.map(c => [c.index, c.x, c.w])).toEqual(jsL.cols.map(c => [c.index, c.x, c.w]))
                const jsBoxes = jsL.cols.flatMap((pc: any) =>
                    (pc.col.items || []).map((it: unknown) => ref.itemBox(jsDeck, jsL, pc, it)))
                expect(itemBoxes(deck, L).map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h }))).toEqual(jsBoxes)
            })
        })

        test(`${file}: validation messages`, () => {
            const expected = ref.validate(json).map(m => ({ level: LEVEL[m.level], text: m.text }))
            expect(validate(scheme)).toEqual(expected)
        })

        test(`${file}: seat states in view and select mode`, () => {
            const seats = scheme.decks.flatMap(d => d.columns.flatMap(c => c.items))
                .filter((it): it is SeatItem => it instanceof SeatItem)
            const jsSeats = json.decks.flatMap((d: any) => (d.columns || []).flatMap((c: any) => c.items || []))
                .filter((it: any) => it.seat != null)
            const available = new Set(seats.filter((_, i) => i % 2 === 0).map(s => s.seat))
            const selected = new Set(seats.filter((_, i) => i % 4 === 0).map(s => s.seat))
            const select = new Interaction(SchemeMode.SELECT, available, selected)
            expect(seats.map(s => seatState(s, new Interaction()))).toEqual(jsSeats.map((s: unknown) => ref.seatState(s, null)))
            expect(seats.map(s => seatState(s, select)))
                .toEqual(jsSeats.map((s: unknown) => ref.seatState(s, { mode: "select", available, selected })))
        })
    }
})
