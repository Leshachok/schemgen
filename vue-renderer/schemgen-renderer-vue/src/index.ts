/**
 * `@uz/schemgen-renderer-vue`: the web renderer (D31), a port of compose-renderer's
 * `schemgen-renderer-compose`. Public API, as in Compose:
 *
 *   const scheme = SchemeParser.parse(json)
 *   <SchemeView :scheme="scheme" mode="select" :available="available" :selected="selected"
 *               :colors="SchemeColors.Dark" @seat-click="toggle" />
 */
export * from "./core.js"
export { SchemeView } from "./render/SchemeCanvas.js"
export { SchemeColors } from "./render/SchemeColors.js"
