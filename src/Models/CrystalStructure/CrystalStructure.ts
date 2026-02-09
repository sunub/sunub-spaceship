import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d-compat"
import { texture } from "three/tsl"
import { Box3, Mesh, Object3D, Vector3 } from "three/webgpu"
import { inject, injectable } from "inversify"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { IResourceService } from "@/Services/IResouceService"
import type { ISceneManager } from "@/Services/ISceneManager"
import type { IPhysicsService } from "@/Services/IPhysicsService"
import type Time from "@/utils/Time"
import { MeshDefaultMaterial } from "../../Materials/MeshDefaultMaterial"
import { ResourceModel } from "../ResourceModel"

@injectable()
export class CrystalStructure extends ResourceModel {
    private floatBrightCrystals: Mesh[] = []
    private floatMetals: Mesh[] = []
    private initialCrystalY: Map<number, number> = new Map()
    private initialMetalScale: Map<number, Vector3> = new Map()

    constructor(
        @inject(GAME_CONTEXT.SERVICE.ResourceService) resourcesManager: IResourceService,
        @inject(GAME_CONTEXT.MANAGER.SceneManager) sceneManager: ISceneManager,
        @inject(GAME_CONTEXT.SERVICE.PhysicsService) private readonly physicsService: IPhysicsService,
        @inject(GAME_CONTEXT.UTILITY.Time) private readonly time: Time,
    ) {
        super(resourcesManager, sceneManager, "crystalStructure")
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        this.modelGroup = new Object3D()
        this.modelGroup.name = "CrystalStructureGroup"

        clonedModel.updateMatrixWorld(true)

        const bakedBaseTexture = this.resourcesManager.getItem(
            "crystalStructureBaseTexture",
        )
        const bakedFloatMetalTexture = this.resourcesManager.getItem(
            "crystalStructureFloatMetalTexture",
        )

        clonedModel.traverse((child) => {
            if (child instanceof Mesh) {
                if (child.name.includes("ground_base")) {
                    const newMat = new MeshDefaultMaterial({
                        colorNode: texture(bakedBaseTexture),
                        emissionNode: texture(bakedBaseTexture).mul(2.5),
                        hasCoreShadows: false,
                        hasLightBounce: false,
                    })
                    child.material = newMat
                } else if (child.name.includes("float_metal")) {
                    const newMat = new MeshDefaultMaterial({
                        colorNode: texture(bakedFloatMetalTexture),
                        emissionNode: texture(bakedFloatMetalTexture).mul(2.5),
                        hasCoreShadows: false,
                        hasLightBounce: false,
                    })
                    child.material = newMat
                    this.floatMetals.push(child as Mesh)
                    this.initialMetalScale.set(child.id, child.scale.clone())
                } else if (child.name.includes("bright_crystal")) {
                    this.floatBrightCrystals.push(child as Mesh)
                    this.initialCrystalY.set(child.id, child.position.y)
                }

                child.castShadow = true
                child.receiveShadow = true
            }
        })

        this.modelGroup.add(clonedModel)
        // super class adds modelGroup to scene
    }

    protected async setupPhysics(): Promise<void> {
        if (!this.rigidBody && this.modelGroup) {
            this.createPhysicsBody()
        }
    }

    private createPhysicsBody() {
        if (!this.modelGroup) {
            return
        }
        const box = new Box3().setFromObject(this.modelGroup)

        const size = new Vector3()
        box.getSize(size)

        const center = new Vector3()
        box.getCenter(center)

        const rigidBodyDesc = RigidBodyDesc.fixed()
            .setTranslation(this.position.x, this.position.y, this.position.z)
            .setRotation({ x: 0, y: 0, z: 0, w: 1 })

        this.rigidBody = this.physicsService.createPhysicsBody(rigidBodyDesc)

        const radius = Math.max(size.x, size.z) / 2
        const halfHeight = size.y / 2

        const colliderDesc = ColliderDesc.cylinder(halfHeight, radius)

        colliderDesc.setTranslation(center.x, center.y, center.z)

        colliderDesc.setFriction(1.0)
        colliderDesc.setRestitution(0.1)

        colliderDesc.setCollisionGroups((0x0002 << 16) | 0xffff)

        this.physicsService.createCollider(colliderDesc, this.rigidBody)
    }

    public update(_deltaTime: number): void {
        const delta = this.time.delta
        const timeVal = this.time.elapsed * 0.001 // assuming time is ms needed in seconds usually?
        // Original logic: this.time += this.context.time.delta
        // But here loop uses this.time.
        // It's ambiguous if 'time' property of CrystalStructure was "elapsed time" or just accumulator.
        // Assuming elapsed time is what matters for sin wave.

        this.floatBrightCrystals.forEach((crystal, index) => {
            crystal.rotation.y += delta * 0.001

            const initialY = this.initialCrystalY.get(crystal.id) || 0
            const offset = Math.sin(timeVal * 2 + index) * 0.001
            crystal.position.y = initialY + offset
        })
    }
}
