import test, { after } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import request from 'supertest'
import { app, server } from '../server.js'

// Guards the #86 boot fix after the CodeQL "Exposure of private files" alert:
// three.js is served from a small committed vendor/ copy, never from
// node_modules.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vendorRoot = path.join(repoRoot, 'vendor', 'three')

after(async () => {
    if (server.listening) {
        await new Promise((resolve, reject) => {
            server.close(err => (err ? reject(err) : resolve()))
        })
    }
})

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full, out)
        else out.push(full)
    }
    return out
}

test('server.js does not serve node_modules', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'server.js'), 'utf8')
    assert.ok(!/express\.static\([^)]*node_modules/.test(src), 'express.static must not target node_modules')
    assert.ok(!src.includes(`'/node_modules'`), 'no /node_modules route should be mounted')
})

test('solo client files reference /vendor, never /node_modules', () => {
    const offenders = []
    for (const file of walk(path.join(repoRoot, 'solo'))) {
        const ext = path.extname(file).toLowerCase()
        if (file.endsWith('.bak') || file.endsWith('.bak2')) continue
        if (!['.html', '.js', '.css'].includes(ext)) continue
        const src = fs.readFileSync(file, 'utf8')
        if (src.includes('/node_modules/')) offenders.push(path.relative(repoRoot, file))
    }
    assert.deepStrictEqual(offenders, [])
})

test('the vendored three build is served at /vendor/three', async () => {
    const res = await request(app).get('/vendor/three/build/three.module.js')
    assert.strictEqual(res.status, 200)
    assert.ok(res.text.includes('THREE'), 'expected the three.js module body')
})

test('loader entry points resolve over HTTP (incl. transitive legs)', async () => {
    for (const p of [
        '/vendor/three/examples/jsm/loaders/GLTFLoader.js',
        '/vendor/three/examples/jsm/utils/BufferGeometryUtils.js',
        '/vendor/three/examples/jsm/libs/fflate.module.js'
    ]) {
        const res = await request(app).get(p)
        assert.strictEqual(res.status, 200, `${p} should be vendored and served`)
    }
})

test('node_modules stays unreachable through the server', async () => {
    for (const p of ['/node_modules/three/package.json', '/node_modules/.package-lock.json']) {
        const res = await request(app).get(p)
        assert.strictEqual(res.status, 404, `${p} must not be served`)
    }
})

test('vendored modules execute under a real ESM loader (closure is complete)', async () => {
    // A missing transitive dependency would throw ERR_MODULE_NOT_FOUND here.
    // FBXLoader alone pulls in fflate, NURBSCurve/NURBSUtils and BufferGeometryUtils.
    for (const rel of [
        'build/three.module.js',
        'examples/jsm/controls/OrbitControls.js',
        'examples/jsm/loaders/OBJLoader.js',
        'examples/jsm/loaders/GLTFLoader.js',
        'examples/jsm/loaders/FBXLoader.js'
    ]) {
        const mod = await import(pathToFileURL(path.join(vendorRoot, rel)).href)
        assert.ok(Object.keys(mod).length > 0, `${rel} exported nothing`)
    }
})

test('every vendored file is committed (not hidden by an ignore rule)', () => {
    // .gitignore carries a broad `build/` rule, which silently swallowed
    // vendor/three/build/*.js until three.core.js went missing from a checkout.
    let tracked
    try {
        tracked = execFileSync('git', ['ls-files', 'vendor/three'], { cwd: repoRoot, encoding: 'utf8' })
    } catch {
        return // git unavailable in this environment
    }
    const trackedSet = new Set(tracked.split('\n').filter(Boolean))
    const manifest = JSON.parse(fs.readFileSync(path.join(vendorRoot, 'vendor-manifest.json'), 'utf8'))
    const missing = manifest.files
        .map(e => `vendor/three/${e.to}`)
        .concat(['vendor/three/vendor-manifest.json'])
        .filter(p => !trackedSet.has(p))
    assert.deepStrictEqual(missing, [], `untracked vendor files would break a fresh clone: ${missing.join(', ')}`)
})

test('vendor manifest matches the committed files (and installed sources)', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(vendorRoot, 'vendor-manifest.json'), 'utf8'))
    assert.strictEqual(manifest.package, 'three')
    assert.ok(manifest.files.length > 0)

    for (const entry of manifest.files) {
        const vendored = path.join(vendorRoot, entry.to)
        assert.ok(fs.existsSync(vendored), `missing vendored file ${entry.to}`)
        const src = path.join(repoRoot, entry.from)
        if (fs.existsSync(src)) {
            // Compare ignoring line-ending differences so a stray core.autcrlf
            // setting can't masquerade as a stale vendor copy (.gitattributes
            // pins vendor/** as -text; this is the belt to those braces).
            const norm = b => b.toString('utf8').replace(/\r\n/g, '\n')
            assert.ok(
                norm(fs.readFileSync(vendored)) === norm(fs.readFileSync(src)),
                `${entry.to} is stale; run npm run vendor:three`
            )
        }
    }

    if (fs.existsSync(path.join(repoRoot, 'node_modules', 'three', 'package.json'))) {
        const installed = JSON.parse(fs.readFileSync(path.join(repoRoot, 'node_modules', 'three', 'package.json'), 'utf8'))
        assert.strictEqual(manifest.version, installed.version, 'vendored three is a different version than installed')
    }
})
