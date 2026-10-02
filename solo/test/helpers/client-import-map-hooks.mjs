// ESM resolve hook that gives `node --test` the same module map the browser gets
// from a page's `<script type="importmap">` plus root-absolute specifiers.
//
// #97: the solo client has been unimportable under Node for exactly two reasons,
// both of them resolution rather than logic.
//
//   1. `import * as THREE from 'three'` is a bare specifier that only means
//      anything because index.html maps it to /vendor/three/build/three.module.js.
//      Node answers with node_modules/three instead, which is a *second copy* of
//      the library: objects built by a vendored loader (OBJLoader, GLTFLoader)
//      then stop being `instanceof` what the renderer made.
//   2. `import { OBJLoader } from '/vendor/three/examples/jsm/loaders/OBJLoader.js'`
//      is a URL, and Node turns a URL it cannot attach to a parent into a
//      filesystem path - which is why the failure in the ticket reads
//      "B:\vendor\three\...\OBJLoader.js", i.e. the drive root, not the repo.
//
// Rather than bend the production sources into a Node-only shape (a bundler, or
// relative paths that drift from the importmap the vendoring pipeline scans), the
// test runner borrows the browser's answer: read the importmap off the page and
// resolve against the very files the page loads. Nothing here is reachable from
// solo/index.html, and it cannot invent a module - a mapped path that is not on
// disk is an error, not a fallback.
//
// Hooks run on their own loader thread and cannot share state with the test
// process, so everything arrives through initialize().

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

let repoRoot = null
let entries = {}

export function initialize(data = {}) {
    if (data.repoRoot) repoRoot = path.resolve(data.repoRoot)
    if (data.importMap) entries = data.importMap
}

/** A path inside the repo that is a real file, else null. */
function repoFile(abs) {
    if (!repoRoot || !abs) return null
    const resolved = path.resolve(abs)
    if (resolved !== repoRoot && !resolved.startsWith(repoRoot + path.sep)) return null
    return fs.existsSync(resolved) && fs.statSync(resolved).isFile() ? resolved : null
}

/** `/vendor/three/build/three.module.js` -> `<repo>/vendor/three/build/...`. */
function fromRootAbsolute(specifier) {
    const clean = specifier.split('?')[0].split('#')[0]
    if (!clean.startsWith('/')) return null
    return repoFile(path.join(repoRoot, clean.slice(1)))
}

/** Longest-prefix importmap match, the way a browser resolves `three/addons/x`. */
function applyImportMap(specifier) {
    if (Object.prototype.hasOwnProperty.call(entries, specifier)) return entries[specifier]
    const prefix = Object.keys(entries)
        .filter(k => k.endsWith('/') && specifier.startsWith(k))
        .sort((a, b) => b.length - a.length)[0]
    return prefix ? entries[prefix] + specifier.slice(prefix.length) : null
}

export async function resolve(specifier, context, nextResolve) {
    // Relative paths, file URLs and anything Node already understands are left
    // alone; this hook exists for bare importmap keys and root-absolute URLs.
    const isRootAbsolute = specifier.startsWith('/')
    const isBare = !isRootAbsolute
        && !specifier.startsWith('.')
        && !/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(specifier)

    const target = isRootAbsolute ? specifier : (isBare ? applyImportMap(specifier) : null)
    if (target == null) return nextResolve(specifier, context)

    const file = fromRootAbsolute(target) ?? (path.isAbsolute(target) ? repoFile(target) : null)
    if (!file) {
        throw new Error(
            `cannot resolve "${specifier}" -> "${target}": no such file under ${repoRoot} ` +
            '(vendor/ is generated - run `npm run vendor:three`)'
        )
    }
    return { url: pathToFileURL(file).href, shortCircuit: true }
}
