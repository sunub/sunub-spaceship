import { uniform, vec3 } from "three/tsl"
import { MeshBasicNodeMaterial } from "three/webgpu"
import type { Color } from "three/webgpu"

interface PluseMaterialOptions {
    color: number | string | Color
    opacity?: number
    intensitiy?: number
}

export class PluseMaterial extends MeshBasicNodeMaterial {
    public uBorderColor: UniformNode<number | string | Color> =
        uniform(0xffffff)
    public uBorderOpacity: UniformNode<number> = uniform(1.0)
    public uBorderIntensity: UniformNode<number> = uniform(1.0)

    constructor({ color, opacity, intensitiy }: PluseMaterialOptions) {
        super()
        this.uBorderColor = uniform(color)
        this.uBorderOpacity = uniform(opacity ?? 1.0)
        this.uBorderIntensity = uniform(intensitiy ?? 1.0)

        this.transparent = true
        this.depthWrite = false
        this.depthTest = false
        this.colorNode = vec3(this.uBorderColor).mul(this.uBorderIntensity)
        this.opacityNode = this.uBorderOpacity
    }
}
