import { color, float, texture } from "three/tsl"
import type { Mesh, MeshStandardMaterial } from "three/webgpu"
import { Object3D, Vector3 } from "three/webgpu"
import { MeshDefaultMaterial } from "../../Materials/MeshDefaultMaterial"
import { ResourceModel } from "../ResourceModel"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { IResourceService } from "@/Services/IResouceService"
import type { ISceneManager } from "@/Services/ISceneManager"
import { inject } from "inversify"

export class Github extends ResourceModel {
    constructor(
        @inject(GAME_CONTEXT.SERVICE.ResourceService) resoucesManager: IResourceService,
        @inject(GAME_CONTEXT.MANAGER.SceneManager) sceneManager: ISceneManager,
        position: Vector3 = new Vector3(0, 0, 0),
        scale: Vector3 = new Vector3(1, 1, 1),
    ) {
        super(resoucesManager, sceneManager, "githubModel", "", position, scale)
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        this.modelGroup = new Object3D()
        this.modelGroup.name = "GithubGroup"

        clonedModel.updateMatrixWorld(true)

        this.mesh = clonedModel
        clonedModel.traverse((child) => {
            if ((child as Mesh).isMesh) {
                const mesh = child as Mesh
                const material = mesh.material as MeshStandardMaterial

                const materialParams: any = {}
                const texNode = texture(material.map ?? undefined)
                if (material.color) {
                    materialParams.colorNode = texNode.mul(
                        color(material.color),
                    )
                } else {
                    materialParams.colorNode = texNode
                }
                if (material.map) {
                } else if (material.color) {
                    materialParams.colorNode = color(material.color)
                }

                if (material.transparent) {
                    materialParams.transparent = true
                    materialParams.alphaNode = float(material.opacity)
                }

                if (material.alphaTest > 0) {
                    materialParams.alphaTest = material.alphaTest
                }

                if (material.side !== undefined) {
                    materialParams.side = material.side
                }

                const defaultMaterial = new MeshDefaultMaterial(materialParams)
                mesh.material = defaultMaterial
                if (this.modelGroup) {
                    this.modelGroup.add(mesh)
                }
            }
        })
        this.modelGroup.add(this.mesh)
    }

    public update(_deltaTime: number): void {
        // Static or simple animation
    }
}
