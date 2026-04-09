import type { Euler, Group, Vector3 } from "three/webgpu"
import type { SvgBuildOptions } from "@/Models/Svgs"
import { Svgs } from "@/Models/Svgs"
import type { IGameObject } from "@/Services/IGameObject"
import type { ISceneManager } from "@/Services/ISceneManager"

export interface SvgOptions {
    svgUrl: string
    name?: string
    position?: Vector3
    rotation?: Euler
    visible?: boolean
    svgOptions?: SvgBuildOptions
}

export class Svg implements IGameObject {
    public modelGroup: Group | null = null
    private isAttachedToScene = false

    constructor(
        private readonly sceneManager: ISceneManager,
        private readonly options: SvgOptions,
    ) {}

    public async initialize(addToScene: boolean = true): Promise<void> {
        if (!this.modelGroup) {
            const svgGroup = await Svgs.build(this.options.svgUrl, {
                name: this.options.name,
                ...this.options.svgOptions,
            })

            svgGroup.name = this.options.name ?? "SvgGroup"

            if (this.options.position) {
                svgGroup.position.copy(this.options.position)
            }

            if (this.options.rotation) {
                svgGroup.rotation.copy(this.options.rotation)
            }

            svgGroup.visible = this.options.visible ?? true
            this.modelGroup = svgGroup
        }

        if (addToScene) {
            this.attachToScene()
        }
    }

    public attachToScene(): void {
        if (!this.modelGroup || this.isAttachedToScene) {
            return
        }

        this.sceneManager.add(this.modelGroup)
        this.isAttachedToScene = true
    }

    public setVisible(visible: boolean): void {
        if (!this.modelGroup) {
            return
        }

        this.modelGroup.visible = visible
    }

    public update(_deltaTime: number): void {}

    public dispose(): void {
        if (this.modelGroup) {
            this.sceneManager.remove(this.modelGroup)
            Svgs.dispose(this.modelGroup)
        }

        this.modelGroup = null
        this.isAttachedToScene = false
    }
}
