import { Object3D } from "three"
import { Mesh, Vector3 } from "three/webgpu"
import { ResourceModel } from "@/Models"
import { inject } from "inversify"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { IResourceService } from "@/Services/IResouceService"
import type { ISceneManager } from "@/Services/ISceneManager"

export class AtmosphereCrystal extends ResourceModel {
    constructor(
        @inject(GAME_CONTEXT.SERVICE.ResourceService) resourcesManager: IResourceService,
        @inject(GAME_CONTEXT.MANAGER.SceneManager) sceneManager: ISceneManager,
        position: Vector3 = new Vector3(0, 0, 0),
        scale: Vector3 = new Vector3(1, 1, 1),
    ) {
        super(resourcesManager, sceneManager, "atmosphereCrystalLights", "", position, scale)
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        this.modelGroup = new Object3D()
        this.modelGroup.name = `${this.modelName}Group`

        const mesh = clonedModel.children[0] as Mesh
        this.mesh = mesh

        // Original had empty traverse, kept for structure if needed in future
        this.mesh.traverse((child) => {
            if (!(child instanceof Mesh)) {
                return
            }
        })

        this.modelGroup.add(this.mesh)
    }

    public update(_deltaTime: number): void {
        // this.material.uTime.value += deltaTime
    }
}
