import { inject, injectable } from "inversify"
import { DoubleSide, Mesh, Object3D } from "three/webgpu"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { IResourceService } from "@/Services/IResouceService"
import type { ISceneManager } from "@/Services/ISceneManager"
import type Time from "@/utils/Time"
import { CloudMaterial } from "../Materials/CloudMaterial"
import { ResourceModel } from "./ResourceModel"

@injectable()
export class Atmosphere extends ResourceModel {
    private material: CloudMaterial | null = null

    constructor(
        @inject(GAME_CONTEXT.SERVICE.ResourceService)
        resourcesManager: IResourceService,
        @inject(GAME_CONTEXT.MANAGER.SceneManager) sceneManager: ISceneManager,
        @inject(GAME_CONTEXT.UTILITY.Time) private readonly time: Time,
    ) {
        super(resourcesManager, sceneManager, "atmosphereModel")
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        this.modelGroup = new Object3D()
        this.modelGroup.name = `${this.modelName}Group`
        this.mesh = clonedModel

        this.material = new CloudMaterial({
            side: DoubleSide,
        })

        if (this.material) {
            this.mesh.traverse((child) => {
                if (child instanceof Mesh) {
                    child.material = this.material as CloudMaterial
                    child.geometry.center()
                }
            })
        }
        this.mesh.scale.set(0.75, 0.75, 0.75)
        this.modelGroup.add(this.mesh)
    }

    public update(_deltaTime: number): void {
        if (this.modelGroup && this.time) {
            const elapsedTime = this.time.elapsed * 0.001 // ms to s
            this.modelGroup.rotation.y = elapsedTime * 0.05
            this.modelGroup.position.y =
                this.position.y + Math.sin(elapsedTime * 0.2) * 0.2

            if (this.material) {
                this.material.uTime = elapsedTime
            }
        }
    }

    dispose(): void {
        this.material?.dispose()
        super.dispose()
    }
}
