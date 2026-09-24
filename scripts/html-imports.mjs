// Small helpers for reading the ES module graph out of the solo client's HTML
// pages and JS files, shared by scripts/sync-vendor-three.mjs (which decides
// what to vendor) and the client-module-graph / vendor tests.
//
// The HTML is scanned with a character-by-character tokenizer rather than a
// `[^>]*` regexp so that a `>` or a quote inside an attribute value can't
// desynchronise the tag boundaries.

function isNameBoundary(ch) {
    return ch === undefined || /\s/.test(ch) || ch === '/' || ch === '>'
}

/**
 * Splits HTML into `<script>` blocks.
 * @param {string} html
 * @returns {{attrs: string, content: string}[]}
 */
export function scriptBlocks(html) {
    const blocks = []
    const lower = html.toLowerCase()
    let i = 0
    for (;;) {
        const start = lower.indexOf('<script', i)
        if (start === -1) break
        const afterName = start + '<script'.length
        if (!isNameBoundary(html[afterName])) {
            i = afterName
            continue
        }
        let j = afterName
        let quote = null
        for (; j < html.length; j++) {
            const ch = html[j]
            if (quote) {
                if (ch === quote) quote = null
            } else if (ch === '"' || ch === "'") {
                quote = ch
            } else if (ch === '>') {
                break
            }
        }
        const close = lower.indexOf('</script', j + 1)
        if (close === -1) break
        blocks.push({ attrs: html.slice(afterName, j), content: html.slice(j + 1, close) })
        const endTag = lower.indexOf('>', close)
        i = endTag === -1 ? html.length : endTag + 1
    }
    return blocks
}

/** Parses an open tag's attribute list into a lowercased name -> value map. */
export function parseAttributes(attrs) {
    const out = {}
    let i = 0
    for (;;) {
        while (i < attrs.length && /[\s/]/.test(attrs[i])) i++
        let name = ''
        while (i < attrs.length && !/[\s/=]/.test(attrs[i])) name += attrs[i++]
        if (!name) break
        let value = ''
        while (i < attrs.length && /\s/.test(attrs[i])) i++
        if (attrs[i] === '=') {
            i++
            while (i < attrs.length && /\s/.test(attrs[i])) i++
            const quote = attrs[i]
            if (quote === '"' || quote === "'") {
                i++
                while (i < attrs.length && attrs[i] !== quote) value += attrs[i++]
                i++
            } else {
                while (i < attrs.length && !/[\s>]/.test(attrs[i])) value += attrs[i++]
            }
        }
        out[name.toLowerCase()] = value
    }
    return out
}

/** Value of an element's `type` attribute, lowercased ('' when absent). */
function scriptType(block) {
    return (parseAttributes(block.attrs).type || '').toLowerCase()
}

/** Merged `imports` (and flattened `scopes`) from every importmap on the page. */
export function importMapEntries(html) {
    const entries = {}
    for (const block of scriptBlocks(html)) {
        if (scriptType(block) !== 'importmap') continue
        let parsed
        try {
            parsed = JSON.parse(block.content)
        } catch {
            continue // malformed importmap is reported by the tests / the browser
        }
        Object.assign(entries, parsed.imports || {})
        for (const scoped of Object.values(parsed.scopes || {})) Object.assign(entries, scoped || {})
    }
    return entries
}

/** Import targets declared by any `<script type="importmap">` on the page. */
export function importMapTargets(html) {
    return Object.values(importMapEntries(html)).filter(v => typeof v === 'string')
}

/** Sources of inline `<script type="module">` blocks on the page. */
export function inlineModuleSources(html) {
    return scriptBlocks(html)
        .filter(block => scriptType(block) === 'module')
        .map(block => block.content)
}

/**
 * Removes // and /* *\/ comments without touching string, template or regexp
 * literals. three.js documents optional dependencies inside `@three_import`
 * JSDoc tags, so comment text must not be mistaken for a real import.
 */
export function stripComments(src) {
    let out = ''
    let lastSig = ''
    let i = 0
    // A `/` only opens a regexp literal where a value can't be the previous token.
    const regexPreceders = new Set(['=', '(', ',', '[', '!', '&', '|', '?', '{', '}', ':', ';', '+', '-', '*', '%', '~', '^', '<', '>'])
    while (i < src.length) {
        const c = src[i]
        const next = src[i + 1]
        if (c === '/' && next === '/') {
            while (i < src.length && src[i] !== '\n') i++
            continue
        }
        if (c === '/' && next === '*') {
            const end = src.indexOf('*/', i + 2)
            i = end === -1 ? src.length : end + 2
            continue
        }
        if (c === '"' || c === "'" || c === '`') {
            const quote = c
            out += src[i++]
            while (i < src.length) {
                if (src[i] === '\\') { out += src[i] + (src[i + 1] ?? ''); i += 2; continue }
                out += src[i]
                if (src[i] === quote) { i++; break }
                i++
            }
            lastSig = quote
            continue
        }
        if (c === '/' && (regexPreceders.has(lastSig)
            || /(?:^|[^\w$])(return|typeof|case|in|of|new|delete|void|do|else|yield|await|if|while)$/.test(out))) {
            out += src[i++]
            let inClass = false
            while (i < src.length) {
                if (src[i] === '\\') { out += src[i] + (src[i + 1] ?? ''); i += 2; continue }
                if (src[i] === '[') inClass = true
                else if (src[i] === ']') inClass = false
                else if (src[i] === '/' && !inClass) { i++; break }
                else if (src[i] === '\n') break // not a regexp after all
                out += src[i++]
            }
            lastSig = '/'
            continue
        }
        out += c
        if (!/\s/.test(c)) lastSig = c
        i++
    }
    return out
}

/** Every static + dynamic module specifier in a JS source string. */
export function staticSpecifiers(src) {
    const specs = new Set()
    for (const m of src.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)) specs.add(m[1])
    for (const m of src.matchAll(/\bimport\s+['"]([^'"]+)['"]/g)) specs.add(m[1])
    for (const m of src.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) specs.add(m[1])
    for (const m of src.matchAll(/\bexport\s+(?:\*|\{[^}]*\})\s*from\s*['"]([^'"]+)['"]/g)) specs.add(m[1])
    return [...specs]
}

/** Every module specifier imported by a JS source string, comments removed. */
export function moduleSpecifiers(src) {
    return staticSpecifiers(stripComments(src))
}
