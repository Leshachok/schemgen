import { Column, Deck, type Item, Scheme, SeatItem, Span, StructuralItem } from "./Scheme.js"

/**
 * Parses scheme JSON the same way web/js/format.js + web/js/render.js do: an item
 * is a seat if it has a `seat` key, otherwise everything else keys off `type`
 * (format decision D30). Port of compose-renderer's model/SchemeParser.kt, including
 * its leniency: a number where a string is expected is read as its text ("seat": 12
 * is seat "12"), a numeric string where a number is expected as that number.
 */

type JsonObject = { readonly [key: string]: unknown }

/** kotlinx's `jsonObject`: throws unless [el] is a JSON object. */
function jsonObject(el: unknown): JsonObject {
    if (el === null || typeof el !== "object" || Array.isArray(el)) {
        throw new Error(`Element ${JSON.stringify(el)} is not a JsonObject`)
    }
    return el as JsonObject
}

/** kotlinx's `jsonPrimitive.contentOrNull`: absent and null are null, a nested object or
 *  array throws, any other primitive is its text. */
function contentOrNull(el: unknown): string | null {
    if (el === undefined || el === null) return null
    if (typeof el === "object") throw new Error(`Element ${JSON.stringify(el)} is not a JsonPrimitive`)
    return String(el)
}

/** kotlinx's `jsonPrimitive.intOrNull`: the value as a whole number, or null. */
function intOrNull(el: unknown): number | null {
    const s = contentOrNull(el)
    if (s === null || !/^[+-]?\d+$/.test(s.trim())) return null
    const n = Number(s)
    return n >= -2147483648 && n <= 2147483647 ? n : null
}

export const SchemeParser = {

    /** Throws on malformed JSON or a non-object root; missing fields fall back to defaults.
     *  Also takes a consumer's already-parsed JSON object (Kotlin's `parse(JsonObject)`). */
    parse(raw: string | object): Scheme {
        const root = jsonObject(typeof raw === "string" ? JSON.parse(raw) : raw)
        return new Scheme(
            contentOrNull(root["key"]),
            intOrNull(root["rev"]),
            contentOrNull(root["vehicle"]),
            Array.isArray(root["decks"]) ? root["decks"].map(parseDeck) : []
        )
    }
}

function parseDeck(el: unknown): Deck {
    const o = jsonObject(el)
    return new Deck(
        contentOrNull(o["level"]),
        intOrNull(o["rows"]) ?? 1,
        Array.isArray(o["columns"]) ? o["columns"].map(parseColumn) : []
    )
}

function parseColumn(el: unknown): Column {
    const o = jsonObject(el)
    const items = Array.isArray(o["items"]) ? o["items"].map(parseItem) : []
    return new Column(items)
}

function parseItem(el: unknown): Item {
    const o = jsonObject(el)
    const span = parseSpan(o["span"])
    const row = intOrNull(o["row"]) ?? 1
    const seat = contentOrNull(o["seat"])
    if (seat !== null) {
        return new SeatItem(
            seat,
            contentOrNull(o["kind"]) ?? "",
            contentOrNull(o["berth"]),
            contentOrNull(o["facing"]),
            row,
            span
        )
    } else {
        return new StructuralItem(
            contentOrNull(o["type"]),
            contentOrNull(o["facing"]),
            row,
            span
        )
    }
}

function parseSpan(el: unknown): Span {
    if (el === undefined) return new Span()
    const o = jsonObject(el)
    return new Span(
        intOrNull(o["rows"]) ?? 1,
        intOrNull(o["cols"]) ?? 1
    )
}
