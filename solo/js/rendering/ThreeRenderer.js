import * as THREE from 'three'
import PerceptionRenderer from './PerceptionRenderer.js'
import createTerrainMesh from './TerrainMesh.js'
import createModelLoaders from './ModelLoader.js'
import createMaterialFactory from './MaterialFactory.js'
import createModelBuilders from './ModelBuilders.js'
import createCameraController from './CameraController3D.js'
import createEntityPose from './EntityPose.js'
import createTerrainGenerator from '../core/TerrainGenerator.js'

class ThreeRenderer {
    constructor(world, canvasId) {
        this.world = world
        this.canvas = document.getElementById(canvasId)

        // Regional terrain generator — mountains in one region, plains downhill
        this._terrainGenerator = createTerrainGenerator({
            seed: world.chunkManager?.seed || 42,
            worldWidth: world.width,
            worldHeight: world.height,
            maxElevation: 400, // Peak mountain height
            waterLevel: 0.12, // Water plane
            hillScale: 200,

            // Mountain region placement (Rockies-style)
            mountainRegionX: 0.25, // Left quarter of world
            mountainRegionY: 0.3, // Upper third
            mountainRegionRadius: 0.35, // Mountain spread
            mountainRegionSharpness: 3, // Foothill falloff

            // Mountain drama
            ridgeStrength: 0.9,
            ridgeSharpness: 3.5,
            valleyStrength: 0.5,

            // Plains
            plainsRoughness: 0.15,

            // Rivers
            riverCarvingDepth: 15,

            // Global grade
            globalGrade: 0.12
        })

        if (!this.canvas) {
            this.canvas = document.createElement('canvas')
            this.canvas.id = canvasId
            document.body.appendChild(this.canvas)
        }

        // Camera/view state
        this.supportsTrueFirstPerson = true
        this.followMode = false
        this.followedEntity = null
        this.firstPersonLocked = false
        this.isPanning = false
        this.viewX = world.width / 2
        this.viewY = world.height / 2
        this.zoomLevel = 1
        this.minZoom = 0.1
        this.maxZoom = 5
        this.cameraDistance = 220
        this.firstPersonHeight = 1.5
        this.turnResponse = 0.22
        this.turnDamping = 0.84
        this.maxTurnSpeed = 0.16
        this.turnSnapThreshold = 0.003
        this.turnStopVelocity = 0.002
        this.showGrid = false
        this.showChunks = false
        this.showMinimap = false
        this.capabilities = null
        this.perceptionPolicy = 'phase_aware'
        this.highlightedEntity = null
        this.highlightEndTime = 0
        this.paused = false

        // Perception
        this.perception = new PerceptionRenderer(world)

        // Entity tracking
        this._meshById = new Map()
        this._entityById = new Map()

        // Smoothed camera/pose vectors
        const spawnHeight = this._terrainGenerator?.getElevation?.(world.width / 2, world.height / 2) ?? 0
        this._tmpTargetPosition = new THREE.Vector3()
        this._smoothedFirstPersonEye = new THREE.Vector3(this.viewX, spawnHeight + this.firstPersonHeight, this.viewY)
        this._smoothedFirstPersonDir = new THREE.Vector3(1, 0, 0)
        this._smoothedCameraTarget = new THREE.Vector3(this.viewX, spawnHeight, this.viewY)
        this._firstPersonYaw = 0
        this._firstPersonYawVelocity = 0
        this._smoothedPawnRotY = 0
        this._smoothedPawnPos = new THREE.Vector3()

        // Pooled temporaries (avoid GC)
        this._tmpHeadTarget = new THREE.Vector3()
        this._tmpTravelDir = new THREE.Vector3()
        this._tmpAttnDir = new THREE.Vector3()
        this._tmpRawAttn = new THREE.Vector3()
        this._tmpBlendDir = new THREE.Vector3()
        this._tmpYawDir = new THREE.Vector3()
        this._tmpTargetEye = new THREE.Vector3()
        this._tmpLookTarget = new THREE.Vector3()
        this._tmpOverseerTarget = new THREE.Vector3()
        this._tmpOverseerElevated = new THREE.Vector3()

        // Tuning
        this.cameraTuning = {
            behindDistance: 0.8,
            cameraHeight: -0.15,
            lookDistance: 9.0,
            lookHeight: 1.5
        }
        this.pawnTuning = {
            pawnScale: 1.6,
            pawnYOffset: -0.1
        }
        this._pawnModelHeight = 1.0

        // Shader uniforms
        this._timeUniform = { value: 0 }
        this._waterShimmerUniform = { value: 1.8 }
        this._waterSpeedUniform = { value: 1.2 }
        this._foliageSwayUniform = { value: 1.0 }
        this._visualTuning = {
            waterShimmer: 1.8,
            waterSpeed: 1.2,
            foliageSway: 1.0
        }
        this._waterMaterials = new Set()
        this._foliageMaterials = new Set()

        // Model roots
        this._treeModelRoot = null
        this._treeModelFailed = false
        this._rockModelRoot = null
        this._rockModelVariants = []
        this._rockModelFailed = false
        this._bushModelRoot = null
        this._bushModelFailed = false
        this._bushLeafTexture = null
        this._bushLeafTextureFailed = false
        this._partsForSaleRoot = null
        this._partsForSaleFailed = false
        this._partsForSaleBushVariants = []
        this._partsForSaleSmallTreeVariants = []
        this._grassModelRoot = null
        this._grassModelMeta = null
        this._grassModelFailed = false
        this._animalModelRoot = null
        this._animalModelFailed = false
        this._animalModelVariants = []
        this._animalVariantMeta = []
        this._animalPackOrder = ['elephant', 'deer', 'bear', 'dog', 'cat', 'horse', 'lion', 'giraffe']
        this._pawnModelRoot = null
        this._pawnModelFailed = false
        this._pawnTexture = null
        this._pawnTextureFailed = false
        this._skyboxTexture = null
        this.showAnimalLabels = false
        this._animalLabelLayer = null

        // Three.js scene
        this.scene = new THREE.Scene()
        this.scene.background = new THREE.Color('#2c5f2d')

        this._skyDome = this._createSkyDome()
        this.scene.add(this._skyDome)

        this._camera3d = new THREE.PerspectiveCamera(65, 1, 0.1, 12000)
        this.webglRenderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true })
        this.webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

        // Compose modules before using their methods
        Object.assign(this, createTerrainMesh(this))
        Object.assign(this, createModelLoaders(this))
        Object.assign(this, createMaterialFactory(this))
        Object.assign(this, createModelBuilders(this))
        Object.assign(this, createCameraController(this))
        Object.assign(this, createEntityPose(this))

        // Head mesh (first-person) — needs _centerModelToOrigin from ModelBuilders
        this._headMesh = this._createHeadMesh()

        // Lighting — bright enough to see dramatic terrain
        this._ambient = new THREE.AmbientLight(0xffffff, 0.6)
        this._sun = new THREE.DirectionalLight(0xffffff, 1.5)
        this._sun.position.set(300, 500, 200)
        this._hemisphere = new THREE.HemisphereLight(0x87CEEB, 0x355f2f, 0.4)
        this.scene.add(this._ambient)
        this.scene.add(this._sun)
        this.scene.add(this._hemisphere)

        // Terrain
        this._terrainSegmentsX = Math.max(100, Math.min(500, Math.floor(this.world.width / 50)))
        this._terrainSegmentsY = Math.max(100, Math.min(500, Math.floor(this.world.height / 50)))
        this._buildTerrainMesh()

        // Grid
        this._gridHelper = new THREE.GridHelper(Math.max(this.world.width, this.world.height), 40, 0x999999, 0x555555)
        this._gridHelper.position.set(this.world.width / 2, 0, this.world.height / 2)
        this._gridHelper.visible = false
        this.scene.add(this._gridHelper)

        // PlayerMode camera proxy
        this.camera = {
            get viewX() { return this._owner.viewX },
            set viewX(v) { this._owner.viewX = v },
            get viewY() { return this._owner.viewY },
            set viewY(v) { this._owner.viewY = v },
            get zoomLevel() { return this._owner.zoomLevel },
            set zoomLevel(v) { this._owner.zoomLevel = v },
            setZoomToShowRadius: (radius, marginFactor) => this.setZoomToShowRadius(radius, marginFactor)
        }
        this.camera._owner = this

        // Raycasting
        this._raycaster = new THREE.Raycaster()
        this._pointer = new THREE.Vector2()
        this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

        // Init
        this._onResize = () => this.resizeCanvas()
        window.addEventListener('resize', this._onResize)
        this.resizeCanvas()
        this._ensureAnimalLabelLayer()

        // Load models
        this._loadTreeModel()
        this._loadRockModel()
        this._loadGrassModel()
        this._loadPartsForSaleModel()
        this._loadAnimalModel()
        this._loadOpenGameArtSkybox()
        this._loadPawnModel()
    }

    // --- Sky dome ---
    _createSkyDome() {
        const geometry = new THREE.SphereGeometry(7000, 24, 16)
        const material = new THREE.ShaderMaterial({
            side: THREE.BackSide,
            depthWrite: false,
            uniforms: {
                topColor: { value: new THREE.Color('#7ec8ff') },
                bottomColor: { value: new THREE.Color('#dff1ff') },
                offset: { value: 120 },
                exponent: { value: 0.7 }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
                    float t = max(pow(max(h, 0.0), exponent), 0.0);
                    gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
                }
            `
        })
        return new THREE.Mesh(geometry, material)
    }

    // --- Resize ---
    resizeCanvas() {
        this.canvas.width = window.innerWidth
        this.canvas.height = window.innerHeight
        this.canvas.style.position = 'absolute'
        this.canvas.style.top = '0'
        this.canvas.style.left = '0'
        this._camera3d.aspect = Math.max(1, this.canvas.width) / Math.max(1, this.canvas.height)
        this._camera3d.updateProjectionMatrix()
        this.webglRenderer.setSize(this.canvas.width, this.canvas.height, false)
    }

    // --- Follow / first-person ---
    setFollowEntity(entity) {
        if (this.firstPersonLocked && entity === null) return false
        this.followedEntity = entity
        this.followMode = entity !== null
        if (entity) {
            this.viewX = entity.x
            this.viewY = entity.y
        }
        return true
    }

    setFirstPersonLocked(locked, options = {}) {
        this.firstPersonLocked = !!locked
        const entity = options.entity ?? this.followedEntity
        if (entity) this.setFollowEntity(entity)
        if (options.radius) this.setZoomToShowRadius(options.radius, options.marginFactor ?? 0.85)
    }

    enterFirstPerson(entity) {
        if (entity) this.setFollowEntity(entity)
        this.firstPersonLocked = true

        const pawn = this.followedEntity
        if (pawn) {
            const eyeGround = this._getGroundHeightAt(pawn.x, pawn.y)
            const pawnScale = this.pawnTuning?.pawnScale ?? 2.5
            const bottomOffset = (this._pawnModelBottomY ?? -0.5) * pawnScale
            const pawnHeadY = eyeGround - bottomOffset + this._pawnModelHeight * pawnScale

            const pX = Number.isFinite(pawn.prevX) ? pawn.prevX : pawn.x
            const pY = Number.isFinite(pawn.prevY) ? pawn.prevY : pawn.y
            const dx = pawn.x - pX
            const dy = pawn.y - pY
            if (dx * dx + dy * dy > 0.0001) {
                this._firstPersonYaw = Math.atan2(dy, dx)
                this._smoothedFirstPersonDir.set(dx, 0, dy).normalize()
            } else {
                this._firstPersonYaw = 0
                this._smoothedFirstPersonDir.set(1, 0, 0)
            }
            this._firstPersonYawVelocity = 0

            const yawDir = new THREE.Vector3(Math.cos(this._firstPersonYaw), 0, Math.sin(this._firstPersonYaw))
            const behindDistance = this.cameraTuning.behindDistance
            const camHeight = pawnHeadY + this.cameraTuning.cameraHeight
            this._smoothedFirstPersonEye.set(
                pawn.x - yawDir.x * behindDistance,
                camHeight,
                pawn.y - yawDir.z * behindDistance
            )
            this._smoothedPawnPos.set(pawn.x, pawnHeadY + (this.pawnTuning?.pawnYOffset ?? 0), pawn.y)
            this._smoothedPawnRotY = this._firstPersonYaw
        }
        return !!this.followedEntity
    }

    exitFirstPerson() {
        this.firstPersonLocked = false
    }

    setZoomToShowRadius(radius, marginFactor = 0.9) {
        if (!radius || radius <= 0) return
        const desiredDistance = (radius * 2) / Math.max(0.1, marginFactor)
        this.cameraDistance = Math.max(25, Math.min(2200, desiredDistance))
        const normalized = 150 / this.cameraDistance
        this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, normalized))
    }

    // --- Perception ---
    get perceptionMode() {
        return this.perception.perceptionMode
    }

    togglePerceptionMode() {
        if (this.perceptionPolicy === 'disabled' || this.perceptionPolicy === 'god_noop') return
        this.perception.togglePerceptionMode()
    }

    // --- Capabilities ---
    setCapabilities(payload) {
        this.capabilities = payload || null
        this.perceptionPolicy = this.capabilities?.modules?.perceptionModePolicy ?? 'phase_aware'
    }

    getCapabilities() {
        return this.capabilities
    }

    setWaypointProvider(provider) {
        this._waypointProvider = provider
    }

    setRouteTraceProvider(provider) {
        this._routeTraceProvider = provider
    }

    // --- Visual tuning ---
    getVisualTuning() {
        return { ...this._visualTuning }
    }

    setVisualTuning(tuning = {}) {
        if (Number.isFinite(tuning.waterShimmer)) {
            this._visualTuning.waterShimmer = Math.max(0, Math.min(4, tuning.waterShimmer))
            this._waterShimmerUniform.value = this._visualTuning.waterShimmer
        }
        if (Number.isFinite(tuning.waterSpeed)) {
            this._visualTuning.waterSpeed = Math.max(0, Math.min(4, tuning.waterSpeed))
            this._waterSpeedUniform.value = this._visualTuning.waterSpeed
        }
        if (Number.isFinite(tuning.foliageSway)) {
            this._visualTuning.foliageSway = Math.max(0, Math.min(3, tuning.foliageSway))
            this._foliageSwayUniform.value = this._visualTuning.foliageSway
        }
    }

    // --- Animal labels ---
    getAnimalLabelsVisible() {
        return !!this.showAnimalLabels
    }

    setAnimalLabelsVisible(visible) {
        this.showAnimalLabels = !!visible
    }

    _ensureAnimalLabelLayer() {
        if (this._animalLabelLayer) return
        const layer = document.createElement('div')
        layer.id = 'animal-label-layer'
        Object.assign(layer.style, {
            position: 'fixed',
            inset: '0',
            pointerEvents: 'none',
            zIndex: '35'
        })
        document.body.appendChild(layer)
        this._animalLabelLayer = layer
    }

    _clearAnimalLabels() {
        if (!this._animalLabelLayer) return
        this._animalLabelLayer.replaceChildren()
    }

    // --- Highlight ---
    highlightEntity(entity, duration = 2000) {
        this.highlightedEntity = entity
        this.highlightEndTime = Date.now() + duration
    }

    // --- Coordinate transforms ---
    screenToWorld(screenX, screenY) {
        this._pointer.x = (screenX / this.canvas.width) * 2 - 1
        this._pointer.y = -(screenY / this.canvas.height) * 2 + 1
        this._raycaster.setFromCamera(this._pointer, this._camera3d)

        const terrainHits = this._raycaster.intersectObject(this._ground, false)
        if (terrainHits.length > 0) {
            const point = terrainHits[0].point
            return { x: point.x, y: point.z }
        }

        const point = new THREE.Vector3()
        const hit = this._raycaster.ray.intersectPlane(this._groundPlane, point)
        if (!hit) return { x: this.viewX, y: this.viewY }
        return { x: point.x, y: point.z }
    }

    getEntityAtScreen(screenX, screenY) {
        if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return null
        if (!this.canvas?.width || !this.canvas?.height) return null
        if (!this._meshById.size) return null

        this._pointer.x = (screenX / this.canvas.width) * 2 - 1
        this._pointer.y = -(screenY / this.canvas.height) * 2 + 1
        this._raycaster.setFromCamera(this._pointer, this._camera3d)

        const roots = [...this._meshById.values()]
        const hits = this._raycaster.intersectObjects(roots, true)
        if (!hits.length) return null

        for (const hit of hits) {
            let node = hit.object
            while (node) {
                const entityId = node.userData?.entityId
                if (entityId && this._entityById.has(entityId)) {
                    return this._entityById.get(entityId) ?? null
                }
                node = node.parent
            }
        }
        return null
    }

    _tagEntityOnObject(root, entityId) {
        if (!root || !entityId) return
        root.userData = root.userData || {}
        root.userData.entityId = entityId
        root.traverse?.((node) => {
            node.userData = node.userData || {}
            node.userData.entityId = entityId
        })
    }

    worldToScreen(worldX, worldY) {
        const point = new THREE.Vector3(worldX, 0, worldY)
        point.project(this._camera3d)
        return {
            x: (point.x + 1) * 0.5 * this.canvas.width,
            y: (1 - point.y) * 0.5 * this.canvas.height
        }
    }

    // --- Utilities ---
    _hasTag(entity, tag) {
        if (!entity || !tag) return false
        if (Array.isArray(entity.tags)) return entity.tags.includes(tag)
        if (entity.tags?.has) return entity.tags.has(tag)
        return false
    }

    _hashUnit(seed, salt = '') {
        let hash = 2166136261
        const source = `${seed ?? ''}|${salt}`
        for (let i = 0; i < source.length; i++) {
            hash ^= source.charCodeAt(i)
            hash = Math.imul(hash, 16777619)
        }
        return ((hash >>> 0) % 10000) / 10000
    }

    // --- Main render loop ---
    render() {
        const { progress } = this.world.clock.getProgress()

        if (!this.paused) {
            this._timeUniform.value = performance.now() * 0.001
            this._updateCamera(progress)
            this._updateHeadMesh(progress)
        }

        this._gridHelper.visible = !!this.showGrid

        const entitiesToRender = this.perception.getEntitiesToRender(this.followedEntity)
        const visibleIds = new Set()

        for (const entity of entitiesToRender) {
            if (!entity?.id) continue
            if (this.firstPersonLocked && entity === this.followedEntity) continue
            visibleIds.add(entity.id)

            let mesh = this._meshById.get(entity.id)
            if (!mesh) {
                mesh = this._createMeshForEntity(entity)
                this._meshById.set(entity.id, mesh)
                this._tagEntityOnObject(mesh, entity.id)
            }
            this._entityById.set(entity.id, entity)
            this._updateMeshPose(entity, mesh, progress)

            const alpha = this.perception.getEntityRenderAlpha(entity, this.followedEntity)
            if (mesh.isMesh) {
                if (mesh.material) {
                    mesh.material.transparent = alpha < 0.999
                    mesh.material.opacity = alpha
                }
            } else {
                mesh.traverse((node) => {
                    if (!node.isMesh || !node.material) return
                    node.material.transparent = alpha < 0.999
                    node.material.opacity = alpha
                })
            }
        }

        for (const [id] of this._meshById) {
            if (visibleIds.has(id)) continue
            this._disposeMesh(id)
        }

        this.webglRenderer.render(this.scene, this._camera3d)
        this._renderAnimalLabels(entitiesToRender)

        if (Date.now() >= this.highlightEndTime) {
            this.highlightedEntity = null
        }
    }

    _renderAnimalLabels(entitiesToRender) {
        if (!this.showAnimalLabels || !this._animalLabelLayer) {
            this._clearAnimalLabels()
            return
        }

        const fragment = document.createDocumentFragment()
        let count = 0
        const maxLabels = 45

        for (const entity of entitiesToRender) {
            if (count >= maxLabels) break
            if (entity?.subtype !== 'animal') continue

            const mesh = this._meshById.get(entity.id)
            if (!mesh) continue
            const labelText = mesh.userData?.animalLabel
            if (!labelText) continue

            const worldPos = mesh.position.clone()
            worldPos.y += 6
            worldPos.project(this._camera3d)

            if (worldPos.z < -1 || worldPos.z > 1) continue

            const x = (worldPos.x + 1) * 0.5 * this.canvas.width
            const y = (1 - worldPos.y) * 0.5 * this.canvas.height

            const label = document.createElement('div')
            label.textContent = labelText
            Object.assign(label.style, {
                position: 'absolute',
                left: `${x}px`,
                top: `${y}px`,
                transform: 'translate(-50%, -100%)',
                font: '11px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                color: '#e5e7eb',
                textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                background: 'rgba(3, 7, 18, 0.55)',
                border: '1px solid rgba(148, 163, 184, 0.35)',
                borderRadius: '4px',
                padding: '2px 5px',
                whiteSpace: 'nowrap'
            })
            fragment.appendChild(label)
            count += 1
        }

        this._animalLabelLayer.replaceChildren(fragment)
    }

    // --- Destroy ---
    destroy() {
        if (this._onResize) window.removeEventListener('resize', this._onResize)
        this._clearAnimalLabels()
        this._animalLabelLayer?.remove?.()
        this._animalLabelLayer = null

        for (const [id] of this._meshById) {
            this._disposeMesh(id)
        }

        this.scene.remove(this._ambient)
        this.scene.remove(this._sun)
        this.scene.remove(this._ground)
        this.scene.remove(this._gridHelper)
        this.scene.remove(this._skyDome)
        this._ground.geometry?.dispose?.()
        this._ground.material?.dispose?.()
        this._skyDome.geometry?.dispose?.()
        this._skyDome.material?.dispose?.()
        this._skyboxTexture?.dispose?.()
        this._pawnTexture?.dispose?.()

        this.webglRenderer.dispose()
        this.webglRenderer.forceContextLoss?.()
    }
}

export default ThreeRenderer
