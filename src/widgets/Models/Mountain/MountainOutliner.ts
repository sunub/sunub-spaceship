import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d-compat"
import { texture } from "three/tsl"
import type { Mesh, Texture } from "three/webgpu"
import { Object3D } from "three/webgpu"
import { MeshDefaultMaterial } from "@/widgets/Materials/MeshDefaultMaterial"
import type { Physics } from "@/widgets/Physics"
import { BaseModel } from "../BaseModel"

export class MountainOutliner extends BaseModel {
    private colliderMeshes: Mesh[] = []

    constructor() {
        super("mountainOutlinerModel")
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        this.modelGroup = new Object3D()
        this.modelGroup.name = `${this.modelName}Group`

        const mountainTexture = this.context.resources.items.mountainTexture as Texture

        this.mesh = clonedModel
        this.mesh.traverse((child) => {
            if ((child as Mesh).isMesh) {
                const mesh = child as Mesh

                const newMat = new MeshDefaultMaterial({
                    colorNode: texture(mountainTexture),
                    hasFog: true,
                })

                mesh.material = newMat
                mesh.castShadow = true
                mesh.receiveShadow = true
                mesh.frustumCulled = false
                mesh.material.transparent = true
                mesh.material.opacity = 0
                mesh.name = this.modelName
            }
        })

        this.modelGroup.add(this.mesh)
    }

    protected async setupPhysics(): Promise<void> {
        if (!this.rigidBody && this.context?.physics && this.mesh) {
            this.createPhysicsBody(this.context.physics)
        }
    }

    private createPhysicsBody(physics: Physics) {
        if (!this.modelGroup || !this.mesh) {
            return
        }

        // Create a fixed rigid body at (0,0,0) with no rotation
        const rigidBodyDesc = RigidBodyDesc.fixed()
            .setTranslation(0, 0, 0)
            .setRotation({ x: 0, y: 0, z: 0, w: 1 })

        this.rigidBody = physics.world.createRigidBody(rigidBodyDesc)

        const targetMeshes =
            this.colliderMeshes.length > 0 ? this.colliderMeshes : []

        // Fallback if no meshes found in colliderMeshes (unlikely if traverse worked)
        if (targetMeshes.length === 0) {
            this.mesh.traverse((c) => {
                if ((c as Mesh).isMesh) targetMeshes.push(c as Mesh)
            })
        }

        targetMeshes.forEach((mesh) => {
            const geometry = mesh.geometry
            if (!geometry) return

            // Ensure matrix world is up to date
            if (this.modelGroup) {
                this.modelGroup.updateMatrixWorld(true)
            }
            mesh.updateMatrixWorld(true)

            // Clone geometry and apply matrix to bake transformations
            const clonedGeom = geometry.clone()
            clonedGeom.applyMatrix4(mesh.matrixWorld)

            const positions = clonedGeom.attributes.position.array
            const indices = clonedGeom.index
                ? clonedGeom.index.array
                : undefined

            let indicesArray: Uint32Array
            if (indices) {
                indicesArray = new Uint32Array(indices)
            } else {
                const vertexCount = positions.length / 3
                indicesArray = new Uint32Array(vertexCount)
                for (let i = 0; i < vertexCount; i++) {
                    indicesArray[i] = i
                }
            }

            // Create Trimesh Collider
            const colliderDesc = ColliderDesc.trimesh(
                positions as Float32Array,
                indicesArray,
            )

            colliderDesc.setFriction(1.0)
            colliderDesc.setRestitution(0.1) // Low restitution for mountains
            colliderDesc.setCollisionGroups((0x0002 << 16) | 0xffff)

            if (this.rigidBody) {
                physics.world.createCollider(colliderDesc, this.rigidBody)
            }

            clonedGeom.dispose()
        })
    }

    public update(_: number) {}
}
