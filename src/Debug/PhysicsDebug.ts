import type * as RAPIER from "@dimforge/rapier3d-compat"
import {
    BufferGeometry,
    Float32BufferAttribute,
    LineBasicMaterial,
    LineSegments,
} from "three/webgpu"

export class PhysicsDebug {
    private _world: RAPIER.World

    geometry: BufferGeometry
    material: LineBasicMaterial
    lineSegments: LineSegments

    constructor(physicWorld: RAPIER.World) {
        this._world = physicWorld

        this.geometry = new BufferGeometry()
        this.geometry.setAttribute(
            "position",
            new Float32BufferAttribute([], 3),
        )
        this.geometry.setAttribute("color", new Float32BufferAttribute([], 4))

        this.material = new LineBasicMaterial({ vertexColors: true })
        this.lineSegments = new LineSegments(this.geometry, this.material)
    }

    update() {
        const { vertices, colors } = this._world.debugRender()

        this.geometry.setAttribute(
            "position",
            new Float32BufferAttribute(vertices, 3),
        )
        this.geometry.attributes.position.needsUpdate = true

        this.geometry.setAttribute(
            "color",
            new Float32BufferAttribute(colors, 4),
        )
        this.geometry.attributes.color.needsUpdate = true
    }
}
