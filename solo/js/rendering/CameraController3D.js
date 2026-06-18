import * as THREE from 'three'
import { GLTFLoader } from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js'

/**
 * 3D camera controller — first-person tracking, overseer camera, head mesh.
 */
export default function createCameraController(renderer) {
    return {
        _createHeadMesh() {
            const headGroup = new THREE.Group()
            const loader = new GLTFLoader()
            loader.load(
                '/solo/assets/models/pawn.glb',
                (gltf) => {
                    while (headGroup.children.length) {
                        const child = headGroup.children[0]
                        headGroup.remove(child)
                        if (child.geometry) child.geometry.dispose()
                        if (child.material) {
                            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose())
                            else child.material.dispose()
                        }
                    }
                    const model = gltf.scene
                    const bbox = new THREE.Box3().setFromObject(model)
                    renderer._pawnModelHeight = bbox.max.y - bbox.min.y
                    renderer._pawnModelBottomY = bbox.min.y
                    model.traverse((node) => {
                        if (node.isMesh) {
                            node.material = new THREE.MeshStandardMaterial({
                                color: 0x5ec4c0,
                                roughness: 0.3,
                                metalness: 0.05,
                                transparent: false,
                                side: THREE.DoubleSide,
                                depthWrite: true
                            })
                        }
                    })
                    renderer._centerModelToOrigin(model)
                    headGroup.add(model)
                    renderer._headMeshLoaded = true
                },
                undefined,
                () => { renderer._headMeshFailed = true }
            )
            headGroup.position.set(0, 0, 0)
            headGroup.scale.setScalar(2.5)
            renderer.scene.add(headGroup)
            headGroup.visible = true
            renderer._headMesh = headGroup
            return headGroup
        },

        _mergeGeometries(geometries) {
            let totalVerts = 0
            let totalIdx = 0
            for (const geo of geometries) {
                totalVerts += geo.attributes.position.count
                const idx = geo.index
                totalIdx += idx ? idx.count : geo.attributes.position.count
            }
            const positions = new Float32Array(totalVerts * 3)
            const normals = new Float32Array(totalVerts * 3)
            const indices = new Uint32Array(totalIdx)
            let vertOffset = 0
            let idxOffset = 0
            for (const geo of geometries) {
                const pos = geo.attributes.position.array
                const nor = geo.attributes.normal.array
                positions.set(pos, vertOffset * 3)
                normals.set(nor, vertOffset * 3)
                const idx = geo.index
                if (idx) {
                    const arr = idx.array
                    for (let i = 0; i < arr.length; i++) {
                        indices[idxOffset + i] = arr[i] + vertOffset
                    }
                    idxOffset += arr.length
                } else {
                    const count = geo.attributes.position.count
                    for (let i = 0; i < count; i++) {
                        indices[idxOffset + i] = vertOffset + i
                    }
                    idxOffset += count
                }
                vertOffset += geo.attributes.position.count
            }
            const merged = new THREE.BufferGeometry()
            merged.setAttribute('position', new THREE.BufferAttribute(positions, 3))
            merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
            merged.setIndex(new THREE.BufferAttribute(indices, 1))
            return merged
        },

        _updateHeadMesh(progress) {
            if (!renderer._headMesh) return
            const head = renderer._headMesh
            const pawn = renderer.followedEntity

            if (pawn && renderer.firstPersonLocked) {
                const eyeGround = renderer._getGroundHeightAt(pawn.x, pawn.y)
                const yOff = renderer.pawnTuning?.pawnYOffset ?? 0
                const scale = renderer.pawnTuning?.pawnScale ?? 2.5
                const bottomOffset = (renderer._pawnModelBottomY ?? -0.5) * scale
                renderer._tmpHeadTarget.set(pawn.x, eyeGround - bottomOffset + yOff, pawn.y)
                renderer._smoothedPawnPos.lerp(renderer._tmpHeadTarget, 0.10)
                head.position.copy(renderer._smoothedPawnPos)

                const breathPhase = renderer._timeUniform.value * 1.5
                const breathScale = 1.0 + Math.sin(breathPhase) * 0.012
                head.scale.setScalar(scale * breathScale)

                const dir = renderer._smoothedFirstPersonDir
                const targetRotY = Math.atan2(dir.z, dir.x)
                renderer._smoothedPawnRotY += (targetRotY - renderer._smoothedPawnRotY) * 0.15
                head.rotation.y = renderer._smoothedPawnRotY

                const pX = Number.isFinite(pawn.prevX) ? pawn.prevX : pawn.x
                const pY = Number.isFinite(pawn.prevY) ? pawn.prevY : pawn.y
                const isWalking = ((pawn.x - pX) ** 2 + (pawn.y - pY) ** 2) > 0.0001
                const bobAmount = isWalking ? Math.sin(renderer._timeUniform.value * 4) * 0.008 * scale : 0
                head.position.y += bobAmount

                const hideHead = renderer.perceptionPolicy === 'disabled' || renderer.perceptionPolicy === 'god_noop'
                head.visible = !hideHead
            } else {
                head.visible = false
            }
        },

        _updateCamera(progress) {
            if (renderer.followMode && renderer.followedEntity) {
                renderer.viewX = renderer.followedEntity.x
                renderer.viewY = renderer.followedEntity.y
            }
            renderer._skyDome.position.set(renderer.viewX, 0, renderer.viewY)

            if (renderer.firstPersonLocked && renderer.followedEntity) {
                const pawn = renderer.followedEntity
                const pX = Number.isFinite(pawn.prevX) ? pawn.prevX : pawn.x
                const pY = Number.isFinite(pawn.prevY) ? pawn.prevY : pawn.y
                renderer._tmpTravelDir.set(pawn.x - pX, 0, pawn.y - pY)
                const isMoving = renderer._tmpTravelDir.lengthSq() > 0.0001
                if (isMoving) renderer._tmpTravelDir.normalize()
                else renderer._tmpTravelDir.set(1, 0, 0)

                renderer._tmpAttnDir.set(0, 0, 0)
                let hasAttention = false
                if (pawn.currentTarget) {
                    const dx = pawn.currentTarget.x - pawn.x
                    const dy = pawn.currentTarget.y - pawn.y
                    if (dx * dx + dy * dy > 0.01) {
                        renderer._tmpRawAttn.set(dx, 0, dy).normalize()
                        if (!renderer._cachedAttnDir || Math.abs(renderer._tmpRawAttn.x - renderer._cachedAttnDir.x) > 0.15 || Math.abs(renderer._tmpRawAttn.z - renderer._cachedAttnDir.z) > 0.15) {
                            renderer._cachedAttnDir = renderer._tmpRawAttn.clone()
                        }
                        renderer._tmpAttnDir.copy(renderer._cachedAttnDir)
                        hasAttention = true
                    }
                }
                if (!hasAttention) {
                    renderer._tmpAttnDir.copy(renderer._tmpTravelDir)
                }

                const isStudying = pawn.behaviorState === 'studying' || pawn.behaviorState === 'resting'
                const attnWeight = isStudying ? 0.85 : (isMoving ? 0.35 : 0.6)
                renderer._tmpBlendDir
                    .addScaledVector(renderer._tmpTravelDir, 1 - attnWeight)
                    .addScaledVector(renderer._tmpAttnDir, attnWeight)
                    .normalize()
                const targetYaw = Math.atan2(renderer._tmpBlendDir.z, renderer._tmpBlendDir.x)

                renderer._firstPersonYaw = renderer._easeAngle(
                    renderer._firstPersonYaw, targetYaw, renderer, '_firstPersonYawVelocity',
                    { response: 0.3, damping: 0.82, maxSpeed: 0.25, snapThreshold: 0.003, stopVelocity: 0.002 }
                )
                renderer._tmpYawDir.set(Math.cos(renderer._firstPersonYaw), 0, Math.sin(renderer._firstPersonYaw))

                const eyeGround = renderer._getGroundHeightAt(pawn.x, pawn.y)
                const pawnScale = renderer.pawnTuning?.pawnScale ?? 2.5
                const bottomOffset = (renderer._pawnModelBottomY ?? -0.5) * pawnScale
                const pawnHeadY = eyeGround - bottomOffset + renderer._pawnModelHeight * pawnScale
                const behindDistance = renderer.cameraTuning.behindDistance
                const camHeight = pawnHeadY + renderer.cameraTuning.cameraHeight

                renderer._tmpTargetEye.set(
                    pawn.x - renderer._tmpYawDir.x * behindDistance,
                    camHeight,
                    pawn.y - renderer._tmpYawDir.z * behindDistance
                )
                renderer._smoothedFirstPersonEye.lerp(renderer._tmpTargetEye, 0.08)
                renderer._smoothedFirstPersonDir.lerp(renderer._tmpYawDir, 0.08).normalize()

                const lookDistance = renderer.cameraTuning.lookDistance
                renderer._tmpLookTarget.set(
                    pawn.x + renderer._tmpYawDir.x * lookDistance,
                    pawnHeadY + renderer.cameraTuning.lookHeight,
                    pawn.y + renderer._tmpYawDir.z * lookDistance
                )

                renderer._camera3d.position.copy(renderer._smoothedFirstPersonEye)
                renderer._camera3d.lookAt(renderer._tmpLookTarget)
                return
            }

            const viewGround = renderer._getGroundHeightAt(renderer.viewX, renderer.viewY)
            renderer._tmpOverseerTarget.set(renderer.viewX, viewGround, renderer.viewY)
            renderer._tmpOverseerElevated.set(renderer.viewX, viewGround + renderer.cameraDistance * 0.45, renderer.viewY + renderer.cameraDistance)
            renderer._camera3d.position.lerp(renderer._tmpOverseerElevated, 0.08)
            renderer._smoothedCameraTarget.lerp(renderer._tmpOverseerTarget, 0.1)
            renderer._camera3d.lookAt(renderer._smoothedCameraTarget)
        },

        _easeAngle(current, target, store, velocityKey, options = {}) {
            const response = options.response ?? renderer.turnResponse
            const damping = options.damping ?? renderer.turnDamping
            const maxSpeed = options.maxSpeed ?? renderer.maxTurnSpeed
            const snapThreshold = options.snapThreshold ?? renderer.turnSnapThreshold
            const stopVelocity = options.stopVelocity ?? renderer.turnStopVelocity

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
    }
}
