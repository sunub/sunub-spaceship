import type { Object3D } from "three"
import { Color, Mesh, Vector3 } from "three/webgpu"
import { BaseModel } from "@/widgets/Models"
import { AtmosphereMaterial } from "../Atmosphere/AtmosphereMaterial"

export class AtmosphereLand extends BaseModel {
    private material!: AtmosphereMaterial
    private scale: Vector3

    constructor(
        position: Vector3 = new Vector3(0, 0, 0),
        scale: Vector3 = new Vector3(1, 1, 1),
    ) {
        super("atmosphereLand")
        this.position = position
        this.scale = scale
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        const mesh = clonedModel.children[0] as Mesh

        mesh.traverse((child) => {
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

        mesh.position.copy(this.position)
        mesh.scale.set(this.scale.x, this.scale.y, this.scale.z)
        this.context?.scene.add(mesh)
    }

    public update(_deltaTime: number): void {
        // this.material.uTime.value += deltaTime
    }
}
