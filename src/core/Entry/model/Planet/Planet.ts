import type { Object3D } from "three"
import { uniform } from "three/tsl"
import { Mesh, Vector3 } from "three/webgpu"
import { BaseModel } from "@/widgets/Models"
import { PlanetMaterial } from "./PlanetMaterial"

export class Planet extends BaseModel {
    private uTime = uniform(0)
    private fresnelStrength = 100.5
    private material!: PlanetMaterial
    private scale: Vector3

    constructor(
        position: Vector3 = new Vector3(0, 0, 0),
        scale: Vector3 = new Vector3(1, 1, 1),
    ) {
        super("planet")
        this.position = position
        this.scale = scale
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        const mesh = clonedModel.children[0] as Mesh

        mesh.traverse((child) => {
            if (!(child instanceof Mesh)) {
                return
            }

            this.material = new PlanetMaterial({
                uTime: this.uTime,
                fresnelStrength: this.fresnelStrength,
            })
            child.material = this.material
            child.scale.set(this.scale.x, this.scale.y, this.scale.z)
        })

        mesh.position.copy(this.position)
        this.context?.scene.add(mesh)
    }

    public update(deltaTime: number): void {
        this.material.uTime.value += deltaTime * 0.001
        const time = this.material.uTime.value
        const speed = 5.0

        this.material.fresnelStrength.value = 75 + 25 * Math.sin(time * speed)
    }
}
