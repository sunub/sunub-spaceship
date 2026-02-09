import { color } from "three/tsl"
import { Mesh, SphereGeometry, type Vector3 } from "three/webgpu"
import { MeshDefaultMaterial } from "../../Materials/MeshDefaultMaterial"

export function Balls() {}

Balls.initialize = Balls_initialize

export function Balls_initialize(
    position: Vector3,
    colorInput: string | number,
) {
    const geometry = new SphereGeometry(1, 64, 64)

    const material = new MeshDefaultMaterial({
        colorNode: color(colorInput as any),
    })

    const mesh = new Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.position.copy(position)
    return mesh
}
