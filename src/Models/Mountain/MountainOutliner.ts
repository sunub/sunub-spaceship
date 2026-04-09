import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d-compat"
import { inject, injectable } from "inversify"
import { texture } from "three/tsl"
import type { Mesh } from "three/webgpu"
import { Object3D } from "three/webgpu"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import { MeshDefaultMaterial } from "@/Materials/MeshDefaultMaterial"
import type { IPhysicsService } from "@/Services/IPhysicsService"
import type { IResourceService } from "@/Services/IResouceService"
import type { ISceneManager } from "@/Services/ISceneManager"
import { ResourceModel } from "../ResourceModel"

@injectable()
export class MountainOutliner extends ResourceModel {
    private colliderMeshes: Mesh[] = []

    constructor(
        @inject(GAME_CONTEXT.MANAGER.SceneManager) sceneManager: ISceneManager,
        @inject(GAME_CONTEXT.SERVICE.ResourceService)
        resourceService: IResourceService,
        @inject(GAME_CONTEXT.SERVICE.PhysicsService)
        private readonly physicsService: IPhysicsService,
    ) {
        super(
            resourceService,
            sceneManager,
            "mountainOutlinerModel",
            "mountainTexture",
        )
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        this.modelGroup = new Object3D()
        this.modelGroup.name = `${this.modelName}Group`

        const mountainTexture = this.loadTexture()
        if (mountainTexture === null) {
            throw new Error("Mountain texture not found")
        }

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
        if (!this.modelGroup || !this.mesh) {
            return
        }

        // Create a fixed rigid body at (0,0,0) with no rotation
        const rigidBodyDesc = RigidBodyDesc.fixed()
            .setTranslation(0, 0, 0)
            .setRotation({ x: 0, y: 0, z: 0, w: 1 })

        const rigidBody = this.physicsService.createPhysicsBody(rigidBodyDesc)

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

            this.physicsService.createCollider(colliderDesc, rigidBody)
            clonedGeom.dispose()
        })
    }

    public update(_: number) {}
}
