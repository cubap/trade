import CanvasRenderer from './CanvasRenderer.js'
import ThreeRenderer from './ThreeRenderer.js'

export const DEFAULT_RENDERER_KEY = 'canvas'

const RENDERER_ALIASES = {
    default: DEFAULT_RENDERER_KEY,
    '2d': DEFAULT_RENDERER_KEY,
    canvas: DEFAULT_RENDERER_KEY,
    '3d': 'three',
    three: 'three'
}

export function normalizeRendererKey(rawKey) {
    const key = String(rawKey || '').trim().toLowerCase()
    return RENDERER_ALIASES[key] ?? DEFAULT_RENDERER_KEY
}

export function getRendererKeyFromHash(hash = window.location.hash) {
    const raw = String(hash || '').replace(/^#/, '')
    const params = new URLSearchParams(raw)
    const keyFromHash = params.get('renderer') || params.get('view')
    return normalizeRendererKey(keyFromHash)
}

export function createRenderer(world, canvasId, rendererKey = DEFAULT_RENDERER_KEY) {
    const key = normalizeRendererKey(rendererKey)

    if (key === DEFAULT_RENDERER_KEY) {
        return { key, instance: new CanvasRenderer(world, canvasId) }
    }

    if (key === 'three') {
        try {
            return { key, instance: new ThreeRenderer(world, canvasId) }
        } catch (error) {
            console.warn(`[renderer] failed to initialize '${key}', falling back to '${DEFAULT_RENDERER_KEY}'`, error)
            return { key: DEFAULT_RENDERER_KEY, instance: new CanvasRenderer(world, canvasId) }
        }
    }

    return { key: DEFAULT_RENDERER_KEY, instance: new CanvasRenderer(world, canvasId) }
}
