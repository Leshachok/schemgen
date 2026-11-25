// Writes the web builder's sample list (web/js/schemes.js: the hand-written schemes and the
// catalogue ones) to src/main/assets/samples.json, as [{ id, label, scheme }], in the
// builder's order. Run by hand after schemes.js changes:
//
//   node compose-renderer/sampleApp/export-samples.mjs

import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import vm from "node:vm"

const here = new URL(".", import.meta.url)
const repo = new URL("../../", here)

// schemes.js is a browser script with top-level declarations; run it in its own context
const ctx = vm.createContext({})
vm.runInContext(readFileSync(new URL("web/js/schemes.js", repo), "utf8") + "\n;this.__SCHEMES = SCHEMES;", ctx)

const samples = ctx.__SCHEMES.map(s => ({ id: s.id, label: s.label, scheme: s.build() }))
const out = fileURLToPath(new URL("src/main/assets/samples.json", here))
writeFileSync(out, JSON.stringify(samples) + "\n")
console.log(`wrote ${samples.length} samples to ${out}`)
