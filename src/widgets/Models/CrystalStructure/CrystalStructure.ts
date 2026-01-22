import { color } from "three/tsl"
import * as THREE from "three/webgpu"
import { MeshDefaultMaterial } from "../../Materials/MeshDefaultMaterial"
import { BaseModel } from "../BaseModel"

export class CrystalStructure extends BaseModel {
    constructor(position: THREE.Vector3 = new THREE.Vector3(0, 0, 0)) {
        super("crystalStructure", position)
    }

    protected setupModelStructure(clonedModel: THREE.Object3D): void {
        this.modelGroup = new THREE.Object3D()
        this.modelGroup.name = "CrystalStructureGroup"

        clonedModel.updateMatrixWorld(true)

        this.mesh = clonedModel

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
            console.error("CrystalStructure 모델에서 Mesh를 찾을 수 없습니다.")
            return
        }

        instancesMap.forEach((data, _) => {
            const { geometry, originalMaterial, matrices } = data

            const materialParams: any = {}

            if (originalMaterial.color) {
                materialParams.colorNode = color(originalMaterial.color)
            }

            const defaultMaterial = new MeshDefaultMaterial(materialParams)

            const instancedMesh = new THREE.InstancedMesh(
                geometry,
                defaultMaterial,
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
