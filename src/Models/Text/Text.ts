import type { Euler, Group, Vector3 } from "three/webgpu"
import { Fonts, type FontBuildOptions } from "@/Models/Fonts"
import type { IGameObject } from "@/Services/IGameObject"
import type { ISceneManager } from "@/Services/ISceneManager"

export interface TextOptions {
    text: string
    name?: string
    position?: Vector3
    rotation?: Euler
    visible?: boolean
    fontOptions?: FontBuildOptions
}

export class Text implements IGameObject {
    public modelGroup: Group | null = null
    private isAttachedToScene = false

    constructor(
        private readonly sceneManager: ISceneManager,
        private readonly options: TextOptions,
    ) {}

    public async initialize(addToScene: boolean = true): Promise<void> {
        if (!this.modelGroup) {
            const textGroup = await Fonts.build(this.options.text, {
                name: this.options.name,
                ...this.options.fontOptions,
            })

            textGroup.name = this.options.name ?? "TextGroup"

            if (this.options.position) {
                textGroup.position.copy(this.options.position)
            }

            if (this.options.rotation) {
                textGroup.rotation.copy(this.options.rotation)
            }

            textGroup.visible = this.options.visible ?? true
            this.modelGroup = textGroup
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
            Fonts.dispose(this.modelGroup)
        }

        this.modelGroup = null
        this.isAttachedToScene = false
    }
}
