import { Object3D } from "three"
import { uniform } from "three/tsl"
import { Mesh, Vector3 } from "three/webgpu"
import { PlanetMaterial } from "./PlanetMaterial"
import { ResourceModel } from "@/Models"
import type { IResourceService } from "@/Services/IResouceService"
import type { ISceneManager } from "@/Services/ISceneManager"

export class Planet extends ResourceModel {
    private uTime = uniform(0)
    private fresnelStrength = uniform(100.5)
    private materials: PlanetMaterial[] = []

    constructor(
        resoucesManager: IResourceService,
        sceneManager: ISceneManager,
        position: Vector3 = new Vector3(0, 0, 0),
        scale: Vector3 = new Vector3(1, 1, 1),
    ) {
        super(resoucesManager, sceneManager, "planet", "", position, scale)
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        this.modelGroup = new Object3D()
        this.modelGroup.name = `${this.modelName}Group`
        this.mesh = clonedModel
        this.materials = []

        this.mesh.traverse((child) => {
            if (!(child instanceof Mesh)) {
                return
            }

            const material = new PlanetMaterial({
                uTime: this.uTime,
                fresnelStrength: this.fresnelStrength,
            })
            child.material = material
            this.materials.push(material)

            child.castShadow = true
            child.receiveShadow = true
        })

        this.modelGroup.add(this.mesh)
    }

    public update(delta: number): void {
        this.uTime.value += delta
        const time = this.uTime.value
        const speed = 4.5

        this.fresnelStrength.value = 75 + 25 * Math.sin(time * speed)
    }
}
