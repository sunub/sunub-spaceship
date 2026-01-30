import { color } from "three/tsl"
import { BoxGeometry, Mesh, type Vector3 } from "three/webgpu"
import { MeshDefaultMaterial } from "@/widgets/Materials/MeshDefaultMaterial"

export function Box() {}

Box.initialize = Box_initialize

function Box_initialize(position: Vector3, colorInput: string | number) {
    const geometry = new BoxGeometry(1.5, 1.5, 1.5)

    // * Material의 _colorNode(기본색)는 0xffffff(흰색) 또는 0x808080(회색)으로 설정하세요.

    // Use TSL color() utility directly. It handles hex strings (including #) and numbers.
    const material = new MeshDefaultMaterial({
        colorNode: color(colorInput as any),
    })

    const mesh = new Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.position.copy(position)
    return mesh
}
