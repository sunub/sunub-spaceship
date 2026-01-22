import { color, texture } from "three/tsl"
import * as THREE from "three/webgpu"
import { MeshDefaultMaterial } from "../../Materials/MeshDefaultMaterial"
import { BaseModel } from "../BaseModel"

export class BrightCrystal extends BaseModel {
    constructor(position: THREE.Vector3 = new THREE.Vector3(0, 0, 0)) {
        super("brightCrystalModel", position)
    }

    protected setupModelStructure(clonedModel: THREE.Object3D): void {
        this.modelGroup = new THREE.Object3D()
        this.modelGroup.name = "BrightCrystalGroup"

        clonedModel.updateMatrixWorld(true)

        this.mesh = clonedModel // Fallback reference

        // 지오메트리/머티리얼별로 데이터 수집
        // Key: Geometry UUID + Material UUID, Value: { geometry, material, matrices }
        // 단순화를 위해 Geometry UUID를 키로 사용하되, Material 변환은 각 그룹 생성 시 수행)
        const instancesMap = new Map<
            string,
            {
                geometry: THREE.BufferGeometry
                originalMaterial: THREE.MeshStandardMaterial
                matrices: THREE.Matrix4[]
            }
        >()

        clonedModel.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh
                const geometry = mesh.geometry
                const material = mesh.material as THREE.MeshStandardMaterial

                if (!instancesMap.has(geometry.uuid)) {
                    instancesMap.set(geometry.uuid, {
                        geometry: geometry,
                        originalMaterial: material,
                        matrices: [],
                    })
                }

                const groupData = instancesMap.get(geometry.uuid)
                if (groupData) {
                    groupData.matrices.push(mesh.matrixWorld.clone())
                }
            }
        })

        if (instancesMap.size === 0) {
            console.error("BrightCrystal 모델에서 Mesh를 찾을 수 없습니다.")
            return
        }

        instancesMap.forEach((data, _) => {
            const { geometry, originalMaterial, matrices } = data

            const materialParams: any = {}

            if (originalMaterial.map) {
                materialParams.colorNode = texture(originalMaterial.map)
            } else if (originalMaterial.color) {
                materialParams.colorNode = color(originalMaterial.color)
            }
            if (originalMaterial.emissive) {
                let emissionNode = null
                if (originalMaterial.emissiveMap) {
                    emissionNode = texture(originalMaterial.emissiveMap)
                } else {
                    emissionNode = color(originalMaterial.emissive)
                }

                if (originalMaterial.emissiveIntensity !== undefined) {
                    emissionNode = emissionNode.mul(
                        originalMaterial.emissiveIntensity,
                    )
                }

                materialParams.emissionNode = emissionNode
            }

            if (originalMaterial.transparent) {
                materialParams.transparent = true
            }

            const customMaterial = new MeshDefaultMaterial(materialParams)

            const instancedMesh = new THREE.InstancedMesh(
                geometry,
                customMaterial,
                matrices.length,
            )
            instancedMesh.castShadow = true
            instancedMesh.receiveShadow = true

            for (let i = 0; i < matrices.length; i++) {
                instancedMesh.setMatrixAt(i, matrices[i])
            }

            instancedMesh.instanceMatrix.needsUpdate = true
            if (this.modelGroup) {
                this.modelGroup.add(instancedMesh)
            }
        })
    }

    public update(_deltaTime: number): void {
        // Static or simple animation
    }
}
