import CanvasRenderer from './CanvasRenderer.js'
import ThreeRenderer from './ThreeRenderer.js'

export const DEFAULT_RENDERER_KEY = 'three'

const RENDERER_ALIASES = {
    default: DEFAULT_RENDERER_KEY,
    '2d': 'canvas',
    canvas: 'canvas',
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

    if (key === 'canvas') {
        return { key, instance: new CanvasRenderer(world, canvasId) }
    }

    if (key === 'three') {
        try {
            return { key, instance: new ThreeRenderer(world, canvasId) }
        } catch (error) {
            console.warn(`[renderer] failed to initialize '${key}', falling back to 'canvas'`, error)
            return { key: 'canvas', instance: new CanvasRenderer(world, canvasId) }
        }
    }

    return { key: 'canvas', instance: new CanvasRenderer(world, canvasId) }
}
