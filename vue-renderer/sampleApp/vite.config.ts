import { fileURLToPath } from "node:url"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"

/*
 * A sample consumer app: what a team embedding @uz/schemgen-renderer-vue writes, as plain
 * Vue SFCs. Unlike previewApp it isn't driven by the builder - it has its own JSON field.
 * The library is used from source, like previewApp, so a change to it shows here without
 * a library build; a real consumer gets the same import from the feed.
 */
export default defineConfig({
    base: "./",
    plugins: [vue()],
    resolve: {
        alias: {
            "@uz/schemgen-renderer-vue": fileURLToPath(new URL("../schemgen-renderer-vue/src/index.ts", import.meta.url))
        }
    },
    server: {
        port: 5174,
        strictPort: true,
        // the sample schemes come from /shared-fixtures, outside this package
        fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] }
    },
    build: { outDir: "dist", emptyOutDir: true }
})
