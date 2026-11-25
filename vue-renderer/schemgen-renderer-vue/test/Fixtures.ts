import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * /shared-fixtures, read from disk (compose-renderer's Fixtures.kt embeds them as
 * constants because its tests also run on iOS; Node can just read the files).
 */
// not `new URL(..., import.meta.url)`: happy-dom swaps the global URL in component tests
export const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../shared-fixtures/")

const read = (name: string): string => readFileSync(FIXTURES_DIR + name + ".json", "utf8")

export const Fixtures = {
    KUPE: read("kupe"),
    PLATSKART: read("platskart"),
    LUX: read("lux"),
    BROKEN: read("broken"),
    BUS: read("bus"),
    WIDE: read("wide"),
    SMALLTABLE: read("smalltable"),
}
