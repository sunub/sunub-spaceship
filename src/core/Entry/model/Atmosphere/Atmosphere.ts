import { Object3D } from "three/webgpu"
import { Color, DoubleSide, Mesh, Vector3 } from "three/webgpu"
import { ResourceModel } from "@/Models"
import { AtmosphereMaterial } from "./AtmosphereMaterial"
import { inject } from "inversify"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { IResourceService } from "@/Services/IResouceService"
import type { ISceneManager } from "@/Services/ISceneManager"

export class Atmosphere extends ResourceModel {
    private material!: AtmosphereMaterial

    constructor(
        @inject(GAME_CONTEXT.SERVICE.ResourceService) resourcesManager: IResourceService,
        @inject(GAME_CONTEXT.MANAGER.SceneManager) sceneManager: ISceneManager,
        position: Vector3 = new Vector3(0, 0, 0),
        scale: Vector3 = new Vector3(1, 1, 1),
    ) {
        super(resourcesManager, sceneManager, "atmosphere", "", position, scale)
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        this.modelGroup = new Object3D()
        this.modelGroup.name = `${this.modelName}Group`
        this.mesh = clonedModel

        this.mesh.traverse((child) => {
            if (!(child instanceof Mesh)) {
                return
            }

            this.material = new AtmosphereMaterial({
                uLightPosition: this.position,
                uDarkColor: new Color("#07002d"),
                uLightColor: new Color("#bca29f"),
                uLightIntensity: 0.5,
                uLightRadius: 2.0 * this.scale.x,
            })
            child.material = this.material
            child.material.side = DoubleSide
        })

        this.modelGroup.add(this.mesh)
    }

    public update(deltaTime: number): void {
        if (this.modelGroup) {
            this.modelGroup.rotation.y += deltaTime * 0.05
            if (this.material) {
                this.material.uTime.value += deltaTime
                const time = this.material.uTime.value

                const floatOffset = Math.sin(time * 0.2) * 0.1
                this.modelGroup.position.y = this.position.y + floatOffset
            }
        }
    }
}
