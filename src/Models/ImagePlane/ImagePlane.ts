import { inject, injectable } from "inversify"
import { color, texture } from "three/tsl"
import {
    DoubleSide,
    Group,
    Mesh,
    MeshBasicMaterial,
    PlaneGeometry,
    type Euler,
    type Texture,
    type Vector3,
} from "three/webgpu"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import { MeshDefaultMaterial } from "@/Materials/MeshDefaultMaterial"
import type { IGameObject } from "@/Services/IGameObject"
import type { IResourceService } from "@/Services/IResouceService"
import type { ISceneManager } from "@/Services/ISceneManager"

export interface ImagePlaneOptions {
    textureName: string
    name?: string
    position?: Vector3
    rotation?: Euler
    visible?: boolean
    width?: number
    height?: number
    renderOrder?: number
    depthWrite?: boolean
    depthTest?: boolean
}

@injectable()
export class ImagePlane implements IGameObject {
    public modelGroup: Group | null = null
    private isAttachedToScene = false

    constructor(
        @inject(GAME_CONTEXT.MANAGER.SceneManager)
        private readonly sceneManager: ISceneManager,
        @inject(GAME_CONTEXT.SERVICE.ResourceService)
        private readonly resourcesManager: IResourceService,
        private readonly options: ImagePlaneOptions,
    ) { }

    public async initialize(addToScene: boolean = true): Promise<void> {
        if (!this.modelGroup) {
            const textureMap = this.resourcesManager.getItem<Texture>(
                this.options.textureName,
            )
            const { width, height } = this.resolveDimensions(textureMap)

            const plane = new Mesh(
                new PlaneGeometry(width, height),
                this.createMaterial(textureMap),
            )
            plane.castShadow = false
            plane.receiveShadow = false
            plane.frustumCulled = false
            plane.renderOrder = this.options.renderOrder ?? 980

            const group = new Group()
            group.name = this.options.name ?? "ImagePlane"
            group.add(plane)

            if (this.options.position) {
                group.position.copy(this.options.position)
            }

            if (this.options.rotation) {
                group.rotation.copy(this.options.rotation)
            }

            group.visible = this.options.visible ?? true
            this.modelGroup = group
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

    public update(_deltaTime: number): void { }

    public dispose(): void {
        if (this.modelGroup) {
            this.sceneManager.remove(this.modelGroup)
            this.modelGroup.traverse((child) => {
                if (!(child instanceof Mesh)) {
                    return
                }

                child.geometry.dispose()

                const material = child.material
                if (Array.isArray(material)) {
                    material.forEach((entry) => {
                        entry.dispose()
                    })
                    return
                }

                material.dispose()
            })
        }

        this.modelGroup = null
        this.isAttachedToScene = false
    }

    private resolveDimensions(textureMap: Texture) {
        const source = textureMap.image as
            | { width?: number; height?: number }
            | undefined
        const imageWidth = source?.width ?? 1
        const imageHeight = source?.height ?? 1
        const aspectRatio = imageWidth / Math.max(imageHeight, 1)
        const width = this.options.width ?? 2.1
        const height = this.options.height ?? width / aspectRatio

        return { width, height }
    }

    private createMaterial(textureMap: Texture) {
        const depthWrite = this.options.depthWrite ?? false
        const depthTest = this.options.depthTest ?? false

        try {
            return new MeshDefaultMaterial({
                colorNode: color(0x000000),
                emissionNode: color(0xffffff),
                alphaNode: texture(textureMap).a,
                transparent: true,
                depthWrite,
                depthTest,
                side: DoubleSide,
                shadowSide: DoubleSide,
                hasCoreShadows: false,
                hasDropShadows: false,
                hasLightBounce: false,
                hasFog: false,
                reorientDoubleSidedNormals: false,
            })
        } catch {
            return new MeshBasicMaterial({
                map: textureMap,
                transparent: true,
                depthWrite,
                depthTest,
                side: DoubleSide,
            })
        }
    }
}
