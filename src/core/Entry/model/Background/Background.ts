import {
    color,
    cos,
    dot,
    Fn,
    float,
    floor,
    fract,
    mix,
    PI,
    sin,
    texture,
    uniform,
    uv,
    vec2,
    vec4,
} from "three/tsl" // [중요] 수학 함수들 추가 임포트
import {
    BackSide,
    BoxGeometry,
    type Color,
    Mesh,
    MeshBasicMaterial,
    RepeatWrapping,
    type Texture,
    type Vector2,
} from "three/webgpu"
import type { GameContext, IGameObject } from "@/core/GameContext"

const ROTATION_SPEED = 0.01

export class Background implements IGameObject {
    public bloomColor: UniformNode<Color>
    public bloomIntensity: UniformNode<number>
    public starsOffset: UniformNode<Vector2>
    public starTexture: Texture

    public mesh!: Mesh

    constructor(private context: GameContext) {
        this.starTexture = context.resources.items.behindeTheScene
        this.starTexture.wrapS = RepeatWrapping
        this.starTexture.wrapT = RepeatWrapping

        this.bloomColor = uniform(color("#050520"))
        this.bloomIntensity = uniform(0.25)
        this.starsOffset = uniform(vec2(0))
    }

    public async initialize() {
        const geometry = new BoxGeometry(500, 500, 500)
        const material = new MeshBasicMaterial({
            side: BackSide,
            wireframe: false,
        })

        const random2D = Fn(([v]: [any]) => {
            return fract(sin(dot(v, vec2(12.9898, 78.233))).mul(43758.5453))
        })

        material.outputNode = Fn(() => {
            const strength = uniform(0.2)
            const tiling = float(10) // 타일링 횟수 (4x4)

            const globalUv = uv().mul(tiling).add(this.starsOffset)

            const gridId = floor(globalUv)
            const gridUv = fract(globalUv)

            const rnd = random2D(gridId)
            const angle = floor(rnd.mul(4)).mul(PI.div(2))

            const c = cos(angle)
            const s = sin(angle)
            const centeredUv = gridUv.sub(0.5)

            const rotatedUv = vec2(
                centeredUv.x.mul(c).sub(centeredUv.y.mul(s)),
                centeredUv.x.mul(s).add(centeredUv.y.mul(c)),
            ).add(0.5)

            const starsColor = texture(this.starTexture, rotatedUv)
                .rgb.pow(2)
                .mul(5)

            const bloomColor = this.bloomColor.mul(this.bloomIntensity)
            const finalColor = mix(starsColor, bloomColor, strength)
            return vec4(finalColor, 1)
        })()

        this.mesh = new Mesh(geometry, material)
        this.mesh.position.set(0, 10, 0)
        this.context.scene.add(this.mesh)
    }

    public update(deltaTime: number) {
        const deltaSeconds = deltaTime * 0.001
        this.mesh.rotation.y += deltaSeconds * ROTATION_SPEED
    }

    public dispose() {
        this.context.scene.remove(this.mesh)
    }
}
