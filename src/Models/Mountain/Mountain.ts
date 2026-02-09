import { texture } from "three/tsl"
import type { Mesh } from "three/webgpu"
import { Object3D } from "three/webgpu"
import { inject, injectable } from "inversify"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import { MeshDefaultMaterial } from "@/Materials/MeshDefaultMaterial"
import { ResourceModel } from "../ResourceModel"
import type { IResourceService } from "@/Services/IResouceService"
import type { ISceneManager } from "@/Services/ISceneManager"

@injectable()
export class Mountain extends ResourceModel {
    constructor(
        @inject(GAME_CONTEXT.SERVICE.ResourceService) resourcesManager: IResourceService,
        @inject(GAME_CONTEXT.MANAGER.SceneManager) sceneManager: ISceneManager,
    ) {
        super(resourcesManager, sceneManager, "mountainModel", "mountainTexture")
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        this.modelGroup = new Object3D()
        this.modelGroup.name = `${this.modelName}Group`

        const mountainTexture = this.loadTexture()
        if (!mountainTexture) return;

        this.mesh = clonedModel
        this.mesh.traverse((child) => {
            if ((child as Mesh).isMesh) {
                const mesh = child as Mesh

                const newMat = new MeshDefaultMaterial({
                    colorNode: texture(mountainTexture),
                    hasFog: true,
                })

                mesh.material = newMat
                mesh.castShadow = true
                mesh.receiveShadow = true
                mesh.frustumCulled = false
            }
        })

        this.modelGroup.add(this.mesh)
    }

    public update(_: number) {}
}
