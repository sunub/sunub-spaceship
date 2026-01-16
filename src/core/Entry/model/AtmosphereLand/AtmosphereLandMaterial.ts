import { Color, Vector3 } from "three"
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
import { MeshBasicNodeMaterial, type UniformNode } from "three/webgpu"

export interface LandMaterialProps {
    uLightPosition?: Vector3
    uDarkColor?: Color
    uLightColor?: Color
    uLightIntensity?: number
    uLightRadius?: number
}

export class AtmosphereLandMaterial extends MeshBasicNodeMaterial {
    // 외부에서 값을 수정할 수 있도록 public으로 선언
    public uLightPosition: UniformNode<Vector3>
    public uDarkColor: UniformNode<Color>
    public uLightColor: UniformNode<Color>
    public uLightIntensity: UniformNode<number>
    public uLightRadius: UniformNode<number>

    constructor({
        uLightPosition = new Vector3(0, 0, 0),
        uDarkColor = new Color("#07002d"),
        uLightColor = new Color("#bca29f"),
        uLightIntensity = 0.5, // GLSL의 기본값 유지
        uLightRadius = 4.45, // GLSL의 기본값 유지
    }: LandMaterialProps = {}) {
        super()

        // 1. Uniform 초기화 (매개변수로 받은 값을 TSL Uniform으로 변환)
        this.uLightPosition = uniform(uLightPosition)
        this.uDarkColor = uniform(uDarkColor)
        this.uLightColor = uniform(uLightColor)
        this.uLightIntensity = uniform(uLightIntensity)
        this.uLightRadius = uniform(uLightRadius)

        // 2. 내장 타이머 사용 (GPU 내부 시간)
        const uTime = uniform(0)

        // 3. 월드 좌표 보간 (Vertex -> Fragment)
        const vWorldPosition = varying(positionWorld)

        // 4. Fragment Shader 로직 구현
        this.outputNode = Fn(() => {
            // 거리 계산: distance = length(uLightPosition - vWorldPosition)
            const dist = length(vec3(this.uLightPosition).sub(vWorldPosition))

            // 감쇠 계산: attenuation = 1.0 - smoothstep(0.0, uLightRadius, distance)
            // float(1.0).sub(...)는 1.0에서 값을 뺀다는 의미 (oneMinus와 동일)
            const attenuation = float(1.0).sub(
                smoothstep(0.0, this.uLightRadius, dist),
            )

            // 시간 변동: timeVariation = sin(uTime * 0.5) * 0.1 + 0.9
            const timeVariation = sin(uTime.mul(0.5)).mul(0.1).add(0.9)

            // 최종 감쇠에 시간 변동 적용
            const finalAttenuation = attenuation.mul(timeVariation)

            // 색상 혼합: mix(uDarkColor, uLightColor, attenuation * uLightIntensity)
            const mixFactor = finalAttenuation.mul(this.uLightIntensity)
            const finalColor = mix(this.uDarkColor, this.uLightColor, mixFactor)

            return vec4(finalColor, 1.0)
        })()
    }
}
