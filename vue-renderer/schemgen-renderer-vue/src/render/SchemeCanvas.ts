import { defineComponent, h as el, type PropType, type VNode } from "vue"
import { Interaction, SchemeMode, SeatState, seatState, seatTappable } from "../layout/SeatState.js"
import { T, isSeparator, itemBoxes, layout, seatAt } from "../layout/Layout.js"
import { type Deck, type Item, Scheme, SeatItem, StructuralItem, Vocabulary, isIn } from "../model/Scheme.js"
import { FACILITY_LABEL, ICONS, SeatBack } from "./Icons.js"
import { SchemeColors } from "./SchemeColors.js"

/**
 * Seats (with seat-back bracket and berth bars), facility blocks with icons, tables,
 * small tables and separators: a port of compose-renderer's render/SchemeCanvas.kt,
 * function for function, drawn to the guidelines file (D50-D52). Compose paints a
 * Canvas; this emits SVG, so it renders on the server (Nuxt SSR) and screen readers
 * see every seat. Each Compose `drawX(...)` is a `drawX(s, ...)` here that pushes SVG
 * nodes onto [s] instead of painting.
 */

/** What a Compose DrawScope paints onto: here, the SVG nodes of one deck, in paint order.
 *  Vue's `h` is imported as `el`, render.js's name for it, so `h` can stay the height. */
type DrawScope = VNode[]

/**
 * Draws a scheme, one SVG per deck stacked top to bottom. [mode] "view": every seat
 * looks available, nothing reacts. [mode] "select": seats in [available] are tappable
 * and each tap emits `seatClick` with the seat number - the app owns [selected] and
 * passes the updated set back in (D45, D46).
 *
 * Each deck has a fixed size from the layout, so a long wagon is wider than a phone.
 * The renderer doesn't scroll by itself - put it in an `overflow-x: auto` box as the
 * screen needs. `class` and `style` land on the root element, like a Compose modifier.
 */
export const SchemeView = defineComponent({
    name: "SchemeView",
    props: {
        /** From `SchemeParser.parse(json)`. */
        scheme: {
            type: Object as PropType<Scheme>,
            required: true,
            validator: (v: unknown) => v instanceof Scheme
        },
        mode: { type: String as PropType<SchemeMode>, default: SchemeMode.VIEW },
        available: { type: [Set, Array] as PropType<ReadonlySet<string> | readonly string[]>, default: () => [] },
        selected: { type: [Set, Array] as PropType<ReadonlySet<string> | readonly string[]>, default: () => [] },
        colors: { type: Object as PropType<SchemeColors>, default: () => SchemeColors.Light }
    },
    emits: {
        /** `@seat-click` in a template, `onSeatClick` in a render function (D45). */
        seatClick: (seat: string) => typeof seat === "string"
    },
    setup(props, { emit }) {
        const onSeatClick = (seat: string) => emit("seatClick", seat)
        return () => {
            const interaction = new Interaction(props.mode, new Set(props.available), new Set(props.selected))
            return el(
                "div",
                { style: "display:flex;flex-direction:column;align-items:flex-start;gap:8px;width:max-content" },
                props.scheme.decks.map((deck, i) =>
                    deckCanvas(i, deck, deckLabel(props.scheme, deck), interaction, props.colors, onSeatClick))
            )
        }
    }
})

/** Accessibility label, same wording as render.js: "Bus BUS-53, lower deck". */
function deckLabel(scheme: Scheme, deck: Deck): string {
    return (scheme.vehicle === "bus" ? "Bus " : "Wagon ") + (scheme.key ?? "") +
        (deck.level !== null ? `, ${deck.level} deck` : "")
}

function deckCanvas(
    key: number, deck: Deck, label: string, interaction: Interaction, colors: SchemeColors,
    onSeatClick: (seat: string) => void
): VNode {
    const L = layout(deck)
    const s: DrawScope = []
    // outline - filled background plus a border, render.js's single rect with both
    s.push(el("rect", {
        x: T.WALL, y: T.WALL, width: L.width - T.WALL * 2, height: L.height - T.WALL * 2, rx: 12,
        fill: colors.background, stroke: colors.border, "stroke-width": 1
    }))

    itemBoxes(deck, L).forEach(b => drawItem(s, b.item, b.x, b.y, b.w, b.h, interaction, colors, onSeatClick))

    return el("svg", {
        key,
        xmlns: "http://www.w3.org/2000/svg",
        width: L.width, height: L.height, viewBox: `0 0 ${L.width} ${L.height}`,
        role: "group", "aria-label": label,
        style: "display:block;user-select:none;-webkit-user-select:none",
        onClick: interaction.mode === SchemeMode.SELECT ? (e: MouseEvent) => {
            // layout units are CSS px; the page may have scaled the svg, so map back
            const svg = e.currentTarget as SVGSVGElement
            const r = svg.getBoundingClientRect()
            const kx = r.width > 0 ? L.width / r.width : 1
            const ky = r.height > 0 ? L.height / r.height : 1
            const seat = seatAt(deck, (e.clientX - r.left) * kx, (e.clientY - r.top) * ky)
            if (seat !== null && seatTappable(seat, interaction)) onSeatClick(seat.seat)
        } : undefined
    }, s)
}

function drawItem(
    s: DrawScope, item: Item, x: number, y: number, w: number, h: number, interaction: Interaction,
    colors: SchemeColors, onSeatClick: (seat: string) => void
) {
    if (item instanceof SeatItem) drawSeat(s, item, x, y, w, h, interaction, colors, onSeatClick)
    else if (item instanceof StructuralItem) {
        if (isSeparator(item)) drawSeparator(s, x, y, w, h, colors)
        else if (item.type === "small_table") drawSmallTable(s, x, y, w, h, item.facing, colors)
        else if (item.type === "table") drawTable(s, x, y, w, h, colors)
        // an unknown type gets its fallback label, no type at all a "?" (D6)
        else if (item.type !== null) drawFacility(s, item.type, x, y, w, h, colors)
        else drawBlock(s, x, y, w, h, colors, "?")
    }
}

function drawBlock(s: DrawScope, x: number, y: number, w: number, h: number, colors: SchemeColors, label: string | null = null) {
    s.push(rect(x, y, w, h, T.RADIUS, { fill: colors.block }))
    if (label !== null) drawLabel(s, label, x, y, w, h, colors.icon)
}

function drawLabel(s: DrawScope, text: string, x: number, y: number, w: number, h: number, color: string) {
    s.push(textAt(text, x + w / 2, y + h / 2, { "font-size": 8, fill: color }))
}

/** Tables carry a 2px outline drawn inside their box, as in the guidelines. */
function drawTable(s: DrawScope, x: number, y: number, w: number, h: number, colors: SchemeColors) {
    s.push(rect(x + 1, y + 1, w - 2, h - 2, T.RADIUS, { fill: colors.block, stroke: colors.line, "stroke-width": 2 }))
}

/** Half the height of the rows it covers, in their top or bottom half. */
function drawSmallTable(s: DrawScope, x: number, y: number, w: number, h: number, facing: string | null, colors: SchemeColors) {
    const hh = h / 2
    drawTable(s, x, facing === "bottom" ? y + h - hh : y, w, hh, colors)
}

/** The box already runs to the wall or past its rows (overhangs() in Layout.ts). */
function drawSeparator(s: DrawScope, x: number, y: number, w: number, h: number, colors: SchemeColors) {
    s.push(rect(x + w / 2 - 1, y, 2, h, 1, { fill: colors.line }))
}

/** A facility block with its icon centred at its own size - icons never scale (D51). Steps
 *  and the wheelchair marker are their own art, with no block. */
function drawFacility(s: DrawScope, type: string, x: number, y: number, w: number, h: number, colors: SchemeColors) {
    const bare = isIn(type, Vocabulary.BARE_TYPES)
    const icon = ICONS.get(type)
    if (!bare || icon === undefined) drawBlock(s, x, y, w, h, colors)
    if (icon === undefined) {
        drawLabel(s, FACILITY_LABEL.get(type) ?? "?", x, y, w, h, colors.icon)
        return
    }
    const color = type === "handicapped_wheelchair" ? colors.marker : bare ? colors.line : colors.icon
    s.push(el("g", { transform: `translate(${x + (w - icon.w) / 2},${y + (h - icon.h) / 2})` }, icon.paths.map(p =>
        el("path", {
            d: p.d,
            transform: p.tx !== 0 || p.ty !== 0 ? `translate(${p.tx},${p.ty})` : undefined,
            fill: p.fill ? color : "none",
            "fill-rule": p.evenOdd ? "evenodd" : undefined,
            stroke: p.stroke > 0 ? color : undefined,
            "stroke-width": p.stroke > 0 ? p.stroke : undefined,
            "stroke-linecap": p.roundCap ? "round" : undefined,
            "stroke-linejoin": p.roundJoin ? "round" : undefined
        })
    )))
}

/** render.js's drawSeat: sit and folding seats are a 32 px body with the back bracket at
 *  50% (D50); a berth carries its bar above (upper) or below (lower); a folding seat is an
 *  outline in the state colour (D52). */
function drawSeat(
    s: DrawScope, item: SeatItem, x: number, y: number, w: number, h: number, interaction: Interaction,
    colors: SchemeColors, onSeatClick: (seat: string) => void
) {
    const state = seatState(item, interaction)
    const c = state === SeatState.UNKNOWN ? colors.unknown
        : state === SeatState.SELECTED ? colors.selected
        : state === SeatState.UNAVAILABLE ? colors.unavailable
        : colors.seat
    let textColor = state === SeatState.UNKNOWN || state === SeatState.UNAVAILABLE ? colors.onUnavailable
        : state === SeatState.SELECTED ? colors.onSelected
        : colors.onSeat
    const folding = item.kind === "folding" && state !== SeatState.UNKNOWN
    const g: DrawScope = []

    let bx = x, by = y, bw = w, bh = h
    if (isIn(item.kind, Vocabulary.FACING_KINDS)) {
        bx = x + (w - T.SQUARE) / 2; by = y + (h - T.SQUARE) / 2; bw = T.SQUARE; bh = T.SQUARE
        const facing = item.facing
        if (facing !== null && isIn(facing, Vocabulary.FACING)) {
            const k = T.SQUARE / SeatBack.SEAT_SIZE
            g.push(el("path", {
                d: SeatBack.PATH, fill: c, opacity: T.BACK_OPACITY,
                transform: `rotate(${SeatBack.ANGLE.get(facing)} ${bx + bw / 2} ${by + bh / 2}) ` +
                    `translate(${bx - SeatBack.SEAT_X * k},${by - SeatBack.SEAT_Y * k}) scale(${k})`
            }))
        }
    } else if (item.kind === "sleep" && (item.berth === "upper" || item.berth === "lower")) {
        const upper = item.berth === "upper"
        g.push(rect(x, upper ? y : y + h - T.BAR_H, w, T.BAR_H, T.BAR_H / 2, { fill: c }))
        const bar = T.BAR_H + T.BAR_GAP
        by = upper ? y + bar : y
        bh = h - bar
    }

    if (folding) {
        g.push(rect(bx + 1, by + 1, bw - 2, bh - 2, T.RADIUS, { fill: colors.folding, stroke: c, "stroke-width": 2 }))
        if (state !== SeatState.UNAVAILABLE) textColor = c
    } else {
        g.push(rect(bx, by, bw, bh, T.RADIUS, { fill: c }))
    }

    const label = isIn(item.kind, Vocabulary.KINDS) ? item.seat : "?"
    g.push(textAt(label, bx + bw / 2, by + bh / 2, { "font-size": T.FONT, "font-weight": 700, fill: textColor }))

    // Compose has one label per deck; SVG gives every seat its own, worded like render.js.
    // Taps are hit-tested on the deck (seatAt), as in Compose; the keyboard needs the seat.
    const bits = [item.seat]
    if (item.kind === "sleep" && item.berth !== null) bits.push(item.berth)
    if (item.kind === "folding") bits.push("folding")
    if (state !== SeatState.UNKNOWN) bits.push(state)
    const tappable = seatTappable(item, interaction)
    s.push(el("g", {
        "aria-label": bits.join(", "),
        role: tappable ? "button" : undefined,
        tabindex: tappable ? 0 : undefined,
        "aria-pressed": tappable ? String(state === SeatState.SELECTED) : undefined,
        style: tappable ? "cursor:pointer" : undefined,
        onKeydown: tappable ? (e: KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSeatClick(item.seat) }
        } : undefined
    }, g))
}

function rect(x: number, y: number, w: number, h: number, rx: number, paint: Record<string, string | number>): VNode {
    return el("rect", { x, y, width: w, height: h, rx, ...paint })
}

/** Centred on (cx, cy), like Compose's measured-then-centred drawText. */
function textAt(text: string, cx: number, cy: number, style: Record<string, string | number>): VNode {
    return el("text", { x: cx, y: cy, "text-anchor": "middle", "dominant-baseline": "central", ...style }, text)
}
