import type { RigidBody } from "@dimforge/rapier3d-compat"
import { Box3, Mesh, Object3D, Vector3 } from "three/webgpu"
import type { GameContext, IGameObject } from "../../core/GameContext"

export abstract class BaseModel implements IGameObject {
    protected context!: GameContext
    public modelGroup: Object3D | null = null
    protected mesh: Object3D | null = null
    public rigidBody: RigidBody | null = null

    constructor(
        protected modelName: string,
        protected position: Vector3 = new Vector3(0, 0, 0),
    ) {}

    async initialize(
        context: GameContext,
        addToScene: boolean = true,
    ): Promise<void> {
        this.context = context
        await this.loadModel(addToScene)
        await this.setupPhysics()
        this.onModelLoaded()
    }

    protected async loadModel(addToScene: boolean = true): Promise<void> {
        if (!this.context) {
            throw new Error("Context not available during model loading")
        }

        const { scene, resources } = this.context

        // Resources에서 모델 가져오기
        const modelScene = resources.items[this.modelName]
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
            if (addToScene) {
                scene.add(this.modelGroup)
            }
        }
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

    protected async setupPhysics(): Promise<void> {
        // 기본적으로는 물리 설정 없음
        // 하위 클래스에서 필요시 오버라이드
    }

    protected onModelLoaded(): void {
        // 하위 클래스에서 구현
    }

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

    abstract update(deltaTime: number): void

    dispose(): void {
        // 물리 정리
        if (this.rigidBody && this.context) {
            this.context.physics.world.removeRigidBody(this.rigidBody)
        }

        // 3D 객체 정리
        if (this.modelGroup && this.context) {
            this.context.scene.remove(this.modelGroup)
        }
    }
}
