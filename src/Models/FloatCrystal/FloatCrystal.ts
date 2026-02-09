import {
    type BufferGeometry,
    InstancedMesh,
    type Material,
    type Matrix4,
    type Mesh,
    Object3D,
} from "three/webgpu"
import { inject, injectable } from "inversify"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { IResourceService } from "@/Services/IResouceService"
import type { ISceneManager } from "@/Services/ISceneManager"
import { CrystalMaterial } from "@/Materials/CrystalMaterial"
import { ResourceModel } from "../ResourceModel"

@injectable()
export class FloatCrystal extends ResourceModel {
    constructor(
        @inject(GAME_CONTEXT.SERVICE.ResourceService) resourcesManager: IResourceService,
        @inject(GAME_CONTEXT.MANAGER.SceneManager) sceneManager: ISceneManager,
    ) {
        super(resourcesManager, sceneManager, "floatCrystalModel")
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        this.modelGroup = new Object3D()
        this.modelGroup.name = "FloatCrystalGroup"

        clonedModel.updateMatrixWorld(true)
        this.mesh = clonedModel

        const instancesMap = new Map<
            string,
            {
                geometry: BufferGeometry
                material: Material
                matrices: Matrix4[]
            }
        >()

        clonedModel.traverse((child) => {
            if ((child as Mesh).isMesh) {
                const mesh = child as Mesh
                const geometry = mesh.geometry
                const crystalMat = new CrystalMaterial({
                    color: 0x3366ff, // 베이스
                    coreColor: 0x00ffff, // 에너지
                    rimColor: 0xffffff, // 가장자리
                    noiseScale: 1.2,
                    flowSpeed: 0.5, // 에너지가 흐르는 속도
                })

                if (!instancesMap.has(geometry.uuid)) {
                    instancesMap.set(geometry.uuid, {
                        geometry: geometry,
                        material: crystalMat,
                        matrices: [],
                    })
                }

                mesh.castShadow = true
                mesh.receiveShadow = true
                const groupData = instancesMap.get(geometry.uuid)
                groupData?.matrices.push(mesh.matrixWorld.clone())
            }
        })

        if (instancesMap.size === 0) {
            console.error("FloatCrystal 모델에서 Mesh를 찾을 수 없습니다.")
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
            if (this.modelGroup) {
                this.modelGroup.add(instancedMesh)
            }
        })
    }

    public update(_deltaTime: number): void {
        // Static or simple animation
    }
}
