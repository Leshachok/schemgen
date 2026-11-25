import { type Item, type Scheme, SeatItem, Vocabulary, isIn } from "../model/Scheme.js"
import { canSpanCols, minRows, spanCols, spanRows } from "./Layout.js"

export const Level = { ERROR: "error", WARN: "warn", OK: "ok" } as const
export type Level = typeof Level[keyof typeof Level]

export interface Message {
    readonly level: Level
    readonly text: string
}

/**
 * Structural validation - deliberately mirrors web/js/format.js's `validate()`
 * rule for rule, as compose-renderer's layout/Validate.kt does. If this ever drifts
 * from the JS version, the renderers can silently disagree about which schemes are
 * valid; keep them in lockstep.
 */
export function validate(scheme: Scheme): Message[] {
    const msgs: Message[] = []
    const add = (level: Level, text: string) => msgs.push({ level, text })
    if (scheme.decks.length === 0) return [{ level: Level.ERROR, text: "No decks in scheme." }]

    const vehicle = scheme.vehicle
    if (vehicle !== null && !isIn(vehicle, Vocabulary.VEHICLES)) {
        add(Level.WARN, `unknown vehicle "${vehicle}" — treated as train.`)
    }
    let seatCount = 0
    const multi = scheme.decks.length > 1
    const levelsSeen = new Set<string>()
    scheme.decks.forEach((deck, di) => {
        const lvl = deck.level
        if (lvl !== null && !isIn(lvl, Vocabulary.LEVELS)) {
            add(Level.WARN, `deck ${di}: unknown level "${lvl}".`)
        }
        if (multi && lvl === null) {
            add(Level.ERROR, `deck ${di}: level is required when a scheme has several decks.`)
        }
        if (lvl !== null) {
            if (levelsSeen.has(lvl)) add(Level.ERROR, `two decks with level "${lvl}".`)
            levelsSeen.add(lvl)
        }

        const seen = new Set<string>()
        const cells = new Set<string>()
        const maxRow = Math.max(deck.rows, 1)
        const maxCol = deck.columns.length

        deck.columns.forEach((col, ci) => {
            col.items.forEach((item: Item) => {
                const row = item.row
                const rows = spanRows(item)
                if (row + rows - 1 > maxRow) {
                    add(Level.ERROR, `col ${ci}: item at row ${row} spans ${rows} rows, past rows=${maxRow}.`)
                }
                const cols = spanCols(item)
                if (ci + cols > maxCol) {
                    add(Level.ERROR, `col ${ci}: item at row ${row} spans ${cols} columns, past the last column.`)
                }
                if (item.span.cols !== 1 && !canSpanCols(item)) {
                    const what = item instanceof SeatItem ? `seat ${item.seat}` : item.type
                    add(Level.WARN, `col ${ci}: ${what} is always one column wide — span.cols ignored.`)
                }
                if (rows < minRows(item)) {
                    add(
                        Level.WARN,
                        `col ${ci}: ${item instanceof SeatItem ? "seat" : item.type} is at least ${minRows(item)} rows tall in the guidelines — it spans ${rows}.`
                    )
                }
                for (let c = ci; c < Math.min(ci + cols, maxCol); c++) {
                    for (let r = row; r < row + rows; r++) {
                        const k = `${c}:${r}`
                        if (cells.has(k)) add(Level.ERROR, `col ${c} row ${r}: two items in one cell.`)
                        cells.add(k)
                    }
                }

                if (item instanceof SeatItem) {
                    const id = item.seat
                    if (seen.has(id)) add(Level.ERROR, `duplicate seat number "${id}".`)
                    seen.add(id)
                    seatCount++
                    if (!isIn(item.kind, Vocabulary.KINDS)) {
                        add(Level.WARN, `seat ${id}: unknown kind "${item.kind}" — drawn as placeholder.`)
                    }
                    if (item.kind === "sleep" && !isIn(item.berth, Vocabulary.BERTHS)) {
                        add(Level.ERROR, `seat ${id}: kind=sleep needs berth.`)
                    }
                    if (item.kind !== "sleep" && item.berth !== null) {
                        add(Level.ERROR, `seat ${id}: berth only valid on kind=sleep.`)
                    }
                    if (item.facing !== null && !isIn(item.facing, Vocabulary.FACING)) {
                        add(Level.WARN, `seat ${id}: unknown facing "${item.facing}".`)
                    }
                } else {
                    const type = item.type
                    if (type === null) {
                        add(Level.WARN, `col ${ci}: item has no type — drawn as placeholder.`)
                    } else if (!isIn(type, Vocabulary.KNOWN_TYPES)) {
                        add(Level.WARN, `unknown type "${type}" — drawn as placeholder.`)
                    }
                    if (type === "small_table" && item.facing !== null && item.facing !== "top" && item.facing !== "bottom") {
                        add(Level.WARN, `col ${ci}: small_table facing must be top or bottom.`)
                    }
                }
            })
        })
    })

    if (msgs.length === 0) add(Level.OK, `No structural problems. ${seatCount} seats.`)
    return msgs
}
