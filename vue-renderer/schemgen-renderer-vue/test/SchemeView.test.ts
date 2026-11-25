// @vitest-environment happy-dom
import { mount } from "@vue/test-utils"
import { createSSRApp, h } from "vue"
import { renderToString } from "vue/server-renderer"
import { describe, expect, test } from "vitest"
import { itemBoxes } from "../src/layout/Layout.js"
import { SeatItem } from "../src/model/Scheme.js"
import { SchemeParser } from "../src/model/SchemeParser.js"
import { SchemeColors, SchemeView } from "../src/index.js"
import { Fixtures } from "./Fixtures.js"

const bus = SchemeParser.parse(Fixtures.BUS)
const box = (seat: string) =>
    itemBoxes(bus.decks[0]!).find(b => b.item instanceof SeatItem && b.item.seat === seat)!

describe("SchemeView", () => {
    /** Nuxt renders on the server first: nothing may touch window or document there. */
    test("renders on the server", async () => {
        const html = await renderToString(createSSRApp({ render: () => h(SchemeView, { scheme: SchemeParser.parse(Fixtures.KUPE) }) }))
        expect(html).toContain(`<svg`)
        expect(html).toContain(`aria-label="Wagon KUP-34"`)
        expect(html).toContain(`>34</text>`)
        expect(html).not.toContain(`role="button"`)
    })

    test("one svg per deck, labelled with its level", () => {
        const deck = (lvl: string) => `{"level":"${lvl}","rows":1,"columns":[{"items":[{"seat":"${lvl}","kind":"sit","row":1}]}]}`
        const w = mount(SchemeView, { props: { scheme: SchemeParser.parse(`{"key":"X","decks":[${deck("lower")},${deck("upper")}]}`) } })
        expect(w.findAll("svg").map(s => s.attributes("aria-label"))).toEqual(["Wagon X, lower deck", "Wagon X, upper deck"])
    })

    test("draws in the colors it is given", () => {
        const w = mount(SchemeView, { props: { scheme: bus, colors: SchemeColors.Dark } })
        expect(w.find("svg > rect").attributes("fill")).toBe(SchemeColors.Dark.background)
        expect(w.find(`g[aria-label^="1,"] rect`).attributes("fill")).toBe(SchemeColors.Dark.seat)
    })

    test("view mode reports no taps", async () => {
        const w = mount(SchemeView, { props: { scheme: bus } })
        const b = box("1")
        await w.find("svg").trigger("click", { clientX: b.x + b.w / 2, clientY: b.y + b.h / 2 })
        expect(w.emitted("seatClick")).toBeUndefined()
    })

    /** Taps are hit-tested on the deck by seatAt, as in Compose; only available seats report. */
    test("select mode reports taps on available seats only", async () => {
        const w = mount(SchemeView, { props: { scheme: bus, mode: "select", available: ["1", "2"], selected: new Set(["2"]) } })
        for (const seat of ["1", "2", "3"]) {
            const b = box(seat)
            await w.find("svg").trigger("click", { clientX: b.x + b.w / 2, clientY: b.y + b.h / 2 })
        }
        expect(w.emitted("seatClick")).toEqual([["1"], ["2"]])
        expect(w.find(`g[aria-label="2, selected"]`).attributes("aria-pressed")).toBe("true")
        expect(w.find(`g[aria-label="3, unavailable"]`).attributes("role")).toBeUndefined()
    })

    test("the renderer never changes the selection itself", async () => {
        const w = mount(SchemeView, { props: { scheme: bus, mode: "select", available: ["1"] } })
        const b = box("1")
        await w.find("svg").trigger("click", { clientX: b.x + b.w / 2, clientY: b.y + b.h / 2 })
        expect(w.find(`g[aria-label="1, available"]`).exists()).toBe(true)
    })

    test("a tappable seat answers the keyboard", async () => {
        const w = mount(SchemeView, { props: { scheme: bus, mode: "select", available: ["1"] } })
        const seat = w.find(`g[aria-label="1, available"]`)
        expect(seat.attributes("tabindex")).toBe("0")
        await seat.trigger("keydown", { key: "Enter" })
        await seat.trigger("keydown", { key: " " })
        expect(w.emitted("seatClick")).toEqual([["1"], ["1"]])
    })
})
