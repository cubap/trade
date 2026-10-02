// Test-only entry point for #97: import the solo client's browser modules under
// `node --test` using the same module map the browser uses.
//
//     const { default: ThreeRenderer } = await importClientModule('solo/js/rendering/ThreeRenderer.js')
//
// Registering the hook is process-global and one-way (Node has no unregister), so
// it is done once, lazily, on the first import. Each `node --test` file is its own
// process, which is what keeps this from changing how any other test resolves
// modules. vendor/ is generated and gitignored, so the same step server.js takes
// at boot runs here first; it is manifest-guarded and cheap when already current.

import fs from 'node:fs'
import path from 'node:path'
import { register } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { importMapEntries } from '../../../scripts/html-imports.mjs'
import { syncThree } from '../../../scripts/sync-vendor-three.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

let registered = false

/**
 * Activates the page's importmap for this process.
 * @param {{page?: string, generateVendor?: boolean}} [options]
 */
export function registerClientImportMap({ page = 'solo/index.html', generateVendor = true } = {}) {
    if (registered) return
    if (generateVendor) {
        const result = syncThree()
        if (result.status === 'skipped') {
            throw new Error(`three.js could not be vendored for tests: ${result.reason}`)
        }
    }
    const htmlPath = path.join(repoRoot, page)
    if (!fs.existsSync(htmlPath)) throw new Error(`no such page to read the importmap from: ${page}`)
    register('./client-import-map-hooks.mjs', import.meta.url, {
        data: { repoRoot, importMap: importMapEntries(fs.readFileSync(htmlPath, 'utf8')) }
    })
    registered = true
}

/**
 * `import()` a client module by repo-relative path, with the browser's map active.
 * @param {string} relPath e.g. 'solo/js/rendering/ThreeRenderer.js'
 */
export async function importClientModule(relPath) {
    registerClientImportMap()
    const abs = path.join(repoRoot, relPath)
    if (!abs.startsWith(repoRoot) || !fs.existsSync(abs)) {
        throw new Error(`no such client module: ${relPath}`)
    }
    return import(pathToFileURL(abs).href)
}

export { repoRoot }
