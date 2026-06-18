import * as THREE from 'three'
import { OBJLoader } from '/node_modules/three/examples/jsm/loaders/OBJLoader.js'
import { FBXLoader } from '/node_modules/three/examples/jsm/loaders/FBXLoader.js'
import { GLTFLoader } from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js'

/**
 * Model loaders — returns loader methods bound to the renderer instance.
 */
export default function createModelLoaders(renderer) {
    return {
        _loadTreeModel() {
            const loader = new OBJLoader()
            loader.load(
                '/solo/assets/models/tree_obj.obj',
                (object) => {
                    renderer._treeModelRoot = object
                    renderer._refreshTreeMeshes()
                },
                undefined,
                () => { renderer._treeModelFailed = true }
            )
        },

        _loadRockModel() {
            const loader = new OBJLoader()
            loader.load(
                '/solo/assets/models/AssortedRocks.obj',
                (object) => {
                    renderer._rockModelRoot = object
                    renderer._rockModelVariants = object.children.filter(node => node.isMesh || node.type === 'Group')
                    renderer._refreshRockMeshes()
                },
                undefined,
                () => { renderer._rockModelFailed = true }
            )
        },

        _loadGrassModel() {
            const loader = new FBXLoader()
            loader.load(
                '/solo/assets/models/grassDarkGreen.fbx',
                (object) => {
                    renderer._grassModelRoot = object
                    renderer._grassModelMeta = renderer._getNodeBoundsMeta(object)
                    renderer._refreshGrassMeshes()
                },
                undefined,
                () => { renderer._grassModelFailed = true }
            )
        },

        _loadPartsForSaleModel() {
            const loader = new OBJLoader()
            loader.load(
                '/solo/assets/models/bush/PartsForSale.obj',
                (object) => {
                    renderer._partsForSaleRoot = object
                    renderer._classifyPartsForSaleVariants()
                    renderer._refreshTreeMeshes()
                    renderer._refreshBushMeshes()
                },
                undefined,
                () => { renderer._partsForSaleFailed = true }
            )
        },

        _loadAnimalModel() {
            const loader = new OBJLoader()
            loader.load(
                '/solo/assets/models/animal_pack/animal%20pack/obj.obj',
                (object) => {
                    renderer._animalModelRoot = object
                    renderer._animalModelVariants = object.children
                        .filter(node => node.isMesh || node.type === 'Group')
                        .sort((a, b) => renderer._getNodeCenterX(a) - renderer._getNodeCenterX(b))
                    renderer._animalVariantMeta = renderer._animalModelVariants.map(node => renderer._getNodeBoundsMeta(node))
                    renderer._normalizeAnimalVariantScales()
                    renderer._refreshAnimalMeshes()
                },
                undefined,
                () => { renderer._animalModelFailed = true }
            )
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
