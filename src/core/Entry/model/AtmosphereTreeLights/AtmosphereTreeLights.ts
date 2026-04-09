import { inject } from "inversify"
import { Object3D } from "three"
import { texture } from "three/tsl"
import {
    type BufferGeometry,
    InstancedMesh,
    type Material,
    type Matrix4,
    type Mesh,
    MeshStandardNodeMaterial,
    type Texture,
    Vector3,
} from "three/webgpu"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import { ResourceModel } from "@/Models"
import type { IResourceService } from "@/Services/IResouceService"
import type { ISceneManager } from "@/Services/ISceneManager"

export class AtmosphereTreeLights extends ResourceModel {
    constructor(
        @inject(GAME_CONTEXT.SERVICE.ResourceService)
        resourcesManager: IResourceService,
        @inject(GAME_CONTEXT.MANAGER.SceneManager) sceneManager: ISceneManager,
        position: Vector3 = new Vector3(0, 0, 0),
        scale: Vector3 = new Vector3(1, 1, 1),
    ) {
        super(
            resourcesManager,
            sceneManager,
            "atmosphereTreeLights",
            "",
            position,
            scale,
        )
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        this.modelGroup = new Object3D()
        this.modelGroup.name = "AtmosphereTreeLights"
        // Scale handled by ResourceModel on modelGroup typically, checking original:
        // this.modelGroup.scale.copy(this.scale) <- logic from original
        // ResourceModel loadModel also does this. So redundant but harmless.

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

        const treeLightTexture = this.resourcesManager.getItem(
            "atmosphereTreeLightsTexture",
        ) as Texture

        clonedModel.traverse((child) => {
            if ((child as Mesh).isMesh) {
                const mesh = child as Mesh
                const geometry = mesh.geometry

                const newMat = new MeshStandardNodeMaterial({
                    colorNode: texture(treeLightTexture),
                    emissiveNode: texture(treeLightTexture).mul(2.5),
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
