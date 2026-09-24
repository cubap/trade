import test, { after } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import request from 'supertest'
import { syncThree } from '../scripts/sync-vendor-three.mjs'
import { app, server } from '../server.js'

// Guards the #86 boot fix after the CodeQL "Exposure of private files" alert:
// three.js is served from a generated vendor/ copy, never from node_modules.
// Importing server.js above already ran the boot sync, so vendor/ exists here.

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

test('vendor/ is generated, not committed', () => {
    // Committing the copy would add ~79k lines of three.js source to the repo,
    // where scanners report its internals as our own findings (CodeQL flagged
    // js/insecure-randomness inside three.core.js on the first attempt).
    let tracked
    try {
        tracked = execFileSync('git', ['ls-files', 'vendor'], { cwd: repoRoot, encoding: 'utf8' })
    } catch {
        return // git unavailable in this environment
    }
    assert.strictEqual(tracked.trim(), '', 'vendor/ must stay out of git; it is generated on boot')
    const ignored = execFileSync('git', ['check-ignore', '-q', 'vendor/three/build/three.module.js'], { cwd: repoRoot, encoding: 'utf8' })
    assert.strictEqual(ignored.trim(), '')
})

test('no .bak copies of client files are tracked', () => {
    // Dead copies can reintroduce the /node_modules import pattern that #86
    // removed, which is what git grep -n '/node_modules' used to hit on.
    let tracked
    try {
        tracked = execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' })
    } catch {
        return // git unavailable in this environment
    }
    const baks = tracked.split('\n').filter(f => /\.bak\d*$/.test(f))
    assert.deepStrictEqual(baks, [])
})

test('server.js materialises vendor/ at boot so a fresh clone works', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'server.js'), 'utf8')
    assert.ok(src.includes('syncThree'), 'boot must generate the vendor copy')
    assert.ok(src.includes(`'/vendor'`), 'the generated directory must be mounted at /vendor')
})

test('syncThree generates the full set from nothing', () => {
    // Proves a fresh clone (vendor/ absent) can boot: write into an empty temp
    // dir rather than deleting the real one under a running server.
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'trade-vendor-'))
    try {
        const result = syncThree({ destRoot: dest, force: true })
        assert.strictEqual(result.status, 'written')
        assert.ok(result.files.length >= 11, `expected the full closure, got ${result.files.length}`)
        for (const rel of result.files) {
            assert.ok(fs.existsSync(path.join(dest, rel.replace(/^three\//, ''))), `not generated: ${rel}`)
        }
        assert.ok(fs.existsSync(path.join(dest, 'vendor-manifest.json')))

        // Second call must be a no-op so boot stays fast.
        assert.strictEqual(syncThree({ destRoot: dest }).status, 'up-to-date')
    } finally {
        fs.rmSync(dest, { recursive: true, force: true })
    }
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
            // Compare ignoring line-ending differences: core.autocrlf is on in
            // some environments, and node_modules was written by npm.
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
