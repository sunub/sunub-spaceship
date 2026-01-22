import { color, float, texture } from "three/tsl"
import type {
    BufferGeometry,
    Matrix4,
    Mesh,
    MeshStandardMaterial,
} from "three/webgpu"
import { InstancedMesh, Object3D, Vector3 } from "three/webgpu"
import { MeshDefaultMaterial } from "../../Materials/MeshDefaultMaterial"
import { BaseModel } from "../BaseModel"

export class Github extends BaseModel {
    constructor(position: Vector3 = new Vector3(0, 0, 0)) {
        super("githubModel", position)
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        this.modelGroup = new Object3D()
        this.modelGroup.name = "GithubGroup"

        clonedModel.updateMatrixWorld(true)

        this.mesh = clonedModel

        const instancesMap = new Map<
            string,
            {
                geometry: BufferGeometry
                originalMaterial: MeshStandardMaterial
                matrices: Matrix4[]
            }
        >()

        clonedModel.traverse((child) => {
            if ((child as Mesh).isMesh) {
                const mesh = child as Mesh
                const geometry = mesh.geometry
                const material = mesh.material as MeshStandardMaterial

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
            console.error("Github 모델에서 Mesh를 찾을 수 없습니다.")
            return
        }

        instancesMap.forEach((data, _) => {
            const { geometry, originalMaterial, matrices } = data

            const materialParams: any = {}

            if (originalMaterial.map) {
                const texNode = texture(originalMaterial.map)
                if (originalMaterial.color) {
                    materialParams.colorNode = texNode.mul(
                        color(originalMaterial.color),
                    )
                } else {
                    materialParams.colorNode = texNode
                }
            } else if (originalMaterial.color) {
                materialParams.colorNode = color(originalMaterial.color)
            }

            if (originalMaterial.transparent) {
                materialParams.transparent = true
                materialParams.alphaNode = float(originalMaterial.opacity)
            }

            if (originalMaterial.alphaTest > 0) {
                materialParams.alphaTest = originalMaterial.alphaTest
            }

            if (originalMaterial.side !== undefined) {
                materialParams.side = originalMaterial.side
            }

            const defaultMaterial = new MeshDefaultMaterial(materialParams)

            const instancedMesh = new InstancedMesh(
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
