// Guards the client-side ES module graph: every page in solo/ must load with
// every import resolving to a real file, the way a browser would resolve it.
//
// This catches breakage the render/physics suites can't see because they mock
// three.js. Issue #86's fix (serving /vendor instead of /node_modules) changed
// the importmap targets AND the absolute specifiers inside solo/js; the repo had
// no test that read a page's module graph, so nothing checked both halves
// agreed. It immediately found a real gap: terrain.html uses OrbitControls,
// which had no importmap entry, so that page could never have loaded.

import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { importMapEntries, inlineModuleSources, moduleSpecifiers, parseAttributes, scriptBlocks } from '../scripts/html-imports.mjs'
import { syncThree } from '../scripts/sync-vendor-three.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const soloRoot = path.join(repoRoot, 'solo')

// The vendored three.js set is generated (gitignored); resolveSpecifier needs
// it on disk to prove the importmap targets are real files.
before(() => {
    const result = syncThree()
    assert.notStrictEqual(result.status, 'skipped', `could not vendor three.js: ${result.reason}`)
})

function findHtmlFiles(dir) {
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) return findHtmlFiles(full)
        return e.name.endsWith('.html') ? [full] : []
    })
}

// Maps a root-absolute URL (the shape importmap targets use) back onto disk.
function urlToFile(url) {
    const clean = url.split('?')[0].split('#')[0]
    if (!clean.startsWith('/')) return null
    const abs = path.join(repoRoot, clean.replace(/^\//, ''))
    if (!abs.startsWith(repoRoot)) return null
    return fs.existsSync(abs) && fs.statSync(abs).isFile() ? abs : null
}

// three.js internals are third-party; their own import closure is verified by
// the ESM-loader test in vendor-three.test.js, not re-parsed here.
function isVendored(absFile) {
    return path.relative(repoRoot, absFile).split(path.sep)[0] === 'vendor'
}

function pageRoots(htmlFile) {
    const html = fs.readFileSync(htmlFile, 'utf8')
    const pageDir = path.dirname(htmlFile)
    const roots = []
    for (const block of scriptBlocks(html)) {
        const attrs = parseAttributes(block.attrs)
        const type = (attrs.type || '').toLowerCase()
        if (type !== 'module') continue
        if (attrs.src) {
            const abs = attrs.src.startsWith('/')
                ? path.join(repoRoot, attrs.src.split('?')[0])
                : path.resolve(pageDir, attrs.src.split('?')[0])
            roots.push(fs.existsSync(abs) ? { file: abs } : { missing: attrs.src })
        } else {
            roots.push({ inline: block.content })
        }
    }
    return roots
}

function resolveSpecifier(spec, fromFile, importMap) {
    if (spec.startsWith('/')) {
        return { kind: 'url', file: urlToFile(spec), spec }
    }
    if (spec.startsWith('.')) {
        const abs = path.resolve(path.dirname(fromFile), spec.split('?')[0])
        return { kind: 'relative', file: fs.existsSync(abs) ? abs : null, spec }
    }
    if (Object.prototype.hasOwnProperty.call(importMap, spec)) {
        return { kind: 'importmap', file: urlToFile(importMap[spec]), spec }
    }
    const prefix = Object.keys(importMap)
        .filter(k => k.endsWith('/') && spec.startsWith(k))
        .sort((a, b) => b.length - a.length)[0]
    if (prefix) {
        return { kind: 'importmap', file: urlToFile(importMap[prefix] + spec.slice(prefix.length)), spec }
    }
    // Bare specifier with no importmap entry: a browser would need a CDN
    // importmap or a bundler. Neither exists here, so it is a failure.
    return { kind: 'bare', file: null, spec }
}

const pages = findHtmlFiles(soloRoot)

test('there are solo pages to check', () => {
    assert.ok(pages.length > 0, 'expected at least one HTML page under solo/')
})

for (const htmlFile of pages) {
    const relPage = path.relative(repoRoot, htmlFile).replace(/\\/g, '/')

    test(`${relPage}: every module in its import graph resolves`, () => {
        const importMap = importMapEntries(fs.readFileSync(htmlFile, 'utf8'))
        const roots = pageRoots(htmlFile)
        const missing = roots.filter(r => r.missing)
        assert.deepStrictEqual(missing.map(r => r.missing), [], 'module <script src> targets must exist')

        const seen = new Set()
        const failures = []
        const queue = roots.map(r => ({ file: r.file ?? htmlFile, inline: r.inline, label: relPage }))

        while (queue.length) {
            const node = queue.pop()
            const current = node.file
            const key = node.inline != null ? `${node.label}#inline` : current
            if (seen.has(key)) continue
            seen.add(key)
            if (isVendored(current) && node.inline == null) continue

            const code = node.inline ?? fs.readFileSync(current, 'utf8')
            for (const spec of moduleSpecifiers(code)) {
                const res = resolveSpecifier(spec, current, importMap)
                if (res.file) {
                    queue.push({ file: res.file, label: path.relative(repoRoot, current).replace(/\\/g, '/') })
                } else {
                    failures.push(`${path.relative(repoRoot, current).replace(/\\/g, '/')} -> "${spec}" (${res.kind})`)
                }
            }
        }

        assert.deepStrictEqual(failures, [], 'every import in the page graph must resolve to a file')
        assert.ok(seen.size > 1, 'expected a non-trivial graph')
    })
}

test('the solo client loads three.js from /vendor only', () => {
    const importMap = importMapEntries(fs.readFileSync(path.join(soloRoot, 'index.html'), 'utf8'))
    assert.strictEqual(importMap.three, '/vendor/three/build/three.module.js')
    assert.ok(Object.values(importMap).every(v => !v.includes('node_modules')), 'importmap must not point at node_modules')
})
