import { Object3D } from "three"
import { texture } from "three/tsl"
import {
    type BufferGeometry,
    InstancedMesh,
    type Material,
    type Matrix4,
    type Mesh,
    type Texture,
    Vector3,
} from "three/webgpu"
import { MeshDefaultMaterial } from "@/widgets/Materials/MeshDefaultMaterial"
import { BaseModel } from "@/widgets/Models"

export class AtmosphereTreeLights extends BaseModel {
    private scale: Vector3

    constructor(
        position: Vector3 = new Vector3(0, 0, 0),
        scale: Vector3 = new Vector3(1, 1, 1),
    ) {
        super("atmosphereTreeLights")
        this.position = position
        this.scale = scale
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        this.modelGroup = new Object3D()
        this.modelGroup.name = "AtmosphereTreeLights"
        this.modelGroup.scale.copy(this.scale)

        clonedModel.updateMatrixWorld(true)

        const rootMatrixInverse = clonedModel.matrixWorld.clone().invert()

        this.mesh = clonedModel.children[0] as Mesh

        const instancesMap = new Map<
            string,
            {
                geometry: BufferGeometry
                material: Material
                matrices: Matrix4[]
            }
        >()

        const treeLightTexture = this.context.resources.getItem(
            "atmosphereTreeLightsTexture",
        ) as Texture

        clonedModel.traverse((child) => {
            if ((child as Mesh).isMesh) {
                const mesh = child as Mesh
                const geometry = mesh.geometry

                const newMat = new MeshDefaultMaterial({
                    colorNode: texture(treeLightTexture),
                    emissionNode: texture(treeLightTexture).mul(2.5),
                    hasCoreShadows: false,
                    hasLightBounce: false,
                })

                if (!instancesMap.has(geometry.uuid)) {
                    instancesMap.set(geometry.uuid, {
                        geometry: geometry,
                        material: newMat,
                        matrices: [],
                    })
                }

                const groupData = instancesMap.get(geometry.uuid)
                if (groupData) {
                    const instanceMatrix = mesh.matrixWorld.clone()
                    instanceMatrix.premultiply(rootMatrixInverse)

                    groupData.matrices.push(instanceMatrix)
                }
            }
        })

        if (instancesMap.size === 0) {
            console.error("TreeLights 모델에서 Mesh를 찾을 수 없습니다.")
            return
        }

        instancesMap.forEach((data, _) => {
            const { geometry, material, matrices } = data

            const instancedMesh = new InstancedMesh(
                geometry,
                material,
                matrices.length,
            )
            instancedMesh.castShadow = true
            instancedMesh.receiveShadow = true

            for (let i = 0; i < matrices.length; i++) {
                instancedMesh.setMatrixAt(i, matrices[i])
            }

            instancedMesh.instanceMatrix.needsUpdate = true

            // InstancedMesh를 modelGroup에 추가
            if (this.modelGroup) {
                this.modelGroup.add(instancedMesh)
            }
        })
    }
    public update(_deltaTime: number): void {
        // this.material.uTime.value += deltaTime
    }
}
