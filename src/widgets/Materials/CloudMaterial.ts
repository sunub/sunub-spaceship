import type { Side } from "three/webgpu"
import { Color, FrontSide, ShaderMaterial, Vector3 } from "three/webgpu"
import { fragmentShader, vertexShader } from "../Shader/CloudShader"

interface CloudMaterialOptions {
    side?: Side
    uLightPosition?: Vector3
    uDarkColor?: Color
    uLightColor?: Color
    uLightIntensity?: number
    uLightRadius?: number
}

export class CloudMaterial extends ShaderMaterial {
    constructor({
        side = FrontSide,
        uLightPosition = new Vector3(0, 0, 0),
        uDarkColor = new Color("#07002d"),
        uLightColor = new Color("#bca29f"),
        uLightIntensity = 1.5,
        uLightRadius = 5.0,
    }: CloudMaterialOptions = {}) {
        super({
            uniforms: {
                uTime: { value: 0 },
                uLightPosition: { value: uLightPosition },
                uDarkColor: { value: uDarkColor },
                uLightColor: { value: uLightColor },
                uLightIntensity: { value: uLightIntensity },
                uLightRadius: { value: uLightRadius },
            },
            vertexShader,
            fragmentShader,
            side,
            transparent: true, // For clouds, transparency is often needed
        })
    }

    get uTime(): number {
        return this.uniforms.uTime.value
    }

    set uTime(value: number) {
        this.uniforms.uTime.value = value
    }
}
