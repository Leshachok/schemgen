import { type SeatItem, Vocabulary, isIn } from "../model/Scheme.js"

/**
 * Renderer contract - interaction modes (D45). Runtime input, never part of the
 * scheme (D4). Mirrors web/js/format.js's MODES / seatState() / seatTappable() and
 * compose-renderer's layout/SeatState.kt. The values are format.js's, so a Vue template
 * can pass `mode="select"` as well as `SchemeMode.SELECT`.
 */
export const SchemeMode = {
    /** Every known seat looks available; nothing is tappable. */
    VIEW: "view",
    /** Only seats in `available` are available and tappable. */
    SELECT: "select"
} as const
export type SchemeMode = typeof SchemeMode[keyof typeof SchemeMode]

export const SeatState = {
    UNKNOWN: "unknown",
    AVAILABLE: "available",
    UNAVAILABLE: "unavailable",
    SELECTED: "selected"
} as const
export type SeatState = typeof SeatState[keyof typeof SeatState]

/** What the renderer is told at runtime. [selected] is owned by the app (D46): the
 *  renderer reports taps and never changes it. */
export class Interaction {
    constructor(
        readonly mode: SchemeMode = SchemeMode.VIEW,
        readonly available: ReadonlySet<string> = new Set(),
        readonly selected: ReadonlySet<string> = new Set()
    ) {}
}

export function seatState(item: SeatItem, interaction: Interaction): SeatState {
    if (!isIn(item.kind, Vocabulary.KINDS)) return SeatState.UNKNOWN
    if (interaction.mode !== SchemeMode.SELECT) return SeatState.AVAILABLE
    if (!interaction.available.has(item.seat)) return SeatState.UNAVAILABLE
    if (interaction.selected.has(item.seat)) return SeatState.SELECTED
    return SeatState.AVAILABLE
}

export function seatTappable(item: SeatItem, interaction: Interaction): boolean {
    if (interaction.mode !== SchemeMode.SELECT) return false
    const st = seatState(item, interaction)
    return st === SeatState.AVAILABLE || st === SeatState.SELECTED
}
