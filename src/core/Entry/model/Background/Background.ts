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
} from "three/tsl"
import {
    BackSide,
    BoxGeometry,
    type Color,
    Mesh,
    MeshBasicMaterial,
    RepeatWrapping,
    type Texture,
    type Vector2,
    Object3D,
    Vector3,
} from "three/webgpu"
import { ResourceModel } from "@/Models"
import { inject } from "inversify"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { IResourceService } from "@/Services/IResouceService"
import type { ISceneManager } from "@/Services/ISceneManager"

const ROTATION_SPEED = 0.01

export class Background extends ResourceModel {
    public bloomColor!: UniformNode<Color>
    public bloomIntensity!: UniformNode<number>
    public starsOffset!: UniformNode<Vector2>
    public starTexture!: Texture

    constructor(
        @inject(GAME_CONTEXT.SERVICE.ResourceService) resourcesManager: IResourceService,
        @inject(GAME_CONTEXT.MANAGER.SceneManager) sceneManager: ISceneManager,
        position: Vector3 = new Vector3(0, 10, 0),
    ) {
        super(resourcesManager, sceneManager, "background", "", position)
    }

    // Override loadModel since we don't load a GLTF here
    protected async loadModel(addToScene: boolean = true): Promise<void> {
        this.starTexture = this.resourcesManager.getItem("behindeTheScene") as Texture
        if (!this.starTexture) {
            console.error("Background texture 'behindeTheScene' not found.")
            return
        }
        this.starTexture.wrapS = RepeatWrapping
        this.starTexture.wrapT = RepeatWrapping

        this.bloomColor = uniform(color("#050520"))
        this.bloomIntensity = uniform(0.25)
        this.starsOffset = uniform(vec2(0))

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

        // Setup modelGroup structure expected by ResourceModel
        this.modelGroup = new Object3D()
        this.modelGroup.name = `${this.modelName}Group`
        this.modelGroup.add(this.mesh)

        this.modelGroup.position.copy(this.position)

        if (addToScene) {
            this.sceneManager.add(this.modelGroup)
        }
    }

    protected setupModelStructure(): void {
        console.warn("Background setupModelStructure should not be called")
    }

    public update(deltaTime: number): void {
        if (this.mesh) {
            const deltaSeconds = deltaTime * 0.001
            this.mesh.rotation.y += deltaSeconds * ROTATION_SPEED
        }
    }

    public dispose(): void {
        super.dispose()
        if (this.mesh instanceof Mesh) {
            this.mesh.geometry.dispose()
            if (Array.isArray(this.mesh.material)) {
                this.mesh.material.forEach(m => m.dispose())
            } else {
                this.mesh.material.dispose()
            }
        }
    }
}
