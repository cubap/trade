#!/usr/bin/env node
// Builds the deployable static site into a staging directory (default `dist/`)
// so the host publishes *that* instead of the repository root (#92).
//
// Why this exists: `netlify.toml` used `publish = "."`, which uploaded
// node_modules, server.js, models/, config/ and .env to a public CDN on every
// deploy, and left no place to run a build step (so #87's deploy preview had no
// build log to diagnose either). Serving files out of that tree is also what
// made `app.use('/node_modules', express.static(...))` look reasonable enough
// for CodeQL to flag it (#86). With a staged directory the server-only half of
// the repo is structurally absent rather than filtered.
//
// Two rules keep the copy honest:
//
//  1. Everything the browser actually imports is in the output. That is not a
//     hand-maintained list - the module graph of every page is walked the way a
//     browser resolves it (importmap / relative / absolute / bare), and the walk
//     is repeated *inside* the output as a self-check.
//  2. Nothing else from the repo root comes along. solo/ is copied wholesale
//     except its Node-only test harness; binary assets are kept only when some
//     client source file mentions them, because `solo/assets` is 91 MB of which
//     ~37 MB is .blend/.zip source formats no loader can read.
//
// Usage:
//   node scripts/build-site.mjs [--out dist] [--no-vendor] [--no-prune]
// npm run build:site

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { importMapEntries, inlineModuleSources, moduleSpecifiers, parseAttributes, scriptBlocks } from './html-imports.mjs'
import { syncThree } from './sync-vendor-three.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Extensions that are the site (as opposed to content loaded by the site).
const SOURCE_EXTS = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.ico', '.map'])
// Documentation/licensing files travel with the assets they describe.
const ALWAYS_KEEP_ASSET = /(^|[\\/])(attribution|license|licence|notice|copying|third[-_ ]?party)([\\.]|$)|\.(md|txt)$/i

/** Repo-relative POSIX path, or null when abs escapes the repo. */
function relPath(abs, root = REPO_ROOT) {
    const rel = path.relative(root, abs).split(path.sep).join('/')
    return rel.startsWith('..') ? null : rel
}

function isBak(rel) {
    return /\.bak\d*$/.test(rel)
}

/** Node-only harness inside solo/ that no page can reach. */
function isSoloNodeOnly(rel) {
    return rel.startsWith('solo/test/') || /^solo\/test_[^/]+\.js$/.test(rel)
}

function listFiles(dir, root = REPO_ROOT, out = []) {
    if (!fs.existsSync(dir)) return out
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name)
        if (entry.isDirectory()) listFiles(abs, root, out)
        else if (entry.isFile()) out.push(abs)
    }
    return out
}

function pages(root = REPO_ROOT) {
    return listFiles(path.join(root, 'solo')).filter(f => f.endsWith('.html'))
}

/** Maps a root-absolute URL (the shape importmap targets and asset paths use) onto disk. */
function urlToFile(url, root = REPO_ROOT) {
    const clean = url.split('?')[0].split('#')[0]
    if (!clean.startsWith('/')) return null
    const abs = path.join(root, clean.replace(/^\//, ''))
    return fs.existsSync(abs) && fs.statSync(abs).isFile() ? abs : null
}

function resolveSpecifier(spec, fromFile, importMap, root = REPO_ROOT) {
    if (spec.startsWith('/')) return urlToFile(spec, root)
    if (spec.startsWith('.')) {
        const abs = path.resolve(path.dirname(fromFile), spec.split('?')[0])
        return fs.existsSync(abs) ? abs : null
    }
    const map = importMap[spec] != null
        ? importMap[spec]
        : Object.keys(importMap)
            .filter(k => k.endsWith('/') && spec.startsWith(k))
            .sort((a, b) => b.length - a.length)
            .map(k => importMap[k] + spec.slice(k.length))[0]
    return map != null ? urlToFile(map, root) : null
}

function isVendored(abs, root = REPO_ROOT) {
    return relPath(abs, root)?.startsWith('vendor/')
}

/**
 * Every file reachable from a page's <script type="module"> tags, plus the
 * page itself. `missing` collects legs that resolved to nothing so the build
 * can fail rather than ship a page that 404s in the browser (the #86 failure).
 */
export function clientGraph(root = REPO_ROOT) {
    const found = new Set()
    const missing = []
    for (const htmlFile of pages(root)) {
        const html = fs.readFileSync(htmlFile, 'utf8')
        const importMap = importMapEntries(html)
        found.add(htmlFile)
        const queue = []
        for (const block of scriptBlocks(html)) {
            const attrs = parseAttributes(block.attrs)
            if ((attrs.type || '').toLowerCase() !== 'module') continue
            if (attrs.src) {
                const abs = attrs.src.startsWith('/')
                    ? path.join(root, attrs.src.split('?')[0])
                    : path.resolve(path.dirname(htmlFile), attrs.src.split('?')[0])
                if (fs.existsSync(abs)) queue.push({ file: abs })
                else missing.push(`${relPath(htmlFile, root)} -> <script src="${attrs.src}">`)
            } else if (block.content.trim()) {
                queue.push({ file: htmlFile, inline: block.content })
            }
        }
        const seen = new Set()
        while (queue.length) {
            const node = queue.pop()
            const key = node.inline != null ? `${node.file}#inline` : node.file
            if (seen.has(key)) continue
            seen.add(key)
            if (node.inline == null) found.add(node.file)
            if (isVendored(node.file, root) && node.inline == null) continue // three.js closure is verified by its own test
            const code = node.inline ?? fs.readFileSync(node.file, 'utf8')
            for (const spec of moduleSpecifiers(code)) {
                const target = resolveSpecifier(spec, node.file, importMap, root)
                if (target) queue.push({ file: target })
                else missing.push(`${relPath(node.file, root)} -> "${spec}"`)
            }
        }
    }
    return { files: found, missing }
}

/**
 * Non-module content the client loads by URL: texture/model paths, stylesheets,
 * favicons. Detected by looking for each candidate's file name (or repo path) in
 * the client sources, which also catches paths assembled from parts.
 */
function referencedAssets(root, sources) {
    const haystack = `${sources}\n`.toLowerCase()
    const candidates = listFiles(path.join(root, 'solo', 'assets'))
        .filter(abs => !isBak(relPath(abs, root)))
    const keep = new Set()
    for (const abs of candidates) {
        const rel = relPath(abs, root)
        if (ALWAYS_KEEP_ASSET.test(rel) || SOURCE_EXTS.has(path.extname(rel))) {
            keep.add(abs)
        } else if (haystack.includes(path.basename(rel).toLowerCase()) || haystack.includes(rel.toLowerCase())) {
            keep.add(abs)
        }
    }

    // Second closure: an .obj can name a sibling .mtl / texture, and a .gltf
    // names its buffers, so anything a *kept* text asset mentions comes along
    // too. Cheap - these files are small and the pass is bounded.
    const TEXTISH = new Set(['.obj', '.mtl', '.gltf', '.json', '.txt', '.svg'])
    let frontier = [...keep].filter(abs => TEXTISH.has(path.extname(abs).toLowerCase()))
    let remaining = candidates.filter(abs => !keep.has(abs))
    for (let pass = 0; pass < 3 && frontier.length && remaining.length; pass++) {
        const inner = frontier.map(abs => fs.readFileSync(abs, 'utf8').toLowerCase()).join('\n')
        const grew = []
        remaining = remaining.filter(abs => {
            const rel = relPath(abs, root)
            const hit = inner.includes(path.basename(rel).toLowerCase()) || inner.includes(rel.toLowerCase())
            if (hit) { keep.add(abs); grew.push(abs) }
            return !hit
        })
        frontier = grew.filter(abs => TEXTISH.has(path.extname(abs).toLowerCase()))
    }
    return [...keep]
}

function stylesheetAndIconFiles(root) {
    const out = new Set()
    for (const htmlFile of pages(root)) {
        const html = fs.readFileSync(htmlFile, 'utf8')
        for (const m of html.matchAll(/<(?:link|img|source|audio|video)[^>]*(?:href|src)\s*=\s*"([^"]+)"/gi)) {
            const raw = m[1].split('?')[0]
            if (raw.startsWith('data:') || /^https?:/.test(raw)) continue
            const abs = raw.startsWith('/')
                ? path.join(root, raw.replace(/^\//, ''))
                : path.resolve(path.dirname(htmlFile), raw)
            if (fs.existsSync(abs) && fs.statSync(abs).isFile()) out.add(abs)
        }
    }
    return out
}

/**
 * Builds the site.
 * @param {{outDir?: string, root?: string, vendor?: boolean, pruneAssets?: boolean, log?: ((msg: string) => void) | null}} options
 * @returns {{outDir: string, files: string[], bytes: number, skipped: number, pruned: boolean}}
 */
export function buildSite(options = {}) {
    const root = options.root ?? REPO_ROOT
    const outDir = path.resolve(options.outDir ?? path.join(root, 'dist'))
    const vendor = options.vendor !== false
    const pruneAssets = options.pruneAssets !== false
    const log = options.log ?? (msg => process.stdout.write(`${msg}\n`))

    // three.js is generated out of node_modules, so the deploy carries real
    // files instead of relying on a server-boot side effect it cannot run.
    let vendorResult = { status: 'skipped', reason: 'vendor: false' }
    if (vendor) {
        vendorResult = syncThree()
        if (vendorResult.status === 'skipped') {
            throw new Error(`could not materialise vendor/three: ${vendorResult.reason}`)
        }
    }

    const graph = clientGraph(root)
    if (graph.missing.length) {
        throw new Error(`client module graph does not resolve:\n  ${graph.missing.join('\n  ')}`)
    }

    const wanted = new Map() // repo-relative posix path -> absolute source path
    const add = abs => {
        const rel = relPath(abs, root)
        if (rel && fs.existsSync(abs)) wanted.set(rel, abs)
    }

    for (const abs of graph.files) add(abs)
    for (const abs of stylesheetAndIconFiles(root)) add(abs)
    // Pages reach sibling modules by hand-written path, so take all of solo's
    // client sources, not just the ones statically reachable from an entry.
    for (const abs of listFiles(path.join(root, 'solo'))) {
        const rel = relPath(abs, root)
        if (!rel || isBak(rel) || isSoloNodeOnly(rel)) continue
        if (rel.startsWith('solo/assets/')) continue // handled by referencedAssets()
        if (SOURCE_EXTS.has(path.extname(rel))) add(abs)
    }
    add(path.join(root, 'favicon.svg'))

    const soloAssets = pruneAssets
        ? referencedAssets(root, [...wanted.keys()].map(rel => fs.readFileSync(wanted.get(rel), 'utf8')).join('\n'))
        : listFiles(path.join(root, 'solo', 'assets'))
    for (const abs of soloAssets) add(abs)

    const vendoredFiles = vendor ? listFiles(path.join(root, 'vendor')) : []
    for (const abs of vendoredFiles) add(abs)

    fs.rmSync(outDir, { recursive: true, force: true })
    let bytes = 0
    for (const [rel, abs] of [...wanted.entries()].sort()) {
        const dest = path.join(outDir, rel)
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        fs.copyFileSync(abs, dest)
        bytes += fs.statSync(dest).size
    }

    const total = wanted.size
    const soloFiles = listFiles(path.join(root, 'solo')).length
    const copiedSolo = [...wanted.keys()].filter(rel => rel.startsWith('solo/')).length
    const mb = (bytes / 1024 / 1024).toFixed(1)
    log?.(`build:site -> ${relPath(outDir, root) ?? outDir}: ${total} files, ${mb} MB`)
    log?.(`build:site: ${copiedSolo}/${soloFiles} files under solo/ (${soloFiles - copiedSolo} Node-only or unreferenced skipped; --no-prune keeps every asset)`)

    return { outDir, files: [...wanted.keys()].sort(), bytes, skipped: soloFiles - copiedSolo, pruned: pruneAssets }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
    const argv = process.argv.slice(2)
    const outFlag = argv.indexOf('--out')
    const result = buildSite({
        outDir: outFlag === -1 ? undefined : argv[outFlag + 1],
        vendor: !argv.includes('--no-vendor'),
        pruneAssets: !argv.includes('--no-prune')
    })
    process.stdout.write(`build:site: done (${result.files.length} files)\n`)
}
