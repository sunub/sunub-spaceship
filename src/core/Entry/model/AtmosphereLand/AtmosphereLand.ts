import { Object3D } from "three"
import { Color, Mesh, Vector3 } from "three/webgpu"
import { ResourceModel } from "@/Models"
import { AtmosphereMaterial } from "../Atmosphere/AtmosphereMaterial"
import { inject } from "inversify"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { IResourceService } from "@/Services/IResouceService"
import type { ISceneManager } from "@/Services/ISceneManager"

export class AtmosphereLand extends ResourceModel {
    private material!: AtmosphereMaterial

    constructor(
        @inject(GAME_CONTEXT.SERVICE.ResourceService) resourcesManager: IResourceService,
        @inject(GAME_CONTEXT.MANAGER.SceneManager) sceneManager: ISceneManager,
        position: Vector3 = new Vector3(0, 0, 0),
        scale: Vector3 = new Vector3(1, 1, 1),
    ) {
        super(resourcesManager, sceneManager, "atmosphereLand", "", position, scale)
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        this.modelGroup = new Object3D()
    this.modelGroup.name = `${this.modelName}Group`

        const mesh = clonedModel.children[0] as Mesh
        this.mesh = mesh

        this.mesh.traverse((child) => {
            if (!(child instanceof Mesh)) {
                return
            }

            this.material = new AtmosphereMaterial({
                uLightPosition: this.position,
                uDarkColor: new Color("#07002d"),
                uLightColor: new Color("#bca29f"),
                uLightIntensity: 2.5,
                uLightRadius: 3.5 * this.scale.x,
            })

            child.material = this.material
        })

        this.modelGroup.add(this.mesh)
    }

    public update(deltaTime: number): void {
        if (this.material) {
            this.material.uTime.value += deltaTime
        }
    }
}
