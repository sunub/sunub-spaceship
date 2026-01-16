import type { Object3D } from "three"
import { Mesh, Vector3 } from "three/webgpu"
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
        const mesh = clonedModel.children[0] as Mesh

        mesh.traverse((child) => {
            if (!(child instanceof Mesh)) {
                return
            }
        })

        mesh.position.copy(this.position)
        mesh.scale.set(this.scale.x, this.scale.y, this.scale.z)
        this.context?.scene.add(mesh)
    }

    public update(_deltaTime: number): void {
        // this.material.uTime.value += deltaTime
    }
}
