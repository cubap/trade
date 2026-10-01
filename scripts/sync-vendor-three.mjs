// Materialises the three.js files the solo client actually imports (plus their
// transitive ES module closure) out of node_modules into vendor/three/.
//
// The game is served to browsers directly from this repo with no bundler, so
// the runtime modules must be servable as plain static files. Serving
// node_modules itself would expose every installed package (CodeQL
// js/exposure-of-private-files on the original #86 fix), so only this small
// allowlisted subset is ever reachable over HTTP.
//
// vendor/ is generated, not committed (see .gitignore): three.core.js alone is
// ~59k lines of third-party code, and committing it turns the pull request into
// an unreviewable diff while making scanners report three.js internals as
// first-party findings. server.js calls syncThree() on boot, so `npm install`
// followed by `npm run serve` is all a fresh clone needs. To refresh by hand:
//
//     npm run vendor:three

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { importMapTargets, inlineModuleSources, moduleSpecifiers } from './html-imports.mjs'

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Entry points actually referenced by the solo client: importmap targets used
// by bare `three` / `three/addons/` specifiers in solo/*.html module scripts,
// plus absolute /vendor/three/... imports in solo/js. Derived from the repo's
// own sources so the vendored set can't silently drift from what loads.
const ADDON_ROOT = 'three/examples/jsm/'
const VENDOR_PREFIX = '/vendor/three/'

function walkFiles(dir, exts, out = []) {
    if (!fs.existsSync(dir)) return out
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walkFiles(full, exts, out)
        else if (exts.some(e => entry.name.endsWith(e))) out.push(full)
    }
    return out
}

function specsFrom(source) {
    return moduleSpecifiers(source).filter(s => s.startsWith(VENDOR_PREFIX))
}

export function clientVendorRefs({ repoRoot = DEFAULT_ROOT } = {}) {
    const srcRoot = path.join(repoRoot, 'node_modules')
    const refs = new Set()
    const soloRoot = path.join(repoRoot, 'solo')
    for (const file of walkFiles(soloRoot, ['.html'])) {
        const src = fs.readFileSync(file, 'utf8')
        for (const target of importMapTargets(src)) {
            if (target.startsWith(VENDOR_PREFIX)) refs.add(`three/${target.slice(VENDOR_PREFIX.length)}`)
        }
        // Inline module scripts use bare `three/addons/...` specifiers.
        for (const moduleSrc of inlineModuleSources(src)) {
            for (const m of moduleSrc.matchAll(/\bfrom\s*['"]three\/addons\/([^'"]+)['"]/g)) {
                refs.add(ADDON_ROOT + m[1])
            }
            for (const spec of specsFrom(moduleSrc)) {
                refs.add(`three/${spec.slice(VENDOR_PREFIX.length)}`)
            }
        }
    }
    for (const file of walkFiles(path.join(soloRoot, 'js'), ['.js'])) {
        for (const spec of specsFrom(fs.readFileSync(file, 'utf8'))) {
            refs.add(`three/${spec.slice(VENDOR_PREFIX.length)}`)
        }
    }
    return [...refs]
        .map(r => (r.endsWith('.js') ? r : `${r}.js`))
        .filter(r => fs.existsSync(path.join(srcRoot, r)))
        .sort()
}

function resolveSpec(srcRoot, spec, fromRel) {
    const joined = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec))
    for (const candidate of [joined, `${joined}.js`, path.posix.join(joined, 'index.js')]) {
        const abs = path.join(srcRoot, candidate)
        if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return candidate
    }
    return null
}

// Transitive closure of relative imports from the client entry points. Bare
// specifiers (`three`, `three/addons/...`) are the importmap's business, not
// extra files, so they don't grow the set.
export function threeClosure({ repoRoot = DEFAULT_ROOT, roots = clientVendorRefs({ repoRoot }) } = {}) {
    const srcRoot = path.join(repoRoot, 'node_modules')
    const seen = new Set()
    const queue = roots.filter(r => fs.existsSync(path.join(srcRoot, r)))
    while (queue.length) {
        const rel = queue.pop()
        if (seen.has(rel)) continue
        seen.add(rel)
        const specs = moduleSpecifiers(fs.readFileSync(path.join(srcRoot, rel), 'utf8'))
        for (const spec of specs.filter(s => s.startsWith('.'))) {
            const resolved = resolveSpec(srcRoot, spec, rel)
            if (resolved && !seen.has(resolved)) queue.push(resolved)
        }
    }
    return [...seen].sort()
}

function manifestFor(version, files) {
    return {
        package: 'three',
        version,
        files: files.map(rel => ({ from: `node_modules/${rel}`, to: rel.replace(/^three\//, '') }))
    }
}

// Lets server boot skip re-copying ~3 MB when the on-disk set already matches.
function isUpToDate(destRoot, manifest) {
    let existing
    try {
        existing = JSON.parse(fs.readFileSync(path.join(destRoot, 'vendor-manifest.json'), 'utf8'))
    } catch {
        return false
    }
    if (existing.version !== manifest.version) return false
    const wanted = manifest.files.map(f => f.to).sort().join('|')
    const have = (existing.files || []).map(f => f.to).sort().join('|')
    if (wanted !== have) return false
    return manifest.files.every(f => fs.existsSync(path.join(destRoot, f.to)))
}

/**
 * Copies the three.js closure the client needs into destRoot.
 *
 * `node --test` runs files in parallel and every one that imports server.js
 * syncs at boot, so generation is guarded by a lock directory (mkdir is atomic
 * on every platform) and each file is written via a temp name + rename. Without
 * that, a reader could see a half-written module or hit a window where the
 * directory had been removed, which is exactly the intermittent
 * ERR_MODULE_NOT_FOUND this avoids.
 * @param {{repoRoot?: string, destRoot?: string, force?: boolean}} [options]
 * @returns {{status: string, reason?: string, files?: string[], version?: string, destRoot: string}}
 */
export function syncThree({
    repoRoot = DEFAULT_ROOT,
    destRoot = path.join(repoRoot, 'vendor', 'three'),
    force = false
} = {}) {
    const pkgJsonPath = path.join(repoRoot, 'node_modules', 'three', 'package.json')
    if (!fs.existsSync(pkgJsonPath)) {
        return { status: 'skipped', reason: 'three-not-installed', destRoot }
    }
    const roots = clientVendorRefs({ repoRoot })
    if (!roots.length) {
        return { status: 'skipped', reason: 'no-client-refs', destRoot }
    }
    const version = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')).version
    const files = threeClosure({ repoRoot, roots })
    const manifest = manifestFor(version, files)
    if (!force && isUpToDate(destRoot, manifest)) {
        return { status: 'up-to-date', files, version, destRoot }
    }

    const lock = `${destRoot}.lock`
    const deadline = Date.now() + 60_000
    let waiting = false
    for (;;) {
        try {
            fs.mkdirSync(path.dirname(lock), { recursive: true })
            fs.mkdirSync(lock)
            break
        } catch (err) {
            if (err.code !== 'EEXIST') throw err
            waiting = true
            // A crashed process must not wedge boot forever; steal a stale lock.
            try {
                if (Date.now() - fs.statSync(lock).mtimeMs > 120_000) {
                    fs.rmSync(lock, { recursive: true, force: true })
                    continue
                }
            } catch { /* lock vanished between stat and retry */ }
            if (Date.now() > deadline) throw new Error(`timed out waiting for ${lock}`)
            if (isUpToDate(destRoot, manifest)) {
                return { status: waiting ? 'generated-by-peer' : 'up-to-date', files, version, destRoot }
            }
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50)
        }
    }

    try {
        // Another process may have finished while we waited for the lock.
        const needed = force || !isUpToDate(destRoot, manifest)
        if (needed) {
            for (const rel of files) {
                // Strip the leading package directory: three/build/x.js -> build/x.js
                const to = rel.replace(/^three\//, '')
                const dest = path.join(destRoot, to)
                fs.mkdirSync(path.dirname(dest), { recursive: true })
                const tmp = `${dest}.tmp-${process.pid}`
                fs.copyFileSync(path.join(repoRoot, 'node_modules', rel), tmp)
                fs.renameSync(tmp, dest)
            }
            // Manifest last: its presence marks a complete set.
            const manifestTmp = path.join(destRoot, `vendor-manifest.json.tmp-${process.pid}`)
            fs.writeFileSync(manifestTmp, JSON.stringify(manifest, null, 4) + '\n')
            fs.renameSync(manifestTmp, path.join(destRoot, 'vendor-manifest.json'))
        }
        return { status: needed ? 'written' : 'up-to-date', files, version, destRoot }
    } finally {
        fs.rmSync(lock, { recursive: true, force: true })
    }
}

// CLI entry point (`npm run vendor:three`).
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const result = syncThree({ force: true })
    if (result.status === 'skipped') {
        console.warn(`sync-vendor-three: ${result.reason}, nothing to do`)
    } else {
        console.log(`vendored ${result.files.length} three@${result.version} files -> vendor/three/`)
    }
}
