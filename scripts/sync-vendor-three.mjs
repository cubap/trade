// Copies the three.js files the solo client actually imports (plus their
// transitive ES module closure) out of node_modules and into vendor/three/.
//
// The game is served to browsers directly from this repo with no bundler, so
// the runtime modules must be servable as plain static files. Serving
// node_modules itself would expose every installed package (CodeQL
// js/exposure-of-private-files), so we vendor a small allowlisted subset
// instead. Re-run after bumping the `three` dependency:
//
//     node scripts/sync-vendor-three.mjs
//
// Runs automatically on `npm install` via the postinstall script.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcRoot = path.join(repoRoot, 'node_modules')
const destRoot = path.join(repoRoot, 'vendor', 'three')

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

function clientVendorRefs() {
    const refs = new Set()
    const soloRoot = path.join(repoRoot, 'solo')
    for (const file of walkFiles(soloRoot, ['.html'])) {
        const src = fs.readFileSync(file, 'utf8')
        const importMap = src.match(/<script[^>]+type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/i)
        if (importMap) {
            try {
                const imports = JSON.parse(importMap[1]).imports || {}
                for (const target of Object.values(imports)) {
                    if (typeof target === 'string' && target.startsWith(VENDOR_PREFIX)) {
                        refs.add(`three/${target.slice(VENDOR_PREFIX.length)}`)
                    }
                }
            } catch { /* malformed importmap surfaces in tests instead */ }
        }
        for (const m of src.matchAll(/\bfrom\s*['"]three\/addons\/([^'"]+)['"]/g)) {
            refs.add(ADDON_ROOT + m[1])
        }
        for (const m of src.matchAll(new RegExp(`\\bfrom\\s*['"]${VENDOR_PREFIX}([^'"]+)['"]`, 'g'))) {
            refs.add(`three/${m[1]}`)
        }
    }
    for (const file of walkFiles(path.join(soloRoot, 'js'), ['.js'])) {
        const src = fs.readFileSync(file, 'utf8')
        for (const m of src.matchAll(new RegExp(`\\bfrom\\s*['"]${VENDOR_PREFIX}([^'"]+)['"]`, 'g'))) {
            refs.add(`three/${m[1]}`)
        }
    }
    return [...refs]
        .map(r => (r.endsWith('.js') ? r : `${r}.js`))
        .filter(r => fs.existsSync(path.join(srcRoot, r)))
        .sort()
}

const roots = clientVendorRefs()
if (!roots.length) {
    console.warn('sync-vendor-three: no /vendor/three references found under solo/, nothing to do')
    process.exit(0)
}

function resolveSpec(spec, fromRel) {
    const joined = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec))
    const candidates = [joined, `${joined}.js`, path.posix.join(joined, 'index.js')]
    for (const c of candidates) {
        if (fs.existsSync(path.join(srcRoot, c)) && fs.statSync(path.join(srcRoot, c)).isFile()) return c
    }
    return null
}

function collectClosure() {
    const seen = new Set()
    const queue = roots.filter(r => fs.existsSync(path.join(srcRoot, r)))
    while (queue.length) {
        const rel = queue.pop()
        if (seen.has(rel)) continue
        const abs = path.join(srcRoot, rel)
        if (!fs.existsSync(abs)) continue
        seen.add(rel)
        const src = fs.readFileSync(abs, 'utf8')
        for (const m of src.matchAll(/(?:\bfrom|\bimport)\s*['"](\.[^'"]+)['"]/g)) {
            const resolved = resolveSpec(m[1], rel)
            if (resolved) queue.push(resolved)
        }
    }
    return [...seen].sort()
}

const pkgJsonPath = path.join(srcRoot, 'three', 'package.json')
if (!fs.existsSync(pkgJsonPath)) {
    // e.g. `npm ci --omit=install-scripts` on a checkout without three installed;
    // the committed vendor/three copy stays as-is.
    console.warn('sync-vendor-three: node_modules/three not found, leaving vendor/three untouched')
    process.exit(0)
}

const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
const files = collectClosure()

fs.rmSync(destRoot, { recursive: true, force: true })
for (const rel of files) {
    // Strip the leading package directory: three/build/x.js -> build/x.js
    const destRel = rel.replace(/^three\//, '')
    const dest = path.join(destRoot, destRel)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(path.join(srcRoot, rel), dest)
}

fs.writeFileSync(
    path.join(destRoot, 'vendor-manifest.json'),
    JSON.stringify({
        package: 'three',
        version: pkg.version,
        files: files.map(rel => ({ from: `node_modules/${rel}`, to: rel.replace(/^three\//, '') }))
    }, null, 4) + '\n'
)

console.log(`vendored ${files.length} three@${pkg.version} files -> vendor/three/`)
