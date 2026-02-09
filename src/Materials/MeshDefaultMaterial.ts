import type OperatorNode from "three/src/nodes/math/OperatorNode.js"
import {
    color,
    Fn,
    float,
    frontFacing,
    If,
    max,
    mix,
    normalWorld,
    positionWorld,
    type ShaderNodeObject,
    vec3,
    vec4,
} from "three/tsl"
import type { Node, Side, TextureNode } from "three/webgpu"
import {
    BackSide,
    type Color,
    type ConstNode,
    DoubleSide,
    FrontSide,
    MeshLambertNodeMaterial,
} from "three/webgpu"
import type { Floor } from "../Models";
import type { Lighting } from "../core/Lighting";
import type { FixedNightFog } from "../Environment/Fog";

interface MeshDefaultMaterialContext {
    lighting: Lighting;
    terrian: Floor;
    fog: FixedNightFog;
}

interface MeshDefaultMaterialParameters {
    colorNode?:
        | ShaderNodeObject<TextureNode>
        | ShaderNodeObject<ConstNode<Color>>
        | ShaderNodeObject<OperatorNode>
    normalNode?: ShaderNodeObject<Node>
    alphaNode?: ShaderNodeObject<Node>
    shadowNode?: ShaderNodeObject<Node>
    emissionNode?: ShaderNodeObject<Node>
    hasCoreShadows?: boolean
    hasDropShadows?: boolean
    hasLightBounce?: boolean
    hasFog?: boolean
    hasWater?: boolean
    hasReveal?: boolean

    depthWrite?: boolean
    depthTest?: boolean
    side?: Side
    wireframe?: boolean
    transparent?: boolean
    shadowSide?: Side
    alphaTest?: number // [Fix] 인터페이스 속성 추가
}

export class MeshDefaultMaterial extends MeshLambertNodeMaterial {
    static revealDiscardNodeBuilder = (
        game: any,
        outputColor: ShaderNodeObject<Node>,
    ) => {
        return Fn(([col]: [ShaderNodeObject<Node>]) => {
            const distanceToCenter = positionWorld.xz
            .sub(game.reveal.position2Uniform)
            .length()
            distanceToCenter.greaterThan(game.reveal.distance).discard()

            const revealMix = distanceToCenter.step(
                game.reveal.distance.sub(game.reveal.thickness),
            )
            const revealColor = game.reveal.color.mul(game.reveal.intensity)
            return mix(col.rgb, revealColor, revealMix)
        })(outputColor)
    }


    private _colorNode: ShaderNodeObject<Node>
    private _normalNode: ShaderNodeObject<Node>
    private _alphaNode: ShaderNodeObject<Node>
    private _shadowNode: ShaderNodeObject<Node>
    private _emissionNode: ShaderNodeObject<Node>

    public hasCoreShadows: boolean
    public hasDropShadows: boolean
    public hasLightBounce: boolean
    public hasFog: boolean
    public hasWater: boolean
    public hasReveal: boolean

    private static context: MeshDefaultMaterialContext

    public static setup(context: MeshDefaultMaterialContext) {
        MeshDefaultMaterial.context = context;
    }

    constructor(parameters: MeshDefaultMaterialParameters = {}) {
        super()
        const context = MeshDefaultMaterial.context;
        if(!context) {
            throw new Error('MeshDefaultMaterial.setup() must be called first!');
        }

        this.depthWrite = parameters.depthWrite ?? true
        this.depthTest = parameters.depthTest ?? true
        this.side = parameters.side ?? FrontSide
        this.wireframe = parameters.wireframe ?? false
        this.transparent = parameters.transparent ?? false
        this.shadowSide = parameters.shadowSide ?? FrontSide

        this.hasCoreShadows = parameters.hasCoreShadows ?? true
        this.hasDropShadows = parameters.hasDropShadows ?? true
        this.hasLightBounce = parameters.hasLightBounce ?? true
        this.hasFog = parameters.hasFog ?? true
        this.hasWater = parameters.hasWater ?? true
        this.hasReveal = parameters.hasReveal ?? true

        // [Fix] 파라미터 할당 시 타입 단언 또는 호환 타입 사용
        this._colorNode =
            (parameters.colorNode as ShaderNodeObject<Node>) ?? color(0xffffff)
        this._normalNode = parameters.normalNode ?? normalWorld
        this._alphaNode = parameters.alphaNode ?? float(1)
        this._shadowNode = parameters.shadowNode ?? float(0)
        this._emissionNode = parameters.emissionNode ?? vec3(0)
        this.alphaTest = parameters.alphaTest ?? 0.1

        this.normalNode = this._normalNode

        /**
         * Shadow catcher
         * Catch shadow as a float and remove it from initial pipeline
         */
        const catchedShadow = float(1).toVar()

        if (this.hasDropShadows) {
            // [Fix] 타입 정의 상 receivedShadowNode가 인자를 받지 않는 것으로 되어 있으나,
            // 실제 TSL 런타임에서는 shadow 인자를 전달받으므로 any로 캐스팅하여 에러 우회
            this.receivedShadowNode = Fn(
                ([shadow]: [ShaderNodeObject<Node>]) => {
                    catchedShadow.mulAssign(shadow.r)
                    return float(1)
                },
            ) as any
        }

        /**
         * Output node
         */
        this.outputNode = Fn(() => {
            const baseColor = this._colorNode.toVar()
            const outputColor = this._colorNode.toVar()

            // Normal orientation
            const reorientedNormal = this._normalNode.toVar()
            if (this.side === DoubleSide || this.side === BackSide) {
                If(frontFacing.not(), () => {
                    reorientedNormal.mulAssign(-1)
                })
            }

            if (this.hasLightBounce && context.terrian) {
                const bounceOrientation = reorientedNormal
                    .dot(vec3(0, -1, 0))
                    .smoothstep(
                        context.lighting.lightBounceEdgeLow,
                        context.lighting.lightBounceEdgeHigh,
                    )
                const bounceDistance = context.lighting.lightBounceDistance
                    .sub(max(0, positionWorld.y))
                    .div(context.lighting.lightBounceDistance)
                    .max(0)
                    .pow(2)

                const bounceColor = context.lighting.bounceColor
                outputColor.assign(
                    mix(
                        outputColor,
                        bounceColor,
                        bounceOrientation
                            .mul(bounceDistance)
                            .mul(context.lighting.lightBounceMultiplier),
                    ),
                )
            }

            // Light
            if (context.lighting) {
                outputColor.mulAssign(
                    context.lighting.colorUniform.mul(
                        context.lighting.intensityUniform,
                    ),
                )
            }

            // Core shadow
            let coreShadowMix: ShaderNodeObject<Node> = float(0)
            if (this.hasCoreShadows && context.lighting)
                coreShadowMix = reorientedNormal
                    .dot(context.lighting.directionUniform)
                    .smoothstep(
                        context.lighting.coreShadowEdgeHigh,
                        context.lighting.coreShadowEdgeLow,
                    )

            // Cast shadow
            let dropShadowMix: ShaderNodeObject<Node> = float(0)
            if (this.hasDropShadows) dropShadowMix = catchedShadow.oneMinus()

            // Combined shadows
            if ((this.hasCoreShadows || this.hasDropShadows) && context.lighting) {
                const combinedShadowMix = max(
                    coreShadowMix,
                    dropShadowMix,
                    this._shadowNode,
                ).clamp(0, 1)

                const shadowColor = baseColor.rgb.mul(
                    context.lighting.shadowColor,
                ).rgb
                outputColor.assign(
                    mix(outputColor, shadowColor, combinedShadowMix),
                )
            }

            // Emission
            outputColor.addAssign(this._emissionNode)

            // Alpha test discard
            this._alphaNode.lessThan(this.alphaTest).discard()
            // Fog
            if (this.hasFog && context.fog) {
                outputColor.assign(
                    context.fog.strength.mix(outputColor, context.fog.color),
                )
            }

            // Output
            return vec4(outputColor.rgb, this._alphaNode)
        })()
    }
}
