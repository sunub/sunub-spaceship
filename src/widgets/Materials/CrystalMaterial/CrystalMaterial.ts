import {
    abs,
    add,
    cameraPosition,
    clamp,
    color as colorNode,
    dot,
    float,
    mix,
    mul,
    normalize,
    normalWorld,
    positionLocal,
    positionWorld,
    pow,
    smoothstep,
    sub,
    uniform,
    vec3,
} from "three/tsl"
import * as THREE from "three/webgpu"
import { MeshDefaultMaterial } from "../MeshDefaultMaterial"
import { fbm } from "./noiseNode"

interface CrystalMaterialOptions {
    color?: number // 크리스탈 기본 색상
    coreColor?: number // 내부 핵/에너지 색상
    rimColor?: number // 가장자리 빛나는 색상
    noiseScale?: number
    noiseStrength?: number
    flowSpeed?: number // 내부 에너지 흐름 속도
    baseOpacity?: number // 기본 투명도
}

export class CrystalMaterial extends MeshDefaultMaterial {
    public _uTime: UniformNode<number>
    public _uNoiseScale: UniformNode<number>
    public _uNoiseStrength: UniformNode<number>
    public _uFlowSpeed: UniformNode<number>

    constructor(options: CrystalMaterialOptions = {}) {
        const {
            color = 0x88ccff,
            coreColor = 0x00ffff,
            rimColor = 0xffffff,
            noiseScale = 1.5,
            noiseStrength = 0.8,
            flowSpeed = 0.2,
            baseOpacity = 0.15,
        } = options

        // Uniform 생성
        const uTime = uniform(0)
        const uNoiseScale = uniform(noiseScale)
        const uNoiseStrength = uniform(noiseStrength)
        const uFlowSpeed = uniform(flowSpeed)

        const viewDirWorld = normalize(sub(cameraPosition, positionWorld))
        const parallaxDepth = float(1.5) // 내부 깊이 계수

        const noiseCoord = add(
            mul(positionLocal, uNoiseScale),
            add(
                mul(viewDirWorld, parallaxDepth),
                vec3(0, mul(uTime, uFlowSpeed), 0),
            ),
        )

        const noiseVal = fbm(noiseCoord)
        const density = smoothstep(0.3, 0.8, noiseVal)

        const baseColorVec = vec3(colorNode(color))
        const coreColorVec = vec3(colorNode(coreColor))
        const finalColor = mix(baseColorVec, coreColorVec, density)

        const viewDir = normalize(sub(cameraPosition, positionWorld))
        const N = normalize(normalWorld)

        const fresnelTerm = pow(sub(1.0, abs(dot(N, viewDir))), 3.0)
        const rimColorVec = vec3(colorNode(rimColor))
        const rimLight = mul(rimColorVec, fresnelTerm) // 가장자리 빛

        const innerGlow = mul(coreColorVec, mul(density, uNoiseStrength))
        const finalEmission = add(rimLight, innerGlow)

        const cloudAlpha = mul(density, 0.8)
        const rimAlpha = mul(fresnelTerm, 0.2)
        const finalAlpha = clamp(
            add(float(baseOpacity), add(cloudAlpha, rimAlpha)),
            0.0,
            1.0,
        )

        super({
            colorNode: finalColor as any, // 기본 색상 (라이팅 영향 받음)
            emissionNode: finalEmission, // 발광 (어두운 곳에서도 보임)
            normalNode: normalWorld, // (선택사항) 노이즈로 노멀을 왜곡하여 울퉁불퉁하게 만들 수도 있음
            alphaNode: finalAlpha,

            // 기존 MeshDefaultMaterial의 속성들 유지
            hasCoreShadows: true,
            hasDropShadows: true, // 크리스탈도 그림자는 받아야 함
            hasFog: true,
            hasReveal: true, // 게임의 Reveal 효과 자동 적용

            // 크리스탈 설정
            transparent: false, // Lambert 기반이므로 투명보다는 불투명+발광이 더 예쁨
            side: THREE.DoubleSide, // 뒷면도 그려야 내부가 꽉 찬 느낌
        })

        this._uTime = uTime
        this._uNoiseScale = uNoiseScale
        this._uNoiseStrength = uNoiseStrength
        this._uFlowSpeed = uFlowSpeed
    }

    public setTime(time: number) {
        this._uTime.value = time
    }
}
