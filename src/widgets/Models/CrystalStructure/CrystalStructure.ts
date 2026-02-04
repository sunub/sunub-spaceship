import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d-compat"
import { texture } from "three/tsl"
import { Box3, Mesh, Object3D, Vector3 } from "three/webgpu"
import type Resources from "@/utils/Resources"
import type { Physics } from "@/widgets/Physics"
import { MeshDefaultMaterial } from "../../Materials/MeshDefaultMaterial"
import { BaseModel } from "../BaseModel"

export class CrystalStructure extends BaseModel {
    private resouce!: Resources
    private floatBrightCrystals: Mesh[] = []
    private floatMetals: Mesh[] = []
    private initialCrystalY: Map<number, number> = new Map()
    private initialMetalScale: Map<number, Vector3> = new Map()
    private time: number = 0

    constructor(position: Vector3 = new Vector3(0, 0, 0)) {
        super("crystalStructure", position)
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        if (!this.context) {
            return
        }
        this.resouce = this.context.resources

        this.modelGroup = new Object3D()
        this.modelGroup.name = "CrystalStructureGroup"

        clonedModel.updateMatrixWorld(true)

        const bakedBaseTexture = this.resouce.getItem(
            "crystalStructureBaseTexture",
        )
        const bakedFloatMetalTexture = this.resouce.getItem(
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

        this.context.scene.add(this.modelGroup)
    }

    protected async setupPhysics(): Promise<void> {
        if (!this.rigidBody && this.context?.physics && this.modelGroup) {
            this.createPhysicsBody(this.context.physics)
        }
    }

    private createPhysicsBody(physics: Physics) {
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

        this.rigidBody = physics.world.createRigidBody(rigidBodyDesc)

        const radius = Math.max(size.x, size.z) / 2
        const halfHeight = size.y / 2

        const colliderDesc = ColliderDesc.cylinder(halfHeight, radius)

        colliderDesc.setTranslation(center.x, center.y, center.z)

        colliderDesc.setFriction(1.0)
        colliderDesc.setRestitution(0.1)

        colliderDesc.setCollisionGroups((0x0002 << 16) | 0xffff)
        physics.world.createCollider(colliderDesc, this.rigidBody)
    }

    public update(): void {
        this.time += this.context.time.delta

        this.floatBrightCrystals.forEach((crystal, index) => {
            crystal.rotation.y += this.context.time.delta * 0.001

            const initialY = this.initialCrystalY.get(crystal.id) || 0
            const offset = Math.sin(this.time * 2 + index) * 0.001
            crystal.position.y = initialY + offset
        })
    }
}
