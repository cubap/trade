import * as THREE from 'three'
import { targetHeightFor } from './ModelScales.js'

/**
 * Entity pose — mesh creation, position/rotation updates, disposal, and render profiles.
 */
export default function createEntityPose(renderer) {
    return {
        /** Cover/shelter entities that use the cover GLB pack; flora and buildings match other profiles first. */
        _isCoverEntity(entity) {
            if (!entity) return false
            if (entity.type === 'tree' || entity.type === 'bush' || entity.subtype === 'plant') return false
            if (entity.subtype === 'cover') return true
            return renderer._hasTag(entity, 'cover') && !renderer._hasTag(entity, 'structure')
        },

        _getEntityRenderProfile(entity) {
            const unitA = renderer._hashUnit(entity?.id, 'a')
            const unitB = renderer._hashUnit(entity?.id, 'b')
            const size = Math.max(0.5, Number(entity?.size) || 1)

            const isWater = entity?.subtype === 'water' || renderer._hasTag(entity, 'water')
            if (isWater) {
                const radius = Math.max(3, size * (1.2 + unitA * 0.8))
                return {
                    geometry: new THREE.CircleGeometry(radius, 18),
                    materialColor: entity?.color || '#4da6ff',
                    shaderType: 'water',
                    baseY: 0.03,
                    waterSurface: true,
                    rotation: { x: -Math.PI / 2, y: 0, z: 0 },
                    lerp: 0.28
                }
            }

            const isStick = entity?.subtype === 'stick' || renderer._hasTag(entity, 'stick')
            if (isStick) {
                const length = Math.max(2.5, size * (1.2 + unitA * 1.8))
                const thickness = 0.18 + unitB * 0.18
                return {
                    geometry: new THREE.BoxGeometry(length, thickness, thickness * 1.2),
                    materialColor: entity?.color || '#8b5a2b',
                    useStickModel: !!renderer._stickModelRoot,
                    modelScale: 0.9 + unitA * 0.4,
                    baseY: 0.06 + thickness * 0.5,
                    rotation: { x: (unitA - 0.5) * 0.16, y: unitB * Math.PI * 2, z: (unitB - 0.5) * 0.12 },
                    lerp: 0.26
                }
            }

            const isRock = entity?.subtype === 'rock' || renderer._hasTag(entity, 'rock')
            if (isRock) {
                const targetHeight = targetHeightFor('rock', unitA, null, size)
                const radius = Math.max(1.2, targetHeight * 0.5)
                return {
                    geometry: new THREE.DodecahedronGeometry(radius, 0),
                    materialColor: entity?.color || '#8b7355',
                    useRockModel: !!renderer._rockModelRoot,
                    targetHeight,
                    modelScale: 0.06 + unitA * 0.05,
                    baseY: radius * 0.68,
                    rotation: { x: (unitA - 0.5) * 0.28, y: unitB * Math.PI * 2, z: (unitB - 0.5) * 0.24 },
                    lerp: 0.22
                }
            }

            const isFiberPlant = entity?.subtype === 'fiber_plant' || renderer._hasTag(entity, 'fiber')
            if (isFiberPlant) {
                const height = Math.max(1.5, 2.2 + unitA * 2.6)
                const radius = Math.max(0.24, 0.18 + unitB * 0.32)
                return {
                    geometry: new THREE.ConeGeometry(radius * 2.2, height, 5),
                    materialColor: entity?.color || '#9acd32',
                    shaderType: 'foliage',
                    swayStrength: 0.4 + unitA * 0.22,
                    useFiberModel: !!renderer._fiberModelRoot,
                    modelScale: 0.8 + unitA * 0.5,
                    baseY: height * 0.5,
                    rotation: { x: 0, y: unitB * Math.PI * 2, z: 0 },
                    lerp: 0.26
                }
            }

            // #129: herbs wear the foliage shader too, but a much smaller cut of it -
            // a knee-high clump at the treeline rather than the waist-high stand fibre
            // makes, so the two plants do not read as the same thing from the saddle.
            if (renderer._hasTag(entity, 'herb')) {
                const height = Math.max(1.1, 1.5 + unitA * 1.3)
                const radius = Math.max(0.16, 0.12 + unitB * 0.18)
                return {
                    geometry: new THREE.ConeGeometry(radius * 2.4, height, 5),
                    materialColor: entity?.color || '#3F7A4E',
                    shaderType: 'foliage',
                    swayStrength: 0.5 + unitB * 0.2,
                    baseY: height * 0.5,
                    rotation: { x: 0, y: unitB * Math.PI * 2, z: 0 },
                    lerp: 0.26
                }
            }

            if (entity?.type === 'grass') {
                const height = targetHeightFor('grass', unitA)
                return {
                    geometry: new THREE.ConeGeometry(0.45 + unitB * 0.35, height, 4),
                    materialColor: entity?.color || '#74b94a',
                    shaderType: 'foliage',
                    swayStrength: 0.32 + unitB * 0.14,
                    baseY: height * 0.5,
                    useGrassModel: !!renderer._grassModelRoot,
                    targetHeight: height,
                    grassTargetHeight: height,
                    rotation: { x: 0, y: unitA * Math.PI * 2, z: 0 },
                    lerp: 0.2
                }
            }

            if (entity?.subtype === 'food' || renderer._hasTag(entity, 'food')) {
                const radius = Math.max(1.2, size * (0.35 + unitA * 0.2))
                return {
                    geometry: new THREE.OctahedronGeometry(radius, 0),
                    materialColor: entity?.color || '#7cfc00',
                    useFoodModel: !!renderer._foodModelRoot,
                    modelScale: 1.0 + unitA * 0.5,
                    baseY: radius,
                    rotation: { x: 0, y: unitB * Math.PI * 2, z: 0 },
                    lerp: 0.22
                }
            }

            if (entity?.type === 'tree') {
                const isSapling = entity?.stage === 'sapling'
                // Canonical height includes the growth stage so models AND the
                // procedural fallback shrink for saplings/sprouts (issue #76).
                const height = targetHeightFor('tree', unitA, entity?.stage)
                const radius = Math.max(0.6, height * 0.08)
                const leafColor = entity?.color || '#5e8f3f'
                return {
                    geometry: new THREE.CylinderGeometry(radius * 0.75, radius, height, 8),
                    materialColor: leafColor,
                    leafColor,
                    trunkColor: '#6b4f2a',
                    shaderType: 'foliage',
                    swayStrength: 0.18 + unitA * 0.08,
                    baseY: height * 0.5,
                    targetHeight: height,
                    modelScale: (0.6 + unitA * 0.2) * 3,
                    modelScaleY: isSapling ? 0.6 : 1,
                    useTreeModel: !!renderer._treeModelRoot,
                    useSmallTreeVariantModel: false,
                    smallTreeModelScale: 0.5 + unitA * 0.15,
                    smallTreeTargetHeight: targetHeightFor('smallTree', unitA),
                    rotation: { x: 0, y: unitB * Math.PI * 2, z: 0 },
                    lerp: 0.24
                }
            }

            if (entity?.type === 'bush' || entity?.subtype === 'plant') {
                const height = targetHeightFor('bush', unitA)
                const radius = Math.max(1.2, height * (0.45 + unitB * 0.35))
                return {
                    geometry: new THREE.SphereGeometry(radius * 0.8, 10, 8),
                    materialColor: entity?.color || '#6c9a4d',
                    shaderType: 'foliage',
                    swayStrength: 0.28 + unitB * 0.14,
                    baseY: radius * 0.88,
                    bushHeight: height,
                    bushRadius: radius,
                    useBushVariantModel: !!renderer._partsForSaleBushVariants.length,
                    useBushModel: !!renderer._bushModelRoot,
                    useBushLeafTexture: !!renderer._bushLeafTexture,
                    targetHeight: height,
                    modelScale: 0.16 + unitA * 0.07,
                    rotation: { x: 0, y: unitA * Math.PI * 2, z: 0 },
                    lerp: 0.24
                }
            }

            if (entity?.subtype === 'pawn') {
                const height = targetHeightFor('pawn', unitA)
                return {
                    geometry: new THREE.CylinderGeometry(1.8, 2.3, height, 6),
                    materialColor: entity?.color || '#3498db',
                    usePawnModel: !!renderer._pawnModelRoot,
                    targetHeight: height,
                    modelScale: 2.5 + unitA * 0.5,
                    baseY: height * 0.5,
                    rotation: { x: 0, y: 0, z: 0 },
                    lerp: 0.38
                }
            }

            if (entity?.subtype === 'animal' || entity?.type === 'mobile') {
                const isAnimal = entity?.subtype === 'animal'
                const height = targetHeightFor('animal', unitA)
                return {
                    geometry: isAnimal
                        ? new THREE.ConeGeometry(2.8, height, 6)
                        : new THREE.OctahedronGeometry(2.5, 0),
                    materialColor: entity?.color || '#c79b5f',
                    useAnimalModel: isAnimal && !!renderer._animalModelRoot,
                    targetHeight: height,
                    modelScale: 0.22 + unitA * 0.1,
                    baseY: isAnimal ? height * 0.5 : 4.1,
                    rotation: { x: 0, y: 0, z: 0 },
                    lerp: 0.34
                }
            }

            // Cover/shelter: check after structures so buildings keep their own look
            if (renderer._isCoverEntity(entity)) {
                return {
                    geometry: new THREE.BoxGeometry(5, 5, 5),
                    materialColor: entity?.color || '#5a7247',
                    useCoverModel: !!renderer._coverModelRoot,
                    modelScale: 1.2 + unitA * 0.6,
                    baseY: 2.5,
                    rotation: { x: 0, y: unitB * Math.PI * 2, z: 0 },
                    lerp: 0.24
                }
            }

            return {
                geometry: new THREE.BoxGeometry(5, 5, 5),
                materialColor: entity?.color || '#888888',
                baseY: 2.5,
                rotation: { x: 0, y: 0, z: 0 },
                lerp: 0.3
            }
        },

        _createMeshForEntity(entity) {
            const profile = renderer._getEntityRenderProfile(entity)

            if (profile.useGrassModel && renderer._grassModelRoot) {
                const model = renderer._buildGrassModelInstance(entity, profile)
                renderer.scene.add(model)
                return model
            }
            if (profile.useSmallTreeVariantModel && renderer._partsForSaleSmallTreeVariants.length) {
                const model = renderer._buildSmallTreeVariantInstance(entity, profile)
                if (model) { renderer.scene.add(model); return model }
            }
            if (profile.useTreeModel && renderer._treeModelRoot) {
                const model = renderer._buildTreeModelInstance(profile)
                renderer.scene.add(model)
                return model
            }
            if (profile.useRockModel && renderer._rockModelRoot) {
                const model = renderer._buildRockModelInstance(entity, profile)
                renderer.scene.add(model)
                return model
            }
            if (profile.useStickModel && renderer._stickModelRoot) {
                const model = renderer._buildStickModelInstance(entity, profile)
                if (model) { renderer.scene.add(model); return model }
            }
            if (profile.useFiberModel && renderer._fiberModelRoot) {
                const model = renderer._buildFiberPlantModelInstance(entity, profile)
                if (model) { renderer.scene.add(model); return model }
            }
            if (profile.useFoodModel && renderer._foodModelRoot) {
                const model = renderer._buildFoodModelInstance(entity, profile)
                if (model) { renderer.scene.add(model); return model }
            }
            if (profile.useCoverModel && renderer._coverModelRoot) {
                const model = renderer._buildCoverModelInstance(entity, profile)
                if (model) { renderer.scene.add(model); return model }
            }
            if (profile.useBushVariantModel && renderer._partsForSaleBushVariants.length) {
                const model = renderer._buildBushVariantModelInstance(entity, profile)
                if (model) { renderer.scene.add(model); return model }
            }
            if (profile.useBushModel && renderer._bushModelRoot) {
                const model = renderer._buildBushModelInstance(profile)
                renderer.scene.add(model)
                return model
            }
            if (profile.useBushLeafTexture && renderer._bushLeafTexture) {
                const model = renderer._buildBushLeafBillboardInstance(entity, profile)
                renderer.scene.add(model)
                return model
            }
            if (profile.usePawnModel && renderer._pawnModelRoot) {
                const model = renderer._buildPawnModelInstance(entity, profile)
                renderer.scene.add(model)
                return model
            }
            if (entity?.type === 'bush' || entity?.subtype === 'plant') {
                const model = renderer._buildProceduralBushInstance(entity, profile)
                renderer.scene.add(model)
                return model
            }
            if (profile.useAnimalModel && renderer._animalModelRoot) {
                const model = renderer._buildAnimalModelInstance(entity, profile)
                if (!model) {
                    const material = renderer._createMaterialForProfile(profile)
                    const mesh = new THREE.Mesh(profile.geometry, material)
                    mesh.castShadow = false
                    mesh.receiveShadow = false
                    mesh.userData.profile = profile
                    mesh.rotation.set(profile.rotation.x, profile.rotation.y, profile.rotation.z)
                    renderer.scene.add(mesh)
                    return mesh
                }
                renderer.scene.add(model)
                return model
            }

            const material = renderer._createMaterialForProfile(profile)
            const mesh = new THREE.Mesh(profile.geometry, material)
            mesh.castShadow = false
            mesh.receiveShadow = false
            mesh.userData.profile = profile
            mesh.rotation.set(profile.rotation.x, profile.rotation.y, profile.rotation.z)
            renderer.scene.add(mesh)
            return mesh
        },

        _updateMeshPose(entity, mesh, progress) {
            const profile = mesh.userData.profile ?? renderer._getEntityRenderProfile(entity)
            const prevX = Number.isFinite(entity.prevX) ? entity.prevX : entity.x
            const prevY = Number.isFinite(entity.prevY) ? entity.prevY : entity.y
            const x = prevX + (entity.x - prevX) * progress
            const y = prevY + (entity.y - prevY) * progress

            const followLift = entity === renderer.followedEntity && entity?.type === 'mobile' ? 1 : 0
            const hasModelGroundOffset = Number.isFinite(mesh.userData.groundOffset)
            const groundedOffset = hasModelGroundOffset
                ? mesh.userData.groundOffset
                : (profile.baseY ?? 2.5)
            const modelGroundBias = hasModelGroundOffset
                ? (renderer._ground?.position?.y ?? 0) + 0.02
                : 0
            const terrainHeight = profile.waterSurface
                ? Math.max(renderer._getGroundHeightAt(x, y), renderer._waterSurfaceHeight())
                : renderer._getGroundHeightAt(x, y)
            const baseHeight = terrainHeight + groundedOffset + modelGroundBias + followLift
            const poseOffset = mesh.userData.poseOffset
            renderer._tmpTargetPosition.set(x + (poseOffset?.x ?? 0), baseHeight, y + (poseOffset?.z ?? 0))

            if (!mesh.userData.motionInitialized) {
                mesh.position.copy(renderer._tmpTargetPosition)
                mesh.userData.motionInitialized = true
            } else {
                const followBoost = entity === renderer.followedEntity ? 0.30 : (profile.lerp ?? 0.20)
                mesh.position.lerp(renderer._tmpTargetPosition, followBoost)
            }

            if (entity.subtype === 'animal') {
                const angle = Math.atan2(entity.y - prevY, entity.x - prevX)
                // Placeholder animal GLBs face +X, so yaw is the raw heading (a +Z-facing model would need +PI/2)
                const targetYaw = -angle
                mesh.rotation.y = renderer._easeAngle(mesh.rotation.y, targetYaw, mesh.userData, 'turnVelocity')
            }

            if (entity.subtype === 'pawn') {
                const interactionYaw = renderer._getPawnInteractionYaw(entity)
                const movementDx = (entity.x ?? 0) - prevX
                const movementDy = (entity.y ?? 0) - prevY
                const hasMovement = Math.hypot(movementDx, movementDy) > 0.06

                let targetYaw = null
                if (Number.isFinite(interactionYaw)) {
                    targetYaw = interactionYaw
                } else if (hasMovement) {
                    targetYaw = -Math.atan2(movementDy, movementDx) + Math.PI / 2
                }

                if (Number.isFinite(targetYaw)) {
                    mesh.rotation.y = renderer._easeAngle(
                        mesh.rotation.y, targetYaw, mesh.userData, 'turnVelocityPawn',
                        {
                            response: Number.isFinite(interactionYaw) ? 0.32 : 0.22,
                            damping: Number.isFinite(interactionYaw) ? 0.82 : 0.84,
                            maxSpeed: Number.isFinite(interactionYaw) ? 0.24 : 0.16,
                            snapThreshold: 0.0025,
                            stopVelocity: 0.0018
                        }
                    )
                }

                // Head turns toward attention independently of the body — visible from behind
                renderer._updatePawnHeadLook(entity, mesh)
            }

            const isHighlighted = entity === renderer.highlightedEntity && Date.now() < renderer.highlightEndTime
            if (!mesh.userData.baseScale) {
                mesh.userData.baseScale = mesh.scale.clone()
            }
            const highlightScale = isHighlighted ? 1.35 : 1
            const baseScale = mesh.userData.baseScale
            mesh.scale.set(baseScale.x * highlightScale, baseScale.y * highlightScale, baseScale.z * highlightScale)
        },

        _getPawnInteractionYaw(pawn) {
            const goal = pawn?.goals?.currentGoal
            if (!goal) return null
            const interactionTypes = new Set(['socialize', 'negotiate_group', 'collaborative_craft', 'teach_skill', 'train_skill', 'apprentice_skill'])
            if (!interactionTypes.has(goal.type)) return null

            const target = renderer._resolveGoalEntityTarget(goal)
            if (target?.id && target.id !== pawn.id && Number.isFinite(target.x) && Number.isFinite(target.y)) {
                const dx = target.x - pawn.x
                const dy = target.y - pawn.y
                if (Math.hypot(dx, dy) > 0.01) {
                    return -Math.atan2(dy, dx) + Math.PI / 2
                }
            }

            if (goal.type === 'negotiate_group') {
                const members = Array.isArray(goal.negotiationMembers)
                    ? goal.negotiationMembers.filter(member => member?.id && member.id !== pawn.id)
                    : []
                if (members.length) {
                    const centerX = members.reduce((sum, member) => sum + (member.x ?? pawn.x), 0) / members.length
                    const centerY = members.reduce((sum, member) => sum + (member.y ?? pawn.y), 0) / members.length
                    const dx = centerX - pawn.x
                    const dy = centerY - pawn.y
                    if (Math.hypot(dx, dy) > 0.01) {
                        return -Math.atan2(dy, dx) + Math.PI / 2
                    }
                }
            }

            if (goal.partner?.id && goal.partner.id !== pawn.id) {
                const dx = (goal.partner.x ?? pawn.x) - pawn.x
                const dy = (goal.partner.y ?? pawn.y) - pawn.y
                if (Math.hypot(dx, dy) > 0.01) {
                    return -Math.atan2(dy, dx) + Math.PI / 2
                }
            }
            return null
        },

        _resolveGoalEntityTarget(goal) {
            if (goal?.target && Number.isFinite(goal.target.x) && Number.isFinite(goal.target.y)) {
                return goal.target
            }
            if (!goal?.targetId || !renderer.world?.entitiesMap) return null
            return renderer.world.entitiesMap.get(goal.targetId) ?? null
        },

        /** Absolute world yaw of what the pawn is paying attention to, or null. */
        _getPawnAttentionYaw(pawn) {
            const interactionYaw = renderer._getPawnInteractionYaw(pawn)
            if (Number.isFinite(interactionYaw)) return interactionYaw

            const candidates = [pawn?.currentTarget, renderer._resolveGoalEntityTarget(pawn?.goals?.currentGoal)]
            for (const target of candidates) {
                if (!target || target.id === pawn?.id) continue
                if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) continue
                const dx = target.x - pawn.x
                const dy = target.y - pawn.y
                if (Math.hypot(dx, dy) > 0.01) {
                    return -Math.atan2(dy, dx) + Math.PI / 2
                }
            }
            return null
        },

        /**
         * Yaw the pawn's head node toward its attention (interaction partner, goal or
         * resource target). With no target, the head scans side to side so pawns
         * visibly "look around" without moving the body or camera.
         */
        _updatePawnHeadLook(pawn, mesh) {
            const head = mesh.userData.headNode
            if (!head) return
            const bodyYaw = mesh.rotation.y
            const attentionYaw = renderer._getPawnAttentionYaw(pawn)

            let targetYaw
            if (Number.isFinite(attentionYaw)) {
                targetYaw = Math.atan2(
                    Math.sin(attentionYaw - bodyYaw),
                    Math.cos(attentionYaw - bodyYaw)
                )
            } else {
                const t = renderer._timeUniform?.value ?? 0
                const seed = renderer._hashUnit(pawn?.id, 'head-scan') * Math.PI * 2
                const prevX = Number.isFinite(pawn?.prevX) ? pawn.prevX : pawn.x
                const prevY = Number.isFinite(pawn?.prevY) ? pawn.prevY : pawn.y
                const isMoving = Math.hypot((pawn.x ?? 0) - prevX, (pawn.y ?? 0) - prevY) > 0.06
                targetYaw = Math.sin(t * 0.6 + seed) * (isMoving ? 0.32 : 0.55)
            }

            const clamped = Math.max(-1.25, Math.min(1.25, targetYaw))
            const eased = renderer._easeAngle(
                head.userData.headYaw ?? 0, clamped, head.userData, 'headYawVelocity',
                { response: 0.25, damping: 0.82, maxSpeed: 0.35, snapThreshold: 0.004, stopVelocity: 0.003 }
            )
            head.userData.headYaw = eased
            head.rotation.y = eased
            head.rotation.z = -eased * 0.10
        },

        _disposeMesh(id) {
            const mesh = renderer._meshById.get(id)
            if (!mesh) return
            renderer.scene.remove(mesh)
            if (mesh.isMesh) {
                mesh.geometry?.dispose?.()
                mesh.material?.dispose?.()
            } else {
                mesh.traverse((node) => {
                    if (!node.isMesh) return
                    node.geometry?.dispose?.()
                    node.material?.dispose?.()
                })
            }
            renderer._meshById.delete(id)
            renderer._entityById.delete(id)
        },

        // Refresh methods — dispose meshes of a given type so they rebuild with new model
        _refreshTreeMeshes() {
            if (!renderer._treeModelRoot && !renderer._partsForSaleSmallTreeVariants.length) return
            for (const [id, entity] of renderer._entityById.entries()) {
                if (entity?.type !== 'tree') continue
                renderer._disposeMesh(id)
            }
        },
        _refreshRockMeshes() {
            if (!renderer._rockModelRoot) return
            for (const [id, entity] of renderer._entityById.entries()) {
                if (entity?.subtype !== 'rock' && !renderer._hasTag(entity, 'rock')) continue
                renderer._disposeMesh(id)
            }
        },
        _refreshGrassMeshes() {
            if (!renderer._grassModelRoot) return
            for (const [id, entity] of renderer._entityById.entries()) {
                if (entity?.type !== 'grass') continue
                renderer._disposeMesh(id)
            }
        },
        _refreshStickMeshes() {
            if (!renderer._stickModelRoot) return
            for (const [id, entity] of renderer._entityById.entries()) {
                if (entity?.subtype !== 'stick' && !renderer._hasTag(entity, 'stick')) continue
                renderer._disposeMesh(id)
            }
        },
        _refreshFiberMeshes() {
            if (!renderer._fiberModelRoot) return
            for (const [id, entity] of renderer._entityById.entries()) {
                if (entity?.subtype !== 'fiber_plant' && !renderer._hasTag(entity, 'fiber')) continue
                renderer._disposeMesh(id)
            }
        },
        _refreshFoodMeshes() {
            if (!renderer._foodModelRoot) return
            for (const [id, entity] of renderer._entityById.entries()) {
                if (entity?.subtype !== 'food' && !renderer._hasTag(entity, 'food')) continue
                renderer._disposeMesh(id)
            }
        },
        _refreshCoverMeshes() {
            if (!renderer._coverModelRoot) return
            for (const [id, entity] of renderer._entityById.entries()) {
                if (!renderer._isCoverEntity(entity)) continue
                renderer._disposeMesh(id)
            }
        },
        _refreshAnimalMeshes() {
            if (!renderer._animalModelRoot) return
            for (const [id, entity] of renderer._entityById.entries()) {
                if (entity?.subtype !== 'animal') continue
                renderer._disposeMesh(id)
            }
        },
        _refreshPawnMeshes() {
            if (!renderer._pawnModelRoot) return
            for (const [id, entity] of renderer._entityById.entries()) {
                if (entity?.subtype !== 'pawn') continue
                renderer._disposeMesh(id)
            }
        },
        _refreshBushMeshes() {
            if (!renderer._bushModelRoot && !renderer._bushLeafTexture && !renderer._partsForSaleBushVariants.length) return
            for (const [id, entity] of renderer._entityById.entries()) {
                if (entity?.type !== 'bush' && entity?.subtype !== 'plant') continue
                renderer._disposeMesh(id)
            }
        }
    }
}
