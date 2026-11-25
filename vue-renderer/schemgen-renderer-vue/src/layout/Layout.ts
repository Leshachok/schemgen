import { type Column, type Deck, type Item, SeatItem, StructuralItem, Vocabulary, isIn } from "../model/Scheme.js"

/**
 * Platform layout constants - never part of the format itself, each renderer owns its
 * own values (see /docs/wagon-scheme-format.md, guardrails). The mobile preset measured
 * from the guidelines file "Wagon components" (D50), the same numbers as web/js/icons.js's
 * `T` and compose-renderer's layout/Layout.kt: berth 40x38, rows 50 apart, a facility
 * block at least 56 wide. Units are CSS px, Compose's are dp.
 */
export const T = {
    /** Cell width and height. */
    SEAT: 40,
    SEAT_H: 38,
    /** A sitting seat's body inside its cell. */
    SQUARE: 32,
    ROW_PITCH: 50,
    COL_GAP: 12,
    SEP_W: 10,
    PAD_X: 16,
    PAD_Y: 16,
    GAP_W: 18,
    BAR_H: 4,
    BAR_GAP: 2,
    /** How far a facility block on the deck's first or last row reaches into the padding (D51),
     *  and how far a partition reaches past a row inside the deck. */
    OVERHANG: 8,
    /** Inset of the vehicle outline, where a partition on an edge row ends. */
    WALL: 2,
    RADIUS: 4,
    FONT: 15,
    /** The seat-back bracket, in the seat's colour, in every state and theme. */
    BACK_OPACITY: 0.5
} as const

/** The narrowest each element may be drawn, which sets its column's width (D51);
 *  anything not listed is one seat wide. */
const ITEM_W: ReadonlyMap<string, number> = new Map([
    ["toilet", 56], ["invalid_toilet", 61], ["baggage", 56], ["bike", 56], ["handicapped", 56],
    ["shield", 56], ["wardrobe", 56], ["cafe", 56], ["coffee_machine", 56], ["kid", 56],
    ["driver", 56], ["steps_up", 56], ["steps_down", 56], ["separator", T.SEP_W]
])

/** Kotlin's `coerceAtLeast`. */
const atLeast = (v: number, min: number): number => Math.max(v, min)

export function rowY(row: number): number {
    return T.PAD_Y + (row - 1) * T.ROW_PITCH
}

export function isSeparator(item: Item): boolean {
    return item instanceof StructuralItem && item.type === "separator"
}

export function itemWidth(item: Item): number {
    return (item instanceof StructuralItem && item.type !== null ? ITEM_W.get(item.type) : undefined) ?? T.SEAT
}

/** A column holding nothing of its own but covered by a wide item is as wide as a
 *  seat, not a gap - otherwise the item would squash it. Mirrors format.js. */
export function colWidth(column: Column, covered: boolean = false): number {
    if (column.items.length === 0) return covered ? T.SEAT : T.GAP_W
    const w = Math.max(...column.items.map(itemWidth))
    return covered ? Math.max(w, T.SEAT) : w
}

export class PlacedColumn {
    constructor(readonly column: Column, readonly index: number, readonly x: number, readonly w: number) {}
}

export class DeckLayout {
    constructor(readonly columns: readonly PlacedColumn[], readonly width: number, readonly height: number) {}
}

export function layout(deck: Deck): DeckLayout {
    const covered = new Set<number>()
    deck.columns.forEach((col, i) => {
        col.items.forEach(item => { for (let c = 1; c < spanCols(item); c++) covered.add(i + c) })
    })
    let x = T.PAD_X
    const placed = deck.columns.map((col, i) => {
        const w = colWidth(col, covered.has(i))
        const p = new PlacedColumn(col, i, x, w)
        x += w + T.COL_GAP
        return p
    })
    const rows = atLeast(deck.rows, 1)
    const width = atLeast(x - T.COL_GAP + T.PAD_X, 140)
    const height = rowY(rows) + T.SEAT_H + T.PAD_Y
    return new DeckLayout(placed, width, height)
}

/** Row span clamped to the item's own rows..rows+span-1 within [maxRow], matching
 *  the JS renderer's `Math.min(row+sp.rows-1, deck.rows)` clamp in the item loop. */
export function clampedEndRow(item: Item, maxRow: number): number {
    return Math.min(item.row + spanRows(item) - 1, maxRow)
}

export function spanRows(item: Item): number {
    return item.span.rows
}

/** Seats are one column wide (D48); a partition only grows in length (D51). */
export function canSpanCols(item: Item): boolean {
    return item instanceof StructuralItem && item.type !== "separator"
}

/** Columns an item covers, counting its own. */
export function spanCols(item: Item): number {
    return canSpanCols(item) ? atLeast(item.span.cols, 1) : 1
}

/** The guidelines' minimum height in rows (D51). */
export function minRows(item: Item): number {
    return (item instanceof StructuralItem && item.type !== null ? Vocabulary.MIN_ROWS.get(item.type) : undefined) ?? 1
}

/** A facility on the deck's first or last row reaches [T.OVERHANG] past it into the deck
 *  padding, as the guidelines draw it: a block spanning the deck is 2 rows + 2 x 8 = 104.
 *  Never into a gap between rows and never depending on its neighbours, so blocks on the
 *  same rows line up and can't overlap (D51). Mirrors format.js's overhangs(). */
function overhangs(deck: Deck, item: Item): [number, number] {
    const last = item.row + spanRows(item) - 1
    const rows = atLeast(deck.rows, 1)
    // a partition is fixed to the vehicle wall: an end on the first or last row runs to the
    // outline, an end inside the deck reaches OVERHANG past its row
    if (isSeparator(item)) {
        const wall = T.PAD_Y - T.WALL
        return [item.row === 1 ? wall : T.OVERHANG, last >= rows ? wall : T.OVERHANG]
    }
    if (!(item instanceof StructuralItem) || !isIn(item.type, Vocabulary.FACILITIES)) return [0, 0]
    return [item.row === 1 ? T.OVERHANG : 0, last >= rows ? T.OVERHANG : 0]
}

/** Where one item lands on a deck - the single geometry both drawing and tap
 *  hit-testing use, so what you see is exactly what you can tap. */
export class ItemBox {
    constructor(readonly item: Item, readonly x: number, readonly y: number, readonly w: number, readonly h: number) {}

    contains(px: number, py: number): boolean {
        return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h
    }
}

export function itemBoxes(deck: Deck, deckLayout: DeckLayout = layout(deck)): ItemBox[] {
    return deckLayout.columns.flatMap(pc =>
        pc.column.items.map(item => {
            const [top, bottom] = overhangs(deck, item)
            const y = rowY(item.row) - top
            const yEnd = rowY(clampedEndRow(item, atLeast(deck.rows, 1)))
            const h = yEnd + T.SEAT_H + bottom - y
            const cols = spanCols(item)
            if (cols > 1) {
                // clipped at the deck's last column, like the row clamp above
                const last = deckLayout.columns[Math.min(pc.index + cols - 1, deckLayout.columns.length - 1)]!
                return new ItemBox(item, pc.x, y, last.x + last.w - pc.x, h)
            } else {
                const w = itemWidth(item)
                return new ItemBox(item, pc.x + (pc.w - w) / 2, y, w, h)
            }
        })
    )
}

/** The seat under a point in deck coordinates, or null. */
export function seatAt(deck: Deck, px: number, py: number): SeatItem | null {
    const hit = itemBoxes(deck).find(it => it.item instanceof SeatItem && it.contains(px, py))
    return (hit?.item as SeatItem | undefined) ?? null
}
