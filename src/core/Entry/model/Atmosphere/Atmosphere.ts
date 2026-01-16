import type { Object3D } from "three/webgpu"
import { Color, DoubleSide, Mesh, Vector3 } from "three/webgpu"
import { BaseModel } from "@/widgets/Models"
import { AtmosphereMaterial } from "./AtmosphereMaterial"

export class Atmosphere extends BaseModel {
    private material!: AtmosphereMaterial
    private scale: Vector3

    constructor(
        position: Vector3 = new Vector3(0, 0, 0),
        scale: Vector3 = new Vector3(1, 1, 1),
    ) {
        super("atmosphere", position)
        this.scale = scale
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        this.mesh = clonedModel.children[0] as Mesh

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

        this.mesh.position.copy(this.position)
        this.mesh.scale.set(this.scale.x, this.scale.y, this.scale.z)
        this.context?.scene.add(this.mesh)
    }

    public update(deltaTime: number) {
        if (this.mesh) {
            const elapsedTime = deltaTime * 0.001 // ms to s
            this.mesh.rotation.y += elapsedTime * 0.05
            const floatOffset = Math.sin(elapsedTime * 0.2) * 0.2
            this.mesh.position.y = this.position.y + floatOffset

            // Material uTime 업데이트
            if (this.material) {
                this.material.uTime.value = elapsedTime
            }
        }
    }
}
