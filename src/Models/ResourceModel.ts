import type { RigidBody } from "@dimforge/rapier3d-compat"
import { Box3, Mesh, Object3D, Texture, Vector3 } from "three/webgpu"
import type { IGameObject } from "../Services/IGameObject"
import type { IResourceService } from "../Services/IResouceService"
import type { ISceneManager } from "../Services/ISceneManager"

export abstract class ResourceModel implements IGameObject {
    public modelGroup: Object3D | null = null
    protected mesh: Object3D | null = null
    public rigidBody: RigidBody | null = null
    private isAttachedToScene: boolean = false

    constructor(
        protected readonly resourcesManager: IResourceService,
        protected readonly sceneManager: ISceneManager,
        protected modelName: string = '',
        protected textureName: string = '',
        protected position: Vector3 = new Vector3(0, 0, 0),
        protected scale: Vector3 = new Vector3(1, 1, 1),
    ) {}

    public async initialize(addToScene: boolean = true): Promise<void> {
        await this.loadModel();
        await this.setupPhysics();
        this.onModelLoaded();

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

    public detachFromScene(): void {
        if (!this.modelGroup || !this.isAttachedToScene) {
            return
        }

        this.sceneManager.remove(this.modelGroup)
        this.isAttachedToScene = false
    }

    public setVisible(visible: boolean): void {
        if (!this.modelGroup) {
            return
        }

        this.modelGroup.visible = visible
    }

    protected async loadModel(): Promise<void> {
        const modelScene = this.resourcesManager.getItem(this.modelName)
        if (!modelScene) {
            throw new Error(
                `Model '${this.modelName}' not found in resources. Check sources.ts configuration.`,
            )
        }

        let actualModel: Object3D
        if (modelScene.scene && modelScene.scene instanceof Object3D) {
            actualModel = modelScene.scene
        } else if (modelScene instanceof Object3D) {
            actualModel = modelScene
        } else {
            console.warn(
                `Model '${this.modelName}' structure might be unexpected.`,
                modelScene,
            )
            actualModel = modelScene as unknown as Object3D
        }

        const clonedModel = actualModel.clone()
        this.setupModelStructure(clonedModel)

        if (this.modelGroup) {
            this.modelGroup.position.copy(this.position)
            this.modelGroup.scale.copy(this.scale)
        }
    }

    protected loadTexture(): Texture | null {
        if(this.textureName === '' || !this.textureName) {
            return null
        }
        const texture = this.resourcesManager.getItem(this.textureName)   
        if(!texture) {
            throw new Error(
                `Texture '${this.textureName}' not found in resources. Check sources.ts configuration.`,
            )
        }
        return texture as Texture
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        this.modelGroup = new Object3D()
        this.modelGroup.name = `${this.modelName}Group`

        this.mesh = clonedModel

        this.mesh.traverse((child) => {
            if (child instanceof Mesh) {
                child.castShadow = true
                child.receiveShadow = true
            }
        })

        this.modelGroup.add(this.mesh)
    }

    protected async setupPhysics(): Promise<void> {}
    protected onModelLoaded(): void {}
    public abstract update(deltaTime: number, alpha?: number): void;

    protected getModelBounds(): {
        size: Vector3
        center: Vector3
        box: Box3
    } {
        if (!this.mesh) {
            throw new Error("Model not loaded yet")
        }

        const box = new Box3().setFromObject(this.mesh)
        const size = box.getSize(new Vector3())
        const center = box.getCenter(new Vector3())

        return { size, center, box }
    }

    dispose(): void {
        this.detachFromScene()
    }
}
