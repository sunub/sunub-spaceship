import {
    color,
    Fn,
    float,
    frontFacing,
    If,
    max,
    mix,
    normalWorld,
    type ShaderNodeObject,
    uniform,
    vec3,
    vec4,
} from "three/tsl"
import type { Node } from "three/webgpu"
import * as THREE from "three/webgpu"

export interface MeshDefaultMaterialParameters
    extends THREE.MeshLambertNodeMaterialParameters {
    hasCoreShadows?: boolean
    hasDropShadows?: boolean
    hasFog?: boolean

    // [추가] 지형 반사를 켜고 끌 옵션
    hasLightBounce?: boolean

    colorNode?: ShaderNodeObject<Node>
    normalNode?: ShaderNodeObject<Node>
    alphaNode?: ShaderNodeObject<Node>
    shadowNode?: ShaderNodeObject<Node>
    alphaTest?: number

    depthWrite?: boolean
    depthTest?: boolean
    side?: THREE.Side
    wireframe?: boolean
    transparent?: boolean
    shadowSide?: THREE.Side
}

export class MeshDefaultMaterial extends THREE.MeshLambertNodeMaterial {
    public hasCoreShadows: boolean
    public hasDropShadows: boolean
    public hasFog: boolean
    public hasLightBounce: boolean // 추가됨

    private _colorNode: ShaderNodeObject<Node>
    private _normalNode: ShaderNodeObject<Node>
    private _alphaNode: ShaderNodeObject<Node>
    private _shadowNode: ShaderNodeObject<Node>

    constructor(parameters: MeshDefaultMaterialParameters = {}) {
        super()

        this.depthWrite = parameters.depthWrite ?? true
        this.depthTest = parameters.depthTest ?? true
        this.side = parameters.side ?? THREE.FrontSide
        this.wireframe = parameters.wireframe ?? false
        this.transparent = parameters.transparent ?? false
        this.shadowSide = parameters.shadowSide ?? THREE.FrontSide

        this.hasCoreShadows = parameters.hasCoreShadows ?? true
        this.hasDropShadows = parameters.hasDropShadows ?? true
        this.hasFog = parameters.hasFog ?? true
        this.hasLightBounce = parameters.hasLightBounce ?? true // 기본값 True 추천

        this._colorNode = parameters.colorNode ?? color(0xffffff)
        this._normalNode = parameters.normalNode ?? normalWorld
        this._alphaNode = parameters.alphaNode ?? float(1)
        this._shadowNode = parameters.shadowNode ?? float(0)
        this.alphaTest = parameters.alphaTest ?? 0.1

        this.normalNode = this._normalNode

        // ---------------------------------------------------------------------------
        // Lighting Configuration
        // ---------------------------------------------------------------------------
        const lightingConfig = {
            direction: uniform(vec3(1, 1, 1).normalize()),
            color: uniform(color(0xffffff)),
            intensity: uniform(1.0),
            shadowColor: uniform(color(0x000000)),
            coreShadowEdgeHigh: uniform(0.1),
            coreShadowEdgeLow: uniform(0.5),

            // [Light Bounce 설정]
            // 지형 데이터를 직접 읽지 않고, 범용적인 바닥 색상과 반사 강도를 설정합니다.
            bounceColor: uniform(color(0x889988)), // 예: 약간의 풀색/흙색 느낌
            bounceIntensity: uniform(0.5), // 반사 강도
            bounceDirection: vec3(0, -1, 0), // 아래쪽 방향 (바닥)
        }

        const fogConfig = {
            color: uniform(color(0xeeeeee)),
            strength: uniform(0.0),
        }

        /**
         * Shadow catcher
         */
        const catchedShadow = float(1).toVar()

        if (this.hasDropShadows) {
            ;(this as any).receivedShadowNode = Fn(
                ([shadow]: [ShaderNodeObject<Node>]) => {
                    catchedShadow.mulAssign(shadow.r)
                    return float(1)
                },
            )
        }

        /**
         * Output node
         */
        this.outputNode = Fn(() => {
            const baseColor = this._colorNode.toVar()
            const outputColor = this._colorNode.toVar()

            // 1. Normal Orientation
            const reorientedNormal = this._normalNode.toVar()
            if (
                this.side === THREE.DoubleSide ||
                this.side === THREE.BackSide
            ) {
                If(frontFacing.not(), () => {
                    reorientedNormal.mulAssign(-1)
                })
            }

            // 2. Light Bounce (Simplified)
            // 지형 시스템 의존성을 제거하고, 노말 벡터를 기반으로 바닥 반사광을 계산합니다.
            if (this.hasLightBounce) {
                // 노말이 아래(-Y)를 향할수록 값이 커짐 (0 ~ 1)
                const bounceFactor = reorientedNormal
                    .dot(lightingConfig.bounceDirection)
                    .max(0)

                // 바닥 색상을 부드럽게 섞어줌
                const bounceMix = bounceFactor.mul(
                    lightingConfig.bounceIntensity,
                )
                outputColor.assign(
                    mix(outputColor, lightingConfig.bounceColor, bounceMix),
                )
            }

            // 3. Main Light
            outputColor.mulAssign(
                lightingConfig.color.mul(lightingConfig.intensity),
            )

            // 4. Core Shadow
            let coreShadowMix: ShaderNodeObject<Node> = float(0)
            if (this.hasCoreShadows) {
                coreShadowMix = reorientedNormal
                    .dot(lightingConfig.direction)
                    .smoothstep(
                        lightingConfig.coreShadowEdgeHigh,
                        lightingConfig.coreShadowEdgeLow,
                    )
            }

            // 5. Cast Shadow
            let dropShadowMix: ShaderNodeObject<Node> = float(0)
            if (this.hasDropShadows) {
                dropShadowMix = catchedShadow.oneMinus()
            }

            // 6. Combined Shadows
            if (this.hasCoreShadows || this.hasDropShadows) {
                const combinedShadowMix = max(
                    coreShadowMix,
                    dropShadowMix,
                    this._shadowNode,
                ).clamp(0, 1)
                const shadowColor = baseColor.rgb.mul(
                    lightingConfig.shadowColor,
                ).rgb
                outputColor.assign(
                    mix(outputColor, shadowColor, combinedShadowMix),
                )
            }

            // 7. Fog
            if (this.hasFog) {
                outputColor.assign(
                    mix(outputColor, fogConfig.color, fogConfig.strength),
                )
            }

            // 8. Alpha Test
            this._alphaNode.lessThan(this.alphaTest).discard()

            return vec4(outputColor, this._alphaNode)
        })()
    }
}
