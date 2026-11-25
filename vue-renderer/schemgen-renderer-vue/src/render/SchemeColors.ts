/**
 * The theme a consumer passes in - colors only, never sizes (D34). [Light] and [Dark] are
 * the guidelines file's two palettes (D50), the same values as web/css/app.css and
 * compose-renderer's render/SchemeColors.kt; an app with its own light/dark switch passes
 * the matching one, or its own copy of either: `{ ...SchemeColors.Light, seat: "#123456" }`.
 * Any CSS colour works.
 */
export interface SchemeColors {
    /** Vehicle body. Not in the guidelines yet - a stand-in, like the web builder's. */
    readonly background: string
    /** Vehicle outline. */
    readonly border: string
    /** Facility, table and small-table fill. */
    readonly block: string
    /** Facility icons and the fallback label of an element with no art. */
    readonly icon: string
    /** Table outline, partitions and the steps. */
    readonly line: string
    /** The standalone wheelchair marker. */
    readonly marker: string
    /** Available seat; a folding seat's outline and number. */
    readonly seat: string
    readonly onSeat: string
    readonly selected: string
    readonly onSelected: string
    readonly unavailable: string
    /** Unavailable and unknown seat number. */
    readonly onUnavailable: string
    /** Inside of a folding seat (D52). White in both palettes, as the guidelines draw it. */
    readonly folding: string
    /** Seat of an unknown kind - an inert placeholder (D6). Not in the guidelines yet. */
    readonly unknown: string
}

const Light: SchemeColors = {
    background: "#FFFFFF",
    border: "#D4D5D6",
    block: "#F7F6F8",
    icon: "#B7BABC",
    line: "#D4D5D6",
    marker: "#D4D5D6",
    seat: "#213786",
    onSeat: "#FFFFFF",
    selected: "#EF9010",
    onSelected: "#FFFFFF",
    unavailable: "#E3E5ED",
    onUnavailable: "#6C6E75",
    folding: "#FFFFFF",
    unknown: "#E3E4E7",
}

const Dark: SchemeColors = {
    ...Light,
    background: "#15171C",
    border: "#2C2E32",
    block: "#04060B",
    icon: "#686A6D",
    line: "#2C2E32",
    marker: "#686A6D",
    seat: "#3A5BCF",
    unavailable: "#252931",
    onUnavailable: "#B7BABC",
    unknown: "#3A3D44",
}

/** Kotlin's `SchemeColors.Light` / `SchemeColors.Dark`; `SchemeColors()` is [Light]. */
export const SchemeColors: { readonly Light: SchemeColors, readonly Dark: SchemeColors } =
    Object.freeze({ Light: Object.freeze(Light), Dark: Object.freeze(Dark) })
