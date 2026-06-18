import * as THREE from 'three'

/**
 * Material factory — shader and standard materials.
 */
export default function createMaterialFactory(renderer) {
    return {
        _createWaterMaterial(baseColor) {
            const waterA = new THREE.Color(baseColor)
            const waterB = waterA.clone().offsetHSL(0.03, 0.08, 0.07)

            const material = new THREE.ShaderMaterial({
                transparent: true,
                depthWrite: false,
                uniforms: {
                    uTime: renderer._timeUniform,
                    uShimmer: renderer._waterShimmerUniform,
                    uSpeed: renderer._waterSpeedUniform,
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

            renderer._waterMaterials.add(material)
            return material
        },

        _createFoliageMaterial(baseColor, swayStrength = 0.25) {
            const material = new THREE.MeshStandardMaterial({
                color: baseColor,
                roughness: 0.92,
                metalness: 0.01
            })

            material.onBeforeCompile = (shader) => {
                shader.uniforms.uTime = renderer._timeUniform
                shader.uniforms.uSwayStrength = { value: swayStrength }
                shader.uniforms.uGlobalSway = renderer._foliageSwayUniform

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
            renderer._foliageMaterials.add(material)
            return material
        },

        _createTreeTrunkMaterial(baseColor) {
            const trunkColor = new THREE.Color(baseColor || '#6b4f2a')
            trunkColor.offsetHSL(0.01, -0.05, -0.06)
            return new THREE.MeshStandardMaterial({
                color: trunkColor,
                roughness: 0.95,
                metalness: 0.0
            })
        },

        _createTreeGradientMaterial() {
            return new THREE.MeshStandardMaterial({
                vertexColors: true,
                roughness: 0.92,
                metalness: 0.0
            })
        },

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
        },

        _createRockMaterial(baseColor, variation = 0) {
            const color = new THREE.Color(baseColor)
            color.offsetHSL(0, -0.05 + variation * 0.08, -0.08 + variation * 0.12)
            return new THREE.MeshStandardMaterial({
                color,
                roughness: 0.98,
                metalness: 0.0
            })
        },

        _createMaterialForProfile(profile) {
            if (profile.shaderType === 'water') {
                return renderer._createWaterMaterial(profile.materialColor)
            }
            if (profile.shaderType === 'foliage') {
                return renderer._createFoliageMaterial(profile.materialColor, profile.swayStrength)
            }
            return new THREE.MeshStandardMaterial({
                color: profile.materialColor,
                roughness: 0.9,
                metalness: 0.05
            })
        }
    }
}
