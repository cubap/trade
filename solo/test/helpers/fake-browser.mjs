// A fake WebGL2 context + canvas, good enough for three.js's WebGLRenderer to
// construct, size, render one frame and dispose under `node --test`. #97.
//
// three touches a couple of hundred GL entry points during construction alone,
// and almost all of them only need to not throw. So the context is a Proxy that
// answers every method with a no-op and every `GL_*`-style constant with a value
// from a name<->number table, because a handful of calls really do have to agree
// with each other:
//
//   - gl.getParameter(gl.VERSION) must be a string containing "WebGL 2".
//   - gl.checkFramebufferStatus() must equal gl.FRAMEBUFFER_COMPLETE, or the
//     renderer declares its own default framebuffer broken.
//   - gl.getParameter(gl.MAX_TEXTURE_SIZE) must outvote three's 2048 floor or the
//     texture atlases come out the wrong size.
//
// That is why enum values are minted per name instead of being hardcoded: the
// table is how a name-keyed answer stays consistent with a number-keyed question
// without shipping a copy of the WebGL registry.
//
// Anything genuinely visual (shader compilation, pixel output) is not modelled
// and must not be asserted on - this proves the renderer's own bookkeeping, not
// three's.

const GL = Object.freeze({
    // Parameters three reads back as strings.
    stringParams: new Set(['VERSION', 'SHADING_LANGUAGE_VERSION', 'UNMASKED_VENDOR_WEBGL', 'UNMASKED_RENDERER_WEBGL']),
    // Parameters that must be numbers, by name fragment.
    maxNumber: 4096,
    /** Methods whose return value must be a specific enum/shape rather than a no-op. */
    answers: {
        getParameter: glParameter,
        checkFramebufferStatus: () => enumValue('FRAMEBUFFER_COMPLETE'),
        // Link/complete status must read truthy, but the *counts* must read 0: three
        // loops `for (i = 0; i < getProgramParameter(p, ACTIVE_UNIFORMS); i++)` and
        // dereferences getActiveUniform() inside it, which a context that compiled
        // nothing cannot describe. Zero introspectable uniforms is the honest answer.
        getProgramParameter: (_program, pname) => (COUNT_PARAMS.has(names.get(pname)) ? 0 : true),
        getShaderParameter: () => true,
        getFramebufferAttachmentParameter: () => 0,
        getProgramInfoLog: () => '',
        getShaderInfoLog: () => '',
        getActiveUniform: () => null,
        getActiveAttrib: () => null,
        getUniformBlockIndex: () => 0,
        getFragDataLocation: () => 0,
        getAttribLocation: () => 0,
        getUniformLocation: () => ({}),
        getError: () => 0,
        isContextLost: () => false,
        getSupportedExtensions: () => [],
        getContextAttributes: () => ({
            alpha: true, antialias: true, depth: true, stencil: false,
            premultipliedAlpha: true, preserveDrawingBuffer: false
        }),
        getShaderPrecisionFormat: () => ({ rangeMin: 127, rangeMax: 127, precision: 23 }),
        getExtension: name => (name === 'WEBGL_debug_renderer_info'
            // Real constants: three reads these two back through getParameter().
            ? { UNMASKED_VENDOR_WEBGL: enumValue('UNMASKED_VENDOR_WEBGL'), UNMASKED_RENDERER_WEBGL: enumValue('UNMASKED_RENDERER_WEBGL') }
            : null),
        createBuffer: () => ({ kind: 'buffer' }),
        createTexture: () => ({ kind: 'texture' }),
        createFramebuffer: () => ({ kind: 'framebuffer' }),
        createRenderbuffer: () => ({ kind: 'renderbuffer' }),
        createProgram: () => ({ kind: 'program' }),
        createShader: () => ({ kind: 'shader' }),
        createVertexArray: () => ({ kind: 'vao' }),
        createQuery: () => ({ kind: 'query' }),
        createSampler: () => ({ kind: 'sampler' })
    }
})

const values = new Map()
const names = new Map()
// Program queries that are counts rather than statuses.
const COUNT_PARAMS = new Set(['ACTIVE_UNIFORMS', 'ACTIVE_ATTRIBUTES', 'ACTIVE_UNIFORM_BLOCKS'])
let nextValue = 0x2000

/** Mint (or reuse) the numeric value of a GL constant by name. */
function enumValue(name) {
    if (!values.has(name)) {
        values.set(name, nextValue++)
        names.set(values.get(name), name)
    }
    return values.get(name)
}

function glParameter(pname) {
    const name = names.get(pname)
    if (name && GL.stringParams.has(name)) {
        return name === 'SHADING_LANGUAGE_VERSION' ? 'WebGL GLSL ES 3.00 (copilot fake)' : 'WebGL 2.0 (copilot fake)'
    }
    if (name && name.startsWith('MAX_')) return GL.maxNumber
    return 0
}

/**
 * @param {object} canvas the fake canvas this context draws into
 * @returns {Proxy} something three's WebGLRenderer will accept as a GL context
 */
export function createFakeGLContext(canvas) {
    // Pre-register the constants three is known to ask for by name so that a
    // later getParameter(x) can still recover the name.
    for (const n of [...GL.stringParams, 'FRAMEBUFFER_COMPLETE', 'ACTIVE_UNIFORMS', 'ACTIVE_ATTRIBUTES']) enumValue(n)

    return new Proxy({}, {
        get(_target, prop) {
            if (prop === 'canvas') return canvas
            if (prop === Symbol.toPrimitive || prop === 'constructor') return undefined
            if (typeof prop !== 'string') return undefined
            if (Object.prototype.hasOwnProperty.call(GL.answers, prop)) return GL.answers[prop]
            // WebGL constants are SCREAMING_SNAKE_CASE; everything else is a method.
            if (/^[A-Z][A-Z0-9_]*$/.test(prop)) return enumValue(prop)
            return () => undefined
        },
        has: () => true,
        set: () => true
    })
}

/**
 * Element generic enough for the loaders: three's ImageLoader wants `img`,
 * app.js wants `div`/`canvas`. Nothing here decodes, so an assigned `src` is
 * simply remembered - a model or texture request stays pending forever, which is
 * the honest headless answer to "load /solo/assets/models/tree_obj.obj".
 */
function createElement(tag, { width = 800, height = 600 } = {}) {
    const normalised = String(tag).toLowerCase()
    if (normalised === 'canvas') return createFakeCanvas({ width, height })
    return {
        tagName: normalised.toUpperCase(),
        style: {},
        dataset: {},
        children: [],
        width,
        height,
        naturalWidth: 0,
        naturalHeight: 0,
        complete: false,
        src: '',
        crossOrigin: null,
        decoding: 'auto',
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        appendChild(child) { this.children.push(child); return child },
        removeChild(child) { this.children = this.children.filter(c => c !== child); return child },
        replaceChildren(...kids) { this.children = kids },
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => true,
        setAttribute() {},
        removeAttribute() {},
        getAttribute: () => null,
        getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 }),
        focus() {},
        querySelector: () => null,
        querySelectorAll: () => [],
        remove() {}
    }
}

/**
 * The 2D half of the fake, since `createElement('canvas')` cannot promise callers
 * only want WebGL. Nothing draws, so every method is a no-op that returns a
 * shape; the point is that a 2D caller does not throw on the way in.
 */
function createFake2DContext(canvas) {
    return {
        canvas,
        fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '10px sans-serif',
        globalAlpha: 1, globalCompositeOperation: 'source-over',
        lineCap: 'butt', lineJoin: 'miter', shadowBlur: 0, shadowColor: 'transparent',
        save() {}, restore() {},
        beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {},
        bezierCurveTo() {}, arc() {}, arcTo() {}, ellipse() {}, rect() {},
        fill() {}, stroke() {}, clip() {},
        translate() {}, rotate() {}, scale() {}, transform() {}, setTransform() {}, resetTransform() {},
        fillRect() {}, strokeRect() {}, clearRect() {},
        fillText() {}, strokeText() {},
        measureText: text => ({ width: String(text).length * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
        drawImage() {},
        createLinearGradient: () => ({ addColorStop() {} }),
        createRadialGradient: () => ({ addColorStop() {} }),
        createPattern: () => null,
        getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
        putImageData() {},
        createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) })
    }
}

/**
 * A canvas whose 2D/webgl contexts are fake. `document.createElement('canvas')`
 * hands this back so a renderer can be constructed headlessly.
 */
export function createFakeCanvas({ width = 800, height = 600, id = 'fake-canvas' } = {}) {
    const contexts = new Map()
    const canvas = {
        id,
        width,
        height,
        clientWidth: width,
        clientHeight: height,
        style: {},
        dataset: {},
        parentNode: null,
        children: [],
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        // One context per type, as a real canvas does: asking twice must give back
        // the same object, or a caller cannot tell whether it is looking at the
        // surface it drew into.
        getContext(kind) {
            const key = String(kind)
            if (!contexts.has(key)) {
                contexts.set(key, key.includes('webgl') ? createFakeGLContext(canvas) : createFake2DContext(canvas))
            }
            return contexts.get(key)
        },
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => true,
        getBoundingClientRect: () => ({ left: 0, top: 0, right: width, bottom: height, width, height, x: 0, y: 0 }),
        setAttribute() {},
        removeAttribute() {},
        getAttribute: () => null,
        appendChild(child) { this.children.push(child); return child },
        removeChild(child) { this.children = this.children.filter(c => c !== child); return child },
        focus() {},
        toDataURL: () => 'data:,'
    }
    return canvas
}

/**
 * Installs the minimum `document` / `window` surface a three.js renderer needs and
 * returns a teardown. Same spirit as canvas-renderer-capabilities.test.js, which
 * stubs the 2D context; this one stubs the 3D one.
 */
export function installFakeBrowser({ width = 800, height = 600 } = {}) {
    const byId = new Map()
    const listeners = []
    const requests = []
    const g = globalThis

    const body = {
        appendChild(child) { if (child.id) byId.set(child.id, child); return child },
        removeChild(child) { return child },
        children: []
    }

    const doc = {
        body,
        documentElement: { style: {}, clientWidth: width, clientHeight: height },
        getElementById: id => byId.get(id) ?? null,
        createElement: tag => createElement(tag, { width, height }),
        createElementNS: (_ns, tag) => createElement(tag, { width, height }),
        createDocumentFragment: () => ({ children: [], appendChild(c) { this.children.push(c); return c } }),
        addEventListener() {},
        removeEventListener() {},
        querySelector: () => null,
        querySelectorAll: () => []
    }

    const win = {
        innerWidth: width,
        innerHeight: height,
        devicePixelRatio: 1,
        document: doc,
        addEventListener(type, fn) { listeners.push({ type, fn }) },
        removeEventListener(type, fn) {
            const i = listeners.findIndex(l => l.type === type && l.fn === fn)
            if (i >= 0) listeners.splice(i, 1)
        },
        requestAnimationFrame: () => 0,
        cancelAnimationFrame() {},
        matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
    }

    // Asset requests are recorded and left pending. A unit test has no server, and
    // a *rejected* load would drive the renderer's error path instead of proving
    // the normal one, so `modelLoader.load(url, onLoad)` simply never resolves -
    // which is what "no assets in this environment" means.
    //
    // `Request` has to be faked as well as `fetch`: three builds one before it
    // calls fetch, and the real constructor runs the WHATWG URL parser, which has
    // no idea what the page-relative '/solo/assets/models/tree_obj.obj' means.
    // Faking Request rather than the loader keeps every client code path intact.
    class FakeRequest {
        constructor(input, init = {}) {
            this.url = typeof input === 'string' ? input : (input?.url ?? String(input))
            requests.push(this.url)
            this.method = String(init.method ?? 'GET').toUpperCase()
            this.headers = new Map(Object.entries(init.headers ?? {}))
            this.signal = init.signal ?? null
            this.cache = init.cache ?? null
            this.mode = init.mode ?? null
            this.credentials = init.credentials ?? null
        }
    }
    const fetchStub = () => new Promise(() => {})

    const saved = {
        document: g.document, window: g.window, self: g.self,
        fetch: g.fetch, Request: g.Request
    }
    Object.defineProperty(g, 'document', { value: doc, configurable: true, writable: true })
    Object.defineProperty(g, 'window', { value: win, configurable: true, writable: true })
    Object.defineProperty(g, 'self', { value: win, configurable: true, writable: true })
    Object.defineProperty(g, 'fetch', { value: fetchStub, configurable: true, writable: true })
    Object.defineProperty(g, 'Request', { value: FakeRequest, configurable: true, writable: true })

    return {
        document: doc,
        window: win,
        canvas: () => createFakeCanvas({ width, height }),
        listeners,
        /** Root-absolute asset URLs the renderer asked for (never actually fetched). */
        requests,
        requestsTo: fragment => requests.filter(url => url.includes(fragment)),
        restore() {
            for (const [key, value] of Object.entries(saved)) {
                if (value === undefined) delete g[key]
                else Object.defineProperty(g, key, { value, configurable: true, writable: true })
            }
        }
    }
}
