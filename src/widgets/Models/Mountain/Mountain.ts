import { texture } from "three/tsl"
import type { Mesh, Texture } from "three/webgpu"
import { Object3D } from "three/webgpu"
import type { GameContext } from "@/core/GameContext"
import { MeshDefaultMaterial } from "@/widgets/Materials/MeshDefaultMaterial"
import { BaseModel } from "../BaseModel"

export class Mountain extends BaseModel {
    constructor() {
        super("mountainModel")
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        this.modelGroup = new Object3D()
        this.modelGroup.name = `${this.modelName}Group`

        const mountainTexture = this.context.resources.items.mountainTexture as Texture

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

    async initialize(context: GameContext) {
        this.context = context
        await super.initialize(context)
    }

    public update(_: number) {}
}
