import { color as colorNode, mix, uniform, vec3, vec4 } from "three/tsl"
import { DoubleSide, MeshStandardNodeMaterial } from "three/webgpu"
import gridNode from "./Shader/gridNode"
import getGridUV from "./Shader/gridVertex"

interface GridMaterialOptions {
    gridDensity?: number
    gridThickness?: number
    color?: number
    backgroundColor?: number
}

export class GridMaterial extends MeshStandardNodeMaterial {
    private _uDensity: UniformNode<number>
    private _uThickness: UniformNode<number>

    constructor(options: GridMaterialOptions = {}) {
        super()
        const {
            gridDensity = 1.0,
            gridThickness = 0.01,
            color = 0xffffff,
            backgroundColor = 0x000000,
        } = options

        this._uDensity = uniform(gridDensity)
        this._uThickness = uniform(gridThickness)

        const worldUV = getGridUV()
        const gridPattern = gridNode(worldUV, this._uDensity, this._uThickness)

        const gridFactor = gridPattern.r
        const colorVec3 = vec3(colorNode(color))
        const bgVec3 = vec3(colorNode(backgroundColor))

        this.colorNode = vec4(mix(bgVec3, colorVec3, gridFactor), 1.0)
        this.roughness = 0.8 // 빛이 넓게 퍼지도록
        this.metalness = 0.2 // 약간의 반사광
        this.side = DoubleSide
    }

    get gridDensity(): number {
        return this._uDensity.value
    }
    set gridDensity(value: number) {
        this._uDensity.value = value
    }

    get gridThickness(): number {
        return this._uThickness.value
    }
    set gridThickness(value: number) {
        this._uThickness.value = value
    }
}
