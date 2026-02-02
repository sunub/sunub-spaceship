import { color, float, texture } from "three/tsl"
import type {
    Mesh,
    MeshStandardMaterial,
} from "three/webgpu"
import { Object3D, Vector3 } from "three/webgpu"
import { MeshDefaultMaterial } from "../../Materials/MeshDefaultMaterial"
import { BaseModel } from "../BaseModel"

export class Github extends BaseModel {
    constructor(position: Vector3 = new Vector3(0, 0, 0)) {
        super("githubModel", position)
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
                if(this.modelGroup) {
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
