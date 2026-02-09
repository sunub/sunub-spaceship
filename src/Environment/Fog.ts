import type MathNode from "three/src/nodes/math/MathNode.js"
import type { ShaderNodeObject } from "three/tsl"
import { fog, mix, rangeFogFactor, uniform, vec2, viewportUV } from "three/tsl"
import type { Node, Vector2 } from "three/webgpu"
import { Color } from "three/webgpu"

import type { Scene } from "../core/Scene"

const NIGHT_FOG = {
    colorA: new Color("#10266f"),
    colorB: new Color("#490a42"),
    nearRatio: -0.85,
    farRatio: 1,
}

export class FixedNightFog {
    public colorA: UniformNode<Color>
    public colorB: UniformNode<Color>
    public radialCenter: UniformNode<Vector2>
    public radialStart: UniformNode<number>
    public radialEnd: UniformNode<number>

    public color: ShaderNodeObject<MathNode>
    public near: UniformNode<number>
    public far: UniformNode<number>
    public strength: ShaderNodeObject<Node>

    constructor(scene: Scene, nearDistance = 10, farDistance = 50) {
        this.colorA = uniform(NIGHT_FOG.colorA)
        this.colorB = uniform(NIGHT_FOG.colorB)
        this.radialCenter = uniform(vec2(0, 0))
        this.radialStart = uniform(0)
        this.radialEnd = uniform(1)

        // 방사형 믹스
        const colorMix = vec2(viewportUV.xy)
            .sub(this.radialCenter)
            .length()
            .smoothstep(this.radialStart, this.radialEnd)

        this.color = mix(this.colorA, this.colorB, colorMix)

        // Scene 배경으로 설정
        scene.backgroundNode = this.color

        // Fog 거리
        const amplitude = farDistance - nearDistance
        const fogNear = nearDistance + NIGHT_FOG.nearRatio * amplitude
        const fogFar = nearDistance + NIGHT_FOG.farRatio * amplitude

        this.near = uniform(fogNear)
        this.far = uniform(fogFar)
        this.strength = rangeFogFactor(this.near, this.far)

        scene.fogNode = fog(this.color, this.strength)
    }
}
