import * as THREE from 'three'

/**
 * Model builders — creates mesh instances from loaded models.
 * Also includes geometry helpers used by builders.
 */
export default function createModelBuilders(renderer) {
    return {
        _splitTreeMaterialsByHeight(model, profile) {
            model.traverse((node) => {
                if (!node.isMesh || !node.geometry) return
                node.geometry = node.geometry.clone()
                node.castShadow = false
                node.receiveShadow = false
                renderer._applyTreeGradientColors(node.geometry, profile.trunkColor, profile.leafColor ?? profile.materialColor)
                node.material = renderer._createTreeGradientMaterial()
            })
        },

        _captureGroundOffset(model) {
            model.updateMatrixWorld(true)
            const bounds = new THREE.Box3().setFromObject(model)
            if (!Number.isFinite(bounds.min.y)) return 0
            return -bounds.min.y
        },

        _getNodeCenterX(node) {
            const box = new THREE.Box3().setFromObject(node)
            if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.x)) return 0
            return (box.min.x + box.max.x) * 0.5
        },

        _getNodeBoundsMeta(node) {
            const box = new THREE.Box3().setFromObject(node)
            const width = Number.isFinite(box.max.x - box.min.x) ? Math.max(0.001, box.max.x - box.min.x) : 1
            const height = Number.isFinite(box.max.y - box.min.y) ? Math.max(0.001, box.max.y - box.min.y) : 1
            const depth = Number.isFinite(box.max.z - box.min.z) ? Math.max(0.001, box.max.z - box.min.z) : 1
            return { width, height, depth, baseScale: 1 }
        },

        _normalizeAnimalVariantScales() {
            if (!renderer._animalVariantMeta.length) return
            const heights = renderer._animalVariantMeta.map(m => m.height).filter(Number.isFinite)
            if (!heights.length) return
            const sorted = [...heights].sort((a, b) => a - b)
            const median = sorted[Math.floor(sorted.length / 2)]
            const targetHeight = Math.max(0.001, median)
            for (const meta of renderer._animalVariantMeta) {
                const safeHeight = Math.max(0.001, meta.height)
                meta.baseScale = Math.max(0.25, Math.min(4, targetHeight / safeHeight))
            }
        },

        _normalizeSpeciesName(entity) {
            const raw = `${entity?.species ?? entity?.name ?? ''}`.trim().toLowerCase()
            if (!raw) return ''
            if (raw.includes('rabbit')) return 'deer'
            if (raw.includes('fox')) return 'lion'
            return raw
        },

        _getAnimalVariantIndex(entity) {
            const species = renderer._normalizeSpeciesName(entity)
            const knownIndex = renderer._animalPackOrder.indexOf(species)
            if (knownIndex >= 0) return knownIndex
            const count = renderer._animalModelVariants.length
            if (!count) return -1
            const hashed = Math.floor(renderer._hashUnit(entity?.id ?? entity?.name, 'animal-variant') * count)
            return Math.max(0, Math.min(count - 1, hashed))
        },

        _centerModelToOrigin(model) {
            model.updateMatrixWorld(true)
            const bounds = new THREE.Box3().setFromObject(model)
            if (!Number.isFinite(bounds.min.x) || !Number.isFinite(bounds.max.x)) return
            const centerX = (bounds.min.x + bounds.max.x) * 0.5
            const centerZ = (bounds.min.z + bounds.max.z) * 0.5
            model.position.x -= centerX
            model.position.y -= bounds.min.y
            model.position.z -= centerZ
        },

        _classifyPartsForSaleVariants() {
            const children = renderer._partsForSaleRoot?.children?.filter(node => node.isMesh || node.type === 'Group') ?? []
            if (!children.length) {
                renderer._partsForSaleBushVariants = []
                renderer._partsForSaleSmallTreeVariants = []
                return
            }

            const withMeta = children.map(node => {
                const centerX = renderer._getNodeCenterX(node)
                const meta = renderer._getNodeBoundsMeta(node)
                return { node, centerX, height: meta.height, width: meta.width, depth: meta.depth }
            }).sort((a, b) => a.centerX - b.centerX)

            const heights = withMeta.map(item => item.height).filter(Number.isFinite).sort((a, b) => a - b)
            if (!heights.length) {
                renderer._partsForSaleBushVariants = []
                renderer._partsForSaleSmallTreeVariants = withMeta.map(item => item.node)
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
                return heightRatio <= 2.2 && item.height <= endMedianHeight * 1.5 && footprint >= endMedianFootprint * 0.25
            })

            renderer._partsForSaleBushVariants = bushCandidates.map(item => item.node)
            const bushSet = new Set(renderer._partsForSaleBushVariants)
            renderer._partsForSaleSmallTreeVariants = withMeta
                .filter(item => !bushSet.has(item.node) && item.height >= median * 0.75)
                .map(item => item.node)

            if (!renderer._partsForSaleBushVariants.length) {
                renderer._partsForSaleBushVariants = rowEnd
                    .filter(item => item.height <= endMedianHeight * 1.2)
                    .map(item => item.node)
            }
            if (!renderer._partsForSaleSmallTreeVariants.length) {
                renderer._partsForSaleSmallTreeVariants = withMeta
                    .filter(item => !renderer._partsForSaleBushVariants.includes(item.node))
                    .map(item => item.node)
            }
        },

        _getPartsVariantIndex(entity, salt, count) {
            if (!count) return -1
            const hashed = Math.floor(renderer._hashUnit(entity?.id ?? entity?.name, salt) * count)
            return Math.max(0, Math.min(count - 1, hashed))
        },

        _getRockVariantIndex(entity) {
            const count = renderer._rockModelVariants.length
            if (!count) return -1
            const hashed = Math.floor(renderer._hashUnit(entity?.id ?? entity?.name, 'rock-variant') * count)
            return Math.max(0, Math.min(count - 1, hashed))
        },

        // --- Instance builders ---

        _buildTreeModelInstance(profile) {
            const model = renderer._treeModelRoot.clone(true)
            const scale = profile.modelScale ?? 0.2
            const scaleY = scale * (profile.modelScaleY ?? 1)
            model.scale.set(scale, scaleY, scale)
            model.userData.profile = profile
            model.userData.motionInitialized = false
            model.rotation.set(profile.rotation.x, profile.rotation.y, profile.rotation.z)
            renderer._splitTreeMaterialsByHeight(model, profile)
            model.userData.groundOffset = renderer._captureGroundOffset(model)
            return model
        },

        _buildRockModelInstance(entity, profile) {
            const variantIndex = renderer._getRockVariantIndex(entity)
            const source = renderer._rockModelVariants[variantIndex] ?? renderer._rockModelRoot
            const model = source.clone(true)
            const scale = profile.modelScale ?? 0.08
            model.scale.setScalar(scale)
            model.userData.profile = profile
            model.userData.motionInitialized = false
            model.rotation.set(profile.rotation.x, profile.rotation.y, profile.rotation.z)
            renderer._centerModelToOrigin(model)
            const variation = renderer._hashUnit(entity?.id, 'rockmat')
            model.traverse((node) => {
                if (!node.isMesh || !node.geometry) return
                node.geometry = node.geometry.clone()
                node.castShadow = false
                node.receiveShadow = false
                node.material = renderer._createRockMaterial(profile.materialColor, variation)
            })
            model.userData.groundOffset = renderer._captureGroundOffset(model)
            return model
        },

        _buildGrassModelInstance(entity, profile) {
            const model = renderer._grassModelRoot.clone(true)
            const sourceHeight = Math.max(0.001, renderer._grassModelMeta?.height ?? 1)
            const targetHeight = Math.max(0.7, profile.grassTargetHeight ?? 1.3)
            const normalizedScale = Math.max(0.02, Math.min(6, targetHeight / sourceHeight))
            const randomScale = 0.9 + renderer._hashUnit(entity?.id, 'grass-scale') * 0.35
            const scale = normalizedScale * randomScale
            model.scale.setScalar(scale)
            model.userData.profile = profile
            model.userData.motionInitialized = false
            model.rotation.set(profile.rotation.x, profile.rotation.y, profile.rotation.z)
            renderer._centerModelToOrigin(model)
            model.traverse((node) => {
                if (!node.isMesh || !node.geometry) return
                node.geometry = node.geometry.clone()
                node.castShadow = false
                node.receiveShadow = false
                node.material = renderer._createFoliageMaterial(profile.materialColor, profile.swayStrength)
            })
            model.userData.groundOffset = renderer._captureGroundOffset(model)
            return model
        },

        _buildBushModelInstance(profile) {
            const model = renderer._bushModelRoot.clone(true)
            const scale = profile.modelScale ?? 0.18
            model.scale.setScalar(scale)
            model.userData.profile = profile
            model.userData.motionInitialized = false
            model.rotation.set(profile.rotation.x, profile.rotation.y, profile.rotation.z)
            renderer._centerModelToOrigin(model)
            model.traverse((node) => {
                if (!node.isMesh || !node.geometry) return
                node.geometry = node.geometry.clone()
                node.castShadow = false
                node.receiveShadow = false
                node.material = renderer._createFoliageMaterial(profile.materialColor, profile.swayStrength)
            })
            model.userData.groundOffset = renderer._captureGroundOffset(model)
            return model
        },

        _buildSmallTreeVariantInstance(entity, profile) {
            const index = renderer._getPartsVariantIndex(entity, 'parts-small-tree', renderer._partsForSaleSmallTreeVariants.length)
            if (index < 0) return null
            const source = renderer._partsForSaleSmallTreeVariants[index]
            if (!source) return null
            const model = source.clone(true)
            const scale = profile.smallTreeModelScale ?? profile.modelScale ?? 0.2
            const scaleY = scale * (profile.modelScaleY ?? 1)
            model.scale.set(scale, scaleY, scale)
            model.userData.profile = profile
            model.userData.motionInitialized = false
            model.rotation.set(profile.rotation.x, profile.rotation.y, profile.rotation.z)
            renderer._centerModelToOrigin(model)
            renderer._splitTreeMaterialsByHeight(model, profile)
            model.userData.groundOffset = renderer._captureGroundOffset(model)
            return model
        },

        _buildBushVariantModelInstance(entity, profile) {
            const index = renderer._getPartsVariantIndex(entity, 'parts-bush', renderer._partsForSaleBushVariants.length)
            if (index < 0) return null
            const source = renderer._partsForSaleBushVariants[index]
            if (!source) return null
            const model = source.clone(true)
            const scale = profile.modelScale ?? 0.18
            model.scale.setScalar(scale)
            model.userData.profile = profile
            model.userData.motionInitialized = false
            model.rotation.set(profile.rotation.x, profile.rotation.y, profile.rotation.z)
            renderer._centerModelToOrigin(model)
            model.traverse((node) => {
                if (!node.isMesh || !node.geometry) return
                node.geometry = node.geometry.clone()
                node.castShadow = false
                node.receiveShadow = false
                node.material = renderer._createFoliageMaterial(profile.materialColor, profile.swayStrength)
            })
            model.userData.groundOffset = renderer._captureGroundOffset(model)
            return model
        },

        _buildBushLeafBillboardInstance(entity, profile) {
            const group = new THREE.Group()
            const leafHeight = 7.5
            const leafWidth = 3.1
            const material = new THREE.MeshStandardMaterial({
                map: renderer._bushLeafTexture,
                color: profile.materialColor,
                transparent: true,
                alphaTest: 0.35,
                side: THREE.DoubleSide,
                roughness: 0.92,
                metalness: 0.0
            })
            const plane = new THREE.PlaneGeometry(leafWidth, leafHeight)
            for (let i = 0; i < 3; i++) {
                const mesh = new THREE.Mesh(plane, material.clone())
                const angleJitter = (renderer._hashUnit(entity?.id, `bush-leaf-angle-${i}`) - 0.5) * 0.22
                mesh.rotation.y = (i / 3) * Math.PI + angleJitter
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
        },

        _buildProceduralBushInstance(entity, profile) {
            const group = new THREE.Group()
            const radius = Math.max(1, profile.bushRadius ?? 1.8)
            const canopyMaterial = renderer._createFoliageMaterial(profile.materialColor, profile.swayStrength)
            const canopyDefs = [
                { x: 0, y: radius * 0.95, z: 0, scale: 1 },
                { x: -radius * 0.48, y: radius * 0.82, z: radius * 0.24, scale: 0.68 },
                { x: radius * 0.44, y: radius * 0.8, z: radius * 0.28, scale: 0.62 },
                { x: 0, y: radius * 0.72, z: -radius * 0.46, scale: 0.7 }
            ]
            for (let i = 0; i < canopyDefs.length; i++) {
                const def = canopyDefs[i]
                const jitter = renderer._hashUnit(entity?.id, `bush-canopy-${i}`)
                const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius * def.scale, 9, 7), canopyMaterial)
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
                renderer._createTreeTrunkMaterial('#6b4f2a')
            )
            trunk.position.y = Math.max(0.4, radius * 0.42)
            trunk.castShadow = false
            trunk.receiveShadow = false
            group.add(trunk)
            group.userData.profile = profile
            group.userData.motionInitialized = false
            group.rotation.set(profile.rotation.x, profile.rotation.y, profile.rotation.z)
            group.userData.groundOffset = renderer._captureGroundOffset(group)
            return group
        },

        _buildAnimalModelInstance(entity, profile) {
            const variantIndex = renderer._getAnimalVariantIndex(entity)
            if (variantIndex < 0) return null
            const source = renderer._animalModelVariants[variantIndex]
            if (!source) return null
            const model = source.clone(true)
            const variantMeta = renderer._animalVariantMeta[variantIndex]
            const normalizedScale = variantMeta?.baseScale ?? 1
            const baseScale = (profile.modelScale ?? 0.25) * normalizedScale
            const mappedName = renderer._animalPackOrder[variantIndex] ?? `variant_${variantIndex + 1}`
            const speciesName = renderer._normalizeSpeciesName(entity) || 'unknown'
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
            renderer._centerModelToOrigin(model)
            model.traverse((node) => {
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
            model.userData.groundOffset = renderer._captureGroundOffset(model)
            return model
        },

        _buildPawnModelInstance(entity, profile) {
            const model = renderer._pawnModelRoot.clone(true)
            const scale = profile.modelScale ?? 8
            model.scale.setScalar(scale)
            model.userData.profile = profile
            model.userData.motionInitialized = false
            model.rotation.set(profile.rotation.x, profile.rotation.y, profile.rotation.z)
            renderer._centerModelToOrigin(model)
            model.traverse((node) => {
                if (!node.isMesh || !node.geometry) return
                node.geometry = node.geometry.clone()
                node.castShadow = false
                node.receiveShadow = false
                node.material = new THREE.MeshStandardMaterial({
                    color: renderer._pawnTexture ? '#ffffff' : profile.materialColor,
                    map: renderer._pawnTexture ?? null,
                    roughness: 0.84,
                    metalness: 0.03
                })
            })
            model.userData.groundOffset = renderer._captureGroundOffset(model)
            return model
        }
    }
}
