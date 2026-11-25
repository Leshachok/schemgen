import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

/*
 * The wasm harness's twin: the builder's Preview tab loads this in an iframe, from
 * localhost:5173 in development and from vue-preview/ next to web/index.html when
 * deployed (see build.md). The library is used from source, so a change to it shows
 * here without a library build.
 */
export default defineConfig({
    base: "./",
    resolve: {
        alias: {
            "@uz/schemgen-renderer-vue": fileURLToPath(new URL("../schemgen-renderer-vue/src/index.ts", import.meta.url))
        }
    },
    server: {
        port: 5173,
        strictPort: true,
        // the sample scheme comes from /shared-fixtures, outside this package
        fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] }
    },
    build: { outDir: "dist", emptyOutDir: true }
})
