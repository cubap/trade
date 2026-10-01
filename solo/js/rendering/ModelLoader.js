import * as THREE from 'three'
import { GLTFLoader } from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js'

// Low-poly placeholder pack authored at world scale (Y-up, origin at model base center)
const PLACEHOLDER_DIR = '/solo/assets/models/placeholders'

/**
 * Model loaders — returns loader methods bound to the renderer instance.
 */
export default function createModelLoaders(renderer) {
    return {
        /** Load a GLB and hand the parsed gltf to onLoad; onFail marks the model unavailable. */
        _loadGLB(url, onLoad, onFail) {
            const loader = new GLTFLoader()
            loader.load(
                url,
                (gltf) => { onLoad(gltf) },
                undefined,
                () => { if (onFail) onFail() }
            )
        },

        /**
         * Top-level mesh/group children of a loaded scene, used as selectable variants.
         * Packs lay their variants out side by side, so each variant is re-parented under an
         * identity pivot centred on its own bounds (base at y=0) while keeping its authored
         * rotation. Clones can then be rotated/scaled freely around the model's own centre.
         */
        _modelVariants(root) {
            if (!root?.children) return []
            const pivots = []
            for (const node of root.children.filter(child => child.isMesh || child.type === 'Group')) {
                root.remove(node)
                node.updateMatrixWorld(true)
                const bounds = new THREE.Box3().setFromObject(node)
                if (Number.isFinite(bounds.min.x)) {
                    node.position.x -= (bounds.min.x + bounds.max.x) * 0.5
                    node.position.y -= bounds.min.y
                    node.position.z -= (bounds.min.z + bounds.max.z) * 0.5
                }
                const pivot = new THREE.Group()
                pivot.name = node.name
                pivot.add(node)
                root.add(pivot)
                pivots.push(pivot)
            }
            return pivots
        },

        _loadTreeModel() {
            renderer._loadGLB(`${PLACEHOLDER_DIR}/tree.glb`, (gltf) => {
                renderer._modelVariants(gltf.scene)
                renderer._treeModelRoot = gltf.scene
                renderer._refreshTreeMeshes()
            }, () => { renderer._treeModelFailed = true })
        },

        _loadRockModel() {
            renderer._loadGLB(`${PLACEHOLDER_DIR}/rock.glb`, (gltf) => {
                renderer._rockModelRoot = gltf.scene
                renderer._rockModelVariants = renderer._modelVariants(gltf.scene)
                renderer._refreshRockMeshes()
            }, () => { renderer._rockModelFailed = true })
        },

        _loadGrassModel() {
            renderer._loadGLB(`${PLACEHOLDER_DIR}/grass.glb`, (gltf) => {
                renderer._modelVariants(gltf.scene)
                renderer._grassModelRoot = gltf.scene
                renderer._grassModelMeta = renderer._getNodeBoundsMeta(gltf.scene)
                renderer._refreshGrassMeshes()
            }, () => { renderer._grassModelFailed = true })
        },

        _loadPartsForSaleModel() {
            renderer._loadGLB(`${PLACEHOLDER_DIR}/bush.glb`, (gltf) => {
                renderer._partsForSaleRoot = gltf.scene
                renderer._bushModelRoot = gltf.scene
                // Placeholder bushes are already separate top-level variants; no classification needed.
                renderer._partsForSaleBushVariants = renderer._modelVariants(gltf.scene)
                renderer._partsForSaleSmallTreeVariants = []
                renderer._refreshBushMeshes()
            }, () => { renderer._partsForSaleFailed = true })
        },

        _loadAnimalModel() {
            renderer._loadGLB(`${PLACEHOLDER_DIR}/animals.glb`, (gltf) => {
                renderer._animalModelRoot = gltf.scene
                renderer._animalModelVariants = renderer._modelVariants(gltf.scene)
                renderer._animalVariantMeta = renderer._animalModelVariants.map(node => renderer._getNodeBoundsMeta(node))
                renderer._normalizeAnimalVariantScales()
                renderer._refreshAnimalMeshes()
            }, () => { renderer._animalModelFailed = true })
        },

        _loadStickModel() {
            renderer._loadGLB(`${PLACEHOLDER_DIR}/stick.glb`, (gltf) => {
                renderer._stickModelRoot = gltf.scene
                renderer._stickModelVariants = renderer._modelVariants(gltf.scene)
                renderer._refreshStickMeshes()
            }, () => { renderer._stickModelFailed = true })
        },

        _loadFiberPlantModel() {
            renderer._loadGLB(`${PLACEHOLDER_DIR}/fiber_plant.glb`, (gltf) => {
                renderer._fiberModelRoot = gltf.scene
                renderer._fiberModelVariants = renderer._modelVariants(gltf.scene)
                renderer._refreshFiberMeshes()
            }, () => { renderer._fiberModelFailed = true })
        },

        _loadFoodModel() {
            renderer._loadGLB(`${PLACEHOLDER_DIR}/food.glb`, (gltf) => {
                renderer._foodModelRoot = gltf.scene
                renderer._foodModelVariants = renderer._modelVariants(gltf.scene)
                renderer._refreshFoodMeshes()
            }, () => { renderer._foodModelFailed = true })
        },

        _loadCoverModel() {
            renderer._loadGLB(`${PLACEHOLDER_DIR}/cover.glb`, (gltf) => {
                renderer._coverModelRoot = gltf.scene
                renderer._coverModelVariants = renderer._modelVariants(gltf.scene)
                renderer._refreshCoverMeshes()
            }, () => { renderer._coverModelFailed = true })
        },

        _loadOpenGameArtSkybox() {
            const faces = [
                '/solo/assets/models/opengameart/skybox_kurt/kurt/space_rt.png',
                '/solo/assets/models/opengameart/skybox_kurt/kurt/space_lf.png',
                '/solo/assets/models/opengameart/skybox_kurt/kurt/space_up.png',
                '/solo/assets/models/opengameart/skybox_kurt/kurt/space_dn.png',
                '/solo/assets/models/opengameart/skybox_kurt/kurt/space_ft.png',
                '/solo/assets/models/opengameart/skybox_kurt/kurt/space_bk.png'
            ]
            const loader = new THREE.CubeTextureLoader()
            loader.load(
                faces,
                (texture) => {
                    if (texture && 'colorSpace' in texture && THREE.SRGBColorSpace) {
                        texture.colorSpace = THREE.SRGBColorSpace
                    }
                    renderer._skyboxTexture = texture
                    renderer.scene.background = texture
                    if (renderer._skyDome) renderer._skyDome.visible = false
                },
                undefined,
                () => {
                    if (renderer._skyDome) renderer._skyDome.visible = true
                }
            )
        },

        _loadPawnModel() {
            const textureLoader = new THREE.TextureLoader()
            textureLoader.load(
                '/solo/assets/models/opengameart/pawn_rpg_kit/textures/boy_Albedo.png',
                (texture) => {
                    if (texture && 'colorSpace' in texture && THREE.SRGBColorSpace) {
                        texture.colorSpace = THREE.SRGBColorSpace
                    }
                    renderer._pawnTexture = texture
                    renderer._refreshPawnMeshes()
                },
                undefined,
                () => { renderer._pawnTextureFailed = true }
            )

            const loader = new GLTFLoader()
            loader.load(
                '/solo/assets/models/pawn.glb',
                (gltf) => {
                    renderer._pawnModelRoot = gltf.scene
                    renderer._refreshPawnMeshes()
                },
                undefined,
                () => { renderer._pawnModelFailed = true }
            )
        }
    }
}
