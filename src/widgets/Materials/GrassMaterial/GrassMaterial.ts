import { Fn, float, uniform } from "three/tsl"
import * as THREE from "three/webgpu"

import { MeshDefaultMaterial } from "../MeshDefaultMaterial"
import grassFragment from "./Shader/grassFragment"
import grassVertex from "./Shader/grassVertex"

export interface GrassMaterialOptions {
    segments?: number
    patchSize?: number
    width?: number
    height?: number
    interactionRadius?: number
}

export class GrassMaterial extends MeshDefaultMaterial {
    private _grassParams: any
    private _time: any
    private _uPlayerPosition: any
    private _uInteractionRadius: any

    constructor(options: GrassMaterialOptions = {}) {
        const {
            segments = 5,
            patchSize = 1.0,
            width = 0.1,
            height = 1.0,
            interactionRadius = 3.0,
        } = options

        const grassParams = uniform(
            new THREE.Vector4(segments, patchSize, width, height),
        )
        const time = uniform(0)
        const uPlayerPosition = uniform(new THREE.Vector3(0, -100, 0))
        const uInteractionRadius = uniform(interactionRadius)

        const { positionNode, vNormal, vColor, vGrassData } = grassVertex(
            grassParams,
            time,
            uPlayerPosition,
            uInteractionRadius,
        )

        const colorNode = grassFragment(vColor, vGrassData)

        super({
            colorNode,
            normalNode: vNormal,
            side: THREE.DoubleSide,
            hasLightBounce: false,
            hasCoreShadows: false,
            hasDropShadows: false,
            hasFog: true,
        })

        this._grassParams = grassParams
        this._time = time
        this._uPlayerPosition = uPlayerPosition
        this._uInteractionRadius = uInteractionRadius

        this.vertexNode = positionNode
        this.alphaTest = 0.5

        // 1. Shadow Catching (MeshDefaultMaterial의 로직을 재구현)
        const catchedShadow = float(1).toVar()
        this.receivedShadowNode = Fn(([shadow]: [any]) => {
            catchedShadow.mulAssign(shadow.r)
            return float(1)
        }) as any

        // 2. Output Node Override
        // 반짝임(Glare) 없는 부드러운 Lambertian 조명을 적용합니다.
        // this.outputNode = Fn(() => {
        //   const baseColor = colorNode.toVar() // Fragment Shader에서 온 기본 색상
        //   if(!this.normalNode) {
        //     return
        //   }

        //   const normal = this.normalNode.toVar()

        //   // BackSide(뒷면)일 경우 Normal 뒤집기 (DoubleSide 대응)
        //   // 풀잎은 양면이므로 필수
        //   const reorientedNormal = normal.toVar()
        //   If(frontFacing.not(), () => {
        //     reorientedNormal.mulAssign(-1)
        //   })

        //   const game = Game.getInstance()

        //   // --- Distance Calculation ---
        //   // vWorldPosition을 사용하여 카메라 거리를 계산 (Flattening 및 Fading에 공통 사용)
        //   const viewDist = distance(cameraPosition, vWorldPosition)

        //   // --- Normal Flattening (Anti-Sparkle) ---
        //   // 거리가 멀어질수록 풀의 Normal을 지면 Normal(0, 1, 0)과 섞어 평평하게 만듭니다.
        //   // 이렇게 하면 바람에 의한 Normal 변화가 줄어들어 원거리 반짝임(Sparkling/Aliasing)이 사라집니다.
        //   const flattenStart = float(0.0)
        //   const flattenEnd = float(100.0)
        //   const flattenFactor = smoothstep(flattenStart, flattenEnd, viewDist)

        //   const flatNormal = mix(reorientedNormal, vec3(0.0, 1.0, 0.0), flattenFactor)
        //   const finalNormal = normalize(flatNormal)

        //   // Lambertian Diffuse (N dot L)
        //   // 빛의 입사각에 따른 부드러운 밝기 변화 (가장 중요: smoothstep 대신 선형 내적 사용)
        //   const lightDir = game.lighting.directionUniform
        //   const NdotL = max(0.0, dot(finalNormal, lightDir.negate()))

        //   // Direct Light (Directional)
        //   const lightColor = game.lighting.colorUniform
        //   const lightIntensity = game.lighting.intensityUniform

        //   // 빛을 너무 강하게 받지 않도록 최대 밝기 제한 (선택 사항, 필요시 조절)
        //   // const diffuse = mul(lightColor, lightIntensity, NdotL)
        //   // 여기서는 그냥 정석대로 계산
        //   const lighting = mul(lightColor, lightIntensity, NdotL)

        //   // Shadows
        //   // catchedShadow: 1.0 = Lit, 0.0 = Shadowed
        //   // 그림자 영역은 Lighting Color 대신 Shadow Color를 사용
        //   const shadowMix = catchedShadow.oneMinus() // 1.0 if shadow

        //   // Shadow Color (Game.lighting에서 가져오기)
        //   // MeshDefaultMaterial은 baseColor * shadowColorUniform 방식을 씀
        //   const shadowColorResult = mul(baseColor.rgb, game.lighting.shadowColor)

        //   // Lit Color = BaseColor * Lighting
        //   const litColorResult = mul(baseColor.rgb, lighting)

        //   // 최종 믹스
        //   // Shadow 영역이면 shadowColorResult, Light 영역이면 litColorResult
        //   // 하지만 PBR이 아니므로, 단순히 빛을 곱하는 방식보다는
        //   // 빛을 받은 색상(Lit)과 그림자 색상(Shadow)을 믹스하는 것이 자연스러움

        //   // 간단한 버전: BaseColor * (Lighting * ShadowFactor)
        //   // 하지만 이러면 그림자 부분이 완전 검정이 될 수 있음.
        //   // MeshDefaultMaterial의 스타일을 유지하며 부드럽게:

        //   const finalLitColor = mix(litColorResult, shadowColorResult, shadowMix)

        //   // Ambient 효과 추가 (너무 어두운 곳 방지)
        //   // 게임에 별도 Ambient 설정이 안보이므로, 최소 밝기 보정
        //   const ambient = float(0.1)
        //   let finalColor = max(finalLitColor, mul(baseColor.rgb, ambient))

        //   // --- Distance Fading (Fog-like effect) ---
        //   // 원거리에서 풀이 "전구"처럼 빛나는 현상 방지

        //   // 감쇠 시작 거리(100)와 완전히 어두워지는 거리(500) 설정
        //   // 필요에 따라 이 값들을 튜닝하거나 Uniform으로 뺄 수 있습니다.
        //   const fadeStart = float(100.0)
        //   const fadeEnd = float(500.0)

        //   const fadeFactor = smoothstep(fadeStart, fadeEnd, viewDist)

        //   // 거리가 멀어질수록 검정색(어둠)과 믹스하여 밝기를 줄임
        //   // 만약 씬에 안개색이 있다면 vec3(0.0) 대신 안개색 사용 가능
        //   finalColor = mix(finalColor, vec3(0.0), fadeFactor)

        //   return vec4(finalColor, this._alphaNode)
        // })()
    }

    // Accessors for TweakPane or updates
    get time() {
        return this._time.value
    }
    set time(v: number) {
        this._time.value = v
    }

    get playerPosition() {
        return this._uPlayerPosition.value
    }
    set playerPosition(v: THREE.Vector3) {
        this._uPlayerPosition.value.copy(v)
    }

    get interactionRadius() {
        return this._uInteractionRadius.value
    }
    set interactionRadius(v: number) {
        this._uInteractionRadius.value = v
    }

    // Helper to update specific grass params
    setGrassParams(
        segments: number,
        patchSize: number,
        width: number,
        height: number,
    ) {
        this._grassParams.value.set(segments, patchSize, width, height)
    }
}
