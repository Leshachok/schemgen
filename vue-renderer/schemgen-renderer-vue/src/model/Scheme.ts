/**
 * Mirrors the wagon scheme JSON format 1:1 - see /docs/wagon-scheme-format.md.
 * Port of compose-renderer's model/Scheme.kt: same types, same names, same defaults.
 *
 * Deliberately NOT a clean tagged union: the JSON itself dispatches on field
 * presence (`seat` vs `type`), not a discriminator field, so the model does
 * the same. [SchemeParser] is what turns raw JSON into these types.
 */

/** As written in the JSON. [cols] only applies to items that may be wide (D48) -
 *  read it through `spanCols()`, which ignores it on everything else. */
export class Span {
    constructor(readonly rows: number = 1, readonly cols: number = 1) {}
}

export type Item = SeatItem | StructuralItem

/** A named seat: [seat] is its identifier (opaque string, per format decision D10 -
 *  never derive logic from it). [kind] is sit | folding | sleep | luxury; unknown values
 *  render as an inert placeholder (format decision D6), never a crash. There is no
 *  `inclusive` seat (D52): accessibility belongs to the handicapped items only. */
export class SeatItem {
    constructor(
        readonly seat: string,
        readonly kind: string,
        readonly berth: string | null = null,     // lower | middle | upper, only for kind == "sleep"
        readonly facing: string | null = null,    // left | right | top | bottom, for sit and folding
        readonly row: number = 1,
        readonly span: Span = new Span()
    ) {}
}

/** Everything else - facility, table, small_table, separator - shares one shape
 *  (format decision D30): [type] names what it is, [facing] only applies to
 *  small_table (top | bottom). A null or unrecognized [type] renders inert. */
export class StructuralItem {
    constructor(
        readonly type: string | null,
        readonly facing: string | null = null,
        readonly row: number = 1,
        readonly span: Span = new Span()
    ) {}
}

export class Column {
    constructor(readonly items: readonly Item[] = []) {}
}

export class Deck {
    constructor(
        readonly level: string | null = null,   // lower | upper; required only when a scheme has several decks
        readonly rows: number,
        readonly columns: readonly Column[] = []
        // Deliberately no `aisleAfterRow` - the aisle concept was removed from the format
        // entirely (D24). Space is just a row nothing is placed on.
    ) {}
}

export class Scheme {
    constructor(
        readonly key: string | null,
        readonly rev: number | null,
        readonly vehicle: string | null = null,   // train | bus; absent means train
        readonly decks: readonly Deck[] = []
    ) {}
}

const FACILITIES: readonly string[] = [
    "toilet", "invalid_toilet", "baggage", "bike", "handicapped", "handicapped_wheelchair",
    "shield", "steps_up", "steps_down", "wardrobe", "cafe", "coffee_machine", "kid", "driver"
]
const STRUCTURAL_TYPES: readonly string[] = ["table", "small_table", "separator"]

/** Known vocabulary - keep this in lockstep with web/js/format.js. */
export const Vocabulary: {
    readonly KINDS: readonly string[]
    readonly FACING_KINDS: readonly string[]
    readonly BERTHS: readonly string[]
    readonly FACING: readonly string[]
    readonly LEVELS: readonly string[]
    readonly VEHICLES: readonly string[]
    readonly FACILITIES: readonly string[]
    readonly STRUCTURAL_TYPES: readonly string[]
    readonly KNOWN_TYPES: readonly string[]
    readonly BARE_TYPES: readonly string[]
    readonly MIN_ROWS: ReadonlyMap<string, number>
} = {
    KINDS: ["sit", "folding", "sleep", "luxury"],
    /** Kinds drawn as a seat body with a back bracket, turned by `facing`. */
    FACING_KINDS: ["sit", "folding"],
    BERTHS: ["lower", "middle", "upper"],
    FACING: ["left", "right", "top", "bottom"],
    LEVELS: ["lower", "upper"],
    VEHICLES: ["train", "bus"],
    /** The elements of the guidelines file "Wagon components" (D50), named after the
     *  Android sales app's drawables (D47). */
    FACILITIES,
    STRUCTURAL_TYPES,
    KNOWN_TYPES: [...FACILITIES, ...STRUCTURAL_TYPES],
    /** Drawn as their own art with no facility block behind it. */
    BARE_TYPES: ["steps_up", "steps_down", "handicapped_wheelchair"],
    /** The guidelines' minimum heights in rows (D51); anything not listed may be one row. */
    MIN_ROWS: new Map([
        ["toilet", 2], ["invalid_toilet", 2], ["baggage", 2], ["bike", 2], ["handicapped", 2],
        ["shield", 2], ["wardrobe", 2], ["cafe", 2], ["coffee_machine", 2], ["kid", 2]
    ])
}

/** `x in list` for the vocabulary lists, which Kotlin writes as `x in Vocabulary.KINDS`. */
export function isIn(value: string | null | undefined, list: readonly string[]): boolean {
    return value != null && list.includes(value)
}
