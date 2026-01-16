import {
    Fn,
    float,
    length,
    mix,
    positionWorld,
    sin,
    smoothstep,
    uniform,
    varying,
    vec3,
    vec4,
} from "three/tsl"
import {
    Color,
    MeshBasicNodeMaterial,
    type UniformNode,
    Vector3,
} from "three/webgpu"

export interface AtmosphereMaterialProps {
    uLightPosition?: Vector3
    uDarkColor?: Color
    uLightColor?: Color
    uLightIntensity?: number
    uLightRadius?: number
}

export class AtmosphereMaterial extends MeshBasicNodeMaterial {
    // 외부에서 접근하여 값을 수정할 수 있도록 public으로 선언
    public uLightPosition: UniformNode<Vector3>
    public uDarkColor: UniformNode<Color>
    public uLightColor: UniformNode<Color>
    public uLightIntensity: UniformNode<number>
    public uLightRadius: UniformNode<number>
    public uTime: UniformNode<number>

    constructor({
        uLightPosition = new Vector3(0, 0, 0),
        uDarkColor = new Color("#07002d"),
        uLightColor = new Color("#bca29f"),
        uLightIntensity = 0.5,
        uLightRadius = 2.0,
    }: AtmosphereMaterialProps = {}) {
        super()

        this.uLightPosition = uniform(uLightPosition)
        this.uDarkColor = uniform(uDarkColor)
        this.uLightColor = uniform(uLightColor)
        this.uLightIntensity = uniform(uLightIntensity)
        this.uLightRadius = uniform(uLightRadius)

        const vWorldPosition = varying(positionWorld)

        this.uTime = uniform(0)

        this.outputNode = Fn(() => {
            const dist = length(vec3(this.uLightPosition).sub(vWorldPosition))

            const attenuation = float(1.0).sub(
                smoothstep(0.0, this.uLightRadius, dist),
            )

            const timeVariation = sin(this.uTime.value * 0.5)
                .mul(0.1)
                .add(0.9)

            const finalAttenuation = attenuation.mul(timeVariation)

            const mixFactor = finalAttenuation.mul(this.uLightIntensity)
            const finalColor = mix(this.uDarkColor, this.uLightColor, mixFactor)
            return vec4(finalColor, 1.0)
        })()
    }
}
