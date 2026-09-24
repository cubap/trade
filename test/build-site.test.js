// Guards the staged static site (#92): `npm run build:site` must produce a
// directory a static host can publish *instead of the repository root*.
//
// publish = "." meant every deploy uploaded node_modules, server.js, models/,
// config/ and .env, which is how "serve /node_modules" looked like a reasonable
// fix for #86 and why #87's build had no log to read. These tests are the
// contract that makes staging safe: the client module graph still resolves
// inside the output, nothing server-only is in it, and no asset the client
// names by path got pruned away.

import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSite, clientGraph } from '../scripts/build-site.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trade-site-'))

let result

before(() => {
    result = buildSite({ outDir, log: () => {} })
})

const exists = rel => fs.existsSync(path.join(outDir, rel))
const abs = rel => path.join(outDir, rel)
const allFiles = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? allFiles(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name)).split(path.sep).join('/')])
const builtFiles = () => allFiles(outDir)

test('the host publishes dist/ and the build command actually builds', () => {
    const toml = fs.readFileSync(path.join(repoRoot, 'netlify.toml'), 'utf8')
    const build = toml.slice(toml.indexOf('[build]'), toml.indexOf('[[redirects]]'))
    assert.match(build, /publish\s*=\s*"dist"/, 'publish must be the staged directory')
    assert.doesNotMatch(build, /publish\s*=\s*"\."/u, 'publishing "." uploads the whole repo')
    assert.match(build, /npm run build:site/, 'the build command must stage the site')

    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
    assert.strictEqual(pkg.scripts['build:site'], 'node scripts/build-site.mjs')
})

test('the staged site is a self-contained client', () => {
    const files = builtFiles()
    assert.ok(files.includes('solo/index.html'), 'entry page missing')
    assert.ok(files.includes('vendor/three/build/three.module.js'), 'vendored three.js missing')
    assert.ok(files.includes('favicon.svg'), 'favicon referenced by every page')

    // Anything that must never reach a CDN.
    const forbidden = files.filter(rel =>
        rel.startsWith('node_modules/') || rel.startsWith('models/') || rel.startsWith('config/')
        || rel.startsWith('scripts/') || rel.startsWith('test/') || rel.startsWith('docs/')
        || rel.startsWith('netlify/') || rel.startsWith('.github/')
        || /^(server|client|gameLogic)\.js$/.test(rel)
        || /^package(-lock)?\.json$/.test(rel) || rel.startsWith('.env'))
    assert.deepStrictEqual(forbidden, [], 'server-only files leaked into the staged site')
})

test('every page still resolves its whole module graph inside dist', () => {
    // Not a re-check of the repo copy: this walks the *output*, so a file the
    // browser imports but the build forgot to stage fails here.
    const graph = clientGraph(outDir)
    assert.deepStrictEqual(graph.missing, [], 'module graph legs must resolve inside dist')
    assert.ok(graph.files.size > 50, `expected a substantial graph, saw ${graph.files.size}`)
    for (const file of graph.files) {
        assert.ok(path.relative(outDir, file).split(path.sep)[0] !== '..', `${file} escaped dist`)
    }
})

test('no path in the built client points at /node_modules', () => {
    // vendor/ is a byte-for-byte copy of three.js; only our own files are held
    // to the rule (vendor-three.test.js proves the copy is unmodified).
    const offenders = builtFiles()
        .filter(rel => /\.(js|mjs|html|css)$/.test(rel) && !rel.startsWith('vendor/'))
        .filter(rel => fs.readFileSync(abs(rel), 'utf8').includes('/node_modules/'))
    assert.deepStrictEqual(offenders, [])
})

test('asset paths the client names by string all survive the prune', () => {
    // solo/assets is 91 MB, most of it .blend/.zip source formats no loader can
    // read, so the build keeps only what is referenced. This is the guard that
    // the pruning is reference-driven rather than hopeful.
    const wanted = new Set()
    for (const rel of builtFiles().filter(r => /\.(js|mjs|html|css)$/.test(r))) {
        const src = fs.readFileSync(abs(rel), 'utf8')
        for (const m of src.matchAll(/['"`](\/solo\/assets\/[^'"`?#]+)['"`]/g)) {
            wanted.add(decodeURIComponent(m[1]).replace(/^\//, ''))
        }
    }
    assert.ok(wanted.size >= 10, `expected the model/texture literals to be found, saw ${wanted.size}`)
    const missing = [...wanted].filter(rel => !exists(rel))
    assert.deepStrictEqual(missing, [], 'referenced assets must be staged')
})

test('unreferenced authoring formats are not shipped', () => {
    const files = builtFiles()
    assert.deepStrictEqual(files.filter(rel => /\.(blend|zip)$/.test(rel)), [],
        '.blend/.zip are editing sources; keeping them costs 37 MB of upload')
    assert.ok(result.bytes < 40 * 1024 * 1024, `staged site is ${result.bytes} bytes`)
})

test('the node-only harness inside solo/ is not published', () => {
    const files = builtFiles()
    assert.deepStrictEqual(files.filter(rel => rel.startsWith('solo/test/')), [])
    assert.deepStrictEqual(files.filter(rel => /^solo\/test_[^/]+\.js$/.test(rel)), [])
    assert.deepStrictEqual(files.filter(rel => /\.bak\d*($|\/)/.test(rel) || rel.endsWith('.bak')), [])
})

test('building twice produces the same manifest', () => {
    const second = buildSite({ outDir, log: () => {} })
    assert.deepStrictEqual(second.files, result.files)
    assert.strictEqual(second.bytes, result.bytes)
})

test('the build fails loudly when the client graph is broken', () => {
    // A staged site that 404s an import is the #86 bug wearing a new hat, so the
    // build must refuse rather than emit a page that loads blank.
    const root = path.join(outDir, 'broken-root')
    const out = path.join(outDir, 'broken-out')
    fs.mkdirSync(path.join(root, 'solo', 'js'), { recursive: true })
    fs.writeFileSync(path.join(root, 'solo', 'index.html'),
        '<!doctype html><script type="module" src="js/app.js"></script>')
    fs.writeFileSync(path.join(root, 'solo', 'js', 'app.js'), "import './missing-module.js'\n")
    try {
        buildSite({ root, outDir: out, vendor: false, log: () => {} })
        assert.fail('expected the build to reject a page whose imports are missing')
    } catch (err) {
        assert.match(String(err.message), /does not resolve/)
        assert.match(String(err.message), /missing-module\.js/)
        assert.ok(!fs.existsSync(out), 'a rejected build must not leave a half-staged site')
    } finally {
        fs.rmSync(root, { recursive: true, force: true })
        fs.rmSync(out, { recursive: true, force: true })
    }
})
