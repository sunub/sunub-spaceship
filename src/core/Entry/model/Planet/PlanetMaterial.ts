import {
    cameraPosition,
    dot,
    Fn,
    float,
    fract,
    max,
    mix,
    nodeObject,
    normalize,
    normalWorld,
    positionWorld,
    pow,
    type ShaderNodeObject,
    sin,
    smoothstep,
    uniform,
    uv,
    varying,
    vec2,
    vec4,
} from "three/tsl"
import {
    MeshBasicNodeMaterial,
    Vector2,
    Vector3,
    Node,
} from "three/webgpu"
import type { UniformNode } from "three/webgpu"

interface PlanetMaterialProps {
    uTime?: Node | number
    fresnelStrength?: Node | number
    uColorStop1?: Vector2
    uColorStop2?: Vector2
    uColor1?: Vector3
    uColor2?: Vector3
    uEmissionColor?: Vector3
    uEmissionStrength?: Node | number
    opacityNode?: ShaderNodeObject<Node>
}

export class PlanetMaterial extends MeshBasicNodeMaterial {
    public uTime: ShaderNodeObject<UniformNode<number>>
    public uColorStop1: ShaderNodeObject<UniformNode<Vector2>>
    public uColorStop2: ShaderNodeObject<UniformNode<Vector2>>
    public uColor1: ShaderNodeObject<UniformNode<Vector3>>
    public uColor2: ShaderNodeObject<UniformNode<Vector3>>
    public uEmissionColor: ShaderNodeObject<UniformNode<Vector3>>
    public uEmissionStrength: ShaderNodeObject<UniformNode<number>>
    public fresnelStrength: ShaderNodeObject<UniformNode<number>>
    public opacityNode: ShaderNodeObject<Node>

    public vUv: ShaderNodeObject<Node>
    public vPosition: ShaderNodeObject<Node>
    public vNormal: ShaderNodeObject<Node>

    constructor(props: PlanetMaterialProps) {
        super()

        const {
            uTime = uniform(0),
            fresnelStrength = 1.5,
            uColorStop1 = new Vector2(0.2, 0.8),
            uColorStop2 = new Vector2(0.3, 0.7),
            uColor1 = new Vector3(1, 0.5, 0),
            uColor2 = new Vector3(0, 0, 1),
            uEmissionColor = new Vector3(0, 0, 1),
            uEmissionStrength = 3.5,
            opacityNode = float(1.0),
        } = props

        // If it's already a node, use nodeObject to wrap it, otherwise create a new uniform
        this.uTime = (uTime instanceof Node ? nodeObject(uTime) : uniform(uTime)) as any
        this.fresnelStrength = (fresnelStrength instanceof Node ? nodeObject(fresnelStrength) : uniform(fresnelStrength)) as any

        this.uColorStop1 = uniform(uColorStop1)
        this.uColorStop2 = uniform(uColorStop2)
        this.uColor1 = uniform(uColor1)
        this.uColor2 = uniform(uColor2)
        this.uEmissionColor = uniform(uEmissionColor)
        this.uEmissionStrength = (uEmissionStrength instanceof Node ? nodeObject(uEmissionStrength) : uniform(uEmissionStrength)) as any

        this.opacityNode = opacityNode

        this.vUv = varying(uv())
        this.vPosition = varying(positionWorld)
        this.vNormal = varying(normalWorld)

        this.outputNode = Fn(() => {
            const noise = this.createNoise(this.vUv).mul(0.05)

            const baseGradient = smoothstep(
                this.uColorStop1.x.sub(0.9),
                this.uColorStop1.y.add(0.2),
                this.vUv.y.add(noise),
            )
            const baseColor = mix(this.uColor1, this.uColor2, baseGradient)

            const emissionGradient = smoothstep(
                this.uColorStop2.x,
                this.uColorStop2.y,
                this.vUv.y.add(noise),
            )
            const bottomEmission = smoothstep(0.3, 0.0, this.vUv.y).mul(0.8)

            const emission = this.uEmissionColor
                .mul(emissionGradient.add(bottomEmission))
                .mul(this.uEmissionStrength)

            const pulse = sin(this.uTime.mul(2.0)).mul(0.2).add(1.0)
            emission.mulAssign(pulse)

            const viewDir = normalize(cameraPosition.sub(this.vPosition))
            const fresnel = pow(
                float(1.0).sub(max(dot(normalize(this.vNormal), viewDir), 0.0)),
                3.0,
            )

            const finalColor = baseColor
                .add(emission)
                .add(fresnel.mul(this.uEmissionColor).mul(this.fresnelStrength))

            return vec4(finalColor, this.opacityNode)
        })()
    }

    private random(st: ShaderNodeObject<Node>) {
        const a = dot(st.xy, vec2(12.9898, 78.233)).mul(43758.5453123)
        return fract(sin(a))
    }

    private createNoise(vUv: ShaderNodeObject<Node>) {
        const noiseUv = vUv.mul(3.0)
        const noise = this.random(noiseUv.add(this.uTime.mul(0.1)))
        return noise
    }
}
