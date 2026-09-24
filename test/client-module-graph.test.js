import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// The solo client is served to browsers as raw ES modules with no bundler, so
// a single unresolvable specifier is a blank page (the #86 bug). This walks the
// real import graph the way a browser would - per-page importmap, absolute
// paths against the same static mounts the server uses - and fails if anything
// is missing or left as a bare specifier.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const soloRoot = path.join(repoRoot, 'solo')

function findHtmlFiles(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) findHtmlFiles(full, out)
        else if (entry.name.endsWith('.html')) out.push(full)
    }
    return out
}

// express.static('solo') is mounted at /, then /vendor -> repo vendor/.
function urlToFile(urlPath) {
    const clean = urlPath.split('?')[0].split('#')[0]
    const candidates = [path.join(soloRoot, clean), path.join(repoRoot, clean)]
    for (const c of candidates) {
        if (fs.existsSync(c) && fs.statSync(c).isFile()) return c
    }
    return null
}

function extractImportMap(html) {
    const m = html.match(/<script[^>]+type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/i)
    if (!m) return {}
    return JSON.parse(m[1]).imports || {}
}

function extractModuleSources(html, htmlFile) {
    const sources = []
    const pageDir = path.posix.dirname('/' + path.relative(soloRoot, htmlFile).replace(/\\/g, '/'))
    const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
    let m
    while ((m = re.exec(html))) {
        const attrs = m[1]
        const body = m[2]
        if (!/type=["']module["']/i.test(attrs)) continue
        const srcMatch = attrs.match(/src=["']([^"']+)["']/i)
        if (srcMatch) {
            const url = srcMatch[1].startsWith('/')
                ? srcMatch[1]
                : path.posix.normalize(path.posix.join(pageDir === '/' ? '' : pageDir, srcMatch[1]))
            const file = urlToFile(url)
            if (file) sources.push({ file })
            else sources.push({ missing: srcMatch[1], from: htmlFile })
        } else if (body.trim()) {
            sources.push({ inline: body, from: htmlFile })
        }
    }
    return sources
}

// Removes // and /* */ comments while respecting strings, template literals and
// regex literals, so documentation examples (three.js uses a `@three_import`
// JSDoc tag with import snippets) aren't mistaken for real imports.
const REGEX_PRECEDERS = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^'])
const REGEX_KEYWORDS = new Set(['return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'do', 'else', 'yield', 'await'])

function stripComments(code) {
    let out = ''
    let i = 0
    let lastSig = null // last significant code char seen in `code` state
    while (i < code.length) {
        const c = code[i]
        const next = code[i + 1]
        if (c === '/' && next === '/') {
            while (i < code.length && code[i] !== '\n') i++
            continue
        }
        if (c === '/' && next === '*') {
            i += 2
            while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++
            i += 2
            out += ' '
            continue
        }
        if (c === '"' || c === "'") {
            const quote = c
            out += c
            i++
            while (i < code.length) {
                if (code[i] === '\\') { out += code[i] + (code[i + 1] ?? ''); i += 2; continue }
                out += code[i]
                if (code[i] === quote) { i++; break }
                if (code[i] === '\n') break // unterminated; bail conservatively
                i++
            }
            lastSig = quote
            continue
        }
        if (c === '`') {
            out += c
            i++
            while (i < code.length) {
                if (code[i] === '\\') { out += code[i] + (code[i + 1] ?? ''); i += 2; continue }
                if (code[i] === '`') { out += code[i++]; break }
                out += code[i++]
            }
            lastSig = '`'
            continue
        }
        if (c === '/') {
            const word = code.slice(Math.max(0, i - 12), i).match(/[A-Za-z_$][\w$]*$/)
            const allowRegex = lastSig === null || REGEX_PRECEDERS.has(lastSig) || (word && REGEX_KEYWORDS.has(word[0]))
            if (allowRegex) {
                out += c
                i++
                let inClass = false
                while (i < code.length) {
                    const rc = code[i]
                    out += rc
                    if (rc === '\\') { out += code[i + 1] ?? ''; i += 2; continue }
                    if (rc === '[') inClass = true
                    else if (rc === ']') inClass = false
                    else if (rc === '/' && !inClass) { i++; break }
                    else if (rc === '\n') break
                    i++
                }
                lastSig = '/'
                continue
            }
        }
        out += c
        if (!/\s/.test(c)) lastSig = c
        i++
    }
    return out
}

function staticSpecifiers(code) {
    const clean = stripComments(code)
    const specs = new Set()
    const re = /(?:\bimport|\bexport)\s+(?:[^'"();]*?\bfrom\s*)?['"]([^'"]+)['"]/g
    let m
    while ((m = re.exec(clean))) specs.add(m[1])
    const dyn = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g
    while ((m = dyn.exec(clean))) specs.add(m[1])
    return [...specs]
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
    const prefix = Object.keys(importMap).filter(k => k.endsWith('/') && spec.startsWith(k)).sort((a, b) => b.length - a.length)[0]
    if (prefix) {
        return { kind: 'importmap', file: urlToFile(importMap[prefix] + spec.slice(prefix.length)), spec }
    }
    return { kind: 'bare', file: null, spec }
}

for (const htmlFile of findHtmlFiles(soloRoot)) {
    const relPage = path.relative(repoRoot, htmlFile).replace(/\\/g, '/')
    // Pages kept purely as backups are excluded from the contract.
    if (htmlFile.endsWith('.bak') || htmlFile.endsWith('.bak2')) continue

    test(`${relPage}: every module in its import graph resolves`, () => {
        const html = fs.readFileSync(htmlFile, 'utf8')
        const importMap = extractImportMap(html)
        const roots = extractModuleSources(html, htmlFile)
        const missingRoots = roots.filter(r => r.missing)
        assert.deepStrictEqual(missingRoots.map(r => r.missing), [], 'module <script src> targets must exist')

        const seen = new Set()
        const failures = []
        const queue = roots.map(f => ({ file: f.file, inline: f.inline, from: relPage }))

        while (queue.length) {
            const node = queue.pop()
            const key = node.file || `${node.from}#inline`
            if (seen.has(key)) continue
            seen.add(key)

            const code = node.inline ?? fs.readFileSync(node.file, 'utf8')
            const currentFile = node.file ?? htmlFile
            for (const spec of staticSpecifiers(code)) {
                const res = resolveSpecifier(spec, currentFile, importMap)
                if (res.file) {
                    queue.push({ file: res.file, from: path.relative(repoRoot, currentFile) })
                } else {
                    failures.push(`${path.relative(repoRoot, currentFile)} -> "${spec}" (${res.kind})`)
                }
            }
        }

        assert.deepStrictEqual(failures, [])
        assert.ok(seen.size > 1, 'expected a non-trivial graph')
    })
}

test('the whole solo client loads three.js from /vendor only', () => {
    const html = fs.readFileSync(path.join(soloRoot, 'index.html'), 'utf8')
    const importMap = extractImportMap(html)
    assert.strictEqual(importMap.three, '/vendor/three/build/three.module.js')
})
