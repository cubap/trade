import * as THREE from 'three'
import { OBJLoader } from '/node_modules/three/examples/jsm/loaders/OBJLoader.js'
import { FBXLoader } from '/node_modules/three/examples/jsm/loaders/FBXLoader.js'
import PerceptionRenderer from './PerceptionRenderer.js'

class ThreeRenderer {
    constructor(world, canvasId) {
        this.world = world
        this.canvas = document.getElementById(canvasId)

        if (!this.canvas) {
            this.canvas = document.createElement('canvas')
            this.canvas.id = canvasId
            document.body.appendChild(this.canvas)
        }

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
        this.firstPersonHeight = 8
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

        this.perception = new PerceptionRenderer(world)
        this._meshById = new Map()
        this._entityById = new Map()
        this._tmpTargetPosition = new THREE.Vector3()
        this._smoothedFirstPersonEye = new THREE.Vector3(this.viewX, this.firstPersonHeight, this.viewY)
        this._smoothedFirstPersonDir = new THREE.Vector3(1, 0, 0)
        this._smoothedCameraTarget = new THREE.Vector3(this.viewX, 0, this.viewY)
        this._firstPersonYaw = 0
        this._firstPersonYawVelocity = 0
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
        this.showAnimalLabels = true
        this._animalLabelLayer = null

        this.scene = new THREE.Scene()
        this.scene.background = new THREE.Color('#2c5f2d')

        this._skyDome = this._createSkyDome()
        this.scene.add(this._skyDome)

        this._camera3d = new THREE.PerspectiveCamera(65, 1, 0.1, 12000)
        this.webglRenderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true })
        this.webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

        this._ambient = new THREE.AmbientLight(0xffffff, 0.7)
        this._sun = new THREE.DirectionalLight(0xffffff, 0.7)
        this._sun.position.set(220, 400, 160)
        this.scene.add(this._ambient)
        this.scene.add(this._sun)

        this._ground = new THREE.Mesh(
            new THREE.PlaneGeometry(this.world.width, this.world.height, 1, 1),
            new THREE.MeshStandardMaterial({ color: '#355f2f', roughness: 1, metalness: 0 })
        )
        this._ground.rotation.x = -Math.PI / 2
        this._ground.position.set(this.world.width / 2, -0.5, this.world.height / 2)
        this.scene.add(this._ground)

        this._gridHelper = new THREE.GridHelper(Math.max(this.world.width, this.world.height), 40, 0x999999, 0x555555)
        this._gridHelper.position.set(this.world.width / 2, 0, this.world.height / 2)
        this._gridHelper.visible = false
        this.scene.add(this._gridHelper)

        // `PlayerMode` expects a `.camera` object with these fields.
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

        this._raycaster = new THREE.Raycaster()
        this._pointer = new THREE.Vector2()
        this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

        this._onResize = () => this.resizeCanvas()
        window.addEventListener('resize', this._onResize)
        this.resizeCanvas()
        this._ensureAnimalLabelLayer()
        this._loadTreeModel()
        this._loadRockModel()
        this._loadGrassModel()
        this._loadPartsForSaleModel()
        this._loadAnimalModel()
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

    _loadTreeModel() {
        const loader = new OBJLoader()
        loader.load(
            '/solo/assets/models/tree_obj.obj',
            object => {
                this._treeModelRoot = object
                this._refreshTreeMeshes()
            },
            undefined,
            error => {
                this._treeModelFailed = true
                console.warn('[three] failed to load tree model, using procedural trees', error)
            }
        )
    }

    _loadRockModel() {
        const loader = new OBJLoader()
        loader.load(
            '/solo/assets/models/AssortedRocks.obj',
            object => {
                this._rockModelRoot = object
                this._rockModelVariants = object.children.filter(node => node.isMesh || node.type === 'Group')
                this._refreshRockMeshes()
            },
            undefined,
            error => {
                this._rockModelFailed = true
                console.warn('[three] failed to load assorted rock model, using procedural rocks', error)
            }
        )
    }

    _loadGrassModel() {
        const loader = new FBXLoader()
        loader.load(
            '/solo/assets/models/grassDarkGreen.fbx',
            object => {
                this._grassModelRoot = object
                this._grassModelMeta = this._getNodeBoundsMeta(object)
                this._refreshGrassMeshes()
            },
            undefined,
            error => {
                this._grassModelFailed = true
                console.warn('[three] failed to load grass model, using procedural grass', error)
            }
        )
    }

    _loadPartsForSaleModel() {
        const loader = new OBJLoader()
        loader.load(
            '/solo/assets/models/bush/PartsForSale.obj',
            object => {
                this._partsForSaleRoot = object
                this._classifyPartsForSaleVariants()
                this._refreshTreeMeshes()
                this._refreshBushMeshes()
            },
            undefined,
            () => {
                this._partsForSaleFailed = true
            }
        )
    }

    _classifyPartsForSaleVariants() {
        const children = this._partsForSaleRoot?.children?.filter(node => node.isMesh || node.type === 'Group') ?? []
        if (!children.length) {
            this._partsForSaleBushVariants = []
            this._partsForSaleSmallTreeVariants = []
            return
        }

        const withMeta = children.map(node => {
            const centerX = this._getNodeCenterX(node)
            const meta = this._getNodeBoundsMeta(node)
            return {
                node,
                centerX,
                height: meta.height,
                width: meta.width,
                depth: meta.depth
            }
        }).sort((a, b) => a.centerX - b.centerX)

        const heights = withMeta.map(item => item.height).filter(Number.isFinite).sort((a, b) => a - b)
        if (!heights.length) {
            this._partsForSaleBushVariants = []
            this._partsForSaleSmallTreeVariants = withMeta.map(item => item.node)
            return
        }

        const median = heights[Math.floor(heights.length * 0.5)]
        const endSliceCount = Math.max(2, Math.floor(withMeta.length * 0.3))
        const leftEnd = withMeta.slice(0, endSliceCount)
        const rightEnd = withMeta.slice(-endSliceCount)

        const averageHeight = items => items.reduce((sum, item) => sum + item.height, 0) / Math.max(1, items.length)
        const leftAvg = averageHeight(leftEnd)
        const rightAvg = averageHeight(rightEnd)
        const rowEnd = rightAvg <= leftAvg ? rightEnd : leftEnd

        const endHeights = rowEnd.map(item => item.height).sort((a, b) => a - b)
        const endMedianHeight = endHeights[Math.floor(endHeights.length * 0.5)] ?? median
        const endFootprints = rowEnd.map(item => Math.max(item.width, item.depth)).sort((a, b) => a - b)
        const endMedianFootprint = endFootprints[Math.floor(endFootprints.length * 0.5)] ?? 1

        const bushCandidates = rowEnd.filter(item => {
            const footprint = Math.max(item.width, item.depth)
            const heightRatio = item.height / Math.max(0.001, footprint)
            const compactEnough = heightRatio <= 2.2
            const withinHeightBand = item.height <= endMedianHeight * 1.5
            const notDebris = footprint >= endMedianFootprint * 0.25
            return compactEnough && withinHeightBand && notDebris
        })

        this._partsForSaleBushVariants = bushCandidates.map(item => item.node)

        const bushSet = new Set(this._partsForSaleBushVariants)
        this._partsForSaleSmallTreeVariants = withMeta
            .filter(item => !bushSet.has(item.node) && item.height >= median * 0.75)
            .map(item => item.node)

        if (!this._partsForSaleBushVariants.length) {
            this._partsForSaleBushVariants = rowEnd
                .filter(item => item.height <= endMedianHeight * 1.2)
                .map(item => item.node)
        }

        if (!this._partsForSaleSmallTreeVariants.length) {
            this._partsForSaleSmallTreeVariants = withMeta
                .filter(item => !this._partsForSaleBushVariants.includes(item.node))
                .map(item => item.node)
        }
    }

    _loadAnimalModel() {
        const loader = new OBJLoader()
        loader.load(
            '/solo/assets/models/animal_pack/animal%20pack/obj.obj',
            object => {
                this._animalModelRoot = object
                this._animalModelVariants = object.children
                    .filter(node => node.isMesh || node.type === 'Group')
                    .sort((a, b) => this._getNodeCenterX(a) - this._getNodeCenterX(b))
                this._animalVariantMeta = this._animalModelVariants.map(node => this._getNodeBoundsMeta(node))
                this._normalizeAnimalVariantScales()
                this._refreshAnimalMeshes()
            },
            undefined,
            error => {
                this._animalModelFailed = true
                console.warn('[three] failed to load animal model pack, using procedural animals', error)
            }
        )
    }

    _refreshTreeMeshes() {
        if (!this._treeModelRoot && !this._partsForSaleSmallTreeVariants.length) return

        const treeIds = []
        for (const [id, entity] of this._entityById.entries()) {
            if (entity?.type !== 'tree') continue
            treeIds.push(id)
        }

        for (const id of treeIds) {
            this._disposeMesh(id)
        }
    }

    _refreshRockMeshes() {
        if (!this._rockModelRoot) return

        const rockIds = []
        for (const [id, entity] of this._entityById.entries()) {
            if (entity?.subtype !== 'rock' && !this._hasTag(entity, 'rock')) continue
            rockIds.push(id)
        }

        for (const id of rockIds) {
            this._disposeMesh(id)
        }
    }

    _refreshGrassMeshes() {
        if (!this._grassModelRoot) return

        const grassIds = []
        for (const [id, entity] of this._entityById.entries()) {
            if (entity?.type !== 'grass') continue
            grassIds.push(id)
        }

        for (const id of grassIds) {
            this._disposeMesh(id)
        }
    }

    _refreshAnimalMeshes() {
        if (!this._animalModelRoot) return

        const animalIds = []
        for (const [id, entity] of this._entityById.entries()) {
            if (entity?.subtype !== 'animal') continue
            animalIds.push(id)
        }

        for (const id of animalIds) {
            this._disposeMesh(id)
        }
    }

    _refreshBushMeshes() {
        if (!this._bushModelRoot && !this._bushLeafTexture && !this._partsForSaleBushVariants.length) return

        const bushIds = []
        for (const [id, entity] of this._entityById.entries()) {
            if (entity?.type !== 'bush' && entity?.subtype !== 'plant') continue
            bushIds.push(id)
        }

        for (const id of bushIds) {
            this._disposeMesh(id)
        }
    }

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

    get perceptionMode() {
        return this.perception.perceptionMode
    }

    togglePerceptionMode() {
        if (this.perceptionPolicy === 'disabled' || this.perceptionPolicy === 'god_noop') return
        this.perception.togglePerceptionMode()
    }

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

    getAnimalLabelsVisible() {
        return !!this.showAnimalLabels
    }

    setAnimalLabelsVisible(visible) {
        this.showAnimalLabels = !!visible
    }

    highlightEntity(entity, duration = 2000) {
        this.highlightedEntity = entity
        this.highlightEndTime = Date.now() + duration
    }

    screenToWorld(screenX, screenY) {
        this._pointer.x = (screenX / this.canvas.width) * 2 - 1
        this._pointer.y = -(screenY / this.canvas.height) * 2 + 1
        this._raycaster.setFromCamera(this._pointer, this._camera3d)

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
        root.traverse?.(node => {
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

    _getEntityRenderProfile(entity) {
        const unitA = this._hashUnit(entity?.id, 'a')
        const unitB = this._hashUnit(entity?.id, 'b')
        const size = Math.max(0.5, Number(entity?.size) || 1)

        const isWater = entity?.subtype === 'water' || this._hasTag(entity, 'water')
        if (isWater) {
            const radius = Math.max(3, size * (1.2 + unitA * 0.8))
            return {
                geometry: new THREE.CircleGeometry(radius, 18),
                materialColor: entity?.color || '#4da6ff',
                shaderType: 'water',
                baseY: 0.03,
                rotation: { x: -Math.PI / 2, y: 0, z: 0 },
                lerp: 0.28
            }
        }

        const isStick = entity?.subtype === 'stick' || this._hasTag(entity, 'stick')
        if (isStick) {
            const length = Math.max(2.5, size * (1.2 + unitA * 1.8))
            const thickness = 0.18 + unitB * 0.18
            return {
                geometry: new THREE.BoxGeometry(length, thickness, thickness * 1.2),
                materialColor: entity?.color || '#8b5a2b',
                baseY: 0.06 + thickness * 0.5,
                rotation: {
                    x: (unitA - 0.5) * 0.16,
                    y: unitB * Math.PI * 2,
                    z: (unitB - 0.5) * 0.12
                },
                lerp: 0.26
            }
        }

        const isRock = entity?.subtype === 'rock' || this._hasTag(entity, 'rock')
        if (isRock) {
            const radius = Math.max(1.2, size * (0.75 + unitA * 0.55))
            return {
                geometry: new THREE.DodecahedronGeometry(radius, 0),
                materialColor: entity?.color || '#8b7355',
                useRockModel: !!this._rockModelRoot,
                modelScale: 0.06 + unitA * 0.05,
                baseY: radius * 0.68,
                rotation: {
                    x: (unitA - 0.5) * 0.28,
                    y: unitB * Math.PI * 2,
                    z: (unitB - 0.5) * 0.24
                },
                lerp: 0.22
            }
        }

        const isFiberPlant = entity?.subtype === 'fiber_plant' || this._hasTag(entity, 'fiber')
        if (isFiberPlant) {
            const height = Math.max(1.5, 2.2 + unitA * 2.6)
            const radius = Math.max(0.24, 0.18 + unitB * 0.32)
            return {
                geometry: new THREE.ConeGeometry(radius * 2.2, height, 5),
                materialColor: entity?.color || '#9acd32',
                shaderType: 'foliage',
                swayStrength: 0.4 + unitA * 0.22,
                baseY: height * 0.5,
                rotation: { x: 0, y: unitB * Math.PI * 2, z: 0 },
                lerp: 0.26
            }
        }

        if (entity?.type === 'grass') {
            const height = Math.max(0.9, 1.1 + unitA * 1.5)
            return {
                geometry: new THREE.ConeGeometry(0.45 + unitB * 0.35, height, 4),
                materialColor: entity?.color || '#74b94a',
                shaderType: 'foliage',
                swayStrength: 0.32 + unitB * 0.14,
                baseY: height * 0.5,
                useGrassModel: !!this._grassModelRoot,
                grassTargetHeight: height,
                rotation: { x: 0, y: unitA * Math.PI * 2, z: 0 },
                lerp: 0.2
            }
        }

        if (entity?.subtype === 'food' || this._hasTag(entity, 'food')) {
            const radius = Math.max(1.2, size * (0.35 + unitA * 0.2))
            return {
                geometry: new THREE.OctahedronGeometry(radius, 0),
                materialColor: entity?.color || '#7cfc00',
                baseY: radius,
                rotation: { x: 0, y: unitB * Math.PI * 2, z: 0 },
                lerp: 0.22
            }
        }

        if (entity?.type === 'tree') {
            const isSapling = entity?.stage === 'sapling'
            const isSmallTreeStage = isSapling
            const stageScale = entity?.stage === 'adult' ? 1 : isSapling ? 0.62 : 0.35
            const baseHeight = Math.max(5, (9 + unitA * 14) * stageScale)
            const height = isSapling ? baseHeight * 2 : baseHeight
            const radius = Math.max(0.6, baseHeight * 0.08)
            const leafColor = entity?.color || '#5e8f3f'
            return {
                geometry: new THREE.CylinderGeometry(radius * 0.75, radius, height, 8),
                materialColor: leafColor,
                leafColor,
                trunkColor: '#6b4f2a',
                shaderType: 'foliage',
                swayStrength: 0.18 + unitA * 0.08,
                baseY: height * 0.5,
                modelScale: (0.2 + unitA * 0.08) * 3,
                modelScaleY: isSapling ? 0.6 : 1,
                useTreeModel: !!this._treeModelRoot,
                useSmallTreeVariantModel: false,
                smallTreeModelScale: 0.18 + unitA * 0.05,
                rotation: { x: 0, y: unitB * Math.PI * 2, z: 0 },
                lerp: 0.24
            }
        }

        if (entity?.type === 'bush' || entity?.subtype === 'plant') {
            const height = Math.max(2, 2.4 + unitA * 4.2)
            const radius = Math.max(1.2, 1.3 + unitB * 2.2)
            return {
                geometry: new THREE.SphereGeometry(radius * 0.8, 10, 8),
                materialColor: entity?.color || '#6c9a4d',
                shaderType: 'foliage',
                swayStrength: 0.28 + unitB * 0.14,
                baseY: radius * 0.88,
                bushHeight: height,
                bushRadius: radius,
                useBushVariantModel: false,
                useBushModel: !!this._bushModelRoot,
                useBushLeafTexture: !!this._bushLeafTexture,
                modelScale: 0.16 + unitA * 0.07,
                rotation: { x: 0, y: unitA * Math.PI * 2, z: 0 },
                lerp: 0.24
            }
        }

        if (entity?.subtype === 'pawn') {
            return {
                geometry: new THREE.CylinderGeometry(1.8, 2.3, 7.5, 6),
                materialColor: entity?.color || '#3498db',
                baseY: 3.75,
                rotation: { x: 0, y: 0, z: 0 },
                lerp: 0.38
            }
        }

        if (entity?.subtype === 'animal' || entity?.type === 'mobile') {
            const isAnimal = entity?.subtype === 'animal'
            return {
                geometry: isAnimal
                    ? new THREE.ConeGeometry(2.8, 8.2, 6)
                    : new THREE.OctahedronGeometry(2.5, 0),
                materialColor: entity?.color || '#c79b5f',
                useAnimalModel: isAnimal && !!this._animalModelRoot,
                modelScale: 0.22 + unitA * 0.1,
                baseY: 4.1,
                rotation: { x: 0, y: 0, z: 0 },
                lerp: 0.34
            }
        }

        return {
            geometry: new THREE.BoxGeometry(5, 5, 5),
            materialColor: entity?.color || '#888888',
            baseY: 2.5,
            rotation: { x: 0, y: 0, z: 0 },
            lerp: 0.3
        }
    }

    _createWaterMaterial(baseColor) {
        const waterA = new THREE.Color(baseColor)
        const waterB = waterA.clone().offsetHSL(0.03, 0.08, 0.07)

        const material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: {
                uTime: this._timeUniform,
                uShimmer: this._waterShimmerUniform,
                uSpeed: this._waterSpeedUniform,
                uColorA: { value: waterA },
                uColorB: { value: waterB }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vWorld;
                void main() {
                    vUv = uv;
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vWorld = worldPos.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform float uShimmer;
                uniform float uSpeed;
                uniform vec3 uColorA;
                uniform vec3 uColorB;
                varying vec2 vUv;
                varying vec3 vWorld;
                void main() {
                    float t = uTime * uSpeed;
                    float ripple = sin((vWorld.x * 0.12) + t * 1.45) * 0.5
                                 + cos((vWorld.z * 0.14) - t * 1.25) * 0.5;
                    float stripe = sin((vUv.x + vUv.y) * 11.0 + t * 2.8) * 0.11;
                    float pulse = sin((vWorld.x - vWorld.z) * 0.08 + t * 1.8) * 0.12;
                    float wave = clamp(0.5 + (ripple * 0.3 + stripe + pulse) * uShimmer, 0.0, 1.0);
                    vec3 color = mix(uColorA, uColorB, wave);
                    float alpha = clamp(0.66 + (ripple * 0.09 + stripe * 0.7) * uShimmer, 0.4, 0.92);
                    gl_FragColor = vec4(color, alpha);
                }
            `
        })

        this._waterMaterials.add(material)
        return material
    }

    _createFoliageMaterial(baseColor, swayStrength = 0.25) {
        const material = new THREE.MeshStandardMaterial({
            color: baseColor,
            roughness: 0.92,
            metalness: 0.01
        })

        material.onBeforeCompile = shader => {
            shader.uniforms.uTime = this._timeUniform
            shader.uniforms.uSwayStrength = { value: swayStrength }
            shader.uniforms.uGlobalSway = this._foliageSwayUniform

            shader.vertexShader = `
                uniform float uTime;
                uniform float uSwayStrength;
                uniform float uGlobalSway;
            ` + shader.vertexShader

            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                float swayMask = clamp((position.y + 0.5) / 12.0, 0.0, 1.0);
                float sway = sin(uTime * 0.9 + position.x * 0.35 + position.z * 0.27)
                    * uSwayStrength * uGlobalSway * swayMask;
                transformed.x += sway;
                transformed.z += sway * 0.32;
                `
            )
        }

        material.customProgramCacheKey = () => `foliage-sway-${swayStrength.toFixed(3)}`
        this._foliageMaterials.add(material)
        return material
    }

    _createTreeTrunkMaterial(baseColor) {
        const trunkColor = new THREE.Color(baseColor || '#6b4f2a')
        trunkColor.offsetHSL(0.01, -0.05, -0.06)
        return new THREE.MeshStandardMaterial({
            color: trunkColor,
            roughness: 0.95,
            metalness: 0.0
        })
    }

    _createTreeGradientMaterial() {
        return new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.92,
            metalness: 0.0
        })
    }

    _applyTreeGradientColors(geometry, trunkColor, leafColor) {
        const position = geometry.getAttribute('position')
        if (!position) return

        geometry.computeBoundingBox()
        const bounds = geometry.boundingBox
        if (!bounds) return

        const minY = bounds.min.y
        const maxY = bounds.max.y
        const height = Math.max(0.001, maxY - minY)
        const colorArray = new Float32Array(position.count * 3)
        const trunk = new THREE.Color(trunkColor || '#6b4f2a')
        const leaf = new THREE.Color(leafColor || '#5e8f3f')
        const mixed = new THREE.Color()

        for (let i = 0; i < position.count; i++) {
            const y = position.getY(i)
            const t = (y - minY) / height
            const ramp = Math.min(1, Math.max(0, (t - 0.28) / 0.42))
            mixed.copy(trunk).lerp(leaf, ramp)
            const index = i * 3
            colorArray[index] = mixed.r
            colorArray[index + 1] = mixed.g
            colorArray[index + 2] = mixed.b
        }

        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colorArray, 3))
    }

    _createRockMaterial(baseColor, variation = 0) {
        const color = new THREE.Color(baseColor)
        color.offsetHSL(0, -0.05 + variation * 0.08, -0.08 + variation * 0.12)
        return new THREE.MeshStandardMaterial({
            color,
            roughness: 0.98,
            metalness: 0.0
        })
    }

    _splitTreeMaterialsByHeight(model, profile) {
        model.traverse(node => {
            if (!node.isMesh || !node.geometry) return

            node.geometry = node.geometry.clone()
            node.castShadow = false
            node.receiveShadow = false

            this._applyTreeGradientColors(node.geometry, profile.trunkColor, profile.leafColor ?? profile.materialColor)
            node.material = this._createTreeGradientMaterial()
        })
    }

    _captureGroundOffset(model) {
        model.updateMatrixWorld(true)
        const bounds = new THREE.Box3().setFromObject(model)
        if (!Number.isFinite(bounds.min.y)) return 0
        return -bounds.min.y
    }

    _getNodeCenterX(node) {
        const box = new THREE.Box3().setFromObject(node)
        if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.x)) return 0
        return (box.min.x + box.max.x) * 0.5
    }

    _getNodeBoundsMeta(node) {
        const box = new THREE.Box3().setFromObject(node)
        const width = Number.isFinite(box.max.x - box.min.x) ? Math.max(0.001, box.max.x - box.min.x) : 1
        const height = Number.isFinite(box.max.y - box.min.y) ? Math.max(0.001, box.max.y - box.min.y) : 1
        const depth = Number.isFinite(box.max.z - box.min.z) ? Math.max(0.001, box.max.z - box.min.z) : 1
        return {
            width,
            height,
            depth,
            baseScale: 1
        }
    }

    _normalizeAnimalVariantScales() {
        if (!this._animalVariantMeta.length) return
        const heights = this._animalVariantMeta.map(meta => meta.height).filter(Number.isFinite)
        if (!heights.length) return

        const sorted = [...heights].sort((a, b) => a - b)
        const median = sorted[Math.floor(sorted.length / 2)]
        const targetHeight = Math.max(0.001, median)

        for (const meta of this._animalVariantMeta) {
            const safeHeight = Math.max(0.001, meta.height)
            // Clamp keeps outliers from exploding or shrinking too aggressively.
            meta.baseScale = Math.max(0.25, Math.min(4, targetHeight / safeHeight))
        }
    }

    _normalizeSpeciesName(entity) {
        const raw = `${entity?.species ?? entity?.name ?? ''}`.trim().toLowerCase()
        if (!raw) return ''

        if (raw.includes('rabbit')) return 'deer'
        if (raw.includes('fox')) return 'lion'
        return raw
    }

    _getAnimalVariantIndex(entity) {
        const species = this._normalizeSpeciesName(entity)
        const knownIndex = this._animalPackOrder.indexOf(species)
        if (knownIndex >= 0) return knownIndex

        const count = this._animalModelVariants.length
        if (!count) return -1
        const hashed = Math.floor(this._hashUnit(entity?.id ?? entity?.name, 'animal-variant') * count)
        return Math.max(0, Math.min(count - 1, hashed))
    }

    _centerModelToOrigin(model) {
        model.updateMatrixWorld(true)
        const bounds = new THREE.Box3().setFromObject(model)
        if (!Number.isFinite(bounds.min.x) || !Number.isFinite(bounds.max.x)) return

        const centerX = (bounds.min.x + bounds.max.x) * 0.5
        const centerZ = (bounds.min.z + bounds.max.z) * 0.5
        model.position.x -= centerX
        model.position.y -= bounds.min.y
        model.position.z -= centerZ
    }

    _buildTreeModelInstance(profile) {
        const model = this._treeModelRoot.clone(true)
        const scale = profile.modelScale ?? 0.2
        const scaleY = scale * (profile.modelScaleY ?? 1)
        model.scale.set(scale, scaleY, scale)
        model.userData.profile = profile
        model.userData.motionInitialized = false
        model.rotation.set(profile.rotation.x, profile.rotation.y, profile.rotation.z)

        this._splitTreeMaterialsByHeight(model, profile)
        model.userData.groundOffset = this._captureGroundOffset(model)
        return model
    }

    _buildRockModelInstance(entity, profile) {
        const variantIndex = this._getRockVariantIndex(entity)
        const source = this._rockModelVariants[variantIndex] ?? this._rockModelRoot
        const model = source.clone(true)
        const scale = profile.modelScale ?? 0.08
        model.scale.setScalar(scale)
        model.userData.profile = profile
        model.userData.motionInitialized = false
        model.rotation.set(profile.rotation.x, profile.rotation.y, profile.rotation.z)

        this._centerModelToOrigin(model)

        const variation = this._hashUnit(entity?.id, 'rockmat')
        model.traverse(node => {
            if (!node.isMesh || !node.geometry) return
            node.geometry = node.geometry.clone()
            node.castShadow = false
            node.receiveShadow = false
            node.material = this._createRockMaterial(profile.materialColor, variation)
        })

        model.userData.groundOffset = this._captureGroundOffset(model)
        return model
    }

    _buildGrassModelInstance(entity, profile) {
        const model = this._grassModelRoot.clone(true)
        const sourceHeight = Math.max(0.001, this._grassModelMeta?.height ?? 1)
        const targetHeight = Math.max(0.7, profile.grassTargetHeight ?? 1.3)
        const normalizedScale = Math.max(0.02, Math.min(6, targetHeight / sourceHeight))
        const randomScale = 0.9 + this._hashUnit(entity?.id, 'grass-scale') * 0.35
        const scale = normalizedScale * randomScale

        model.scale.setScalar(scale)
        model.userData.profile = profile
        model.userData.motionInitialized = false
        model.rotation.set(profile.rotation.x, profile.rotation.y, profile.rotation.z)

        this._centerModelToOrigin(model)

        model.traverse(node => {
            if (!node.isMesh || !node.geometry) return
            node.geometry = node.geometry.clone()
            node.castShadow = false
            node.receiveShadow = false
            node.material = this._createFoliageMaterial(profile.materialColor, profile.swayStrength)
        })

        model.userData.groundOffset = this._captureGroundOffset(model)
        return model
    }

    _buildBushModelInstance(profile) {
        const model = this._bushModelRoot.clone(true)
        const scale = profile.modelScale ?? 0.18
        model.scale.setScalar(scale)
        model.userData.profile = profile
        model.userData.motionInitialized = false
        model.rotation.set(profile.rotation.x, profile.rotation.y, profile.rotation.z)

        this._centerModelToOrigin(model)

        model.traverse(node => {
            if (!node.isMesh || !node.geometry) return
            node.geometry = node.geometry.clone()
            node.castShadow = false
            node.receiveShadow = false
            node.material = this._createFoliageMaterial(profile.materialColor, profile.swayStrength)
        })

        model.userData.groundOffset = this._captureGroundOffset(model)
        return model
    }

    _getPartsVariantIndex(entity, salt, count) {
        if (!count) return -1
        const hashed = Math.floor(this._hashUnit(entity?.id ?? entity?.name, salt) * count)
        return Math.max(0, Math.min(count - 1, hashed))
    }

    _buildSmallTreeVariantInstance(entity, profile) {
        const index = this._getPartsVariantIndex(entity, 'parts-small-tree', this._partsForSaleSmallTreeVariants.length)
        if (index < 0) return null

        const source = this._partsForSaleSmallTreeVariants[index]
        if (!source) return null

        const model = source.clone(true)
        const scale = profile.smallTreeModelScale ?? profile.modelScale ?? 0.2
        const scaleY = scale * (profile.modelScaleY ?? 1)
        model.scale.set(scale, scaleY, scale)
        model.userData.profile = profile
        model.userData.motionInitialized = false
        model.rotation.set(profile.rotation.x, profile.rotation.y, profile.rotation.z)

        this._centerModelToOrigin(model)
        this._splitTreeMaterialsByHeight(model, profile)
        model.userData.groundOffset = this._captureGroundOffset(model)
        return model
    }

    _buildBushVariantModelInstance(entity, profile) {
        const index = this._getPartsVariantIndex(entity, 'parts-bush', this._partsForSaleBushVariants.length)
        if (index < 0) return null

        const source = this._partsForSaleBushVariants[index]
        if (!source) return null

        const model = source.clone(true)
        const scale = profile.modelScale ?? 0.18
        model.scale.setScalar(scale)
        model.userData.profile = profile
        model.userData.motionInitialized = false
        model.rotation.set(profile.rotation.x, profile.rotation.y, profile.rotation.z)

        this._centerModelToOrigin(model)
        model.traverse(node => {
            if (!node.isMesh || !node.geometry) return
            node.geometry = node.geometry.clone()
            node.castShadow = false
            node.receiveShadow = false
            node.material = this._createFoliageMaterial(profile.materialColor, profile.swayStrength)
        })

        model.userData.groundOffset = this._captureGroundOffset(model)
        return model
    }

    _buildBushLeafBillboardInstance(entity, profile) {
        const group = new THREE.Group()
        const leafHeight = 7.5
        const leafWidth = 3.1
        const material = new THREE.MeshStandardMaterial({
            map: this._bushLeafTexture,
            color: profile.materialColor,
            transparent: true,
            alphaTest: 0.35,
            side: THREE.DoubleSide,
            roughness: 0.92,
            metalness: 0.0
        })

        const plane = new THREE.PlaneGeometry(leafWidth, leafHeight)
        const crosses = 3
        for (let i = 0; i < crosses; i++) {
            const mesh = new THREE.Mesh(plane, material.clone())
            const angleJitter = (this._hashUnit(entity?.id, `bush-leaf-angle-${i}`) - 0.5) * 0.22
            mesh.rotation.y = (i / crosses) * Math.PI + angleJitter
            mesh.position.y = leafHeight * 0.5
            mesh.castShadow = false
            mesh.receiveShadow = false
            group.add(mesh)
        }

        group.userData.profile = profile
        group.userData.motionInitialized = false
        group.rotation.set(profile.rotation.x, profile.rotation.y, profile.rotation.z)
        group.userData.groundOffset = 0
        return group
    }

    _buildProceduralBushInstance(entity, profile) {
        const group = new THREE.Group()
        const radius = Math.max(1, profile.bushRadius ?? 1.8)
        const canopyMaterial = this._createFoliageMaterial(profile.materialColor, profile.swayStrength)

        const canopyDefs = [
            { x: 0, y: radius * 0.95, z: 0, scale: 1 },
            { x: -radius * 0.48, y: radius * 0.82, z: radius * 0.24, scale: 0.68 },
            { x: radius * 0.44, y: radius * 0.8, z: radius * 0.28, scale: 0.62 },
            { x: 0, y: radius * 0.72, z: -radius * 0.46, scale: 0.7 }
        ]

        for (let i = 0; i < canopyDefs.length; i++) {
            const def = canopyDefs[i]
            const jitter = this._hashUnit(entity?.id, `bush-canopy-${i}`)
            const sphere = new THREE.Mesh(
                new THREE.SphereGeometry(radius * def.scale, 9, 7),
                canopyMaterial
            )
            sphere.position.set(
                def.x + (jitter - 0.5) * radius * 0.16,
                def.y,
                def.z + (0.5 - jitter) * radius * 0.16
            )
            sphere.castShadow = false
            sphere.receiveShadow = false
            group.add(sphere)
        }

        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(radius * 0.16, radius * 0.2, Math.max(0.8, radius * 0.85), 6),
            this._createTreeTrunkMaterial('#6b4f2a')
        )
        trunk.position.y = Math.max(0.4, radius * 0.42)
        trunk.castShadow = false
        trunk.receiveShadow = false
        group.add(trunk)

        group.userData.profile = profile
        group.userData.motionInitialized = false
        group.rotation.set(profile.rotation.x, profile.rotation.y, profile.rotation.z)
        group.userData.groundOffset = this._captureGroundOffset(group)
        return group
    }

    _getRockVariantIndex(entity) {
        const count = this._rockModelVariants.length
        if (!count) return -1
        const hashed = Math.floor(this._hashUnit(entity?.id ?? entity?.name, 'rock-variant') * count)
        return Math.max(0, Math.min(count - 1, hashed))
    }

    _buildAnimalModelInstance(entity, profile) {
        const variantIndex = this._getAnimalVariantIndex(entity)
        if (variantIndex < 0) return null

        const source = this._animalModelVariants[variantIndex]
        if (!source) return null

        const model = source.clone(true)
        const variantMeta = this._animalVariantMeta[variantIndex]
        const normalizedScale = variantMeta?.baseScale ?? 1
        const baseScale = (profile.modelScale ?? 0.25) * normalizedScale
        const mappedName = this._animalPackOrder[variantIndex] ?? `variant_${variantIndex + 1}`
        const speciesName = this._normalizeSpeciesName(entity) || 'unknown'
        const deerTargetHeight = 6.8
        const unscaledHeight = Math.max(0.001, variantMeta?.height ?? 1)
        const deerScaleMultiplier = speciesName === 'deer'
            ? Math.max(0.5, Math.min(8, deerTargetHeight / (unscaledHeight * baseScale)))
            : 1
        const scale = baseScale * deerScaleMultiplier
        model.scale.setScalar(scale)
        model.userData.profile = profile
        model.userData.motionInitialized = false
        model.userData.animalLabel = `${speciesName} -> ${mappedName} (#${variantIndex + 1})`

        this._centerModelToOrigin(model)

        model.traverse(node => {
            if (!node.isMesh || !node.geometry) return
            node.geometry = node.geometry.clone()
            node.castShadow = false
            node.receiveShadow = false

            node.material = new THREE.MeshStandardMaterial({
                color: profile.materialColor,
                roughness: 0.86,
                metalness: 0.02
            })
        })

        model.userData.groundOffset = this._captureGroundOffset(model)
        return model
    }

    _createMaterialForProfile(profile) {
        if (profile.shaderType === 'water') {
            return this._createWaterMaterial(profile.materialColor)
        }

        if (profile.shaderType === 'foliage') {
            return this._createFoliageMaterial(profile.materialColor, profile.swayStrength)
        }

        return new THREE.MeshStandardMaterial({
            color: profile.materialColor,
            roughness: 0.9,
            metalness: 0.05
        })
    }

    _createMeshForEntity(entity) {
        const profile = this._getEntityRenderProfile(entity)

        if (profile.useGrassModel && this._grassModelRoot) {
            const model = this._buildGrassModelInstance(entity, profile)
            this.scene.add(model)
            return model
        }

        if (profile.useSmallTreeVariantModel && this._partsForSaleSmallTreeVariants.length) {
            const model = this._buildSmallTreeVariantInstance(entity, profile)
            if (model) {
                this.scene.add(model)
                return model
            }
        }

        if (profile.useTreeModel && this._treeModelRoot) {
            const model = this._buildTreeModelInstance(profile)
            this.scene.add(model)
            return model
        }

        if (profile.useRockModel && this._rockModelRoot) {
            const model = this._buildRockModelInstance(entity, profile)
            this.scene.add(model)
            return model
        }

        if (profile.useBushVariantModel && this._partsForSaleBushVariants.length) {
            const model = this._buildBushVariantModelInstance(entity, profile)
            if (model) {
                this.scene.add(model)
                return model
            }
        }

        if (profile.useBushModel && this._bushModelRoot) {
            const model = this._buildBushModelInstance(profile)
            this.scene.add(model)
            return model
        }

        if (profile.useBushLeafTexture && this._bushLeafTexture) {
            const model = this._buildBushLeafBillboardInstance(entity, profile)
            this.scene.add(model)
            return model
        }

        if (entity?.type === 'bush' || entity?.subtype === 'plant') {
            const model = this._buildProceduralBushInstance(entity, profile)
            this.scene.add(model)
            return model
        }

        if (profile.useAnimalModel && this._animalModelRoot) {
            const model = this._buildAnimalModelInstance(entity, profile)
            if (!model) {
                const material = this._createMaterialForProfile(profile)
                const mesh = new THREE.Mesh(profile.geometry, material)
                mesh.castShadow = false
                mesh.receiveShadow = false
                mesh.userData.profile = profile
                mesh.rotation.set(profile.rotation.x, profile.rotation.y, profile.rotation.z)
                this.scene.add(mesh)
                return mesh
            }
            this.scene.add(model)
            return model
        }

        const material = this._createMaterialForProfile(profile)
        const mesh = new THREE.Mesh(profile.geometry, material)
        mesh.castShadow = false
        mesh.receiveShadow = false
        mesh.userData.profile = profile
        mesh.rotation.set(profile.rotation.x, profile.rotation.y, profile.rotation.z)
        this.scene.add(mesh)
        return mesh
    }

    _updateMeshPose(entity, mesh, progress) {
        const profile = mesh.userData.profile ?? this._getEntityRenderProfile(entity)
        const prevX = Number.isFinite(entity.prevX) ? entity.prevX : entity.x
        const prevY = Number.isFinite(entity.prevY) ? entity.prevY : entity.y
        const x = prevX + (entity.x - prevX) * progress
        const y = prevY + (entity.y - prevY) * progress

        const followLift = entity === this.followedEntity && entity?.type === 'mobile' ? 1 : 0
        const hasModelGroundOffset = Number.isFinite(mesh.userData.groundOffset)
        const groundedOffset = hasModelGroundOffset
            ? mesh.userData.groundOffset
            : (profile.baseY ?? 2.5)
        const modelGroundBias = hasModelGroundOffset
            ? (this._ground?.position?.y ?? 0) + 0.02
            : 0
        const baseHeight = groundedOffset + modelGroundBias + followLift
        this._tmpTargetPosition.set(x, baseHeight, y)
        if (!mesh.userData.motionInitialized) {
            mesh.position.copy(this._tmpTargetPosition)
            mesh.userData.motionInitialized = true
        } else {
            const followBoost = entity === this.followedEntity ? 0.52 : (profile.lerp ?? 0.32)
            mesh.position.lerp(this._tmpTargetPosition, followBoost)
        }

        if (entity.subtype === 'animal') {
            const angle = Math.atan2(entity.y - prevY, entity.x - prevX)
            const targetYaw = -angle + Math.PI / 2
            mesh.rotation.y = this._easeAngle(mesh.rotation.y, targetYaw, mesh.userData, 'turnVelocity')
        }

        const isHighlighted = entity === this.highlightedEntity && Date.now() < this.highlightEndTime
        if (!mesh.userData.baseScale) {
            mesh.userData.baseScale = mesh.scale.clone()
        }
        const highlightScale = isHighlighted ? 1.35 : 1
        const baseScale = mesh.userData.baseScale
        mesh.scale.set(
            baseScale.x * highlightScale,
            baseScale.y * highlightScale,
            baseScale.z * highlightScale
        )
    }

    _disposeMesh(id) {
        const mesh = this._meshById.get(id)
        if (!mesh) return
        this.scene.remove(mesh)

        if (mesh.isMesh) {
            mesh.geometry?.dispose?.()
            mesh.material?.dispose?.()
        } else {
            mesh.traverse(node => {
                if (!node.isMesh) return
                node.geometry?.dispose?.()
                node.material?.dispose?.()
            })
        }

        this._meshById.delete(id)
        this._entityById.delete(id)
    }

    _updateCamera() {
        if (this.followMode && this.followedEntity) {
            this.viewX = this.followedEntity.x
            this.viewY = this.followedEntity.y
        }

        this._skyDome.position.set(this.viewX, 0, this.viewY)

        if (this.firstPersonLocked && this.followedEntity) {
            const prevX = Number.isFinite(this.followedEntity.prevX) ? this.followedEntity.prevX : this.followedEntity.x - 1
            const prevY = Number.isFinite(this.followedEntity.prevY) ? this.followedEntity.prevY : this.followedEntity.y
            const dir = new THREE.Vector3(this.followedEntity.x - prevX, 0, this.followedEntity.y - prevY)
            if (dir.lengthSq() < 0.0001) dir.set(1, 0, 0)
            dir.normalize()

            const targetYaw = Math.atan2(dir.z, dir.x)
            this._firstPersonYaw = this._easeAngle(
                this._firstPersonYaw,
                targetYaw,
                this,
                '_firstPersonYawVelocity',
                { response: 0.26, damping: 0.86, maxSpeed: 0.12 }
            )
            dir.set(Math.cos(this._firstPersonYaw), 0, Math.sin(this._firstPersonYaw))

            const targetEye = new THREE.Vector3(this.followedEntity.x, this.firstPersonHeight, this.followedEntity.y)
            this._smoothedFirstPersonEye.lerp(targetEye, 0.48)
            this._smoothedFirstPersonDir.lerp(dir, 0.4).normalize()

            const look = this._smoothedFirstPersonEye.clone().add(this._smoothedFirstPersonDir.clone().multiplyScalar(18))
            this._camera3d.position.copy(this._smoothedFirstPersonEye)
            this._camera3d.lookAt(look)
            return
        }

        const target = new THREE.Vector3(this.viewX, 0, this.viewY)
        const elevated = new THREE.Vector3(this.viewX, this.cameraDistance * 0.45, this.viewY + this.cameraDistance)
        this._camera3d.position.lerp(elevated, 0.15)
        this._smoothedCameraTarget.lerp(target, 0.22)
        this._camera3d.lookAt(this._smoothedCameraTarget)
    }

    _easeAngle(current, target, store, velocityKey, options = {}) {
        const response = options.response ?? this.turnResponse
        const damping = options.damping ?? this.turnDamping
        const maxSpeed = options.maxSpeed ?? this.maxTurnSpeed
        const snapThreshold = options.snapThreshold ?? this.turnSnapThreshold
        const stopVelocity = options.stopVelocity ?? this.turnStopVelocity

        const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current))
        let velocity = Number(store?.[velocityKey]) || 0

        const desiredSpeed = Math.sign(delta) * Math.min(maxSpeed, Math.abs(delta) * response)
        velocity += (desiredSpeed - velocity) * response
        velocity *= damping

        let next = current + velocity
        const remaining = Math.atan2(Math.sin(target - next), Math.cos(target - next))

        if (Math.abs(remaining) < snapThreshold && Math.abs(velocity) < stopVelocity) {
            next = target
            velocity = 0
        }

        if (store) store[velocityKey] = velocity
        return next
    }

    render() {
        const { progress } = this.world.clock.getProgress()
        this._timeUniform.value = performance.now() * 0.001
        this._updateCamera()

        this._gridHelper.visible = !!this.showGrid

        const entitiesToRender = this.perception.getEntitiesToRender(this.followedEntity)
        const visibleIds = new Set()

        for (const entity of entitiesToRender) {
            if (!entity?.id) continue
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
                mesh.traverse(node => {
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

        this.webglRenderer.dispose()
        this.webglRenderer.forceContextLoss?.()
    }
}

export default ThreeRenderer
