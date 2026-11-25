/**
 * `@uz/schemgen-renderer-vue/core`: the parts with no Vue in them - model, parser,
 * validation and the interaction rule - for a consumer that draws schemes itself, like
 * the web sales site (D49). The same public surface as compose-renderer's non-UI code;
 * the layout stays internal there and here until the golden fixtures settle it (§9).
 */
export { Span, SeatItem, StructuralItem, Column, Deck, Scheme, Vocabulary } from "./model/Scheme.js"
export type { Item } from "./model/Scheme.js"
export { SchemeParser } from "./model/SchemeParser.js"
export { Level, validate } from "./layout/Validate.js"
export type { Message } from "./layout/Validate.js"
export { SchemeMode } from "./layout/SeatState.js"
